import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SIGN_IN_NOTICE } from "../guestChrome";
import { LandingPage } from "./LandingPage";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("landing carousel", () => {
  it("supports mouse, dots, and arrow keys without autoplay and shows Start only on the final slide", () => {
    vi.useFakeTimers();
    const onStart = vi.fn();
    const { container } = render(<LandingPage completed={false} onStart={onStart} />);
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

  it("uses the account-intake notice and enables only Sign up for a completed guest", () => {
    render(<LandingPage completed onStart={vi.fn()} />);
    const login = screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement;
    const signup = screen.getByRole("button", { name: "Sign up" }) as HTMLButtonElement;

    expect(login.disabled).toBe(true);
    expect(login.title).toBe(SIGN_IN_NOTICE);
    expect(signup.disabled).toBe(false);
    expect(signup.title).toBe(SIGN_IN_NOTICE);
    expect(within(screen.getByRole("group", { name: "1 of 4" })).getByText(/Publishing 3 learning moments grants account registration/)).toBeTruthy();
  });
});
