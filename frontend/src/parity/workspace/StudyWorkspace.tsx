import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { currentPosition, useCoachStore } from "../../store";
import type { GamePayload, ReplayPosition } from "../../types";
import { ParityBoard } from "../board/ParityBoard";
import { parityBoardTheme } from "../board/themes";
import { ParityControls } from "../controls/ParityControls";
import { PARITY_LAYOUTS, type ParityLayout } from "../layout";
import { ParityPocket } from "../pocket/ParityPocket";
import { parityKeyboardAction, type ParityNavigationAction } from "../tree/treeNavigation";
import { replayToParity } from "../adapters/replayToParity";
import { StudyMoves } from "./StudyMoves";
import "./studyWorkspace.css";

function studyLayoutForWidth(width: number) {
  if (width >= 1600) return PARITY_LAYOUTS.owner;
  if (width <= 1024) return PARITY_LAYOUTS.reference1024;
  if (width <= 1200) return PARITY_LAYOUTS.reference1200;
  return PARITY_LAYOUTS.reference;
}

function reviewerOrientation(game: GamePayload): "white" | "black" {
  return game.game.user_color === "black" ? "black" : "white";
}

function compactLayout(layout: ParityLayout): ParityLayout {
  const size = layout.id === "owner" ? 293.5 : Math.min(293.5, layout.board.size * 0.5);
  const pocketHeight = 35;
  return {
    ...layout,
    board: { ...layout.board, size, squareSize: size / 8, ranksWidth: 8, filesHeight: 13 },
    tools: { ...layout.tools, width: size, pocketHeight, pocketSlotSize: pocketHeight },
  };
}

function PlayerBar({ name, clock, position }: { name: string; clock: string; position: "top" | "bottom" }) {
  return <div className={`study-player-bar ${position}`}><span>{name}</span><time>{clock}</time></div>;
}

function pocketColor(position: ReplayPosition, orientation: "white" | "black", edge: "top" | "bottom") {
  const bottom = orientation === "white" ? "white" : "black";
  const color = edge === "bottom" ? bottom : bottom === "white" ? "black" : "white";
  return { color, pocket: color === "white" ? position.white_pocket : position.black_pocket } as const;
}

export function StudyWorkspace() {
  const { game, globalPly, seek } = useCoachStore();
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [flipped, setFlipped] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => workspaceRef.current?.focus(), []);
  if (!game) return null;

  const layout = studyLayoutForWidth(viewportWidth);
  const smallLayout = compactLayout(layout);
  const baseOrientation = reviewerOrientation(game);
  const orientation = flipped ? (baseOrientation === "white" ? "black" : "white") : baseOrientation;
  const boardAReplay = currentPosition(game, globalPly, "A");
  const boardBReplay = currentPosition(game, globalPly, "B");
  if (!boardAReplay) return null;
  const boardA = replayToParity(boardAReplay);
  const boardB = boardBReplay ? replayToParity(boardBReplay) : null;
  const frames = game.timeline;
  const activeIndex = Math.max(0, frames.findIndex((frame) => frame.global_ply === globalPly));
  const move = (index: number) => frames.length && seek(frames[Math.max(0, Math.min(frames.length - 1, index))].global_ply);
  const navigate = (action: ParityNavigationAction) => {
    if (action === "first") move(0);
    else if (action === "last") move(frames.length - 1);
    else move(activeIndex + (action === "prev" ? -1 : 1));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const action = parityKeyboardAction(event.key);
    if (!action) return;
    event.preventDefault();
    if (action.type === "flip") { setFlipped((current) => !current); return; }
    if (action.key === "Home" || action.key === "ArrowUp") move(0);
    else if (action.key === "End" || action.key === "ArrowDown") move(frames.length - 1);
    else move(activeIndex + (action.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 1));
  };
  const top = pocketColor(boardAReplay, orientation, "top");
  const bottom = pocketColor(boardAReplay, orientation, "bottom");
  const players = { white: game.players.board_a_white, black: game.players.board_a_black };
  const bottomSide = orientation;
  const topSide = bottomSide === "white" ? "black" : "white";
  const style = {
    "--study-board-x": `${layout.board.x}px`, "--study-board-y": `${layout.board.y}px`, "--study-board-size": `${layout.board.size}px`,
    "--study-tools-x": `${layout.tools.x}px`, "--study-tools-width": `${layout.tools.width}px`, "--study-pocket-top": `${layout.tools.pocketTopY}px`,
    "--study-pocket-bottom": `${layout.tools.pocketBottomY}px`, "--study-moves-top": `${layout.tools.movesTop}px`,
    "--study-moves-height": `${layout.tools.movesBottom - layout.tools.movesTop}px`, "--study-controls-y": `${layout.tools.controlsY}px`, "--study-controls-height": `${layout.tools.controlsHeight}px`,
    "--study-side-size": `${smallLayout.board.size}px`, "--study-side-pocket-height": `${smallLayout.tools.pocketHeight}px`,
  } as CSSProperties;

  return <section ref={workspaceRef} className="study-workspace" aria-label="Study review workspace" tabIndex={0} onKeyDown={onKeyDown} data-layout={layout.id} data-orientation={orientation} style={style}>
    {game.second_board_available && boardBReplay && boardB && <aside className="study-second-board" data-jimmy-departure="second-board">
      {/* Jimmy departure: the synchronized second board remains visible in the study side column. */}
      <ParityPocket {...pocketColor(boardBReplay, orientation, "top")} position="top" usable={boardB.position.side_to_move.toLowerCase() === pocketColor(boardBReplay, orientation, "top").color} orientation={orientation} layout={smallLayout} />
      <ParityBoard position={boardB.position} orientation={orientation} layout={smallLayout} theme={parityBoardTheme("brown")} lastMove={boardB.lastMove} check={boardB.check} showCoords />
      <ParityPocket {...pocketColor(boardBReplay, orientation, "bottom")} position="bottom" usable={boardB.position.side_to_move.toLowerCase() === pocketColor(boardBReplay, orientation, "bottom").color} orientation={orientation} layout={smallLayout} />
    </aside>}
    <div className="study-main-board">
      <PlayerBar position="top" name={players[topSide]} clock={topSide === "white" ? boardAReplay.white_clock : boardAReplay.black_clock} />
      <ParityBoard position={boardA.position} orientation={orientation} layout={layout} theme={parityBoardTheme("brown")} lastMove={boardA.lastMove} check={boardA.check} showCoords />
      <PlayerBar position="bottom" name={players[bottomSide]} clock={bottomSide === "white" ? boardAReplay.white_clock : boardAReplay.black_clock} />
    </div>
    <aside className="study-tools">
      <ParityPocket {...top} position="top" usable={boardA.position.side_to_move.toLowerCase() === top.color} orientation={orientation} layout={layout} />
      <div className="study-moves"><StudyMoves game={game} globalPly={globalPly} seek={seek} /></div>
      <div className="study-fork" />
      <ParityPocket {...bottom} position="bottom" usable={boardA.position.side_to_move.toLowerCase() === bottom.color} orientation={orientation} layout={layout} />
      <div className="study-controls"><ParityControls onNavigate={navigate} /></div>
    </aside>
  </section>;
}
