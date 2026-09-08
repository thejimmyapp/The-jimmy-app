import { describe, expect, it } from "vitest";
import { PARITY_LAYOUTS, parityLayout } from "./layout";

describe("parity layout presets", () => {
  it("defaults to the frozen anonymous reference geometry", () => {
    expect(parityLayout(null)).toBe(PARITY_LAYOUTS.reference);
    expect(PARITY_LAYOUTS.reference.board).toMatchObject({ size: 680, squareSize: 85 });
  });

  it("keeps the owner's logged-in zoom as an 800px/100px preset", () => {
    expect(parityLayout("owner")).toBe(PARITY_LAYOUTS.owner);
    expect(PARITY_LAYOUTS.owner.board).toMatchObject({ size: 800, squareSize: 100 });
  });
});
