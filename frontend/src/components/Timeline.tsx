import { useEffect } from "react";
import type { BoardId } from "../types";
import { ReplayControls } from "./ReplayControls";
import { useReplayMovement } from "./useReplayMovement";

interface Props {
  variant?: "full" | "panel";
  activeBoard?: BoardId;
  boardFocusEnabled?: boolean;
  onActiveBoardChange?: (board: BoardId) => void;
  stagedSourceBoard?: BoardId;
  dockSourceBoard?: BoardId;
  stagedBoardName?: string;
  dockBoardName?: string;
}

export function Timeline({ variant = "full", activeBoard = "A", boardFocusEnabled = false, onActiveBoardChange, stagedSourceBoard = "A", dockSourceBoard = "B", stagedBoardName = "First Board", dockBoardName = "Second Board" }: Props) {
  const { game, globalPly, max, mode, move } = useReplayMovement();
  const focusedBoardName = activeBoard === "A" ? stagedBoardName : dockBoardName;
  useEffect(() => {
    const handleArrowNavigation = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
      if (!game || mode !== "review" || isTyping) return;
      if (event.key === "Tab" && boardFocusEnabled) {
        event.preventDefault();
        onActiveBoardChange?.(activeBoard === "A" ? "B" : "A");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(globalPly - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(globalPly + 1);
      }
    };
    window.addEventListener("keydown", handleArrowNavigation);
    return () => window.removeEventListener("keydown", handleArrowNavigation);
  }, [activeBoard, boardFocusEnabled, game, globalPly, mode, move, onActiveBoardChange]);
  return (
    <section className={`timeline ${variant === "panel" ? "timeline-panel" : ""}`} aria-label="Synchronized move history">
      <div className="timeline-left">
        <ReplayControls />
        <div className={`mode-badge ${mode}`}><span />{mode === "review" ? `GAME REVIEW · MOVE ${globalPly}${boardFocusEnabled ? ` · ${focusedBoardName.toUpperCase()} FOCUS` : ""}` : `EXPLORATION · MOVE ${globalPly}`}</div>
      </div>
      <div className="timeline-tracks">
        <div className={`track-label ${activeBoard === "A" && boardFocusEnabled ? "focus-active" : ""}`}>{stagedBoardName}</div><div className="move-track">{game?.timeline.filter((item) => item.board === stagedSourceBoard).map((item) => <button className={item.global_ply === globalPly ? "active" : ""} key={item.global_ply} onClick={() => move(item.global_ply)}>{item.move}</button>)}</div>
        <div className={`track-label ${activeBoard === "B" && boardFocusEnabled ? "focus-active" : ""}`}>{dockBoardName}</div><div className="move-track">{game?.timeline.filter((item) => item.board === dockSourceBoard).map((item) => <button className={item.global_ply === globalPly ? "active" : ""} key={item.global_ply} onClick={() => move(item.global_ply)}>{item.move}</button>)}</div>
      </div>
      <div className="timeline-position"><strong>{mode === "review" ? "GAME" : "VAR"}</strong><span>{globalPly}/{max}</span></div>
    </section>
  );
}
