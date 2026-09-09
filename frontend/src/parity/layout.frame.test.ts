import { describe, expect, it } from "vitest";
import { PARITY_LAYOUTS, studyLayoutForBox } from "./layout";

describe("Jimmy stage-frame layout selection", () => {
  it.each([
    [1372, 842, "jimmy1440"],
    [1132, 742, "jimmy1200"],
    [956, 710, "jimmy1024"],
  ] as const)("selects %s×%s as %s", (width, height, id) => {
    expect(studyLayoutForBox(width, height).id).toBe(id);
  });

  it("uses the largest fitting preset and falls back to the smallest", () => {
    expect(studyLayoutForBox(1800, 1200)).toBe(PARITY_LAYOUTS.jimmy1440);
    expect(studyLayoutForBox(700, 500)).toBe(PARITY_LAYOUTS.jimmy1024);
  });

  it("stores the 1440 board top relative to the 60px Lichess header", () => {
    expect(PARITY_LAYOUTS.jimmy1440.board.y).toBe(82.703125 - 60);
  });

  it("stores each anonymous underboard top relative to the 60px header", () => {
    expect(PARITY_LAYOUTS.jimmy1440.underboard?.y).toBe(780.375 - 60);
    expect(PARITY_LAYOUTS.jimmy1200.underboard?.y).toBe(716.046875 - 60);
    expect(PARITY_LAYOUTS.jimmy1024.underboard?.y).toBe(676.875 - 60);
  });
});
