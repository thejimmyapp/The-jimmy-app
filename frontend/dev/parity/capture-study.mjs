import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { chromium } from "playwright";

const parityRoot = dirname(fileURLToPath(import.meta.url));
const frontendRoot = join(parityRoot, "..", "..");
const referenceDir = join(parityRoot, "reference");
const reportDir = process.env.PARITY_STUDY_REPORT_DIR ?? "/Users/user/Documents/4robots/HARDCODE/gate4-work/reports/PARITY-05c";
const candidateUrl = "http://127.0.0.1:4179/dev/parity.html";
const referenceMeta = JSON.parse(readFileSync(join(referenceDir, "reference-meta.json"), "utf8"));
const cases = [
  { id: "jimmy1440", frame: { width: 1372, height: 842 } },
  { id: "jimmy1200", frame: { width: 1132, height: 742 } },
  { id: "jimmy1024", frame: { width: 956, height: 710 } },
];
mkdirSync(reportDir, { recursive: true });

const frameRect = (value) => value ? { x: value.x, y: value.y - 60, width: value.width, height: value.height } : null;
const delta = (actual, expected) => actual && expected ? Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, Number((actual[key] - expected[key]).toFixed(4))])) : null;
const roundedCrop = (value) => ({ x: Math.round(value.x), y: Math.round(value.y), width: Math.round(value.width), height: Math.round(value.height) });

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(candidateUrl)).ok) return; } catch { /* Vite is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Vite did not start");
}

async function candidateGeometry(page) {
  return page.evaluate(() => {
    const box = (selector) => { const value = document.querySelector(selector)?.getBoundingClientRect(); return value ? { x: value.x, y: value.y, width: value.width, height: value.height } : null; };
    return {
      board: box(".study-main-board cg-board"), ranks: box(".study-main-board coords.ranks"), files: box(".study-main-board coords.files"),
      pocketTop: box(".study-tools > .pocket-top"), pocketTopSlot: box(".study-tools > .pocket-top piece"),
      pocketBottom: box(".study-tools > .pocket-bottom"), pocketBottomSlot: box(".study-tools > .pocket-bottom piece"),
      moves: box(".study-moves"), fork: box(".study-fork .parity-fork-options"), controls: box(".study-controls .analyse__controls"),
      controlButtons: [...document.querySelectorAll(".study-controls button[data-act]")].map((element) => ({ action: element.dataset.act, rect: box(`.study-controls button[data-act="${element.dataset.act}"]`) })),
      toolsColumn: box(".study-tools"), secondBoard: box(".study-second-board"), layout: document.querySelector(".study-workspace")?.getAttribute("data-layout"),
    };
  });
}

function expectedGeometry(id) {
  const source = referenceMeta.jimmyFrames[id];
  return {
    board: frameRect(source.cgBoard),
    ranks: frameRect(source.coords.find((item) => item.className.includes("ranks"))?.rect),
    files: frameRect(source.coords.find((item) => item.className.includes("files"))?.rect),
    pocketTop: frameRect(source.pockets[0]), pocketTopSlot: frameRect(source.details.pockets[0].piece.rect),
    pocketBottom: frameRect(source.pockets[1]), pocketBottomSlot: frameRect(source.details.pockets[1].piece.rect),
    moves: frameRect(source.tools), fork: frameRect(source.fork), controls: frameRect(source.controls),
    controlButtons: source.controlButtons.slice(0, 4).map((rect, index) => ({ action: ["first", "prev", "next", "last"][index], rect: frameRect(rect) })),
    toolsColumn: { x: source.tools.x, y: 0, width: source.tools.width, height: source.frame.height },
  };
}

function compareGeometry(actual, expected) {
  const result = {};
  for (const key of ["board", "ranks", "files", "pocketTop", "pocketTopSlot", "pocketBottom", "pocketBottomSlot", "moves", "fork", "controls", "toolsColumn"]) {
    result[key] = { actual: actual[key], expected: expected[key], delta: delta(actual[key], expected[key]) };
  }
  result.controlButtons = actual.controlButtons.map((button, index) => ({ action: button.action, actual: button.rect, expected: expected.controlButtons[index]?.rect ?? null, delta: delta(button.rect, expected.controlButtons[index]?.rect) }));
  result.secondBoard = actual.secondBoard;
  return result;
}

function crop(image, cropBox) {
  const result = new PNG({ width: cropBox.width, height: cropBox.height });
  PNG.bitblt(image, result, cropBox.x, cropBox.y, cropBox.width, cropBox.height, 0, 0);
  return result;
}

function mismatch(reference, candidate, expectedRect) {
  if (!expectedRect) return null;
  const candidateBox = roundedCrop(expectedRect);
  const referenceBox = { ...candidateBox, y: candidateBox.y + 60 };
  const expected = crop(reference, referenceBox); const actual = crop(candidate, candidateBox);
  const diff = new PNG({ width: candidateBox.width, height: candidateBox.height });
  const count = pixelmatch(expected.data, actual.data, diff.data, candidateBox.width, candidateBox.height, { threshold: 0.1 });
  return Number((100 * count / (candidateBox.width * candidateBox.height)).toFixed(3));
}

function geometryFailures(compared) {
  return [...Object.entries(compared).flatMap(([name, entry]) => {
    if (name === "controlButtons") return entry.flatMap((button) => button.delta ? Object.entries(button.delta).filter(([, value]) => Math.abs(value) > 1).map(([field, value]) => `${name}.${button.action}.${field}=${value}`) : []);
    if (!entry?.delta) return [];
    return Object.entries(entry.delta).filter(([, value]) => Math.abs(value) > 1).map(([field, value]) => `${name}.${field}=${value}`);
  })];
}

const viteBin = join(frontendRoot, "node_modules", "vite", "bin", "vite.js");
const server = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "4179", "--strictPort"], { cwd: frontendRoot, stdio: "ignore" });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  await waitForServer();
  const results = {};
  for (const item of cases) {
    const context = await browser.newContext({ viewport: item.frame, deviceScaleFactor: 1, colorScheme: "dark", locale: "en-US" });
    const page = await context.newPage();
    await page.goto(`${candidateUrl}?study=0&ply=1&frame=${item.frame.width}x${item.frame.height}`, { waitUntil: "networkidle" });
    await page.waitForSelector(`.study-workspace[data-layout="${item.id}"]`); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    const captureName = `frame-${item.frame.width}x${item.frame.height}.png`;
    await page.screenshot({ path: join(reportDir, captureName) });
    const actual = await candidateGeometry(page); const expected = expectedGeometry(item.id); const geometry = compareGeometry(actual, expected);
    const reference = PNG.sync.read(readFileSync(join(referenceDir, `${item.id}-S1.png`)));
    const candidate = PNG.sync.read(readFileSync(join(reportDir, captureName)));
    const pixels = {
      board: mismatch(reference, candidate, expected.board), ranks: mismatch(reference, candidate, expected.ranks), files: mismatch(reference, candidate, expected.files),
      pocketTop: mismatch(reference, candidate, expected.pocketTop), pocketBottom: mismatch(reference, candidate, expected.pocketBottom),
      moves: mismatch(reference, candidate, expected.moves), controls: mismatch(reference, candidate, expected.controls),
    };
    results[item.id] = { frame: item.frame, geometry, pixels, failures: geometryFailures(geometry) };
    console.log(`${item.id}: ${results[item.id].failures.length ? `FAIL ${results[item.id].failures.join(", ")}` : "PASS all geometry deltas ≤ 1px"}`);
    await context.close();
  }
  if (process.env.PARITY_CAPTURE_CHROME === "1") {
    const context = await browser.newContext({ viewport: cases[0].frame, deviceScaleFactor: 1, colorScheme: "dark", locale: "en-US" });
    const page = await context.newPage();
    await page.goto(`${candidateUrl}?study=0&ply=1&frame=1372x842&chrome=1`, { waitUntil: "networkidle" });
    await page.waitForSelector('.study-workspace[data-layout="jimmy1440"]'); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    await page.screenshot({ path: join(reportDir, "frame-1372x842-side.png") });
    await page.getByRole("button", { name: "Menu" }).click(); await page.waitForSelector(".study-action-menu");
    await page.screenshot({ path: join(reportDir, "frame-1372x842-menu-open.png") });
    for (const [name, referenceName] of [["side", "jimmy1440-side.png"], ["menu-open", "jimmy1440-menu-open.png"]]) {
      const candidate = PNG.sync.read(readFileSync(join(reportDir, `frame-1372x842-${name}.png`)));
      const reference = PNG.sync.read(readFileSync(join(referenceDir, referenceName)));
      const referenceFrame = crop(reference, { x: 0, y: 60, width: 1372, height: 842 });
      const joined = new PNG({ width: 2752, height: 842 });
      PNG.bitblt(candidate, joined, 0, 0, 1372, 842, 0, 0);
      PNG.bitblt(referenceFrame, joined, 0, 0, 1372, 842, 1380, 0);
      writeFileSync(join(reportDir, `frame-1372x842-${name}-vs-jimmy1440.png`), PNG.sync.write(joined));
    }
    await context.close();
  }
  const wide = PNG.sync.read(readFileSync(join(reportDir, "frame-1372x842.png")));
  const referenceWide = PNG.sync.read(readFileSync(join(referenceDir, "jimmy1440-S1.png")));
  const referenceFrame = crop(referenceWide, { x: 0, y: 60, width: 1372, height: 842 });
  const joined = new PNG({ width: wide.width + 8 + referenceFrame.width, height: Math.max(wide.height, referenceFrame.height) });
  PNG.bitblt(wide, joined, 0, 0, wide.width, wide.height, 0, 0); PNG.bitblt(referenceFrame, joined, 0, 0, referenceFrame.width, referenceFrame.height, wide.width + 8, 0);
  writeFileSync(join(reportDir, "frame-1372x842-vs-jimmy1440.png"), PNG.sync.write(joined));
  writeFileSync(join(reportDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const failures = Object.values(results).flatMap((result) => result.failures);
  if (failures.length) throw new Error(`Geometry gate failed: ${failures.join(", ")}`);
} finally {
  await browser.close(); server.kill("SIGTERM");
}
