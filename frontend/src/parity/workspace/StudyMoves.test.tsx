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
const longGame: GamePayload = {
  ...game,
  timeline: [game.timeline[0], ...Array.from({ length: 40 }, (_, index) => {
    const global_ply = index + 1;
    return { global_ply, board: global_ply % 2 ? "A" as const : "B" as const, local_ply: Math.ceil(global_ply / 2), move: `Move ${global_ply}`, board_a: position, board_b: position };
  })],
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

  it("autoscrolls the second list from its own scroll-container origin", () => {
    const { container, rerender } = render(<StudyMoves game={longGame} globalPly={2} seek={() => undefined} />);
    const boxes = container.querySelectorAll<HTMLElement>(".study-board-list .parity-tree");
    Object.defineProperty(boxes[0], "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(boxes[1], "clientHeight", { configurable: true, value: 100 });
    boxes[0].getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 100, width: 300, height: 100, toJSON: () => ({}) });
    boxes[1].getBoundingClientRect = () => ({ x: 0, y: 300, top: 300, left: 0, right: 300, bottom: 400, width: 300, height: 100, toJSON: () => ({}) });
    const activeA = container.querySelector<HTMLElement>('move[data-node-id="39"]')!;
    const activeB = container.querySelector<HTMLElement>('move[data-node-id="40"]')!;
    activeA.getBoundingClientRect = () => ({ x: 0, y: 20, top: 20, left: 0, right: 100, bottom: 49, width: 100, height: 29, toJSON: () => ({}) });
    activeB.getBoundingClientRect = () => ({ x: 0, y: 500, top: 500, left: 0, right: 100, bottom: 529, width: 100, height: 29, toJSON: () => ({}) });
    rerender(<StudyMoves game={longGame} globalPly={40} seek={() => undefined} />);
    expect(boxes[0].scrollTop).toBe(0);
    expect(boxes[1].scrollTop).toBeCloseTo(500 - 300 - 100 / 3);
  });
});
