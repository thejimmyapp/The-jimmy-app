import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useCoachStore } from "../../store";
import type { GamePayload, ReplayPosition } from "../../types";
import { StudyWorkspace } from "./StudyWorkspace";

const position: ReplayPosition = {
  ply: 0, label: "Start", board: Array.from({ length: 8 }, () => Array(8).fill("")), side_to_move: "White", variant_fen: "",
  white_pocket: "", black_pocket: "", white_clock: "3:00", black_clock: "2:59", partner_index: 0, from_square: null, to_square: null,
};
const game: GamePayload = {
  game: { id: 1, played_at: "", result: "*", opponent: "Black A", opponent_rating: 2310, partner: null, user_color: "white", time_control: "180" },
  players: { board_a_white: "White A", board_a_black: "Black A", board_b_white: "White B", board_b_black: "Black B" },
  moves_a: [], moves_b: [], positions_a: [position], positions_b: [position],
  timeline: [{ global_ply: 0, board: "A", local_ply: 0, move: "Start", board_a: position, board_b: position }],
  second_board_available: false, limitations: [], outcome: { summary: "", detail: "", loser_username: null, termination: null, board: null, board_role: null, move_number: null },
};
const reportUnexpectedReactError = console.error;
beforeAll(() => vi.spyOn(console, "error").mockImplementation((message, ...details) => {
  if (typeof message === "string" && message.includes("is unrecognized in this browser")) return;
  reportUnexpectedReactError(message, ...details);
}));
afterAll(() => vi.restoreAllMocks());

describe("workspace player orientation", () => {
  beforeEach(() => useCoachStore.setState({ game, globalPly: 0, mode: "review" }));
  afterEach(() => { cleanup(); useCoachStore.setState({ game: null }); });

  it("keeps the reviewer on the bottom and swaps both bars on flip", () => {
    const { container } = render(<StudyWorkspace />);
    const info = (edge: "top" | "bot") => container.querySelector(`.study__player-${edge} .info`)?.textContent;
    const clock = (edge: "top" | "bot") => container.querySelector(`.study__player-${edge} [data-jimmy-departure="clock"]`)?.textContent;
    expect(info("top")).toBe("Black A 2310"); expect(clock("top")).toBe("2:59");
    expect(info("bot")).toBe("White A"); expect(clock("bot")).toBe("3:00");
    fireEvent.keyDown(container.querySelector(".study-workspace")!, { key: "f" });
    expect(info("top")).toBe("White A"); expect(clock("top")).toBe("3:00");
    expect(info("bot")).toBe("Black A 2310"); expect(clock("bot")).toBe("2:59");
  });
});
