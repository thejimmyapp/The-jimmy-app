import { describe, expect, it } from "vitest";
import type { ParityPosition } from "../board/ParityBoard";
import { canLegallyReach, isPositionCheckmate } from "./crazyhouse";

const position = (pieces: Record<string, string>, side_to_move: "White" | "Black"): ParityPosition => {
  const board = Array.from({ length: 8 }, () => Array(8).fill(""));
  for (const [square, piece] of Object.entries(pieces)) board[8 - Number(square[1])]["abcdefgh".indexOf(square[0])] = piece;
  return { board, white_pocket: "", black_pocket: "", side_to_move };
};

describe("SAN legality support", () => {
  it("excludes a pinned same-role mover that would expose its king", () => {
    const pinned = position({ e1: "K", e2: "R", h2: "R", e8: "r", h8: "k" }, "White");
    expect(canLegallyReach(pinned, "e2", "f2", "White")).toBe(false);
    expect(canLegallyReach(pinned, "h2", "f2", "White")).toBe(true);
  });

  it("recognizes checkmate with no legal board move or pocket drop", () => {
    expect(isPositionCheckmate(position({ h8: "k", g7: "Q", f6: "K" }, "Black"))).toBe(true);
  });
});
