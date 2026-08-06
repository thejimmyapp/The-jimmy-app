import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisAcknowledgement } from "./AnalysisAcknowledgement";

describe("first-analysis acknowledgement", () => {
  it("requires both checkboxes before continuing and closes with Escape", () => {
    const onContinue = vi.fn();
    const onClose = vi.fn();
    render(<AnalysisAcknowledgement open onContinue={onContinue} onClose={onClose} />);
    const continueButton = screen.getByRole("button", { name: "Continue to analysis" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/single-board engine suggestion/i));
    expect(continueButton.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/missing Chess.com data/i));
    expect(continueButton.disabled).toBe(false);
    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
