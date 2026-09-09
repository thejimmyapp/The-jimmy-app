import { describe, expect, it } from "vitest";
import { reconstructGuestMatch } from "../../bughouseDecoder";
import fixtures from "../../fixtures/guest-match-replays.json";
import type { CallbackReplayBoard, GuestMatchReplaySource, NormalizedMatch } from "../../types";
import { timelineToBoardTreesWithDiagnostics } from "./timelineToBoardTrees";

const boards = (fixtures.matches[0] as unknown as { boards: { A: CallbackReplayBoard; B: CallbackReplayBoard } }).boards;
const match: NormalizedMatch = {
  game_ids: { A: boards.A.id, B: boards.B.id }, end_time: 1_786_320_000,
  seats: {
    "A-white": { name: String(boards.A.headers.White), rating: Number(boards.A.headers.WhiteElo) },
    "A-black": { name: String(boards.A.headers.Black), rating: Number(boards.A.headers.BlackElo) },
    "B-white": { name: String(boards.B.headers.White), rating: Number(boards.B.headers.WhiteElo) },
    "B-black": { name: String(boards.B.headers.Black), rating: Number(boards.B.headers.BlackElo) },
  },
  ply_counts: { A: boards.A.plyCount, B: boards.B.plyCount }, decisive_board: "A", loser_seat: "A-black", action: "checkmated",
  highest_rated: { name: String(boards.B.headers.White), rating: Number(boards.B.headers.WhiteElo), seat: "B-white", outcome: "WON" }, loser_relative_to_highest: "oppo",
};

describe("two-board timeline adapter", () => {
  it("generates real SAN for every prod-like fixture transition with zero fallbacks", () => {
    const game = reconstructGuestMatch({ match, boards } satisfies GuestMatchReplaySource).game;
    const result = timelineToBoardTreesWithDiagnostics(game.timeline);
    const san = [...result.trees.A.nodes, ...result.trees.B.nodes].map((node) => node.san);
    expect(result.fallbackCount).toBe(0);
    expect(san).toHaveLength(game.timeline.length - 1);
    expect(san).toEqual(expect.arrayContaining(["P@f2+", "dxe4", "B@h4+"]));
    expect(san.some((move) => move.includes("@"))).toBe(true);
    expect(san.some((move) => move.includes("x"))).toBe(true);
    expect(san.some((move) => /[+#]$/.test(move))).toBe(true);
    expect(san.filter((move) => move.startsWith("O-O") || move.includes("="))).toEqual([]);
  });
});
