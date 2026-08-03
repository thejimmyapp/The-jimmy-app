import { describe, expect, it } from "vitest";
import { bmachoUrlForGameId, chessComGameIdFromUrl } from "./chesscomGameUrl";

describe("Chess.com game URL boundary", () => {
  it.each([
    ["https://www.chess.com/game/live/123", "123"],
    ["https://www.chess.com/live/game/456", "456"],
    ["https://www.chess.com/game/live/789?move=0", "789"],
  ])("accepts %s", (value, expected) => {
    expect(chessComGameIdFromUrl(value)).toBe(expected);
  });

  it.each([
    "http://www.chess.com/game/live/123",
    "https://chess.com/game/live/123",
    "https://attacker.example/game/live/123",
    "https://www.chess.com/game/live/not-numeric",
    "https://www.chess.com@127.0.0.1/game/live/123",
    "http://169.254.169.254/latest/meta-data",
  ])("rejects %s", (value) => {
    expect(chessComGameIdFromUrl(value)).toBeNull();
  });

  it("constructs bMacho links only from validated numeric IDs", () => {
    expect(bmachoUrlForGameId("123")).toBe("https://bmacho.github.io/bughouse-viewer/view.html?game_id=123");
    expect(bmachoUrlForGameId("123&next=https://attacker.example")).toBeNull();
  });
});
