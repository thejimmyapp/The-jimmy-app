import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SIGN_IN_NOTICE } from "../guestChrome";
import { AccountActions } from "./AccountActions";

afterEach(cleanup);

describe("account actions", () => {
  it("keeps Log in disabled and enables Sign up only after server completion", () => {
    const onSignUp = vi.fn();
    const { rerender } = render(<AccountActions completed={false} onSignUp={onSignUp} />);
    const login = screen.getByRole("button", { name: "Log in" }) as HTMLButtonElement;
    const signUp = screen.getByRole("button", { name: "Sign up" }) as HTMLButtonElement;

    expect(login.disabled).toBe(true);
    expect(login.title).toBe(SIGN_IN_NOTICE);
    expect(signUp.disabled).toBe(true);
    expect(signUp.title).toBe(SIGN_IN_NOTICE);
    fireEvent.click(signUp);
    expect(onSignUp).not.toHaveBeenCalled();

    rerender(<AccountActions completed onSignUp={onSignUp} />);
    const enabledSignUp = screen.getByRole("button", { name: "Sign up" }) as HTMLButtonElement;
    expect(enabledSignUp.title).toBe("");
    fireEvent.click(enabledSignUp);
    expect(onSignUp).toHaveBeenCalledOnce();
  });
});
