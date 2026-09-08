import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { chromium } from "playwright";

const parityRoot = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(parityRoot, "..", "..");
const referenceDir = join(parityRoot, "reference");
const outDir = join(parityRoot, "out");
const statesPath = join(frontendRoot, "src", "parity", "fixtures", "Ma9vcnpu-4lZqSffp.states.json");
const defaultStudyUrl = "https://lichess.org/study/Ma9vcnpu/4lZqSffp";
const referenceUrl = process.env.PARITY_REFERENCE_URL ?? defaultStudyUrl;
const referenceChapter = process.env.PARITY_REFERENCE_CHAPTER ?? "4lZqSffp";
const candidateUrl = "http://127.0.0.1:4177/dev/parity.html";
const viewport = { width: 1440, height: 900 };
const boardCrop = { x: 379, y: 83, width: 680, height: 680 };
const stateIds = ["S0", "S1", "S2"];

mkdirSync(referenceDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

async function newPage(browser, overrides = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "dark", ...overrides });
  const page = await context.newPage();
  return { context, page };
}

async function installedChromeUserAgent(browser) {
  const { context, page } = await newPage(browser);
  const userAgent = await page.evaluate(() => navigator.userAgent);
  await context.close();
  return userAgent.replace("HeadlessChrome/", "Chrome/");
}

async function settle(page) {
  await page.waitForTimeout(900);
  await page.evaluate(() => document.fonts.ready);
}

async function referenceStateMeta(page) {
  return page.evaluate(() => {
    const rectFor = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, top: box.top, right: box.right, bottom: box.bottom, left: box.left };
    };
    const styleFor = (element, pseudo = null) => {
      if (!element) return null;
      const style = getComputedStyle(element, pseudo);
      return {
        rect: rectFor(element),
        width: style.width,
        height: style.height,
        backgroundSize: style.backgroundSize,
        backgroundColor: style.backgroundColor,
        opacity: style.opacity,
        content: style.content,
        right: style.right,
        bottom: style.bottom,
        font: style.font,
        color: style.color,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
      };
    };
    const textCell = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return { text: element.textContent, rect: rectFor(element), font: style.font, color: style.color, backgroundColor: style.backgroundColor };
    };
    const pockets = [...document.querySelectorAll(".pocket")].map((pocket) => {
      const piece = pocket.querySelector("piece");
      return { rect: rectFor(pocket), piece: styleFor(piece), badge: styleFor(piece, "::after") };
    });
    return {
      shapesInnerHtml: document.querySelector(".cg-shapes")?.innerHTML ?? null,
      shapesBelowInnerHtml: document.querySelector(".cg-shapes-below")?.innerHTML ?? null,
      customSvgsInnerHtml: document.querySelector(".cg-custom-svgs")?.innerHTML ?? null,
      customBelowInnerHtml: document.querySelector(".cg-custom-below")?.innerHTML ?? null,
      pockets,
      coords: [...document.querySelectorAll("coords")].map((strip) => ({
        className: strip.className,
        rect: rectFor(strip),
        entries: [...strip.querySelectorAll("coord")].slice(0, 2).map((coord) => textCell(coord)),
      })),
      tools: styleFor(document.querySelector(".analyse__tools")),
      controlButtons: [...document.querySelectorAll(".analyse__controls button")].map((button) => textCell(button)),
      moveCells: [...document.querySelectorAll(".tview2 index, .tview2 move")].slice(0, 8).map((cell) => ({ tagName: cell.tagName.toLowerCase(), ...textCell(cell) })),
      fork: (() => {
        const fork = document.querySelector(".analyse__fork");
        return { rect: rectFor(fork), children: fork ? [...fork.children].map((child) => textCell(child)) : [] };
      })(),
    };
  });
}

