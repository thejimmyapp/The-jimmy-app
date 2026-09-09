import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudyEval } from "./StudyEval";

afterEach(cleanup);

describe("study evaluation chrome", () => {
  it("mounts analysis only after the measured switch turns on", () => {
    const onToggle = vi.fn();
    const { container, rerender } = render(<StudyEval enabled={false} onToggle={onToggle} analysis={<div data-testid="analysis-node">locked analysis</div>} />);
    const row = container.querySelector<HTMLElement>(".study-eval")!;
    expect(row.textContent).toBe("Fairy-Stockfish");
    expect(getComputedStyle(row).height).toBe("44px");
    expect(container.querySelector(".study-eval-pearl")?.textContent).toBe("");
    expect(container.querySelector(".study-eval-settings")).toBeNull();
    expect(screen.queryByTestId("analysis-node")).toBeNull();
    const toggle = screen.getByRole("switch", { name: "Toggle local evaluation" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<StudyEval enabled onToggle={onToggle} analysis={<div data-testid="analysis-node">locked analysis</div>} />);
    expect(screen.getByTestId("analysis-node")).not.toBeNull();
    expect(container.querySelector(".study-eval-engine")?.textContent).toBe("Fairy-Stockfish");
    expect(container.querySelector(".study-eval-pearl")?.textContent).toBe("");
    expect(screen.getByRole("switch", { name: "Toggle local evaluation" }).getAttribute("aria-checked")).toBe("true");
  });
});
