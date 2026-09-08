import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePgn } from "../../src/parity/pgn/parsePgn.ts";
import { buildPositionMap } from "../../src/parity/rules/crazyhouse.ts";

const parityRoot = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(parityRoot, "..", "..", "src", "parity", "fixtures");
const pgn = readFileSync(join(fixtureRoot, "Ma9vcnpu-4lZqSffp.pgn"), "utf8");
const positions = buildPositionMap(parsePgn(pgn));
writeFileSync(join(fixtureRoot, "Ma9vcnpu-4lZqSffp.positions.json"), `${JSON.stringify(positions, null, 2)}\n`);
console.log(`Wrote ${Object.keys(positions).length} positions.`);
