import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useCoachStore } from "./store";

const apiMock = vi.hoisted(() => ({
  games: vi.fn(),
  game: vi.fn(),
  connectChessCom: vi.fn(),
  importPgn: vi.fn(),
  createRoom: vi.fn(),
  room: vi.fn(),
  joinRoom: vi.fn(),
  coachStatus: vi.fn(),
  runCoach: vi.fn(),
  coachJob: vi.fn(),
}));

vi.mock("./api", () => ({ api: apiMock }));
vi.mock("./socket", () => ({
  applyRoomSnapshot: vi.fn(),
  connectRoomSocket: vi.fn(),
  sendRoomEvent: vi.fn(),
}));
vi.mock("./components/BoardPanel", () => ({ BoardPanel: ({ title }: { title: string }) => <div>{title}</div> }));
vi.mock("./components/SidePanel", () => ({ SidePanel: () => <div>Games panel</div> }));
vi.mock("./components/Timeline", () => ({ Timeline: () => <div>Timeline</div> }));

const renderApp = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
};

describe("two-board PGN import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useCoachStore.setState({ username: "", game: null, games: [], roomId: null });
    apiMock.games.mockResolvedValue({ games: [] });
    apiMock.coachStatus.mockResolvedValue({ enabled: false, state: "disabled" });
    apiMock.importPgn.mockResolvedValue({ created: true, source: "manual", second_board_supplied: true });
  });

  it("offers only a credential-free completed-game import path", async () => {
    renderApp();
    fireEvent.change(screen.getByRole("textbox", { name: "Chess.com username" }), { target: { value: "FixtureUser" } });
    fireEvent.click(screen.getByRole("button", { name: "Import two-board PGNs" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Board A PGN" }), { target: { value: '[Variant "Bughouse"]\n[Result "1-0"]\n\n1. e4 1-0' } });
    fireEvent.change(screen.getByRole("textbox", { name: "Board B PGN" }), { target: { value: '[Variant "Bughouse"]\n[Result "0-1"]\n\n1. d4 0-1' } });
    fireEvent.click(screen.getByRole("button", { name: "Import complete game" }));

    await waitFor(() => expect(apiMock.importPgn).toHaveBeenCalledWith(
      "FixtureUser",
      '[Variant "Bughouse"]\n[Result "1-0"]\n\n1. e4 1-0',
      '[Variant "Bughouse"]\n[Result "0-1"]\n\n1. d4 0-1',
    ));
    await waitFor(() => expect(apiMock.games.mock.calls.length).toBeGreaterThan(1));
    expect(await screen.findByText("Complete two-board game imported. No Chess.com credentials were used or stored.")).toBeTruthy();
    expect(screen.queryByText(/pgn-info/i)).toBeNull();
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
  });
});
