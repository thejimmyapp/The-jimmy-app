import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParityControls } from "./ParityControls";

describe("parity replay controls", () => {
  it("renders the four move actions and inert titled side controls", () => {
    const onNavigate = vi.fn();
    const { getByRole } = render(<ParityControls onNavigate={onNavigate} />);
    for (const [name, action] of [["First move", "first"], ["Previous move", "prev"], ["Next move", "next"], ["Last move", "last"]] as const) {
      const button = getByRole("button", { name });
      fireEvent.click(button);
      expect(button.getAttribute("data-act")).toBe(action);
    }
    expect(onNavigate.mock.calls.flat()).toEqual(["first", "prev", "next", "last"]);
    expect(getByRole("button", { name: "Practice with computer" }).getAttribute("title")).toBe("Practice with computer");
    expect(getByRole("button", { name: "Menu" }).getAttribute("title")).toBe("Menu");
  });
});
