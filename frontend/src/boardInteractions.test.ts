import { describe, expect, it } from "vitest";
import { isMeaningfulChessVector, parseEngineBestmove } from "./boardInteractions";

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

describe("engine bestmove parsing", () => {
  it("parses normal moves and promotions", () => {
    expect(parseEngineBestmove("e2e4")).toEqual({ from: "e2", to: "e4", dropPiece: null });
    expect(parseEngineBestmove("bestmove e7e8q ponder a7a6")).toEqual({ from: "e7", to: "e8", dropPiece: null });
  });

  it("parses Bughouse drops", () => {
    expect(parseEngineBestmove("N@e4+")).toEqual({ from: null, to: "e4", dropPiece: "N" });
  });

  it("ignores missing or unusable engine output", () => {
    expect(parseEngineBestmove()).toBeNull();
    expect(parseEngineBestmove("(none)")).toBeNull();
    expect(parseEngineBestmove("0000")).toBeNull();
  });
});
