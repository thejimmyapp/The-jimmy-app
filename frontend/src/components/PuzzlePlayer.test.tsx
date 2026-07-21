import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PuzzlePayload, ReplayPosition } from "../types";
import { PuzzlePlayer } from "./PuzzlePlayer";

const apiMock = vi.hoisted(() => ({
  puzzle: vi.fn(),
  explorationMove: vi.fn(),
  explorationSanMove: vi.fn(),
  puzzleMove: vi.fn(),
  puzzleNextMove: vi.fn(),
  puzzleSolution: vi.fn(),
}));

vi.mock("../api", () => ({ api: apiMock }));
vi.mock("./BoardPanel", () => ({
  BoardPanel: ({ title, onMoveIntent }: { title: string; onMoveIntent: (intent: { board: "A"; from: string; to: string }) => Promise<unknown> }) => (
    <button aria-label={title} onClick={() => void onMoveIntent({ board: "A", from: "d1", to: "d7" })}>{title}</button>
  ),
}));

const position = (fen: string): ReplayPosition => ({
  ply: 0,
  label: "Puzzle start",
  board: Array.from({ length: 8 }, () => Array<string>(8).fill("")),
  side_to_move: "White",
  variant_fen: fen,
  white_pocket: "-",
  black_pocket: "-",
  white_clock: "--:--",
  black_clock: "--:--",
  partner_index: null,
  from_square: null,
  to_square: null,
});

const puzzle: PuzzlePayload = {
  id: "9a026277569e649bc6d2133c98383990fe75f4e1",
  title: "RyanTime's forcing promotion",
  prompt: "RyanTime to move on Board A.",
  boards: ["board-a", "board-b"],
  positions: { board_a: position("board-a"), board_b: position("board-b") },
  perspective: { board: "A", color: "white" },
  category: "forcing line",
  rating: 1600,
  tags: ["real-game", "two-board-context"],
  source: { player: "RyanTime", game_id: "175403513133", partner_game_id: "175403513135", url: "https://www.chess.com/live/game/175403513133" },
  players: { board_a_white: "RyanTime", board_a_black: "Boratinio", board_b_white: "Amiran1217", board_b_black: "rookie879" },
};

const renderPuzzle = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><PuzzlePlayer puzzleId={puzzle.id} /></QueryClientProvider>);
};

describe("real-game puzzle player", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.puzzle.mockResolvedValue(puzzle);
  });
  afterEach(cleanup);

  it("loads both boards and identifies the real source game", async () => {
    renderPuzzle();
    expect(await screen.findByRole("button", { name: "BOARD A · RYANTIME" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "BOARD B · PARTNER CONTEXT" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Original game/ }).getAttribute("href")).toBe(puzzle.source.url);
  });

  it("rejects a legal non-solution move without advancing history", async () => {
    apiMock.explorationMove.mockResolvedValue({
      legal: true,
      notation: "Q@d7",
      board_a: position("moved-a"),
      board_b: position("moved-b"),
    });
    apiMock.puzzleMove.mockResolvedValue({ status: "wrong_move" });
    renderPuzzle();
    fireEvent.click(await screen.findByRole("button", { name: "BOARD A · RYANTIME" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("misses the forcing idea"));
    expect(apiMock.puzzleMove).toHaveBeenCalledWith(puzzle.id, [{ board: "A", san: "Q@d7" }]);
    expect(screen.getByText("0/0")).toBeTruthy();
  });
});
