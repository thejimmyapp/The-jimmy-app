import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GamePayload, ReplayPosition } from "../../types";
import { PARITY_LAYOUTS } from "../layout";
import { StudyUnderboard } from "./StudyUnderboard";

const position: ReplayPosition = { ply: 0, label: "Start", board: Array.from({ length: 8 }, () => Array(8).fill("")), side_to_move: "White", variant_fen: "", white_pocket: "", black_pocket: "", white_clock: "3:00", black_clock: "3:00", partner_index: 0, from_square: null, to_square: null };
const game: GamePayload = {
  game: { id: 7, played_at: "2026-09-08T12:00:00Z", result: "1-0", opponent: "Black A", opponent_rating: 2288, partner: "White B", user_color: "white", time_control: "180+2" },
  players: { board_a_white: "White A", board_a_black: "Black A", board_b_white: "White B", board_b_black: "Black B" },
  moves_a: [], moves_b: [], positions_a: [position], positions_b: [position], timeline: [{ global_ply: 0, board: "A", local_ply: 0, move: "Start", board_a: position, board_b: position }],
  second_board_available: true, limitations: [], outcome: { summary: "White won", detail: "Black was checkmated", loser_username: "Black A", termination: "checkmated", board: "A", board_role: null, move_number: 20 },
};
afterEach(cleanup);

describe("Jimmy study underboard", () => {
  it("renders the three measured tabs, count badge, and callback wiring", () => {
    const onSaveMoment = vi.fn(); const onOpenLibrary = vi.fn();
    render(<StudyUnderboard game={game} layout={PARITY_LAYOUTS.jimmy1440} savedMomentCount={7} onSaveMoment={onSaveMoment} onOpenLibrary={onOpenLibrary} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Save moment" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Library" }).textContent).toBe("7");
    expect(screen.getByRole("button", { name: "Match info" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save moment" })); expect(onSaveMoment).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Library" })); expect(onOpenLibrary).toHaveBeenCalledOnce();
  });

  it("shows fixture metadata and lets Match info toggle it", () => {
    render(<StudyUnderboard game={game} layout={PARITY_LAYOUTS.jimmy1440} />);
    expect(screen.getByRole("heading").textContent).toBe("Bughouse · White A vs Black A (2288)");
    for (const value of ["Bughouse", "White A", "Black A (2288)", "White B", "Black B", "1-0", "180+2", "2026-09-08T12:00:00Z", "White won · Black was checkmated"]) expect(screen.getByText(value)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Match info" }));
    expect(screen.queryByRole("heading")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Match info" }));
    expect(screen.getByRole("heading")).not.toBeNull();
  });
});
