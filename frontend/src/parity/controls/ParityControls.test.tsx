import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParityControls } from "./ParityControls";

describe("parity replay controls", () => {
  it("renders the four move actions and inert titled side controls", () => {
    const onNavigate = vi.fn();
    const { container, getByRole } = render(<ParityControls onNavigate={onNavigate} />);
    for (const [name, action] of [["First move", "first"], ["Previous move", "prev"], ["Next move", "next"], ["Last move", "last"]] as const) {
      const button = getByRole("button", { name });
      fireEvent.click(button);
      expect(button.getAttribute("data-act")).toBe(action);
    }
    expect(onNavigate.mock.calls.flat()).toEqual(["first", "prev", "next", "last"]);
    const practice = container.querySelector<HTMLButtonElement>(".practice")!;
    expect(practice.disabled).toBe(true);
    expect(practice.getAttribute("aria-hidden")).toBe("true");
    expect(practice.textContent).toBe("");
    const menu = getByRole("button", { name: "Menu" });
    expect(menu.getAttribute("title")).toBe("Menu");
    expect(menu.querySelector("svg path")?.getAttribute("d")).toBe("M5 7h14M5 12h14M5 17h14");
  });
});
