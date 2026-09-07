import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("landing carousel", () => {
  it("supports mouse, dots, and arrow keys without autoplay and shows Start only on the final slide", () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    const { container } = render(<LandingPage completed={false} showAccountActions onStart={onStart} />);
    const carousel = screen.getByRole("region", { name: "Product introduction" });

    expect(screen.getByRole("group", { name: "1 of 4" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /Go to slide/ })).toHaveLength(4);
    expect((screen.getByRole("button", { name: "Previous slide" }) as HTMLButtonElement).disabled).toBe(true);
    expect(Array.from(container.querySelectorAll("[data-copy-placeholder]")).every((line) => line.textContent?.startsWith("[COPY-PLACEHOLDER]"))).toBe(true);

    vi.advanceTimersByTime(60_000);
    expect(screen.getByRole("group", { name: "1 of 4" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(screen.getByRole("group", { name: "2 of 4" })).toBeTruthy();
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(screen.getByRole("group", { name: "3 of 4" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go to slide 4" }));
    expect(screen.getByRole("group", { name: "4 of 4" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next slide" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onStart).toHaveBeenCalledOnce();
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(screen.getByRole("group", { name: "3 of 4" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("hides its account actions when the completed quest bar owns them", () => {
    render(<LandingPage completed showAccountActions onStart={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Log in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign up" })).toBeNull();
    expect(within(screen.getByRole("group", { name: "1 of 4" })).getByText(/Publishing 3 learning moments grants account registration/)).toBeTruthy();
  });
});