async function captureReference(browser) {
  const captureVariant = "a:user-agent-minus-headless+locale-en-US";
  const userAgent = await installedChromeUserAgent(browser);
  const { context, page } = await newPage(browser, { userAgent, locale: "en-US" });
  const response = await page.goto(referenceUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  let boardPresent = false;
  if (response?.status() === 200) {
    boardPresent = await page.waitForSelector("cg-board", { timeout: 90_000 }).then(() => true, () => false);
  }
  const responseHeaders = response?.headers() ?? {};
  const requestHeaders = response ? await response.request().allHeaders() : {};
  const navigation = {
    variant: captureVariant,
    status: response?.status() ?? null,
    responseHeaders: {
      server: responseHeaders.server ?? null,
      cfRay: responseHeaders["cf-ray"] ?? null,
    },
    requestUserAgent: requestHeaders["user-agent"] ?? userAgent,
    boardPresent,
    title: await page.title(),
  };
  console.log(`Reference navigation: ${JSON.stringify(navigation)}`);
  if (!response?.ok() || !boardPresent) {
    throw new Error(`Reference returned HTTP ${response?.status() ?? "unknown"} with cg-board=${boardPresent}: ${navigation.title}`);
  }
  const chapter = page.locator(`.study__chapters button[data-id="${referenceChapter}"]`);
  if (await chapter.count() && !(await chapter.first().evaluate((element) => element.classList.contains("active")))) await chapter.first().click();
  await page.waitForSelector(".pocket", { timeout: 90_000 });
  await page.waitForSelector(".tview2 move", { timeout: 90_000 });
  await settle(page);
  await page.screenshot({ path: join(referenceDir, "S0.png") });
  const stateMeta = { S0: await referenceStateMeta(page) };

  await page.keyboard.press("ArrowRight");
  await settle(page);
  await page.screenshot({ path: join(referenceDir, "S1.png") });
  stateMeta.S1 = await referenceStateMeta(page);

  const moves = page.locator(".tview2 move");
  let target = null;
  for (let index = 0; index < await moves.count(); index += 1) {
    const candidate = moves.nth(index);
    if ((await candidate.textContent())?.includes("R@c1!!")) { target = candidate; break; }
  }
  if (!target) throw new Error('Could not find move text containing "R@c1!!"');
  await target.scrollIntoViewIfNeeded();
  await target.click();
  await settle(page);
  await page.screenshot({ path: join(referenceDir, "S2.png") });
  stateMeta.S2 = await referenceStateMeta(page);

  const meta = await page.evaluate(() => {
    const rectFor = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, top: box.top, right: box.right, bottom: box.bottom, left: box.left };
    };
    return {
      url: location.href,
      capturedAt: new Date().toISOString(),
      cgBoard: rectFor(document.querySelector("cg-board")),
      coords: [...document.querySelectorAll("coords")].map((element) => ({ className: element.className, rect: rectFor(element) })),
      pockets: [...document.querySelectorAll(".pocket")].map((element) => rectFor(element)),
      tools: rectFor(document.querySelector(".analyse__tools")),
      controls: rectFor(document.querySelector(".analyse__controls")),
      boardBeforeBackgroundImage: getComputedStyle(document.querySelector("cg-board"), "::before").backgroundImage,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyFont: getComputedStyle(document.body).font,
    };
  });
  writeFileSync(join(referenceDir, "reference-meta.json"), `${JSON.stringify({ ...meta, navigation, states: stateMeta }, null, 2)}\n`);
  await context.close();
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(url)).ok) return; } catch { /* Vite is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function captureCandidate(browser) {
  const viteBin = join(frontendRoot, "node_modules", "vite", "bin", "vite.js");
  const server = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "4177", "--strictPort"], { cwd: frontendRoot, stdio: ["ignore", "pipe", "pipe"] });
  try {
    await waitForServer(candidateUrl);
    const { context, page } = await newPage(browser);
    for (const stateId of stateIds) {
      await page.goto(`${candidateUrl}?state=${stateId}&layout=reference&theme=brown`, { waitUntil: "networkidle" });
      await page.waitForSelector("cg-board");
      await settle(page);
      await page.screenshot({ path: join(outDir, `${stateId}.png`) });
    }
    await context.close();
  } finally {
    server.kill("SIGTERM");
  }
}

function crop(source, cropBox) {
  const result = new PNG({ width: cropBox.width, height: cropBox.height });
  PNG.bitblt(source, result, cropBox.x, cropBox.y, cropBox.width, cropBox.height, 0, 0);
  return result;
}

function compareCrop(reference, candidate, cropBox, stateId, label, threshold) {
  const expected = crop(reference, cropBox);
  const actual = crop(candidate, cropBox);
  const diff = new PNG({ width: cropBox.width, height: cropBox.height });
  const mismatches = pixelmatch(expected.data, actual.data, diff.data, cropBox.width, cropBox.height, { threshold });
  writeFileSync(join(outDir, `${stateId}-${label}-diff-${String(threshold).replace(".", "")}.png`), PNG.sync.write(diff));
  return 100 * mismatches / (cropBox.width * cropBox.height);
}

function srgbToLab([red, green, blue]) {
  const linear = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
  const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
  const curve = (value) => value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116;
  const fx = curve(x); const fy = curve(y); const fz = curve(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(first, second) {
  const a = srgbToLab(first); const b = srgbToLab(second);
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

function squareMean(image, x, y, size) {
  const inset = 8;
  const sums = [0, 0, 0];
  let count = 0;
  for (let py = y + inset; py < y + size - inset; py += 1) for (let px = x + inset; px < x + size - inset; px += 1) {
    const index = (py * image.width + px) * 4;
    sums[0] += image.data[index]; sums[1] += image.data[index + 1]; sums[2] += image.data[index + 2]; count += 1;
  }
  return sums.map((value) => Math.round(value / count));
}

function nearestEmptySquares(board) {
  const choices = [];
  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
    if (board[7 - rankIndex][fileIndex]) continue;
    const displayX = 7 - fileIndex;
    const displayY = rankIndex;
    const distance = Math.min(displayX + displayY, 7 - displayX + displayY, displayX + 7 - displayY, 14 - displayX - displayY);
    choices.push({ square: `${"abcdefgh"[fileIndex]}${rankIndex + 1}`, displayX, displayY, distance });
  }
  return choices.sort((a, b) => a.distance - b.distance || a.square.localeCompare(b.square)).slice(0, 12);
}

function compareAll() {
  const states = JSON.parse(readFileSync(statesPath, "utf8"));
  const results = {};
  for (const stateId of stateIds) {
    const reference = PNG.sync.read(readFileSync(join(referenceDir, `${stateId}.png`)));
    const candidate = PNG.sync.read(readFileSync(join(outDir, `${stateId}.png`)));
    const board = {};
    for (const threshold of [0.1, 0.3]) board[threshold] = compareCrop(reference, candidate, boardCrop, stateId, "board", threshold);
    const ranksCrop = { x: 1049, y: 83, width: 10, height: 680 };
    const filesCrop = { x: 379, y: 746, width: 680, height: 17 };
    const coords = {};
    for (const threshold of [0.1, 0.3]) {
      const rankMismatch = compareCrop(reference, candidate, ranksCrop, stateId, "ranks", threshold);
      const fileMismatch = compareCrop(reference, candidate, filesCrop, stateId, "files", threshold);
      coords[threshold] = (rankMismatch * ranksCrop.width * ranksCrop.height + fileMismatch * filesCrop.width * filesCrop.height) / (ranksCrop.width * ranksCrop.height + filesCrop.width * filesCrop.height);
    }
    const pockets = { top: {}, bottom: {} };
    const pocketCrops = { top: { x: 1071, y: 83, width: 354, height: 60 }, bottom: { x: 1071, y: 705, width: 354, height: 60 } };
    for (const [position, cropBox] of Object.entries(pocketCrops)) for (const threshold of [0.1, 0.3]) pockets[position][threshold] = compareCrop(reference, candidate, cropBox, stateId, `pocket-${position}`, threshold);
    const means = nearestEmptySquares(states[stateId].position.board).map(({ square, displayX, displayY }) => {
      const x = boardCrop.x + displayX * 85;
      const y = boardCrop.y + displayY * 85;
      const expected = squareMean(reference, x, y, 85);
      const actual = squareMean(candidate, x, y, 85);
      return { square, reference: expected, candidate: actual, deltaE: Number(deltaE(expected, actual).toFixed(2)) };
    });
    results[stateId] = { board, coords, pockets, means };
    console.log(`${stateId}: board ${board[0.1].toFixed(3)}% @0.1 · ${board[0.3].toFixed(3)}% @0.3; coords ${coords[0.1].toFixed(3)}% @0.1 · ${coords[0.3].toFixed(3)}% @0.3; pocket-top ${pockets.top[0.1].toFixed(3)}% · ${pockets.top[0.3].toFixed(3)}%; pocket-bottom ${pockets.bottom[0.1].toFixed(3)}% · ${pockets.bottom[0.3].toFixed(3)}%`);
    console.table(means.map((item) => ({ state: stateId, square: item.square, reference: item.reference.join(","), candidate: item.candidate.join(","), deltaE: item.deltaE })));
  }
  writeFileSync(join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
}

const mode = process.argv[2] ?? "all";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const referenceComplete = stateIds.every((stateId) => existsSync(join(referenceDir, `${stateId}.png`)));
  if (mode === "reference") {
    if (referenceComplete && process.env.PARITY_RECAPTURE !== "1") console.log("Reference S0/S1/S2 already exist; set PARITY_RECAPTURE=1 to replace them.");
    else await captureReference(browser);
  }
  else {
    await captureCandidate(browser);
    if (referenceComplete) compareAll();
    else {
      const result = { status: "unmeasurable", reason: `Reference unavailable at ${referenceUrl}; candidate captures completed.` };
      writeFileSync(join(outDir, "results.json"), `${JSON.stringify(result, null, 2)}\n`);
      console.log(result.reason);
    }
  }
} finally {
  await browser.close();
}
