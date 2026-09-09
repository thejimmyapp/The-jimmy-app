import type { BoardId, GamePayload } from "../../types";
import type { ParsedPgn, PgnNode, PgnRoot } from "../pgn/parsePgn";
import type { Side } from "../rules/crazyhouse";
import { sanForTransition } from "../rules/san";
import { replayToParity } from "./replayToParity";

export interface BoardTreeResult {
  trees: Record<BoardId, ParsedPgn>;
  fallbackCount: number;
}

export function timelineToBoardTreesWithDiagnostics(timeline: GamePayload["timeline"]): BoardTreeResult {
  let fallbackCount = 0;
  const trees = Object.fromEntries((["A", "B"] as BoardId[]).map((board) => {
    const root: PgnRoot = { id: "root", comments: [], shapes: [], children: [] };
    const frames = timeline.filter((frame) => frame.global_ply > 0 && frame.board === board);
    const nodes: PgnNode[] = frames.map((frame) => {
      const index = timeline.findIndex((candidate) => candidate.global_ply === frame.global_ply);
      const beforeFrame = timeline[Math.max(0, index - 1)];
      const beforeReplay = board === "A" ? beforeFrame.board_a : beforeFrame.board_b;
      const afterReplay = board === "A" ? frame.board_a : frame.board_b;
      const sideMoved: Side = frame.local_ply % 2 === 1 ? "White" : "Black";
      let san = frame.move;
      try {
        if (!afterReplay.to_square) throw new Error("transition has no destination");
        san = sanForTransition(replayToParity(beforeReplay).position, replayToParity(afterReplay).position, afterReplay.from_square, afterReplay.to_square, sideMoved);
      } catch { fallbackCount += 1; }
      return {
        id: String(frame.global_ply), parentId: "root", ply: frame.local_ply,
        moveNumber: Math.ceil(frame.local_ply / 2), sideToMove: sideMoved,
        san, glyphs: [], comments: [], shapes: [], children: [],
      };
    });
    nodes.forEach((node, index) => { const parent = nodes[index - 1] ?? root; node.parentId = parent.id; parent.children.push(node); });
    return [board, { headers: {}, root, result: "*", nodes } satisfies ParsedPgn];
  })) as Record<BoardId, ParsedPgn>;
  return { trees, fallbackCount };
}

export function timelineToBoardTrees(timeline: GamePayload["timeline"]) {
  return timelineToBoardTreesWithDiagnostics(timeline).trees;
}
