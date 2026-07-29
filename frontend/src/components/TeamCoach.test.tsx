import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCoachStore } from "../store";
import type { CoachPreparedPayload, GamePayload, ReplayPosition } from "../types";
import { TeamCoach } from "./TeamCoach";

const apiMock = vi.hoisted(() => ({ coachStatus: vi.fn(), runCoach: vi.fn(), coachJob: vi.fn() }));
vi.mock("../api", () => ({ api: apiMock }));

const position = (fen: string, side: string): ReplayPosition => ({
  ply: 4,
  label: "Position",
  board: Array.from({ length: 8 }, () => Array<string>(8).fill("")),
  side_to_move: side,
  variant_fen: fen,
  white_pocket: "N",
  black_pocket: "p",
  white_clock: "0:24",
  black_clock: "0:19",
  partner_index: 4,
  from_square: "e2",
  to_square: "e4",
});

const boardA = position("board-a-fen[] w - - 0 1", "White");
const boardB = position("board-b-fen[] b - - 0 1", "Black");
const game = {
  game: { id: 42, played_at: "2026-07-29", result: "win", opponent: "Opponent", opponent_rating: 1900, partner: "Partner", user_color: "white", time_control: "180" },
  players: { board_a_white: "Jimmy", board_a_black: "Opponent", board_b_white: "Diagonal", board_b_black: "Partner" },
  moves_a: [], moves_b: [], positions_a: [boardA], positions_b: [boardB], timeline: [], second_board_available: true, limitations: [],
  outcome: { summary: "Jimmy's team won.", detail: "Fixture", loser_username: "Opponent", termination: "checkmated", board: "A", board_role: "high", move_number: 2 },
} satisfies GamePayload;

const prepared: CoachPreparedPayload = {
  mode: "validated_context",
  summary: "Both boards are ready.",
  prompt: "complete two-board prompt",
  context: {},
  board_a: { available: true, best_move: "N@f7", threats: [], mistakes: [] },
  board_b: { available: true, best_move: null, threats: [], mistakes: [] },
  team_plan: [], piece_requests: [], urgency: "unknown", quick_questions: [],
  privacy: "No external AI API key is used.",
};

const renderCoach = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><TeamCoach open onClose={() => undefined} boardA={boardA} boardB={boardB} orientationA="white" orientationB="black" analyses={{ A: { status: "completed", bestmove: "N@f7", scoreCp: 180, depth: 10 } }} /></QueryClientProvider>);
};

describe("Team Coach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const modelStatus = { enabled: true, state: "ready", detail: "Model ready", model: "Qwen", model_file: "Qwen3.5-4B-Q4_K_M.gguf", model_downloaded: true, runtime_available: true, context_size: 8192, max_tokens: 1200, temperature: 0.15, top_p: 0.85 };
    apiMock.coachStatus.mockResolvedValue(modelStatus);
    apiMock.runCoach.mockResolvedValue({ job_id: "job-1", status: "queued" });
    apiMock.coachJob.mockResolvedValue({ status: "completed", stage: "Review ready", result: { explanation: "Validated coaching", qwen_error: null, prepared, model: modelStatus } });
    useCoachStore.setState({ game, username: "Jimmy", globalPly: 4, annotations: [] });
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(cleanup);

  it("runs both boards through the coupled pipeline and copies validated evidence", async () => {
    renderCoach();
    fireEvent.click(screen.getByRole("button", { name: "Run coupled AI review" }));
    expect(await screen.findByText("Coupled review ready")).toBeTruthy();
    expect(apiMock.runCoach.mock.calls[0][0]).toEqual(expect.objectContaining({ game_id: 42, board_a: expect.any(Object), board_b: expect.any(Object) }));
    fireEvent.click(screen.getByRole("button", { name: "Copy validated evidence" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("complete two-board prompt"));
  });
});
