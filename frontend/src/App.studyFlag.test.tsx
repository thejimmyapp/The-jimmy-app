import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useCoachStore } from "./store";
import type { GamePayload, NormalizedMatch, ReplayPosition } from "./types";

const apiMock = vi.hoisted(() => ({
  guestSession: vi.fn(), resetGuestSession: vi.fn(), accountMe: vi.fn(), claimAccount: vi.fn(), listMyMoments: vi.fn(), listPublicMoments: vi.fn(), games: vi.fn(),
  guestMatchups: vi.fn(), chessComMatchReplay: vi.fn(), game: vi.fn(), resolveGame: vi.fn(), connectChessCom: vi.fn(), enrichChessCom: vi.fn(), importPgn: vi.fn(),
  createRoom: vi.fn(), room: vi.fn(), joinRoom: vi.fn(), coachStatus: vi.fn(), runCoach: vi.fn(), coachJob: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => ({ ...(await importOriginal<typeof import("./api")>()), api: apiMock }));
vi.mock("./socket", () => ({ applyRoomSnapshot: vi.fn(), connectRoomSocket: vi.fn(), disconnectRoomSocket: vi.fn(), sendRoomEvent: vi.fn() }));
vi.mock("./components/BoardPanel", () => ({ BoardPanel: () => <div data-testid="legacy-review-board" /> }));
vi.mock("./components/SidePanel", () => ({ SidePanel: () => <div data-testid="legacy-review-dock" /> }));
vi.mock("./parity/workspace/StudyWorkspace", () => ({ StudyWorkspace: ({ onSaveMoment, saveMomentDisabled }: { onSaveMoment?: () => void; saveMomentDisabled?: boolean }) => <section aria-label="Study review workspace"><button type="button" onClick={onSaveMoment} disabled={saveMomentDisabled} aria-disabled={saveMomentDisabled}>Save moment</button></section> }));

const position: ReplayPosition = {
  ply: 0, label: "Start", board: Array.from({ length: 8 }, () => Array(8).fill("")), side_to_move: "White", variant_fen: "", white_pocket: "", black_pocket: "",
  white_clock: "3:00", black_clock: "3:00", partner_index: 0, from_square: null, to_square: null,
};
const game: GamePayload = {
  game: { id: 42, played_at: "", result: "*", opponent: null, opponent_rating: null, partner: null, user_color: "white", time_control: "180" },
  players: { board_a_white: "A White", board_a_black: "A Black", board_b_white: "B White", board_b_black: "B Black" },
  moves_a: [], moves_b: [], positions_a: [position], positions_b: [position],
  timeline: [
    { global_ply: 0, board: "A", local_ply: 0, move: "Start", board_a: position, board_b: position },
    { global_ply: 1, board: "A", local_ply: 1, move: "e4", board_a: position, board_b: position },
  ],
  second_board_available: true, limitations: [], outcome: { summary: "", detail: "", loser_username: null, termination: null, board: null, board_role: null, move_number: null },
};
const match: NormalizedMatch = {
  game_ids: { A: 42, B: 43 }, end_time: 1, seats: {
    "A-white": { name: "A White", rating: 2200 }, "A-black": { name: "A Black", rating: 2100 },
    "B-white": { name: "B White", rating: 2000 }, "B-black": { name: "B Black", rating: 1900 },
  }, ply_counts: { A: 1, B: 0 }, decisive_board: "A", loser_seat: "A-black", action: "checkmated",
  highest_rated: { name: "A White", rating: 2200, seat: "A-white", outcome: "WON" }, loser_relative_to_highest: "oppo",
};

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><App /></QueryClientProvider>);
}

describe("opt-in study UI mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    history.replaceState(null, "", "/");
    useCoachStore.setState({ game, globalPly: 0, mode: "review", guestMatch: null, roomId: null, username: "" });
    apiMock.guestSession.mockResolvedValue({ guest_number: 1, total_guests: 1, completions_to_date: null, saved_moment_count: 0, analysis_unlocked: false });
    apiMock.accountMe.mockResolvedValue({ account: null });
    apiMock.listMyMoments.mockResolvedValue({ moments: [] });
    apiMock.listPublicMoments.mockResolvedValue({ moments: [] });
    apiMock.games.mockResolvedValue({ games: [] });
  });
  afterEach(() => { cleanup(); useCoachStore.setState({ game: null }); });

  it("keeps the legacy stage and dock when the flag is absent", () => {
    renderApp();
    expect(screen.queryByRole("region", { name: "Study review workspace" })).toBeNull();
    expect(screen.getByTestId("legacy-review-board")).not.toBeNull();
    expect(screen.getByTestId("legacy-review-dock")).not.toBeNull();
  });

  it("mounts the study workspace and suppresses the legacy stage and dock with ?ui=study", () => {
    history.replaceState(null, "", "/?ui=study");
    renderApp();
    expect(screen.getByRole("region", { name: "Study review workspace" })).not.toBeNull();
    expect(screen.queryByTestId("legacy-review-board")).toBeNull();
    expect(screen.queryByTestId("legacy-review-dock")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Main views" })).not.toBeNull();
  });

  it("routes the study Save moment tab through the existing moment editor handler", () => {
    history.replaceState(null, "", "/?ui=study");
    useCoachStore.setState({ game, guestMatch: match, globalPly: 1, mode: "review" });
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Save moment" }));
    expect(screen.getByLabelText("Learning moment wizard steps 1 through 4")).not.toBeNull();
  });

  it("disables Save moment at global ply 0 and enables it at a capturable ply", () => {
    history.replaceState(null, "", "/?ui=study");
    useCoachStore.setState({ game, guestMatch: match, globalPly: 0, mode: "review" });
    renderApp();
    expect((screen.getByRole("button", { name: "Save moment" }) as HTMLButtonElement).disabled).toBe(true);
    act(() => useCoachStore.setState({ globalPly: 1 }));
    expect((screen.getByRole("button", { name: "Save moment" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
