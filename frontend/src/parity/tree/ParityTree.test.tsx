import { fireEvent, render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pgnText from "../fixtures/Ma9vcnpu-4lZqSffp.pgn?raw";
import { parsePgn } from "../pgn/parsePgn";
import { ParityFork, ParityTree } from "./ParityTree";
import { parityKeyboardAction, pgnMainline, treeControlTarget, treeKeyboardTarget, treeNavigationTarget } from "./treeNavigation";

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
  it("matches the measured replay controls on a small branching tree", () => {
    const small = parsePgn('[Result "*"]\n\n1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 *');
    const first = small.root.children[0];
    const second = first.children[0];
    expect(treeControlTarget(small, second.id, "first")).toBe("root");
    expect(treeControlTarget(small, second.id, "prev")).toBe(first.id);
    expect(treeControlTarget(small, first.id, "next")).toBe(second.id);
    expect(treeControlTarget(small, "root", "last")).toBe(small.nodes.find((node) => node.san === "Nc6")?.id);
  });

  it("matches the measured study keyboard grammar including ten-ply jumps", () => {
    const mainline = pgnMainline(tree);
    expect(treeNavigationTarget(tree, mainline[1].id, "ArrowLeft")).toBe(mainline[0].id);
    expect(treeNavigationTarget(tree, "root", "ArrowRight")).toBe(mainline[0].id);
    expect(treeNavigationTarget(tree, mainline[4].id, "ArrowUp")).toBe("root");
    expect(treeNavigationTarget(tree, "root", "ArrowDown")).toBe(mainline.at(-1)?.id);
    expect(treeNavigationTarget(tree, "root", "ArrowRight", true)).toBe(mainline[9].id);
    expect(treeNavigationTarget(tree, mainline.at(-1)!.id, "ArrowLeft", true)).toBe(mainline[8].id);
    expect(treeNavigationTarget(tree, mainline[4].id, "Home")).toBe("root");
    expect(treeNavigationTarget(tree, mainline[4].id, "End")).toBe(mainline.at(-1)?.id);
    expect(parityKeyboardAction("f")).toEqual({ type: "flip" });
    expect(parityKeyboardAction("l")).toEqual({ type: "evaluation" });
    expect(parityKeyboardAction("Escape")).toBeNull();
  });

  it("shows the reference positional NAG symbols in the two measured variation moves", () => {
    const { container } = render(<ParityTree tree={tree} activeId="root" onSelect={() => undefined} />);
    expect(container.textContent).toContain("15.♔xe2=");
    expect(container.textContent).toContain("10.♔xe1");
    expect(container.textContent).toContain("10...♝b4+∓");
  });

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
