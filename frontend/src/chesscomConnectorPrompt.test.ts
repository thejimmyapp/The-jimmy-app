import { describe, expect, it } from "vitest";
import { buildChessComConnectorPrompt } from "./chesscomConnectorPrompt";

describe("buildChessComConnectorPrompt", () => {
  it("keeps the temporary connector instructions account-neutral", () => {
    const prompt = buildChessComConnectorPrompt("https://thejimmyapp.com/");

    expect(prompt).toContain("The Jimmy App: https://thejimmyapp.com");
    expect(prompt).not.toContain("https://thejimmyapp.com/");
    expect(prompt).toContain("username already entered by the current user");
    expect(prompt).not.toContain("BestBym");
    expect(prompt).not.toContain("Chess.com username:");
    expect(prompt).toContain('filter for "pgn-info"');
  });

  it("includes credential and destination safeguards", () => {
    const prompt = buildChessComConnectorPrompt("http://localhost:8000");

    expect(prompt).toContain("Never ask me for my Chess.com password");
    expect(prompt).toContain("Do not print the cURL in chat");
    expect(prompt).toContain("Clear the sensitive cURL from the clipboard");
    expect(prompt).toContain("Stop immediately if the destination domain differs");
  });
});
