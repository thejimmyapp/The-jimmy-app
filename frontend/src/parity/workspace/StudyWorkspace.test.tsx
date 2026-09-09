import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useCoachStore } from "../../store";
import type { GamePayload, ReplayPosition } from "../../types";
import { StudyWorkspace } from "./StudyWorkspace";

const position: ReplayPosition = {
  ply: 0, label: "Start", board: [
    ["r", "n", "b", "q", "k", "b", "n", "r"], ["p", "p", "p", "p", "p", "p", "p", "p"],
    ...Array.from({ length: 4 }, () => Array(8).fill("")), ["P", "P", "P", "P", "P", "P", "P", "P"], ["R", "N", "B", "Q", "K", "B", "N", "R"],
  ], side_to_move: "White", variant_fen: "", white_pocket: "", black_pocket: "", white_clock: "3:00", black_clock: "2:59", partner_index: 0, from_square: null, to_square: null,
};

const game: GamePayload = {
  game: { id: 1, played_at: "", result: "*", opponent: null, opponent_rating: null, partner: null, user_color: "black", time_control: "180" },
  players: { board_a_white: "White A", board_a_black: "Black A", board_b_white: "White B", board_b_black: "Black B" },
  moves_a: [], moves_b: [], positions_a: [position], positions_b: [position],
  timeline: [0, 1, 2].map((global_ply) => ({ global_ply, board: global_ply === 1 ? "B" as const : "A" as const, local_ply: global_ply, move: global_ply ? `Move ${global_ply}` : "Start", board_a: position, board_b: position })),
  second_board_available: true, limitations: [], outcome: { summary: "", detail: "", loser_username: null, termination: null, board: null, board_role: null, move_number: null },
};

const reportUnexpectedReactError = console.error;
beforeAll(() => vi.spyOn(console, "error").mockImplementation((message, ...details) => {
  if (typeof message === "string" && message.includes("is unrecognized in this browser")) return;
  reportUnexpectedReactError(message, ...details);
}));
afterAll(() => vi.restoreAllMocks());

describe("study workspace", () => {
  beforeEach(() => { localStorage.clear(); useCoachStore.setState({ game, globalPly: 1, mode: "review" }); });
  afterEach(() => { cleanup(); useCoachStore.setState({ game: null, globalPly: 0 }); });

  it("renders synchronized main and departure-tagged second boards, and hides the second when unavailable", () => {
    const { container, rerender } = render(<StudyWorkspace />);
    expect(container.querySelectorAll("cg-board")).toHaveLength(2);
    expect(container.querySelector('[data-jimmy-departure="second-board"]')).not.toBeNull();
    expect(container.querySelector(".study-workspace")?.getAttribute("data-orientation")).toBe("black");
    useCoachStore.setState({ game: { ...game, second_board_available: false } });
    rerender(<StudyWorkspace />);
    expect(container.querySelectorAll("cg-board")).toHaveLength(1);
  });

  it("routes replay controls and measured workspace keys through seek", () => {
    const seek = vi.fn();
    useCoachStore.setState({ game, globalPly: 1, seek });
    const { container, getByRole } = render(<StudyWorkspace />);
    fireEvent.click(getByRole("button", { name: "Next move" }));
    expect(seek).toHaveBeenLastCalledWith(2);
    fireEvent.click(getByRole("button", { name: "First move" }));
    expect(seek).toHaveBeenLastCalledWith(0);
    const workspace = container.querySelector<HTMLElement>(".study-workspace")!;
    fireEvent.keyDown(workspace, { key: "End" });
    expect(seek).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(workspace, { key: "ArrowLeft" });
    expect(seek).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(workspace, { key: "ArrowRight", shiftKey: true });
    expect(seek).toHaveBeenLastCalledWith(2);
  });

  it("opens and closes the menu, flips, and persists the selected board theme", () => {
    const { container, getByRole, queryByRole } = render(<StudyWorkspace />);
    const workspace = container.querySelector<HTMLElement>(".study-workspace")!;
    fireEvent.click(getByRole("button", { name: "Menu" }));
    expect(getByRole("region", { name: "Study menu" })).not.toBeNull();
    expect(getByRole("region", { name: "Study menu" }).textContent).toContain("Study");
    fireEvent.click(getByRole("button", { name: "Flip board" }));
    expect(workspace.dataset.orientation).toBe("white");
    fireEvent.click(getByRole("button", { name: "Wood" }));
    expect(container.querySelectorAll('.parity-board[data-theme="wood"]')).toHaveLength(2);
    expect(localStorage.getItem("thejimmyapp.parity.theme")).toBe("wood");
    fireEvent.keyDown(workspace, { key: "Escape" });
    expect(queryByRole("region", { name: "Study menu" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Menu" }));
    fireEvent.click(getByRole("button", { name: "Menu" }));
    expect(queryByRole("region", { name: "Study menu" })).toBeNull();
  });

  it("toggles evaluation with l and does not mount analysis while off", () => {
    const { container, queryByTestId } = render(<StudyWorkspace analysis={<div data-testid="analysis-node">locked analysis</div>} />);
    const workspace = container.querySelector<HTMLElement>(".study-workspace")!;
    expect(workspace.dataset.evaluation).toBe("off");
    expect(queryByTestId("analysis-node")).toBeNull();
    fireEvent.keyDown(workspace, { key: "l" });
    expect(workspace.dataset.evaluation).toBe("on");
    expect(queryByTestId("analysis-node")).not.toBeNull();
    fireEvent.keyDown(workspace, { key: "l" });
    expect(workspace.dataset.evaluation).toBe("off");
    expect(queryByTestId("analysis-node")).toBeNull();
  });
});
