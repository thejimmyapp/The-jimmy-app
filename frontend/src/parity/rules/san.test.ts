import { describe, expect, it } from "vitest";
import pgnText from "../fixtures/Ma9vcnpu-4lZqSffp.pgn?raw";
import positionsJson from "../fixtures/Ma9vcnpu-4lZqSffp.positions.json";
import { parsePgn } from "../pgn/parsePgn";
import type { CrazyhousePosition, Side } from "./crazyhouse";
import { sanForTransition } from "./san";

describe("Lichess-grammar SAN generator", () => {
  it("matches all 135 parsed fixture nodes exactly", () => {
    const tree = parsePgn(pgnText);
    const positions = positionsJson as Record<string, CrazyhousePosition>;
    const generated = tree.nodes.map((node) => {
      const before = positions[node.parentId]; const after = positions[node.id];
      if (!before || !after?.lastMove) throw new Error(`Missing transition ${node.id}`);
      return sanForTransition(before, after, after.lastMove.from, after.lastMove.to, node.sideToMove as Side);
    });
    expect(generated).toEqual(tree.nodes.map((node) => node.san));
    expect(generated).toHaveLength(135);
  });
});
