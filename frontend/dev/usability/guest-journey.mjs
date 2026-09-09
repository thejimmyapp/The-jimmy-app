import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGuestJourneys } from "./guest-journey-browser.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, "../..");
const repo = resolve(frontend, "..");
const report = resolve(process.env.USAB_REPORT_DIR ?? join(repo, "reports/usability-journey", new Date().toISOString().replaceAll(":", "-")));
mkdirSync(report, { recursive: true });
const source = readFileSync(join(here, "guest-journey-browser.mjs"), "utf8");
// Keep user actions auditable: DOM evaluation below is only used for measurements.
for (const forbidden of [/\.keyboard\b/, /\.press\s*\(/, /\.selectOption\s*\(/, /\.dispatchEvent\s*\(/,
  /\bfetch\s*\(/, /\b(?:page|context)\.request\b/, /\blocalStorage\b/, /\bsessionStorage\b/,
  /\.setContent\s*\(/, /\.addInitScript\s*\(/, /\.addStyleTag\s*\(/, /force\s*:\s*true/,
  /\.fulfill\s*\(/, /useCoachStore/, /\.seek\s*\(/]) {
  assert(!forbidden.test(source), `Forbidden journey shortcut: ${forbidden}`);
}

function run(command, args, logName, env = process.env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: frontend, env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
      output += chunk; process.stdout.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      writeFileSync(join(report, logName), output);
      if (code === 0) resolveRun(); else reject(new Error(`${command} exited ${code}; see ${logName}`));
    });
  });
}

let backend;
let backendClosed;
let backendOutput = "";
let failure;
let databaseDirectory;
try {
  // Never accept a stale dist or a caller's public build URL for this offline walk.
  await run("pnpm", ["build"], "build.log", { ...process.env, VITE_PUBLIC_BASE_URL: "" });
  databaseDirectory = mkdtempSync(join(tmpdir(), "jimmy-usability-db-"));
  const python = process.env.USAB_PYTHON ?? (existsSync(join(repo, ".venv/bin/python")) ? join(repo, ".venv/bin/python") : "python3.11");
  backend = spawn(python, [join(repo, "scripts/usability_backend.py"), "--report-dir", report, "--database-dir", databaseDirectory], {
    cwd: repo, stdio: ["ignore", "pipe", "pipe"],
  });
  backendClosed = new Promise((resolveClose) => backend.once("close", (code) => resolveClose(code)));
  const origin = await new Promise((resolveReady, reject) => {
    const deadline = setTimeout(() => reject(new Error("Local backend did not become ready within 30 seconds")), 30_000);
    let pending = "";
    backend.once("error", (error) => { clearTimeout(deadline); reject(error); });
    backend.once("close", (code) => { clearTimeout(deadline); reject(new Error(`Local backend exited before readiness: ${code}`)); });
    backend.stdout.on("data", (chunk) => {
      backendOutput += chunk; pending += chunk;
      for (;;) {
        const end = pending.indexOf("\n"); if (end < 0) break;
        const line = pending.slice(0, end); pending = pending.slice(end + 1);
        try {
          const value = JSON.parse(line);
          if (value.usabBackendReady) {
            assert.equal(new URL(value.usabBackendReady).hostname, "127.0.0.1");
            clearTimeout(deadline); resolveReady(value.usabBackendReady);
          }
        } catch { /* Ordinary backend diagnostics remain in backend.log. */ }
      }
    });
    backend.stderr.on("data", (chunk) => { backendOutput += chunk; });
  });
  console.log(`Local real backend: ${origin}; evidence: ${report}`);
  await runGuestJourneys(origin, report);
} catch (error) {
  failure = error;
  writeFileSync(join(report, "failure.txt"), String(error.stack ?? error) + "\n");
} finally {
  if (backend && backend.exitCode === null) {
    backend.kill("SIGTERM");
    const deadline = setTimeout(() => backend.kill("SIGKILL"), 5000);
    await backendClosed;
    clearTimeout(deadline);
  }
  writeFileSync(join(report, "backend.log"), backendOutput);
  const guardFile = join(report, "backend-network.json");
  if (existsSync(guardFile) && JSON.parse(readFileSync(guardFile, "utf8")).length) {
    failure ??= new Error("Backend attempted non-loopback network");
  }
  // The parent owns cleanup, including when Uvicorn exits by signal.
  if (databaseDirectory) {
    rmSync(databaseDirectory, { recursive: true, force: true });
    writeFileSync(join(report, "cleanup.json"), JSON.stringify({ databaseDirectory, removed: !existsSync(databaseDirectory) }, null, 2) + "\n");
  }
}
if (failure) {
  console.error(failure);
  process.exitCode = 1;
} else {
  console.log(`PASS all four guest journeys; evidence: ${report}`);
}
