import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalPage } from "./LegalPage";

describe("public legal pages", () => {
  it("renders the privacy disclosures and public legal navigation", () => {
    render(<LegalPage page="privacy" />);
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeTruthy();
    expect(screen.getByText(/does not request or accept Chess.com passwords/i)).toBeTruthy();
    expect(screen.getByText(/does not currently apply a guaranteed automatic deletion period/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
  });

  it("renders completed-game and no-live-assistance terms", () => {
    render(<LegalPage page="terms" />);
    expect(screen.getByRole("heading", { name: "Terms of Service" })).toBeTruthy();
    expect(screen.getByText(/Public Chess.com imports are limited to completed archive records/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No live assistance or cheating" })).toBeTruthy();
    expect(screen.getByText(/not affiliated with, sponsored by, or endorsed by Chess.com/i)).toBeTruthy();
  });
});
