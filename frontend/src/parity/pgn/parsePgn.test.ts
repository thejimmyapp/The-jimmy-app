import { describe, expect, it } from "vitest";
import fixture from "../fixtures/Ma9vcnpu-4lZqSffp.pgn?raw";
import { extractCommentShapes, parsePgn, pgnDepth } from "./parsePgn";

describe("original PGN tree parser", () => {
  it("parses every one of the fixture's 135 SAN tokens with deterministic ids and result star", () => {
    const tree = parsePgn(fixture);
    expect(tree.nodes).toHaveLength(135);
    expect(tree.nodes[0]).toMatchObject({ id: "n-001", ply: 1, moveNumber: 1, sideToMove: "Black", san: "P@e2+" });
    expect(tree.result).toBe("*");
  });

  it("keeps multiple suffix/NAG glyph kinds on one node", () => {
    const tree = parsePgn('[Result "*"]\n\n1... P@e2+!? $2 *');
    expect(tree.nodes[0].glyphs.map(({ kind }) => kind)).toEqual(["interesting", "mistake"]);
  });

  it("renders the standard Lichess symbols for positional NAGs and preserves unknown NAGs", () => {
    const source = '[Result "*"]\n\n1... Kxe2 $10 Bb4+ $17 2. Kf3 $146 Kf5 $999 *';
    const glyphs = parsePgn(source).nodes.map((node) => node.glyphs[0]);
    expect(glyphs).toEqual([
      { symbol: "=", kind: "other", nag: 10 },
      { symbol: "∓", kind: "other", nag: 17 },
      { symbol: "N", kind: "other", nag: 146 },
      { symbol: "$999", kind: "other", nag: 999 },
    ]);
  });

  it("extracts the R@c1 circle and arrow while removing directives from comment text", () => {
    const parsed = extractCommentShapes("[%csl Gh6][%cal Gg4h6]");
    expect(parsed.text).toBe("");
    expect(parsed.shapes).toEqual([{ brush: "green", orig: "h6" }, { brush: "green", orig: "g4", dest: "h6" }]);
    const node = parsePgn(fixture).nodes.find((candidate) => candidate.san === "R@c1" && candidate.glyphs[0]?.symbol === "!!");
    expect(node?.shapes).toEqual(parsed.shapes);
  });

  it("retains nested variations to at least depth four", () => {
    expect(pgnDepth(parsePgn(fixture).root)).toBeGreaterThanOrEqual(4);
  });
});
