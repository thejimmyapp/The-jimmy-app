import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, type AccountSummary } from "../api";
import { AccountClaimForm } from "./AccountClaimForm";

const claimedAccount: AccountSummary = {
  guest_number: 7,
  email: "guest@example.com",
  completion_ordinal: 7,
  founder_eligible: true,
  created_at: "2026-08-11T00:00:00+00:00",
};

afterEach(cleanup);

describe("account claim form", () => {
  it("submits the entered email and renders the claimed identity", async () => {
    const onClaimAccount = vi.fn().mockResolvedValue(claimedAccount);
    const onAccountClaimed = vi.fn();
    render(<AccountClaimForm account={null} accountLoading={false} onClaimAccount={onClaimAccount} onAccountClaimed={onAccountClaimed} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: claimedAccount.email } });
    fireEvent.click(screen.getByRole("button", { name: "Claim your identity" }));

    await waitFor(() => expect(onClaimAccount).toHaveBeenCalledWith(claimedAccount.email));
    expect(await screen.findByText("Claimed — Founder #7")).toBeTruthy();
    expect(onAccountClaimed).toHaveBeenCalledWith(claimedAccount);
  });

  it("maps a 422 refusal to the existing validation string", async () => {
    const onClaimAccount = vi.fn().mockRejectedValue(new ApiError(422, "Enter a valid email."));
    render(<AccountClaimForm account={null} accountLoading={false} onClaimAccount={onClaimAccount} onAccountClaimed={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim your identity" }));

    expect((await screen.findByRole("alert")).textContent).toBe("enter a valid email");
  });

  it("maps any other refusal to the existing generic error", async () => {
    const onClaimAccount = vi.fn().mockRejectedValue(new ApiError(503, "Unavailable"));
    render(<AccountClaimForm account={null} accountLoading={false} onClaimAccount={onClaimAccount} onAccountClaimed={vi.fn()} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "guest@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim your identity" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Identity claim failed.");
  });
});
