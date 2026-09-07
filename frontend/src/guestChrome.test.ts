import { describe, expect, it } from "vitest";
import { SIGN_IN_NOTICE } from "./guestChrome";

describe("owner-approved guest chrome copy", () => {
  it("keeps the account-intake notice byte-identical", () => {
    expect(SIGN_IN_NOTICE).toBe("Account registration is currently unavailable. Coming soon.");
  });
});
