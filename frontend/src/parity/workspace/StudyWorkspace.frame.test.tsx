import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useCoachStore } from "../../store";
import type { GamePayload, ReplayPosition } from "../../types";
import { StudyWorkspace } from "./StudyWorkspace";

const position: ReplayPosition = {
  ply: 0, label: "Start", board: Array.from({ length: 8 }, () => Array(8).fill("")), side_to_move: "White", variant_fen: "",
  white_pocket: "", black_pocket: "", white_clock: "3:00", black_clock: "3:00", partner_index: 0, from_square: null, to_square: null,
};
const game: GamePayload = {
  game: { id: 1, played_at: "", result: "*", opponent: null, opponent_rating: null, partner: null, user_color: "white", time_control: "180" },
  players: { board_a_white: "A White", board_a_black: "A Black", board_b_white: "B White", board_b_black: "B Black" },
  moves_a: [], moves_b: [], positions_a: [position], positions_b: [position],
  timeline: [{ global_ply: 0, board: "A", local_ply: 0, move: "Start", board_a: position, board_b: position }],
  second_board_available: true, limitations: [], outcome: { summary: "", detail: "", loser_username: null, termination: null, board: null, board_role: null, move_number: null },
};

let resize: ResizeObserverCallback;
const reportUnexpectedReactError = console.error;
beforeAll(() => vi.spyOn(console, "error").mockImplementation((message, ...details) => {
  if (typeof message === "string" && message.includes("is unrecognized in this browser")) return;
  reportUnexpectedReactError(message, ...details);
}));
afterAll(() => vi.restoreAllMocks());

describe("stage-frame study workspace", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() { /* captured by the test callback */ }
      disconnect() { /* no resources in the mock */ }
      unobserve() { /* no resources in the mock */ }
    });
    useCoachStore.setState({ game, globalPly: 0, mode: "review" });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); useCoachStore.setState({ game: null }); });

  it("reselects a preset from its own ResizeObserver dimensions", () => {
    const { container } = render(<StudyWorkspace />);
    const workspace = container.querySelector<HTMLElement>(".study-workspace")!;
    act(() => resize([{ contentRect: { width: 1372, height: 842 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(workspace.dataset.layout).toBe("jimmy1440");
    expect(workspace.dataset.frame).toBe("1372x842");
    expect(workspace.style.getPropertyValue("--study-side-top")).toBe("57.703125px");
    act(() => resize([{ contentRect: { width: 1132, height: 742 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(workspace.dataset.layout).toBe("jimmy1200");
  });

  it("selects the wide preset from border-box dimensions when a scrollbar narrows contentRect", () => {
    const { container } = render(<StudyWorkspace />);
    const workspace = container.querySelector<HTMLElement>(".study-workspace")!;
    act(() => resize([{
      contentRect: { width: 1357, height: 842 },
      borderBoxSize: [{ inlineSize: 1372, blockSize: 842 }],
    } as unknown as ResizeObserverEntry], {} as ResizeObserver));
    expect(workspace.dataset.layout).toBe("jimmy1440");
    expect(workspace.dataset.frame).toBe("1372x842");
  });

  it("switches the second board from the wide side column to the narrow underboard", () => {
    const { container } = render(<StudyWorkspace />);
    const second = () => container.querySelector<HTMLElement>('[data-jimmy-departure="second-board"]')!;
    act(() => resize([{ contentRect: { width: 1372, height: 842 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(second().dataset.placement).toBe("side");
    expect(container.querySelector<HTMLElement>(".study-workspace")?.style.getPropertyValue("--study-side-top")).toBe("57.703125px");
    act(() => resize([{ contentRect: { width: 1132, height: 742 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(second().dataset.placement).toBe("under");
    expect(container.querySelector<HTMLElement>(".study-workspace")?.style.getPropertyValue("--study-side-top")).toBe("1141.890625px");
    expect(second().querySelector<HTMLElement>(".parity-board")?.style.getPropertyValue("--parity-board-size")).toBe("293.5px");
    fireEvent.click(container.querySelector<HTMLButtonElement>('button[aria-label="Match info"]')!);
    expect(container.querySelector<HTMLElement>(".study-workspace")?.style.getPropertyValue("--study-side-top")).toBe("738.25px");
    fireEvent.click(container.querySelector<HTMLButtonElement>('button[aria-label="Match info"]')!);
    expect(container.querySelector<HTMLElement>(".study-workspace")?.style.getPropertyValue("--study-side-top")).toBe("1141.890625px");
    act(() => resize([{ contentRect: { width: 956, height: 710 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(container.querySelector<HTMLElement>(".study-workspace")?.style.getPropertyValue("--study-side-top")).toBe("1090px");
  });
});
