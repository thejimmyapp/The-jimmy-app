import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

export async function runGuestJourneys(origin, report) {
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  const browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true }
    : { channel: "chrome", headless: true });
  const runs = [];
  const allActions = [];
  const allNetwork = [];
  const saveEvidence = () => {
    writeFileSync(join(report, "measurements.json"), JSON.stringify(runs, null, 2) + "\n");
    writeFileSync(join(report, "action-log.json"), JSON.stringify(allActions, null, 2) + "\n");
    writeFileSync(join(report, "network-summary.json"), JSON.stringify(allNetwork, null, 2) + "\n");
  };
  try {
    for (const layout of ["default", "study"]) {
      for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
        const name = `${layout}-${viewport.width}x${viewport.height}`;
        const directory = join(report, name);
        mkdirSync(directory, { recursive: true });
        const run = { name, layout, viewport, stage: "landing", moments: [], passed: false };
        runs.push(run);
        const context = await browser.newContext({ viewport, colorScheme: "dark", deviceScaleFactor: 1, serviceWorkers: "block" });
        const forbiddenNetwork = [];
        await context.route("**/*", (route) => {
          if (new URL(route.request().url()).origin !== origin) {
            forbiddenNetwork.push(route.request().url());
            return route.abort();
          }
          return route.continue();
        });
        await context.routeWebSocket("**/*", (route) => {
          if (route.url().replace(/^ws/, "http").startsWith(origin + "/")) route.connectToServer();
          else { forbiddenNetwork.push(route.url()); route.close(); }
        });
        const page = await context.newPage();
        page.setDefaultTimeout(8000);
        const network = [];
        const requestRecords = new WeakMap();
        const bodyReads = [];
        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("request", (request) => {
          const path = new URL(request.url()).pathname;
          if (!path.startsWith("/api/")) return;
          const record = { run: name, at: new Date().toISOString(), method: request.method(), path, status: null };
          requestRecords.set(request, record); network.push(record); allNetwork.push(record);
        });
        page.on("response", (response) => {
          const record = requestRecords.get(response.request());
          if (!record) return;
          record.status = response.status();
          if (record.path === "/api/guests" || (record.path === "/api/moments" && record.method === "POST")) {
            bodyReads.push(response.json().then((body) => { record.response = body; }));
          }
        });
        page.on("requestfailed", (request) => {
          const record = requestRecords.get(request);
          if (record) record.failure = request.failure();
        });
        const log = (action, data = {}) => allActions.push({ run: name, at: new Date().toISOString(), action, ...data });
        const shot = async (step) => {
          await page.screenshot({ path: join(directory, `${step}.png`) });
        };
        const click = async (label, target) => {
          run.stage = label;
          const beforeClickRect = await target.boundingBox();
          await target.click();
          log("pointer-click", { target: label, beforeClickRect });
        };
        const openMoment = () => layout === "study"
          ? page.locator(".study-underboard").getByRole("button", { name: "Save moment", exact: true })
          : page.getByRole("button", { name: "Save current learning moment", exact: true });
        const wizard = page.getByRole("article", { name: "Learning moment wizard steps 1 through 4" });
        try {
          await page.goto(origin + (layout === "study" ? "/?ui=study" : "/"), { waitUntil: "networkidle" });
          await shot("slide-1");
          for (let slide = 2; slide <= 4; slide++) {
            await click(`slide-${slide}`, page.getByRole("button", { name: "Next slide", exact: true }));
            await shot(`slide-${slide}`);
          }
          const started = Date.now();
          run.startedAt = new Date(started).toISOString();
          await click("start", page.getByRole("button", { name: "Start", exact: true }));
          await page.getByText("0/3 learning moments published", { exact: true }).waitFor();
          assert.equal(await page.getByText("5:00", { exact: true }).count(), 1);
          await shot("quest-start");
          const cards = page.getByRole("option");
          await cards.nth(2).waitFor();
          assert.equal(await cards.count(), 3);
          run.cards = await cards.allInnerTexts();
          for (const [index, label] of ["2300+", "1900–2300", "1400–1900"].entries()) {
            assert(run.cards[index].startsWith(label));
          }
          await shot("matchup-rows");
          run.stage = "card-selection";
          const [replay] = await Promise.all([
            page.waitForResponse((response) => /\/api\/chesscom\/matches\/\d+\/replay$/.test(response.url()), { timeout: 8000 }),
            click("card-selection", cards.first()),
          ]);
          assert.equal(replay.status(), 200);
          run.replay = { path: new URL(replay.url()).pathname, status: replay.status(), card: run.cards[0] };
          await openMoment().waitFor();
          await shot("replay");
          const seenMoves = new Set();
          for (let moment = 1; moment <= 3; moment++) {
            if (layout === "study") {
              await click(`moment-${moment}-next`, page.getByRole("button", { name: "Next move", exact: true }));
            } else {
              run.stage = `moment-${moment}-wheel`;
              await page.locator(".board-layout-primary .board").hover();
              await page.mouse.wheel(0, 100);
              log("pointer-wheel", { deltaY: 100, target: "primary board" });
              // Allow the browser's wheel event and the existing 120 ms scrub throttle to settle.
              await page.waitForTimeout(160);
            }
            await click(`moment-${moment}-open`, openMoment());
            await wizard.waitFor();
            if (moment === 1) {
              const cancel = wizard.getByRole("button", { name: "Cancel", exact: true });
              run.cancel = await cancel.evaluate((element) => ({ rect: element.getBoundingClientRect().toJSON(), disabled: element.disabled, inert: !!element.closest("[inert]") }));
              assert(!run.cancel.disabled && !run.cancel.inert);
              await shot("cancel-step-1");
              await click("cancel-step-1", cancel);
              await wizard.waitFor({ state: "detached" });
              run.cancel.closed = true;
              await shot("cancel-closed");
              await click("reopen-after-cancel", openMoment());
            }
            await shot(`moment-${moment}-step-1`);
            const move = wizard.locator(".wizard-step__moves button");
            assert.equal(await move.count(), 1);
            const moveText = await move.innerText();
            assert(!seenMoves.has(moveText), `Replay did not advance: ${moveText}`);
            seenMoves.add(moveText);
            await click(`moment-${moment}-move-token`, move);
            await shot(`moment-${moment}-step-2`);
            const tile = wizard.getByRole("button", { name: "1 · ! · good", exact: true });
            await click(`moment-${moment}-glyph-tile`, tile);
            assert.equal(await tile.getAttribute("aria-pressed"), "true");
            run.stage = `moment-${moment}-step-3-geometry`;
            const board = wizard.locator(".wizard-step__board-moves .board");
            const geometry = await board.evaluate((element) => ({
              board: element.getBoundingClientRect().toJSON(),
              label: element.getAttribute("aria-label"),
              heading: element.closest(".board-panel").querySelector(".board-heading").innerText,
              inert: !!element.closest("[inert]"),
              squares: [...element.querySelectorAll("button")].map((square) => ({ label: square.getAttribute("aria-label"), rect: square.getBoundingClientRect().toJSON() })),
            }));
            const measurement = { number: moment, moveText, geometry };
            run.moments.push(measurement);
            await shot(`moment-${moment}-step-3`);
            assert(geometry.board.width >= 400 && geometry.board.height >= 400, `Alternative board ${geometry.board.width}×${geometry.board.height} is below 400 px`);
            assert.equal(geometry.squares.length, 64);
            assert(geometry.squares.every((square) => square.rect.width >= 45 && square.rect.height >= 45), "Alternative squares below 45 px");
            assert(!geometry.inert);
            const white = geometry.heading.includes("White to move");
            assert(white || geometry.heading.includes("Black to move"));
            const rank = white ? "2" : "7";
            const piece = white ? "P" : "p";
            const squares = new Set(geometry.squares.map((square) => square.label));
            const file = ["d", "e", "c", "a", "h", "b", "g", "f"].find((candidate) =>
              squares.has(`${candidate}${rank} ${piece}`) && squares.has(`${candidate}${white ? "3" : "6"}`)
              && !moveText.includes(`${candidate}${white ? "4" : "5"}`) && !moveText.includes(`${candidate}${white ? "3" : "6"}`));
            assert(file, "No suitable fixture pawn found through the rendered board");
            const from = `${file}${rank} ${piece}`;
            await click(`moment-${moment}-alternative-source`, board.getByRole("button", { name: from, exact: true }));
            const targets = board.locator(".legal-target");
            await targets.first().waitFor();
            const destinations = await targets.evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")));
            const to = destinations.find((label) => label === `${file}${white ? "4" : "5"}`) ?? destinations[0];
            assert(to, "No legal destination exposed by the rendered board");
            await click(`moment-${moment}-alternative-destination`, board.getByRole("button", { name: to, exact: true }));
            await wizard.getByRole("heading", { name: /^Instead, play (?!___)/ }).waitFor();
            measurement.alternative = { from, to, heading: await wizard.locator("#wizard-step-3-title").innerText() };
            const answer = wizard.getByRole("textbox", { name: "Written answer after Because", exact: true });
            await click(`moment-${moment}-answer`, answer);
            await answer.pressSequentially(`Offline guest journey ${name}, moment ${moment}: the alternative contests the centre.`);
            log("type-answer", { moment });
            const save = wizard.getByRole("button", { name: "Save moment", exact: true });
            let saveBox = await save.boundingBox();
            for (let scroll = 0; saveBox && saveBox.y + saveBox.height > viewport.height && scroll < 3; scroll++) {
              await answer.hover(); await page.mouse.wheel(0, 200); await page.waitForTimeout(80);
              log("pointer-wheel", { deltaY: 200, target: "wizard answer" });
              saveBox = await save.boundingBox();
            }
            assert(saveBox && saveBox.x >= 0 && saveBox.y >= 0 && saveBox.x + saveBox.width <= viewport.width && saveBox.y + saveBox.height <= viewport.height, "Save must be inside the viewport before clicking");
            measurement.saveRect = saveBox;
            await shot(`moment-${moment}-step-4`);
            const [saved] = await Promise.all([
              page.waitForResponse((response) => new URL(response.url()).pathname === "/api/moments" && response.request().method() === "POST", { timeout: 8000 }),
              click(`moment-${moment}-save`, save),
            ]);
            assert.equal(saved.status(), 201);
            measurement.response = await saved.json();
            measurement.elapsedSeconds = (Date.now() - started) / 1000;
            assert(measurement.elapsedSeconds < 300, "The unchanged five-minute window expired");
            await page.getByText(`${moment}/3 learning moments published`, { exact: true }).waitFor();
            await shot(`moment-${moment}-saved`);
            console.log(`${name}: moment ${moment} saved 201 (ID ${measurement.response.private_moment.id}) at ${measurement.elapsedSeconds.toFixed(2)} s`);
          }
          run.stage = "completion";
          await page.getByText("[COPY-PLACEHOLDER] Quest complete", { exact: true }).waitFor();
          run.completionCopy = "[COPY-PLACEHOLDER] Quest complete\n3/3 learning moments published";
          await page.waitForLoadState("networkidle");
          await Promise.all(bodyReads);
          run.guest = network.find((entry) => entry.path === "/api/guests").response;
          run.completedGuest = network.filter((entry) => entry.path === "/api/guests").at(-1).response;
          assert.equal(run.guest.saved_moment_count, 0);
          assert.equal(run.completedGuest.saved_moment_count, 3);
          assert.equal(run.completedGuest.completed, true);
          assert.equal(run.completedGuest.guest_number, run.guest.guest_number);
          const saves = network.filter((entry) => entry.path === "/api/moments" && entry.method === "POST");
          assert.equal(saves.length, 3);
          assert(saves.every((entry) => entry.status === 201));
          assert(network.every((entry) => entry.status >= 200 && entry.status < 300 && !entry.failure), "An API request failed");
          assert.equal(network.filter((entry) => entry.path === "/api/guests/reset" || entry.path === "/api/accounts/claim").length, 0);
          assert.deepEqual(forbiddenNetwork, []);
          assert.deepEqual(pageErrors, []);
          await shot("complete");
          run.passed = true;
          console.log(`${name}: PASS guest #${run.guest.guest_number}, 3/3 complete, Cancel and tile clicks verified`);
        } catch (error) {
          run.error = String(error.stack ?? error);
          run.forbiddenNetwork = forbiddenNetwork;
          run.pageErrors = pageErrors;
          await shot("FAILED").catch(() => {});
          throw new Error(`${name} failed at ${run.stage}: ${error.message}`, { cause: error });
        } finally {
          await Promise.allSettled(bodyReads);
          await context.close();
          saveEvidence();
        }
      }
    }
    assert.equal(new Set(runs.map((run) => run.guest.guest_number)).size, 4, "Each context must create a fresh guest");
  } finally {
    await browser.close();
    saveEvidence();
  }
}
