import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import replayFixtures from "./fixtures/guest-match-replays.json";
import { sendRoomEvent } from "./socket";
import { useCoachStore } from "./store";
import type { CallbackReplayBoard, GuestMatchReplaySource, NormalizedMatch } from "./types";

const apiMock = vi.hoisted(() => ({
  guestSession: vi.fn(),
  resetGuestSession: vi.fn(),
  guestMatchups: vi.fn(),
  chessComMatchReplay: vi.fn(),
}));

vi.mock("./api", async (importOriginal) => {
  const original = await importOriginal<typeof import("./api")>();
  return { ...original, api: { ...original.api, ...apiMock } };
});

vi.mock("./socket", () => ({
  applyRoomSnapshot: vi.fn(),
  connectRoomSocket: vi.fn(),
  disconnectRoomSocket: vi.fn(),
  sendRoomEvent: vi.fn(),
}));

const boardA = replayFixtures.matches[0].boards.A as CallbackReplayBoard;
const boardB = replayFixtures.matches[0].boards.B as CallbackReplayBoard;
const match: NormalizedMatch = {
  game_ids: { A: boardA.id, B: boardB.id },
  end_time: 1_786_320_000,
  seats: {
    "A-white": { name: String(boardA.headers.White), rating: Number(boardA.headers.WhiteElo) },
    "A-black": { name: String(boardA.headers.Black), rating: Number(boardA.headers.BlackElo) },
    "B-white": { name: String(boardB.headers.White), rating: Number(boardB.headers.WhiteElo) },
    "B-black": { name: String(boardB.headers.Black), rating: 1000 },
  },
  ply_counts: { A: boardA.plyCount, B: boardB.plyCount },
  decisive_board: "A",
  loser_seat: "A-white",
  action: "checkmated",
  highest_rated: { name: String(boardB.headers.White), rating: Number(boardB.headers.WhiteElo), seat: "B-white", outcome: "LOST" },
  loser_relative_to_highest: "diag oppo",
};
const source: GuestMatchReplaySource = { match, boards: { A: boardA, B: boardB } };

const startFromLanding = async () => {
  const carousel = screen.getByRole("region", { name: "Product introduction" });
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  fireEvent.keyDown(carousel, { key: "ArrowRight" });
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  return screen.findByRole("listbox", { name: "Guest matchups" });
};

