import { describe, expect, it } from "vitest";
import type { GamePayload, ReplayPosition } from "../../types";
import { timelineToTree } from "./timelineToTree";

const position = {} as ReplayPosition;
const timeline: GamePayload["timeline"] = [
  { global_ply: 0, board: "A", local_ply: 0, move: "Start", board_a: position, board_b: position },
  { global_ply: 1, board: "B", local_ply: 1, move: "e4", board_a: position, board_b: position },
  { global_ply: 2, board: "A", local_ply: 1, move: "N@f7+", board_a: position, board_b: position },
];

describe("timeline-to-tree adapter", () => {
  it("creates a linear chain in global order with ids and board tags", () => {
    const tree = timelineToTree(timeline);
    expect(tree.nodes.map(({ id, boardTag, san }) => [id, boardTag, san])).toEqual([["0", "A", "Start"], ["1", "B", "e4"], ["2", "A", "N@f7+"]]);
    expect(tree.root.children[0].id).toBe("0");
    expect(tree.nodes[0].children[0].id).toBe("1");
    expect(tree.nodes[1].parentId).toBe("0");
  });
});
