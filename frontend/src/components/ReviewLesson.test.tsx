import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewLesson } from "./ReviewLesson";

describe("ReviewLesson", () => {
  it("shows only stored evidence and seeks to the synchronized moment", () => {
    const onReview = vi.fn();
    render(
      <ReviewLesson
        lesson={{
          id: "mistake-1",
          board: "A",
          local_ply: 7,
          global_ply: 11,
          played_move: "Nxf7",
          best_move: "N@h6",
          severity: "mistake",
          estimated_loss_cp: 184,
          category: "ignored partner danger",
          pattern: "removal of defender",
          confidence: "high",
          depth: 14,
          partner_context: "Your partner was facing a mate threat on the synced board.",
        }}
        onReview={onReview}
      />,
    );

    expect(screen.getByText("Nxf7 · consider N@h6")).toBeTruthy();
    expect(screen.getByText(/estimated 184 cp swing/i)).toBeTruthy();
    expect(screen.getByText(/partner was facing a mate threat/i)).toBeTruthy();
    expect(screen.getByText("ONE MOMENT TO REVISIT").closest("section")?.getAttribute("title")).toContain("high confidence · depth 14");

    fireEvent.click(screen.getByRole("button", { name: /ONE MOMENT TO REVISIT/ }));
    expect(onReview).toHaveBeenCalledWith(11);
  });

  it("saves and unsaves only eligible evidence-backed lessons", () => {
    const onToggleSave = vi.fn();
    render(<ReviewLesson lesson={{ id: "mistake-2", board: "A", local_ply: 2, global_ply: 4, played_move: "Qh5", best_move: "N@e4", severity: "blunder", estimated_loss_cp: 300, category: "king safety", pattern: "mate threat", confidence: "medium", depth: 12, partner_context: null }} onReview={vi.fn()} onToggleSave={onToggleSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Save to Library" }));
    expect(onToggleSave).toHaveBeenCalledOnce();
  });
});
