import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BoardPanel } from "./BoardPanel";
import { ReviewWorkspace } from "./ReviewWorkspace";

describe("review workspace layout", () => {
  afterEach(cleanup);

  it("renders each supplied slot in its structural region", () => {
    const { container } = render(<ReviewWorkspace mainBoard={<span>Main board</span>} secondaryBoard={<span>Secondary board content</span>} replayControls={<button>Replay</button>} swapControl={<button>Swap</button>} stageActions={<button>Undo</button>} />);

    expect(within(container.querySelector(".review-main-board") as HTMLElement).getByText("Main board")).toBeTruthy();
    expect(within(container.querySelector(".review-replay") as HTMLElement).getByRole("button", { name: "Replay" })).toBeTruthy();
    expect(within(container.querySelector(".review-divider") as HTMLElement).getByRole("button", { name: "Swap" })).toBeTruthy();
    expect(within(screen.getByRole("complementary", { name: "Secondary board" })).getByText("Secondary board content")).toBeTruthy();
    expect(within(container.querySelector(".review-main") as HTMLElement).getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("keeps the existing unavailable BoardPanel card in the secondary rail", () => {
    render(<ReviewWorkspace
      mainBoard={<span>Main board</span>}
      replayControls={<button>Replay</button>}
      secondaryBoard={<BoardPanel boardId="B" position={null} orientation="black" pieceStyle="solid" layout="compact" title="Second Board" playerTop="Diagonal Opponent Unknown" playerBottom="Partner Unknown" unavailable />}
    />);

    const secondary = screen.getByRole("complementary", { name: "Secondary board" });
    expect(within(secondary).getByText("Second Board is unavailable")).toBeTruthy();
    expect(within(secondary).getByText("The second board was not included in the available Chess.com data.")).toBeTruthy();
  });
});
