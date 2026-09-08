import { fireEvent, render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pgnText from "../fixtures/Ma9vcnpu-4lZqSffp.pgn?raw";
import { parsePgn } from "../pgn/parsePgn";
import { ParityFork, ParityTree } from "./ParityTree";
import { pgnMainline, treeKeyboardTarget } from "./treeNavigation";

const tree = parsePgn(pgnText);
const reportUnexpectedReactError = console.error;

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation((message, ...details) => {
    if (typeof message === "string" && message.includes("is unrecognized in this browser")) return;
    reportUnexpectedReactError(message, ...details);
  });
});

afterAll(() => vi.restoreAllMocks());

describe("Lichess-column parity move tree", () => {
  it("renders the 19-ply mainline as ten numbered rows with glyph classes and nested lines", () => {
    const { container } = render(<ParityTree tree={tree} activeId="root" onSelect={() => undefined} />);
    expect(pgnMainline(tree)).toHaveLength(19);
    expect(container.querySelectorAll("[data-mainline-row]")).toHaveLength(10);
    expect([...container.querySelectorAll(".parity-column-row > index")].map((index) => index.textContent)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(container.querySelector("move.glyph-good")).not.toBeNull();
    const depths = [...container.querySelectorAll("interrupt[data-depth]")].map((entry) => Number(entry.getAttribute("data-depth")));
    expect(Math.max(...depths)).toBeGreaterThanOrEqual(4);
  });

  it("shows a two-choice fork at root and no fork after mainline ply one", () => {
    const { queryByTestId, rerender } = render(<ParityFork node={tree.root} onSelect={() => undefined} />);
    expect(queryByTestId("parity-fork")?.querySelectorAll("button")).toHaveLength(2);
    expect(queryByTestId("parity-fork")?.textContent).toContain("1...♟@e2+!");
    rerender(<ParityFork node={tree.root.children[0]} onSelect={() => undefined} />);
    expect(queryByTestId("parity-fork")).toBeNull();
  });

  it("selects a clicked move and advances ArrowRight from root to mainline ply one", () => {
    const onSelect = vi.fn();
    const { container } = render(<ParityTree tree={tree} activeId="root" onSelect={onSelect} />);
    fireEvent.click(container.querySelector('move[data-node-id="n-001"]')!);
    expect(onSelect).toHaveBeenCalledWith("n-001");
    expect(treeKeyboardTarget(tree, "root", "ArrowRight")).toBe("n-001");
    expect(treeKeyboardTarget(tree, "n-001", "ArrowLeft")).toBe("root");
  });
});
