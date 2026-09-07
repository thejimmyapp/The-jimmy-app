import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOARD_THEMES, DEFAULT_BOARD_THEME, DEFAULT_PIECE_SET, PIECE_SETS, resolveBoardTheme, resolvePieceSet } from "./boardAppearance";

describe("board appearance registry", () => {
  it("keeps every registry id unique and resolves unknown ids to the defaults", () => {
    expect(new Set(BOARD_THEMES.map(({ id }) => id)).size).toBe(BOARD_THEMES.length);
    expect(new Set(PIECE_SETS.map(({ id }) => id)).size).toBe(PIECE_SETS.length);
    expect(resolveBoardTheme("missing").id).toBe(DEFAULT_BOARD_THEME);
    expect(resolvePieceSet("missing").id).toBe(DEFAULT_PIECE_SET);
  });

  it("keeps every legacy appearance id resolvable", () => {
    for (const id of ["slate", "classic", "wood", "green", "blue", "violet", "mono"]) expect(resolveBoardTheme(id).id).toBe(id);
    for (const id of ["classic", "solid", "bold", "soft"]) expect(resolvePieceSet(id).id).toBe(id);
  });

  it("lists all twelve local files for every SVG piece set", () => {
    const publicRoot = `${process.cwd()}/public`;
    for (const pieceSet of PIECE_SETS) {
      if (pieceSet.kind !== "svg") continue;
      expect(pieceSet.files).toHaveLength(12);
      for (const file of pieceSet.files) expect(existsSync(`${publicRoot}${pieceSet.dir}${file}`)).toBe(true);
    }
  });
});
