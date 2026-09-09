import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, "../..");
const reportDir = process.env.USAB_REPORT_DIR ?? resolve(frontend, "../reports/USAB-01");
const fixture = JSON.parse(readFileSync(join(here, "starting-position.json"), "utf8"));
const afterD4 = structuredClone(fixture);
afterD4.board[6][3] = "";
afterD4.board[4][3] = "P";
afterD4.side_to_move = "Black";
afterD4.variant_fen = "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR[PNpn] b KQkq d3 0 1";
mkdirSync(reportDir, { recursive: true });

// Use an ephemeral port so a different lane's server can never satisfy this test.
const server = await createServer({ root: frontend, configFile: join(frontend, "vite.config.ts"), server: { host: "127.0.0.1", port: 0, strictPort: true } });
let browser;
const results = [];
try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true }
    : { channel: "chrome", headless: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    for (const dock of [true, false]) {
      const name = `${dock ? "default" : "without-dock"}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "dark", serviceWorkers: "block" });
      const page = await context.newPage();
      const unexpectedRequests = [];
      const pageErrors = [];
      const moves = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== origin || (url.pathname.startsWith("/api/") && url.pathname !== "/api/exploration/move")) {
          unexpectedRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
          return route.abort();
        }
        if (url.pathname !== "/api/exploration/move") return route.continue();
        const body = request.postDataJSON();
        const validSource = request.method() === "POST" && body.board === "A" && body.from_square === "d2"
          && body.board_a_fen === fixture.variant_fen && body.board_b_fen === fixture.variant_fen && !body.drop_piece;
        if (body.dry_run && validSource && body.to_square === "d2") {
          return route.fulfill({ json: { legal: true, legal_destinations: ["d3", "d4"] } });
        }
        if (!body.dry_run && validSource && body.to_square === "d4") {
          moves.push(body);
          return route.fulfill({ json: { legal: true, notation: "d4", board_a: afterD4, board_b: fixture } });
        }
        unexpectedRequests.push(`Unexpected exploration request: ${JSON.stringify(body)}`);
        return route.fulfill({ status: 400, json: { detail: "Outside fixed d2-d4 fixture" } });
      });
      try {
        await page.goto(`${origin}/dev/usability/wizard-board.html?dock=${dock ? "1" : "0"}`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "1A e4", exact: true }).click();
        await page.getByRole("combobox", { name: "Required move glyph pointer fallback" }).selectOption("!");
        const board = page.getByLabel("Board A alternative chessboard", { exact: true });
        await board.locator("..").scrollIntoViewIfNeeded();
        const geometry = await board.evaluate((element) => {
          const box = (node) => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; };
          const stage = element.parentElement;
          return {
            board: box(element),
            stage: box(stage),
            containerType: getComputedStyle(stage).containerType,
            squares: [...element.querySelectorAll("button")].map(box),
            pockets: [...stage.querySelectorAll(".pocket-rail")].map((rail) => ({
              ...box(rail),
              pieces: [...rail.querySelectorAll(".piece")].map((piece) => ({ ...box(piece), backgroundImage: getComputedStyle(piece).backgroundImage })),
            })),
          };
        });
        results.push({ name, viewport, geometry, passed: false });
        await page.screenshot({ path: join(reportDir, `${name}-step3.png`) });
        assert(geometry.board.width >= 400 && geometry.board.height >= 400, `${name}: board is ${geometry.board.width}x${geometry.board.height}, expected at least 400x400`);
        assert.equal(geometry.squares.length, 64);
        assert(geometry.squares.every((square) => square.width >= 45 && square.height >= 45), `${name}: each square must be at least 45x45`);
        assert.equal(geometry.containerType, "size");
        assert.equal(geometry.pockets.length, 2);
        assert(geometry.pockets.every((rail) => Math.abs(rail.height - 44) < 0.1 && rail.pieces.length > 0 && rail.pieces.every((piece) => piece.width > 0 && piece.height > 0 && piece.backgroundImage !== "none")), `${name}: 44px pocket rails must retain visible pieces`);
        await board.getByRole("button", { name: "d2 P", exact: true }).click();
        await board.getByRole("button", { name: "d4", exact: true }).click();
        await page.getByRole("heading", { name: "Instead, play d4", exact: true }).waitFor();
        assert.equal(moves.length, 1, `${name}: exactly one d2-d4 move request`);
        await page.getByRole("textbox", { name: "Written answer after Because" }).fill("the alternative claims the centre.");
        const save = page.getByRole("button", { name: "Save moment", exact: true });
        await save.scrollIntoViewIfNeeded();
        const saveBox = await save.boundingBox();
        assert(saveBox && saveBox.y >= 0 && saveBox.y + saveBox.height <= viewport.height, `${name}: Save must scroll into the viewport`);
        await page.screenshot({ path: join(reportDir, `${name}-save.png`) });
        await save.click();
        await page.getByRole("status").filter({ hasText: "Fixture moment saved" }).waitFor();
        assert.deepEqual(unexpectedRequests, []);
        assert.deepEqual(pageErrors, []);
        results.at(-1).passed = true;
        results.at(-1).save = saveBox;
        console.log(`${name}: PASS board ${geometry.board.width.toFixed(2)}x${geometry.board.height.toFixed(2)}; squares ${geometry.squares[0].width.toFixed(2)}x${geometry.squares[0].height.toFixed(2)}; pockets 44px; d2→d4 by pointer; Save reached and clicked`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  writeFileSync(join(reportDir, "measurements.json"), JSON.stringify(results, null, 2) + "\n");
  await browser?.close();
  await server.close();
}
