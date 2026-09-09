import { useMemo } from "react";
import type { GamePayload } from "../../types";
import { timelineToBoardTrees } from "../adapters/timelineToBoardTrees";
import { ParityFork, ParityTree } from "../tree/ParityTree";
import { pgnNodeById } from "../tree/treeNavigation";
import "./studyMoves.css";

export interface StudyMovesProps {
  game: GamePayload;
  globalPly: number;
  seek: (ply: number) => void;
}

export function StudyMoves({ game, globalPly, seek }: StudyMovesProps) {
  const trees = useMemo(() => timelineToBoardTrees(game.timeline), [game.timeline]);
  const latest = (board: "A" | "B") => [...game.timeline].reverse().find((frame) => frame.global_ply > 0 && frame.global_ply <= globalPly && frame.board === board);
  const active = { A: latest("A"), B: latest("B") };
  const mover = game.timeline.find((frame) => frame.global_ply === globalPly)?.board ?? "A";
  const moverNode = active[mover] ? pgnNodeById(trees[mover], String(active[mover]!.global_ply)) : undefined;
  return <div className="study-board-lists" data-jimmy-departure="board-lists">
    {/* Jimmy departure: the synchronized match keeps one independently scrolling move list per board. */}
    {(["A", "B"] as const).map((board) => <section className="study-board-list" data-board={board} key={board}>
      <header>Board {board}</header>
      <ParityTree tree={trees[board]} activeId={active[board] ? String(active[board]!.global_ply) : "root"} onSelect={(id) => seek(Number(id))} />
    </section>)}
    <ParityFork node={moverNode} onSelect={(id) => seek(Number(id))} />
  </div>;
}
