import { describe, expect, it } from "vitest";
import { buildChessComConnectorPrompt } from "./chesscomConnectorPrompt";

describe("Chess.com connector prompt", () => {
  it("is account-neutral and protects reusable credentials", () => {
    const prompt = buildChessComConnectorPrompt("https://thejimmyapp.com");

    expect(prompt).toContain("https://thejimmyapp.com");
    expect(prompt).toContain('filter for "pgn-info"');
    expect(prompt).toContain("Do not ask for, print, save, log, commit, or share my Chess.com password");
    expect(prompt).toContain("Do not repeat any authentication header, cookie, token, or cURL content in chat");
    expect(prompt).not.toContain("Ilikebigbug");
    expect(prompt).not.toContain("BestBym");
  });
});
