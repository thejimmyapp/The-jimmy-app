import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import replayFixtures from "./fixtures/guest-match-replays.json";
import { GUEST_PROGRESS_KEY, emptyGuestProgress, loadGuestProgress } from "./guestProgress";
import { SIGN_IN_NOTICE } from "./guestChrome";
import { QUEST_DURATION_MS } from "./quest";
import { useCoachStore } from "./store";
import type { CallbackReplayBoard, GamePayload, NormalizedMatch } from "./types";

const apiMock = vi.hoisted(() => ({
  guestSession: vi.fn(),
  resetGuestSession: vi.fn(),
  accountMe: vi.fn(),
  claimAccount: vi.fn(),
  listMyMoments: vi.fn(),
  listPublicMoments: vi.fn(),
  games: vi.fn(),
  guestMatchups: vi.fn(),
  chessComMatchReplay: vi.fn(),
  game: vi.fn(),
  resolveGame: vi.fn(),
  connectChessCom: vi.fn(),
  enrichChessCom: vi.fn(),
  importPgn: vi.fn(),
  createRoom: vi.fn(),
  room: vi.fn(),
  joinRoom: vi.fn(),
  coachStatus: vi.fn(),
  runCoach: vi.fn(),
  coachJob: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./api")>();
  return { ...original, api: apiMock };
});
vi.mock("./socket", () => ({
  applyRoomSnapshot: vi.fn(),
  connectRoomSocket: vi.fn(),
  disconnectRoomSocket: vi.fn(),
  sendRoomEvent: vi.fn(),
}));
vi.mock("./components/BoardPanel", () => ({
  BoardPanel: ({ title, showTitle = true, unavailable, beforeAnalyze }: { title: string; showTitle?: boolean; unavailable?: boolean; beforeAnalyze?: () => Promise<boolean> }) => (
    <div data-testid={`board-${title}`}>{showTitle && <span>{title}</span>}{unavailable && <span>Second board was not included in the available Chess.com data.</span>}{beforeAnalyze && <button onClick={() => void beforeAnalyze()}>Run mocked analysis</button>}</div>
  ),
}));
vi.mock("./components/SidePanel", () => ({ SidePanel: ({ boardContent, dockBoardName = "Second Board" }: { boardContent: ReactNode; dockBoardName?: string }) => <div>Games panel<div role="tablist" aria-label="Review views"><button role="tab">Info</button><button role="tab">{dockBoardName}</button></div>{boardContent}</div> }));

const completeGame: GamePayload = {
  game: {
    id: 42,
    played_at: "2026-08-02T20:00:00Z",
    result: "win",
    opponent: "Opponent",
    opponent_rating: 1800,
    partner: "Partner",
    user_color: "white",
    time_control: "180",
    url: "https://www.chess.com/game/live/123456789",
  },
  players: {
    board_a_white: "FixtureUser",
    board_a_black: "Opponent",
    board_b_white: "DiagonalOpponent",
    board_b_black: "Partner",
  },
  moves_a: [],
  moves_b: [],
  positions_a: [],
  positions_b: [],
  timeline: [],
  second_board_available: true,
  limitations: [],
  outcome: {
    summary: "FixtureUser won",
    detail: "Completed game",
    loser_username: "Opponent",
    termination: "resigned",
    board: "A",
    board_role: "high",
    move_number: 1,
  },
};

const guestMatch: NormalizedMatch = {
  game_ids: { A: 180443871315, B: 180443871317 },
  end_time: 1_786_320_000,
  seats: {
    "A-white": { name: "vjbaker", rating: 2799 },
    "A-black": { name: "larso", rating: 2677 },
    "B-white": { name: "littleplotkin", rating: 2608 },
    "B-black": { name: "chickencrossroad", rating: 2408 },
  },
  ply_counts: { A: 71, B: 81 },
  decisive_board: "B",
  loser_seat: "B-black",
  action: "checkmated",
  highest_rated: { name: "vjbaker", rating: 2799, seat: "A-white", outcome: "LOST" },
  loser_relative_to_highest: "partner",
};

const renderApp = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
};

