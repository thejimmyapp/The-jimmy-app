import { describe, expect, it } from "vitest";
import pgnText from "../fixtures/Ma9vcnpu-4lZqSffp.pgn?raw";
import positionsJson from "../fixtures/Ma9vcnpu-4lZqSffp.positions.json";
import statesJson from "../fixtures/Ma9vcnpu-4lZqSffp.states.json";
import { parsePgn } from "../pgn/parsePgn";
import { applySan, buildPositionMap, isCheckmate, parseCrazyhouseFen } from "./crazyhouse";

const tree = parsePgn(pgnText);
const positions = positionsJson as ReturnType<typeof buildPositionMap>;

function fixturePosition(stateId: "S1" | "S2") {
  const state = statesJson[stateId];
  return { ...state.position, lastMove: state.lastMove, check: state.check };
}

describe("original Crazyhouse position tracker", () => {
  it("puts the side to move in check after every SAN ending in plus or mate", () => {
    const checkingNodes = tree.nodes.filter((node) => /[+#]$/.test(node.san));
    expect(checkingNodes.length).toBeGreaterThan(0);
    expect(checkingNodes.filter((node) => positions[node.id].check === null).map((node) => `${node.id}:${node.san}`)).toEqual([]);
  });

  it("recognizes the mainline final 10...Bc5# position as checkmate", () => {
    let state = parseCrazyhouseFen(tree.headers.FEN);
    let node = tree.root.children[0];
    while (node) {
      state = applySan(state, node.san);
      if (!node.children[0]) break;
      node = node.children[0];
    }
    expect(node.san).toBe("Bc5#");
    expect(state.check).not.toBeNull();
    expect(isCheckmate(state)).toBe(true);
  });

  it("reproduces the hand-derived S1 position after 1...P@e2+", () => {
    const node = tree.root.children.find((candidate) => candidate.san === "P@e2+");
    expect(node).toBeDefined();
    expect(positions[node!.id]).toEqual(fixturePosition("S1"));
  });

  it("reproduces the hand-derived S2 board and pockets after 8...R@c1!!", () => {
    const node = tree.nodes.find((candidate) => candidate.san === "R@c1" && candidate.glyphs[0]?.symbol === "!!");
    expect(node).toBeDefined();
    expect(positions[node!.id]).toEqual(fixturePosition("S2"));
  });

  it("returns a captured promoted piece to the capturer's pocket as a pawn", () => {
    let state = parseCrazyhouseFen("rk6/1P6/8/8/8/8/8/4K3[] w - - 0 1");
    state = applySan(state, "bxa8=Q+");
    state = applySan(state, "Kxa8");
    expect(state.black_pocket).toContain("p");
    expect(state.black_pocket).not.toContain("q");
  });
});