describe("guest replay workspace integration", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/");
    useCoachStore.setState({ game: null, guestMatch: null, roomId: null, globalPly: 0, mode: "review" });
    apiMock.guestSession.mockResolvedValue({ guest_number: 13, total_guests: 13, completions_to_date: null, saved_moment_count: 0, analysis_unlocked: false });
    apiMock.resetGuestSession.mockResolvedValue({ guest_number: 14, total_guests: 14, completions_to_date: null, saved_moment_count: 0, analysis_unlocked: false });
    apiMock.guestMatchups.mockResolvedValue({
      matches: [match],
      examined: 1,
      excluded: 0,
      exclusion_counts: {},
      players_sampled: ["one", "two", "three"],
      players_represented: ["one", "two", "three"],
      seed_source: "players_of_interest",
      cached: false,
    });
    apiMock.chessComMatchReplay.mockResolvedValue(source);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("stages a featured player on the rating-derived Second Board and preserves named focus through swaps", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><App /></QueryClientProvider>);

    const list = await startFromLanding();
    fireEvent.keyDown(list, { key: "Enter" });

    const stagedSecondBoard = await screen.findByLabelText("Second Board chessboard");
    const dockFirstBoard = screen.getByLabelText("First Board chessboard");
    const stagedSecondPanel = stagedSecondBoard.closest(".board-panel") as HTMLElement;
    const dockFirstPanel = dockFirstBoard.closest(".board-panel") as HTMLElement;
    const secondaryRail = document.querySelector(".review-secondary") as HTMLElement;
    expect(screen.queryByText("BOARD A · FEATURED PLAYER")).toBeNull();
    expect(within(secondaryRail).getByLabelText("First Board chessboard")).toBe(dockFirstBoard);
    expect(within(stagedSecondBoard).getAllByRole("button")).toHaveLength(64);
    expect(within(stagedSecondBoard).getAllByRole("button")[0].getAttribute("aria-label")?.startsWith("a8")).toBe(true);
    expect(within(stagedSecondPanel).getByText(String(boardB.headers.White))).toBeTruthy();
    expect(within(dockFirstBoard).getAllByRole("button")[0].getAttribute("aria-label")?.startsWith("h1")).toBe(true);
    expect(within(dockFirstPanel).getByText(String(boardA.headers.Black))).toBeTruthy();
    expect(stagedSecondPanel.getAttribute("data-keyboard-focus")).toBe("active");
    expect(dockFirstPanel.getAttribute("data-keyboard-focus")).toBe("inactive");
    expect(useCoachStore.getState().game?.timeline).toHaveLength(boardA.plyCount + boardB.plyCount + 1);
    const analyze = screen.getAllByRole("button", { name: /Analyze with Fairy-Stockfish/ }) as HTMLButtonElement[];
    const coach = screen.getByRole("button", { name: /Team Coach/ }) as HTMLButtonElement;
    expect(analyze).toHaveLength(2);
    expect(analyze.every((button) => button.disabled && button.classList.contains("capability-locked"))).toBe(true);
    const enginePlaceholderCaptions = screen.getAllByText("PLACEHOLDER · future engine analysis · see the UI library");
    expect(enginePlaceholderCaptions).toHaveLength(2);
    expect(enginePlaceholderCaptions.every((caption) => caption.closest("figure")?.getAttribute("aria-disabled") === "true")).toBe(true);
    expect(screen.getByAltText("Specimen of a future engine evaluation row").getAttribute("src")).toBe("/placeholders/specimen-12-eval-row.jpg");
    expect(screen.getByAltText("Specimen of a future engine analysis panel").getAttribute("src")).toBe("/placeholders/specimen-21-analysis-panel.jpg");
    expect(coach.disabled).toBe(true);
    expect(coach.classList.contains("capability-locked")).toBe(true);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(useCoachStore.getState().globalPly).toBe(1);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(useCoachStore.getState().globalPly).toBe(0);

    fireEvent.keyDown(window, { key: "Tab" });
    await waitFor(() => expect(dockFirstPanel.getAttribute("data-keyboard-focus")).toBe("active"));
    expect(stagedSecondPanel.getAttribute("data-keyboard-focus")).toBe("inactive");

    vi.mocked(sendRoomEvent).mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(useCoachStore.getState().globalPly).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(useCoachStore.getState().globalPly).toBe(0);
    expect(vi.mocked(sendRoomEvent).mock.calls).toEqual([
      ["timeline.seek", { global_ply: 1 }],
      ["timeline.seek", { global_ply: 0 }],
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Swap staged board" }));
    const stagedFirstBoard = await screen.findByLabelText("First Board chessboard");
    const stagedFirstPanel = stagedFirstBoard.closest(".board-panel") as HTMLElement;
    const dockSecondBoard = within(secondaryRail).getByLabelText("Second Board chessboard");
    const dockSecondPanel = dockSecondBoard.closest(".board-panel") as HTMLElement;
    expect(within(stagedFirstBoard).getAllByRole("button")[0].getAttribute("aria-label")?.startsWith("h1")).toBe(true);
    expect(within(stagedFirstPanel).getByText(String(boardA.headers.Black))).toBeTruthy();
    expect(stagedFirstPanel.getAttribute("data-keyboard-focus")).toBe("active");
    expect(within(dockSecondBoard).getAllByRole("button")[0].getAttribute("aria-label")?.startsWith("a8")).toBe(true);
    expect(within(dockSecondPanel).getByText(String(boardB.headers.White))).toBeTruthy();
    expect(dockSecondPanel.getAttribute("data-keyboard-focus")).toBe("inactive");

    const firstPocketPly = useCoachStore.getState().game?.timeline.findIndex((frame) =>
      frame.board_a.white_pocket !== "-"
      || frame.board_a.black_pocket !== "-"
      || frame.board_b.white_pocket !== "-"
      || frame.board_b.black_pocket !== "-",
    ) ?? -1;
    expect(firstPocketPly).toBeGreaterThan(0);
    for (let ply = useCoachStore.getState().globalPly; ply < firstPocketPly; ply += 1) fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(useCoachStore.getState().globalPly).toBe(firstPocketPly));
    expect(document.querySelectorAll(".pocket-rail span").length).toBeGreaterThan(0);

    expect(screen.getAllByLabelText(/pocket$/)).toHaveLength(4);
    expect(useCoachStore.getState().game?.cross_board_ordering).toEqual({ method: "clock-inferred", exact: false });
  });
});