const startFromLanding = async () => {
  const carousel = screen.getByRole("region", { name: "Product introduction" });
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  return screen.findByRole("listbox", { name: "Guest matchups" });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  useCoachStore.setState({ username: "", game: null, guestMatch: null, games: [], roomId: null });
});

describe("URL-first exact review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    history.replaceState(null, "", "/");
    useCoachStore.setState({ username: "", game: null, guestMatch: null, games: [], roomId: null });
    apiMock.guestSession.mockResolvedValue({ guest_number: 13, total_guests: 13, completions_to_date: null, saved_moment_count: 0, analysis_unlocked: false });
    apiMock.resetGuestSession.mockResolvedValue({ guest_number: 14, total_guests: 14, completions_to_date: null, saved_moment_count: 0, analysis_unlocked: false });
    apiMock.accountMe.mockResolvedValue({ account: null });
    apiMock.listMyMoments.mockResolvedValue({ moments: [] });
    apiMock.listPublicMoments.mockResolvedValue({ moments: [] });
    apiMock.games.mockResolvedValue({ games: [] });
    apiMock.guestMatchups.mockResolvedValue({
      matches: Array.from({ length: 5 }, (_, index) => ({
        ...guestMatch,
        game_ids: { A: guestMatch.game_ids.A + index * 2, B: guestMatch.game_ids.B + index * 2 },
      })),
      examined: 5,
      excluded: 0,
      exclusion_counts: {},
      players_sampled: ["vjbaker", "nochewycandy"],
      players_represented: ["vjbaker", "nochewycandy", "third-player"],
      seed_source: "leaderboard_top_50",
      cached: false,
    });
    const fixture = replayFixtures.matches[0].boards;
    apiMock.chessComMatchReplay.mockResolvedValue({
      match: guestMatch,
      boards: {
        A: { ...fixture.A, id: guestMatch.game_ids.A } as CallbackReplayBoard,
        B: { ...fixture.B, id: guestMatch.game_ids.B } as CallbackReplayBoard,
      },
    });
    apiMock.game.mockResolvedValue(completeGame);
    apiMock.resolveGame.mockResolvedValue({
      status: "resolved",
      source: "stored",
      external_game_id: "123456789",
      game_id: 42,
      game: completeGame,
    });
    apiMock.room.mockResolvedValue({ id: "room-1", game_id: null, snapshot: {} });
    apiMock.joinRoom.mockResolvedValue({ client_id: "client-1", display_name: "Guest" });
    apiMock.coachStatus.mockResolvedValue({ enabled: false, state: "disabled" });
    apiMock.importPgn.mockResolvedValue({ created: true, source: "manual", second_board_supplied: true, game_id: 42 });
    apiMock.enrichChessCom.mockResolvedValue({ checked: 0, enriched: 0, remaining_without_second_board: 0, credentials_stored: false });
  });

  it("keeps ordinary RAIL chrome and DOCK inert on the landing and matchup phases", async () => {
    const { container } = renderApp();
    const rail = container.querySelector(".app-rail");
    const lockedRailContent = container.querySelector(".app-rail-locked-content");
    const dock = container.querySelector(".app-dock");
    expect(rail?.hasAttribute("inert")).toBe(false);
    expect(lockedRailContent?.hasAttribute("inert")).toBe(true);
    expect(dock?.hasAttribute("inert")).toBe(true);
    expect(lockedRailContent?.getAttribute("aria-hidden")).toBe("true");
    expect(dock?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("navigation", { name: "Main views" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Task tools" })).toBeNull();
    expect(screen.getByRole("link", { name: "Open mission" }).getAttribute("href")).toBe("/mission");
    expect(screen.getByRole("button", { name: "Open flashcard library" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Privacy" })).toBeNull();
    expect(container.querySelector(".guest-entry-node")).toBeNull();
    expect(container.querySelector("#onboarding-username")).toBeNull();

    await startFromLanding();
    expect(screen.getByTestId("quest-progress").textContent).toBe("0/3 learning moments published");
    expect(lockedRailContent?.hasAttribute("inert")).toBe(true);
    expect(dock?.hasAttribute("inert")).toBe(true);
  });

  it("renders the landing carousel and disabled account actions without starting the quest", () => {
    renderApp();
    expect(screen.getByRole("region", { name: "Product introduction" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Go to slide/ })).toHaveLength(4);
    const login = screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement;
    const signup = screen.getByRole("button", { name: "Sign up" }) as HTMLButtonElement;
    expect(login.disabled).toBe(true);
    expect(login.title).toBe(SIGN_IN_NOTICE);
    expect(signup.disabled).toBe(true);
    expect(signup.title).toBe(SIGN_IN_NOTICE);
    expect(loadGuestProgress().questDeadline).toBeNull();
  });

  it("uses Wood Classic and Cburnett defaults on first load", () => {
    const { container } = renderApp();
    const shell = container.querySelector(".app-shell");
    expect(shell?.getAttribute("data-board-theme")).toBe("wood-classic");
    expect(shell?.getAttribute("data-piece-set")).toBe("cburnett");
  });

  it("continues to apply saved legacy appearance ids", () => {
    localStorage.setItem("thejimmyapp.boardTheme", "violet");
    localStorage.setItem("thejimmyapp.pieceStyle", "soft");
    const { container } = renderApp();
    const shell = container.querySelector(".app-shell");
    expect(shell?.getAttribute("data-board-theme")).toBe("violet");
    expect(shell?.getAttribute("data-piece-set")).toBe("soft");
  });

  it("renders registry-backed theme and Piece set cards in settings", () => {
    const progress = emptyGuestProgress();
    progress.capabilities.rail_settings = "unlocked";
    localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(progress));
    useCoachStore.setState({ game: completeGame });
    const { container } = renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Board settings", hidden: true }));
    expect(screen.getByRole("heading", { name: "Piece set" })).toBeTruthy();
    expect(container.querySelectorAll(".theme-grid .appearance-mini-board")).toHaveLength(8);
    expect(Array.from(container.querySelectorAll(".piece-style-grid .piece-style-card")).map((card) => card.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Cburnett"), expect.stringContaining("Classic"), expect.stringContaining("Filled"), expect.stringContaining("Bold"), expect.stringContaining("Soft")]));
  });

  it("hydrates an existing account for a server-completed guest", async () => {
    apiMock.guestSession.mockResolvedValue({ guest_number: 13, total_guests: 13, completions_to_date: 13, saved_moment_count: 3, analysis_unlocked: false, completed: true, completion_ordinal: 7 });
    apiMock.accountMe.mockResolvedValue({
      account: {
        guest_number: 13,
        email: "claimed@example.com",
        completion_ordinal: 7,
        founder_eligible: true,
        created_at: "2026-08-11T00:00:00+00:00",
      },
    });
    renderApp();

    await waitFor(() => expect(apiMock.accountMe).toHaveBeenCalledTimes(1));
    expect((screen.getByRole("button", { name: "Sign up" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Open flashcard library" }));
    expect(await screen.findByText("Claimed — Founder #7")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
  });

  it("shows one working Sign up action for a completed guest on the landing", async () => {
    apiMock.guestSession.mockResolvedValue({ guest_number: 13, total_guests: 13, completions_to_date: 13, saved_moment_count: 3, analysis_unlocked: false, completed: true, completion_ordinal: 7 });
    apiMock.accountMe.mockResolvedValue({ account: null });
    renderApp();

    await waitFor(() => expect(screen.getByTestId("quest-progress").textContent).toBe("3/3 learning moments published"));
    const signUp = screen.getByRole("button", { name: "Sign up" }) as HTMLButtonElement;
    expect(signUp.disabled).toBe(false);
    expect(signUp.title).toBe("");
    fireEvent.click(signUp);
    expect(document.querySelector("#guest-account-email")).not.toBeNull();
  });

  it("does not expose the private UI library from the public app", () => {
    renderApp();
    expect(screen.queryByRole("link", { name: "Open building blocks" })).toBeNull();
  });

  it("restores a standalone exact review from the browser URL on reload", async () => {
    history.replaceState(null, "", "/?game=42");
    renderApp();

    await waitFor(() => expect(apiMock.game).toHaveBeenCalledWith(42));
    expect(await screen.findByTestId("board-First Board")).toBeTruthy();
    expect(screen.queryByText("First Board")).toBeNull();
    expect(new URLSearchParams(location.search).get("game")).toBe("42");
  });

  it("loads guest matchups, selects by keyboard, and unlocks Review with Info and Second Board", async () => {
    renderApp();
    const statistics = screen.getByRole("button", { name: "Statistics", hidden: true }) as HTMLButtonElement;
    expect(statistics.disabled).toBe(true);
    const list = await startFromLanding();
    fireEvent.keyDown(list, { key: "Enter" });

    await waitFor(() => expect(useCoachStore.getState().guestMatch).toEqual(guestMatch));
    expect(useCoachStore.getState().game?.timeline.length).toBeGreaterThan(100);
    expect(screen.getByTestId("board-First Board")).toBeTruthy();
    expect(screen.getByTestId("board-Second Board")).toBeTruthy();
    expect(screen.queryByText("BOARD A · FEATURED PLAYER")).toBeNull();
    expect(screen.queryByText("BOARD B · PARTNER BOARD")).toBeNull();
    expect(screen.queryByText(/175% browser zoom/)).toBeNull();
    expect((screen.getByRole("button", { name: "Review" }) as HTMLButtonElement).disabled).toBe(false);
    expect(Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-label="Review views"] > button')).map((button) => button.textContent)).toEqual(["Info", "Second Board"]);
    expect(statistics.disabled).toBe(true);
    const stored = JSON.parse(localStorage.getItem(GUEST_PROGRESS_KEY) ?? "{}") as { capabilities?: Record<string, string> };
    expect(stored.capabilities?.rail_review).toBe("unlocked");
    expect(stored.capabilities?.dock_review).toBe("unlocked");
    expect(stored.capabilities?.rail_statistics).toBe("locked");
    expect(stored.capabilities?.board_analysis).toBe("locked");
    expect(stored.capabilities?.team_coach).toBe("locked");
    expect(apiMock.guestMatchups).toHaveBeenCalledOnce();
    expect(apiMock.chessComMatchReplay).toHaveBeenCalledWith(guestMatch.game_ids.A);
    expect(apiMock.resolveGame).not.toHaveBeenCalled();
    expect(apiMock.connectChessCom).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Notes board" }));
    expect(await screen.findByRole("heading", { name: "Notes board" })).toBeTruthy();
    expect(await screen.findByText("No public moments yet.")).toBeTruthy();
    expect(apiMock.listPublicMoments).toHaveBeenCalledOnce();
  });

  it("requires and persists the versioned acknowledgement only when analysis is requested", async () => {
    history.replaceState(null, "", "/?game=42");
    renderApp();
    expect(await screen.findByTestId("board-First Board")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /analysis acknowledgement/i })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Run mocked analysis" })[0]);
    const continueButton = screen.getByRole("button", { name: "Continue to analysis" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/single-board engine suggestion/i));
    fireEvent.click(screen.getByLabelText(/missing Chess.com data/i));
    fireEvent.click(continueButton);
    expect(localStorage.getItem("thejimmyapp.analysisAcknowledgement.v1")).toBe("analysis-limits-2026-08-06");
  });

  it("gives room links precedence over a standalone game query", async () => {
    history.replaceState(null, "", "/?room=room-1&game=42");
    useCoachStore.setState({ roomId: "room-1", game: null });
    renderApp();

    await waitFor(() => expect(apiMock.room).toHaveBeenCalledWith("room-1"));
    expect(apiMock.game).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Review the game you just played." })).toBeNull();
  });

  it("sets the five-minute deadline only when Start is pressed", async () => {
    const now = new Date("2026-09-07T18:00:00.000Z").getTime();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    renderApp();
    expect(loadGuestProgress().questDeadline).toBeNull();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();

    await startFromLanding();

    expect(loadGuestProgress().questDeadline).toBe(now + QUEST_DURATION_MS);
    expect(apiMock.guestMatchups).toHaveBeenCalledOnce();
    clock.mockRestore();
  });
});
