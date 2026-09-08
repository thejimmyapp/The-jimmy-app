import { describe, expect, it } from "vitest";
import type { ReplayPosition } from "../../types";
import { replayToParity } from "./replayToParity";

const replay = (overrides: Partial<ReplayPosition> = {}): ReplayPosition => ({
  ply: 1, label: "1. R@e7+", board: [
    ["", "", "", "", "k", "", "", ""], ["", "", "", "", "R", "", "", ""],
    ...Array.from({ length: 5 }, () => Array(8).fill("")), ["", "", "", "", "K", "", "", ""],
  ], side_to_move: "Black", variant_fen: "", white_pocket: "QP", black_pocket: "n", white_clock: "2:59", black_clock: "2:58", partner_index: 0, from_square: null, to_square: "e7", ...overrides,
});

describe("replay-to-parity adapter", () => {
  it("preserves board rows and pockets, represents a drop, and detects the checked king", () => {
    const result = replayToParity(replay());
    expect(result.position).toMatchObject({ white_pocket: "QP", black_pocket: "n", side_to_move: "Black" });
    expect(result.lastMove).toEqual({ from: null, to: "e7" });
    expect(result.check).toBe("e8");
  });

  it("normalizes dash pockets and omits an unavailable last move", () => {
    const result = replayToParity(replay({ white_pocket: "-", black_pocket: "-", from_square: null, to_square: null }));
    expect(result.position).toMatchObject({ white_pocket: "", black_pocket: "" });
    expect(result.lastMove).toBeNull();
  });
});
