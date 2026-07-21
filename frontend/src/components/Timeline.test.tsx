import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCoachStore } from "../store";
import type { GamePayload, ReplayPosition } from "../types";
import { Timeline } from "./Timeline";

const position: ReplayPosition = {
  ply: 0,
  label: "Start",
  board: [],
  side_to_move: "White",
  variant_fen: "",
  white_pocket: "-",
  black_pocket: "-",
  white_clock: "3:00",
  black_clock: "3:00",
  partner_index: 0,
  from_square: null,
  to_square: null,
};

const game: GamePayload = {
  game: { id: 1, played_at: "", result: "*", opponent: null, opponent_rating: null, partner: null, user_color: "white", time_control: "180" },
  players: { board_a_white: "White A", board_a_black: "Black A", board_b_white: "White B", board_b_black: "Black B" },
  moves_a: [],
  moves_b: [],
  positions_a: [position],
  positions_b: [position],
  timeline: [0, 1, 2].map((global_ply) => ({ global_ply, board: global_ply === 2 ? "B" as const : "A" as const, local_ply: global_ply, move: `Move ${global_ply}`, board_a: position, board_b: position })),
  second_board_available: true,
  limitations: [],
};

describe("timeline keyboard navigation", () => {
  beforeEach(() => useCoachStore.setState({ game, globalPly: 1, mode: "review" }));

  it("moves backward and forward with the arrow keys", () => {
    render(<Timeline />);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(useCoachStore.getState().globalPly).toBe(0);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(useCoachStore.getState().globalPly).toBe(1);
  });

  it("does not steal arrow keys while the user is typing", () => {
    const { container } = render(<><input aria-label="Chat input" /><Timeline /></>);
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    fireEvent.keyDown(input!, { key: "ArrowRight" });
    expect(useCoachStore.getState().globalPly).toBe(1);
  });
});
