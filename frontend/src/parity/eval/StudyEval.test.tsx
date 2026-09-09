import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudyEval } from "./StudyEval";

afterEach(cleanup);

describe("study evaluation chrome", () => {
  it("mounts analysis only after the measured switch turns on", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<StudyEval enabled={false} onToggle={onToggle} analysis={<div data-testid="analysis-node">locked analysis</div>} />);
    expect(screen.queryByTestId("analysis-node")).toBeNull();
    const toggle = screen.getByRole("switch", { name: "Toggle local evaluation" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<StudyEval enabled onToggle={onToggle} analysis={<div data-testid="analysis-node">locked analysis</div>} />);
    expect(screen.getByTestId("analysis-node")).not.toBeNull();
    expect(screen.getByRole("switch", { name: "Toggle local evaluation" }).getAttribute("aria-checked")).toBe("true");
  });
});
