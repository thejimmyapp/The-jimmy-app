import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GuestSessionIdentity } from "../guestChrome";
import { SIGN_IN_NOTICE } from "../guestChrome";
import { QuestTopBar } from "./QuestTopBar";

const guestSession = (savedMomentCount: number, completed = false): GuestSessionIdentity => ({
  guest_number: 13,
  total_guests: 13,
  completions_to_date: completed ? 1 : null,
  saved_moment_count: savedMomentCount,
  analysis_unlocked: false,
  completed,
  completion_ordinal: completed ? 1 : null,
});

const baseProps: Parameters<typeof QuestTopBar>[0] = {
  questDeadline: 1_000,
  questCompleted: false,
  questRemaining: 299,
  guestSession: guestSession(0),
  account: null,
  accountLoading: false,
  onClaimAccount: vi.fn(),
  onAccountClaimed: vi.fn(),
};

afterEach(() => {
  cleanup();
  document.getElementById("app-stage-panel")?.remove();
  vi.clearAllMocks();
});

describe("quest top bar", () => {
  it("formats the countdown and follows 0/3, 1/3, and 3/3 server counts", () => {
    const { rerender } = render(<QuestTopBar {...baseProps} />);
    expect(screen.getByRole("timer", { name: "Quest countdown" }).textContent).toBe("4:59");
    expect(screen.getByTestId("quest-progress").textContent).toBe("0/3 learning moments published");

    rerender(<QuestTopBar {...baseProps} guestSession={guestSession(1)} />);
    expect(screen.getByTestId("quest-progress").textContent).toBe("1/3 learning moments published");

    rerender(<QuestTopBar {...baseProps} guestSession={guestSession(9, true)} />);
    expect(screen.getByTestId("quest-progress").textContent).toBe("3/3 learning moments published");
  });

  it("replaces the countdown with the labelled completion state", () => {
    const { container } = render(<QuestTopBar {...baseProps} questDeadline={null} questCompleted guestSession={guestSession(3, true)} />);
    expect(screen.queryByRole("timer", { name: "Quest countdown" })).toBeNull();
    const complete = screen.getByText("[COPY-PLACEHOLDER] Quest complete");
    expect(complete.hasAttribute("data-copy-placeholder")).toBe(true);
    expect(container.querySelector(".quest-topbar")).not.toBeNull();
  });

  it("keeps Log in disabled and opens the shared claim form only after completion", () => {
    const stagePanel = document.createElement("div");
    stagePanel.id = "app-stage-panel";
    document.body.append(stagePanel);
    const { rerender } = render(<QuestTopBar {...baseProps} />);
    const login = screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement;
    const signUp = screen.getByRole("button", { name: "Sign up" }) as HTMLButtonElement;
    expect(login.disabled).toBe(true);
    expect(login.title).toBe(SIGN_IN_NOTICE);
    expect(signUp.disabled).toBe(true);
    expect(signUp.title).toBe(SIGN_IN_NOTICE);
    expect(document.querySelector("#guest-account-email")).toBeNull();

    rerender(<QuestTopBar {...baseProps} questDeadline={null} questCompleted guestSession={guestSession(3, true)} />);
    const enabledSignUp = screen.getByRole("button", { name: "Sign up" }) as HTMLButtonElement;
    expect(enabledSignUp.disabled).toBe(false);
    expect(enabledSignUp.title).toBe("");
    fireEvent.click(enabledSignUp);
    expect(document.querySelector("#guest-account-email")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.querySelector("#guest-account-email")).toBeNull();
  });

  it("renders no bar in the idle landing state", () => {
    const { container } = render(<QuestTopBar {...baseProps} questDeadline={null} questCompleted={false} questRemaining={null} />);
    expect(container.firstChild).toBeNull();
  });
});
