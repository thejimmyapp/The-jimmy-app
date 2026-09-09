import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { GamePayload, ReplayPosition } from "../../types";
import { StudyMoves } from "./StudyMoves";

const position: ReplayPosition = { ply: 0, label: "", board: Array.from({ length: 8 }, () => Array(8).fill("")), side_to_move: "White", variant_fen: "", white_pocket: "", black_pocket: "", white_clock: "3:00", black_clock: "3:00", partner_index: 0, from_square: null, to_square: null };
const events = [
  [0, "A", 0, "Start"], [1, "A", 1, "e4"], [2, "A", 2, "e5"], [3, "B", 1, "d4"], [4, "A", 3, "Nf3"], [5, "B", 2, "d5"], [6, "B", 3, "c4"],
] as const;
const game: GamePayload = {
  game: { id: 1, played_at: "", result: "*", opponent: null, opponent_rating: null, partner: null, user_color: "white", time_control: "180" },
  players: { board_a_white: "A White", board_a_black: "A Black", board_b_white: "B White", board_b_black: "B Black" }, moves_a: [], moves_b: [], positions_a: [], positions_b: [],
  timeline: events.map(([global_ply, board, local_ply, move]) => ({ global_ply, board, local_ply, move, board_a: position, board_b: position })), second_board_available: true, limitations: [],
  outcome: { summary: "", detail: "", loser_username: null, termination: null, board: null, board_role: null, move_number: null },
};
const reportUnexpectedReactError = console.error;
beforeAll(() => vi.spyOn(console, "error").mockImplementation((message, ...details) => {
  if (typeof message === "string" && message.includes("is unrecognized in this browser")) return;
  reportUnexpectedReactError(message, ...details);
}));
afterAll(() => vi.restoreAllMocks());
afterEach(cleanup);

describe("synchronized board move lists", () => {
  it("renders every non-start frame with independent numbering and headers", () => {
    const { container, getByText } = render(<StudyMoves game={game} globalPly={4} seek={() => undefined} />);
    expect(container.querySelector('[data-jimmy-departure="board-lists"]')).not.toBeNull();
    expect(getByText("Board A")).not.toBeNull(); expect(getByText("Board B")).not.toBeNull();
    expect(container.querySelectorAll(".study-board-list move[data-node-id]")).toHaveLength(game.timeline.length - 1);
    const lists = container.querySelectorAll(".study-board-list");
    expect([...lists[0].querySelectorAll(".parity-column-row > index")].map((node) => node.textContent)).toEqual(["1", "2"]);
    expect([...lists[1].querySelectorAll(".parity-column-row > index")].map((node) => node.textContent)).toEqual(["1", "2"]);
  });

  it("highlights both current board positions before B, mid-game, and at the end", () => {
    const { container, rerender } = render(<StudyMoves game={game} globalPly={2} seek={() => undefined} />);
    const active = () => [...container.querySelectorAll(".study-board-list move.active")].map((node) => node.getAttribute("data-node-id"));
    expect(active()).toEqual(["2"]);
    rerender(<StudyMoves game={game} globalPly={4} seek={() => undefined} />);
    expect(active()).toEqual(["4", "3"]);
    rerender(<StudyMoves game={game} globalPly={6} seek={() => undefined} />);
    expect(active()).toEqual(["4", "6"]);
  });

  it("seeks the selected global node id", () => {
    const seek = vi.fn();
    const { container } = render(<StudyMoves game={game} globalPly={4} seek={seek} />);
    fireEvent.click(container.querySelector('move[data-node-id="3"]')!);
    expect(seek).toHaveBeenCalledWith(3);
  });
});
