import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { useCoachStore } from "../store";
import type { ReplayPosition } from "../types";
import { BoardPanel } from "./BoardPanel";

const startBoard = [
  ["r", "n", "b", "q", "k", "b", "n", "r"],
  Array(8).fill("p"),
  ...Array.from({ length: 4 }, () => Array(8).fill("")),
  Array(8).fill("P"),
  ["R", "N", "B", "Q", "K", "B", "N", "R"],
];

const position: ReplayPosition = {
  ply: 0,
  label: "Start",
  board: startBoard,
  side_to_move: "White",
  variant_fen: "start",
  white_pocket: "PPN",
  black_pocket: "qr",
  white_clock: "3:00",
  black_clock: "3:00",
  partner_index: 0,
  from_square: "e2",
  to_square: "e4",
};

const renderBoard = (pieceStyle: "cburnett" | "classic") => render(
  <div data-piece-set={pieceStyle}>
    <BoardPanel boardId="A" position={position} pairedPosition={position} orientation="white" pieceStyle={pieceStyle} title="First Board" playerTop="Black" playerBottom="White" />
  </div>,
);

describe("BoardPanel appearance resources", () => {
  beforeEach(() => useCoachStore.setState({ game: null, roomId: null, globalPly: 0, mode: "review", annotations: [] }));
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("renders all 32 starting pieces from the SVG set without changing square labels", () => {
    const { container } = renderBoard("cburnett");
    expect(screen.getAllByRole("img")).toHaveLength(36);
    expect(container.querySelectorAll(".board .piece[data-piece]")).toHaveLength(32);
    expect(screen.getByRole("img", { name: "white king" }).getAttribute("data-piece")).toBe("wK");
    expect(container.querySelector('.board .piece[aria-label="black queen"]')?.getAttribute("data-piece")).toBe("bQ");
    expect(screen.getByRole("button", { name: "e1 K" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "e8 k" })).toBeTruthy();
  });

  it("preserves glyph rendering for a legacy set", () => {
    const { container } = renderBoard("classic");
    expect(container.querySelector('.board [aria-label="e1 K"] .piece')?.textContent).toBe("♔");
    expect(container.querySelector('.board [aria-label="e8 k"] .piece')?.textContent).toBe("♚");
    expect(container.querySelectorAll(".board .piece[data-piece]")).toHaveLength(0);
  });

  it("uses SVG piece spans in pockets while preserving rail names and count badges", () => {
    const { container } = renderBoard("cburnett");
    expect(screen.getByLabelText("White pocket")).toBeTruthy();
    expect(screen.getByLabelText("Black pocket")).toBeTruthy();
    expect(container.querySelector('.pocket-rail.white .piece[data-piece="wP"] b')?.textContent).toBe("2");
    expect(container.querySelector('.pocket-rail.black .piece[data-piece="bQ"]')).not.toBeNull();
  });

  it("retains coordinate, last-move, annotation, selection, and legal-target classes", async () => {
    useCoachStore.setState({ annotations: [{ id: "highlight", board: "A", ply: 0, author: "Tester", color: "cyan", type: "highlight", from: "e4" }] });
    vi.spyOn(api, "explorationMove").mockResolvedValue({ legal: false, reason: "preview", legal_destinations: ["e3"] });
    const { container } = renderBoard("cburnett");
    expect(container.querySelectorAll(".coordinate.rank-coordinate")).toHaveLength(8);
    expect(container.querySelectorAll(".coordinate.file-coordinate")).toHaveLength(8);
    expect(container.querySelector('[aria-label="e4"].last-move.annotated')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "e2 P" }));
    expect(container.querySelector('[aria-label="e2 P"].selected-source.last-move')).not.toBeNull();
    await waitFor(() => expect(container.querySelector('[aria-label="e3"].legal-target')).not.toBeNull());
  });
});
