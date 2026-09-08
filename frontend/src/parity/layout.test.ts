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

  it("keeps measured 1200 and 1024 reference viewport presets", () => {
    expect(parityLayout("reference1200")).toBe(PARITY_LAYOUTS.reference1200);
    expect(PARITY_LAYOUTS.reference1200).toMatchObject({ viewport: { width: 1200, height: 800 }, board: { size: 592, squareSize: 74 }, tools: { width: 400 } });
    expect(parityLayout("reference1024")).toBe(PARITY_LAYOUTS.reference1024);
    expect(PARITY_LAYOUTS.reference1024).toMatchObject({ viewport: { width: 1024, height: 768 }, board: { size: 568, squareSize: 71 }, tools: { width: 400 } });
  });
});
