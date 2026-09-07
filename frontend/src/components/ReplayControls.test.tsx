import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendRoomEvent } from "../socket";
import { useCoachStore } from "../store";
import type { GamePayload, ReplayPosition } from "../types";
import { ReplayControls } from "./ReplayControls";

vi.mock("../socket", () => ({ sendRoomEvent: vi.fn() }));

const position: ReplayPosition = {
  ply: 0,
  label: "Start",
  board: [],
  side_to_move: "White",
  variant_fen: "",
  white_pocket: "-",
  black_pocket: "-",
  white_clock: "3:00",
  black_clock: "3:00",
  partner_index: 0,
  from_square: null,
  to_square: null,
};

const game: GamePayload = {
  game: { id: 1, played_at: "", result: "*", opponent: null, opponent_rating: null, partner: null, user_color: "white", time_control: "180" },
  players: { board_a_white: "White A", board_a_black: "Black A", board_b_white: "White B", board_b_black: "Black B" },
  moves_a: [],
  moves_b: [],
  positions_a: [position],
  positions_b: [position],
  timeline: [0, 1, 2].map((global_ply) => ({ global_ply, board: "A" as const, local_ply: global_ply, move: `Move ${global_ply}`, board_a: position, board_b: position })),
  second_board_available: true,
  limitations: [],
  outcome: { summary: "Game complete", detail: "Fixture", loser_username: null, termination: null, board: null, board_role: null, move_number: null },
};

describe("replay controls", () => {
  const originalSeek = useCoachStore.getState().seek;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    useCoachStore.setState({ game, globalPly: 1, mode: "review", seek: originalSeek });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useCoachStore.setState({ seek: originalSeek });
  });

  it("clamps Start, Previous, Next, and End and emits every seek", () => {
    const seek = vi.fn((ply: number) => useCoachStore.setState({ globalPly: ply }));
    useCoachStore.setState({ seek });
    render(<ReplayControls />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    act(() => useCoachStore.setState({ globalPly: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "End" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(seek.mock.calls.map(([ply]) => ply)).toEqual([0, 0, 2, 2, 2]);
    expect(vi.mocked(sendRoomEvent).mock.calls).toEqual([
      ["timeline.seek", { global_ply: 0 }],
      ["timeline.seek", { global_ply: 0 }],
      ["timeline.seek", { global_ply: 2 }],
      ["timeline.seek", { global_ply: 2 }],
      ["timeline.seek", { global_ply: 2 }],
    ]);
  });

  it("toggles Play to Pause and advances one ply every 650 ms", async () => {
    vi.useFakeTimers();
    const seek = vi.fn((ply: number) => useCoachStore.setState({ globalPly: ply }));
    useCoachStore.setState({ globalPly: 0, seek });
    render(<ReplayControls />);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(650));
    expect(useCoachStore.getState().globalPly).toBe(1);
    await act(async () => vi.advanceTimersByTime(650));
    expect(useCoachStore.getState().globalPly).toBe(2);
    expect(seek.mock.calls.map(([ply]) => ply)).toEqual([1, 2]);
    expect(vi.mocked(sendRoomEvent).mock.calls).toEqual([
      ["timeline.seek", { global_ply: 1 }],
      ["timeline.seek", { global_ply: 2 }],
    ]);
  });
});
