import type { GamePayload } from "../../types";
import type { ParsedPgn, PgnNode, PgnRoot } from "../pgn/parsePgn";

export function timelineToTree(timeline: GamePayload["timeline"]): ParsedPgn {
  const root: PgnRoot = { id: "root", comments: [], shapes: [], children: [] };
  const nodes: PgnNode[] = timeline.map((frame) => ({
    id: String(frame.global_ply),
    parentId: "root",
    ply: frame.global_ply,
    moveNumber: Math.floor((Math.max(1, frame.local_ply) + 1) / 2),
    sideToMove: frame.local_ply % 2 === 0 ? "Black" : "White",
    boardTag: frame.board,
    san: frame.move,
    glyphs: [],
    comments: [],
    shapes: [],
    children: [],
  }));
  nodes.forEach((node, index) => {
    const parent = nodes[index - 1] ?? root;
    node.parentId = parent.id;
    parent.children.push(node);
  });
  return { headers: {}, root, result: "*", nodes };
}
