import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ApiError } from "./api";
import { useCoachStore } from "./store";
import type { GamePayload } from "./types";

const apiMock = vi.hoisted(() => ({
  games: vi.fn(),
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
  sendRoomEvent: vi.fn(),
}));
vi.mock("./components/BoardPanel", () => ({
  BoardPanel: ({ title, unavailable }: { title: string; unavailable?: boolean }) => (
    <div><span>{title}</span>{unavailable && <span>Partner board was not included in the available Chess.com data.</span>}</div>
  ),
}));
vi.mock("./components/SidePanel", () => ({ SidePanel: () => <div>Games panel</div> }));
vi.mock("./components/Timeline", () => ({ Timeline: () => <div>Timeline</div> }));

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

const renderApp = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
};

afterEach(() => {
  cleanup();
  useCoachStore.setState({ username: "", game: null, games: [], roomId: null });
});

describe("URL-first exact review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    history.replaceState(null, "", "/");
    useCoachStore.setState({ username: "", game: null, games: [], roomId: null });
    apiMock.games.mockResolvedValue({ games: [] });
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

  it("makes the exact Chess.com URL the primary empty-state action and opens it directly", async () => {
    renderApp();

    expect(screen.getByRole("heading", { name: "Review the game you just played." })).toBeTruthy();
    expect(screen.queryByText("Games panel")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Paste Chess.com game URL" }), {
      target: { value: "https://www.chess.com/game/live/123456789?move=0" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Chess.com username needed/ }), {
      target: { value: "FixtureUser" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review this game" }));

    await waitFor(() => expect(apiMock.resolveGame).toHaveBeenCalledWith(
      "https://www.chess.com/game/live/123456789?move=0",
      "FixtureUser",
    ));
    expect(await screen.findByText("BOARD A · YOUR BOARD")).toBeTruthy();
    expect(screen.getByText("BOARD B · PARTNER BOARD")).toBeTruthy();
    expect(new URLSearchParams(location.search).get("game")).toBe("42");
  });

  it("restores a standalone exact review from the browser URL on reload", async () => {
    history.replaceState(null, "", "/?game=42");
    renderApp();

    await waitFor(() => expect(apiMock.game).toHaveBeenCalledWith(42));
    expect(await screen.findByText("BOARD A · YOUR BOARD")).toBeTruthy();
    expect(new URLSearchParams(location.search).get("game")).toBe("42");
  });

  it("gives room links precedence over a standalone game query", async () => {
    history.replaceState(null, "", "/?room=room-1&game=42");
    useCoachStore.setState({ roomId: "room-1", game: null });
    renderApp();

    await waitFor(() => expect(apiMock.room).toHaveBeenCalledWith("room-1"));
    expect(apiMock.game).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Review the game you just played." })).toBeNull();
  });

  it("opens a successful two-PGN import instead of returning the user to the archive", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Import both board PGNs" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Chess.com username" }), { target: { value: "FixtureUser" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Board A PGN" }), { target: { value: '[Variant "Bughouse"]\n[Result "1-0"]\n\n1. e4 1-0' } });
    fireEvent.change(screen.getByRole("textbox", { name: "Board B PGN" }), { target: { value: '[Variant "Bughouse"]\n[Result "0-1"]\n\n1. d4 0-1' } });
    fireEvent.click(screen.getByRole("button", { name: "Import complete game" }));

    await waitFor(() => expect(apiMock.importPgn).toHaveBeenCalled());
    await waitFor(() => expect(apiMock.game).toHaveBeenCalledWith(42));
    expect(await screen.findByText("BOARD B · PARTNER BOARD")).toBeTruthy();
    expect(new URLSearchParams(location.search).get("game")).toBe("42");
    await waitFor(() => expect(apiMock.games.mock.calls.length).toBeGreaterThan(1));
  });

  it("keeps pgn-info enrichment as an advanced optional connector", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Import both board PGNs" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Chess.com username" }), { target: { value: "FixtureUser" } });
    fireEvent.click(screen.getByRole("button", { name: "Advanced pgn-info enrichment" }));

    expect(screen.getByText("Recover partner boards from Chess.com pgn-info")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Codex setup prompt" })).toBeTruthy();
    fireEvent.click(screen.getByText("Paste pgn-info cURL"));
    fireEvent.change(screen.getByPlaceholderText("Paste the pgn-info cURL request"), {
      target: { value: "curl 'https://www.chess.com/callback/game/pgn-info' -b 'session=fake' --data-raw '{\"_token\":\"fake\"}'" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enrich existing games" }));

    await waitFor(() => expect(apiMock.enrichChessCom).toHaveBeenCalledWith("FixtureUser", expect.stringContaining("pgn-info")));
    expect(await screen.findByText("Checked 0 games. Enriched 0. Credentials stored: no.")).toBeTruthy();
  });

  it("keeps an exact not-found result in the entry state with a whitelisted fallback", async () => {
    apiMock.resolveGame.mockRejectedValue(new ApiError(404, "That exact completed Bughouse game was not found in the available data.", {
      code: "game_not_found",
      external_game_id: "123456789",
    }));
    renderApp();
    fireEvent.change(screen.getByRole("textbox", { name: "Paste Chess.com game URL" }), {
      target: { value: "https://www.chess.com/live/game/123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review this game" }));

    expect(await screen.findByText("We could not open that exact game.")).toBeTruthy();
    const fallback = screen.getByRole("link", { name: /Open this game in bMacho/ });
    expect(fallback.getAttribute("href")).toBe("https://bmacho.github.io/bughouse-viewer/view.html?game_id=123456789");
    expect(screen.queryByText("BOARD A · YOUR BOARD")).toBeNull();
  });
});
