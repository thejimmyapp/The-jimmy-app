import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyGuestProgress, type GuestProgress } from "../guestProgress";
import { OnboardingMap } from "./OnboardingMap";

function Harness({ initial = emptyGuestProgress(), onReset = vi.fn() }: { initial?: GuestProgress; onReset?: () => void }) {
  const [progress, setProgress] = useState(initial);
  return <OnboardingMap progress={progress} onNodeChange={(mapNode) => setProgress((value) => ({ ...value, mapNode }))} onReset={onReset} onImportBothBoards={vi.fn()} onAdvancedRecovery={vi.fn()} reviewForm={<div>Exact game URL form</div>} />;
}

describe("keyboard overworld", () => {
  afterEach(cleanup);
  it("moves one unlocked segment with arrows/WASD and activates with Enter/Space", () => {
    render(<Harness />);
    const map = screen.getByRole("region", { name: /Onboarding route/ });
    map.focus();
    fireEvent.keyDown(map, { key: "ArrowLeft" });
    expect(map.getAttribute("aria-label")).toContain("Current stop: Analyze a game");
    fireEvent.keyDown(map, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: "Analyze a game" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(map, { key: "d" });
    expect(map.getAttribute("aria-label")).toContain("Current stop: Start");
    fireEvent.keyDown(map, { key: " " });
    expect(screen.queryByRole("dialog", { name: "Analyze a game" })).toBeNull();
  });

  it("will not cross a locked route", () => {
    render(<Harness initial={{ ...emptyGuestProgress(), mapNode: "analyze" }} />);
    const map = screen.getByRole("region", { name: /Onboarding route/ });
    map.focus();
    fireEvent.keyDown(map, { key: "s" });
    expect(map.getAttribute("aria-label")).toContain("Current stop: Analyze a game");
    expect(screen.getByRole("status").textContent).toContain("analyze one exact game");
  });
});
