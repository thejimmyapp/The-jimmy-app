import { describe, expect, it } from "vitest";
import { replayNotices } from "./replayIntegrity";
import type { GamePayload, ReplayPosition } from "./types";

const position = (warning = ""): ReplayPosition => ({
  ply: 0,
  label: "Start",
  board: [],
  side_to_move: "White",
  variant_fen: "",
  white_pocket: "-",
  black_pocket: "-",
  white_clock: "-",
  black_clock: "-",
  partner_index: 0,
  warning,
  from_square: null,
  to_square: null,
});

const game = {
  limitations: ["Cross-board move order is approximate because complete clock timestamps are unavailable."],
} as GamePayload;

describe("replay integrity notices", () => {
  it("deduplicates global and position-level limitations", () => {
    const warning = game.limitations[0];
    expect(replayNotices(game, position(warning), position(warning))).toEqual([warning]);
  });

  it("identifies a board that stopped at the reviewed move", () => {
    expect(replayNotices(game, position("Stopped before 4. N@f7: move is not legal"), position())).toEqual([
      game.limitations[0],
      "Board A at this move: Stopped before 4. N@f7: move is not legal",
    ]);
  });

  it("leaves the incomplete-board explanation to the actionable Board B state", () => {
    expect(replayNotices({ ...game, limitations: ["Second board unavailable"] }, position(), null)).toEqual([]);
  });
});
