import { describe, expect, it } from "vitest";
import { isMeaningfulChessVector } from "./boardInteractions";

describe("board annotation geometry", () => {
  it("accepts straight, diagonal, and knight vectors", () => {
    expect(isMeaningfulChessVector("a1", "a8")).toBe(true);
    expect(isMeaningfulChessVector("a1", "h1")).toBe(true);
    expect(isMeaningfulChessVector("c1", "h6")).toBe(true);
    expect(isMeaningfulChessVector("g1", "f3")).toBe(true);
  });

  it("rejects arbitrary or zero-length vectors", () => {
    expect(isMeaningfulChessVector("a1", "b4")).toBe(false);
    expect(isMeaningfulChessVector("e4", "e4")).toBe(false);
  });
});
