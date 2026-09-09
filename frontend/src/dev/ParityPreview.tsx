import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createRoot } from "react-dom/client";
import { ParityBoard, type ParityGlyph, type ParityShape } from "../parity/board/ParityBoard";
import { parityBoardTheme } from "../parity/board/themes";
import { ParityControls } from "../parity/controls/ParityControls";
import pgnText from "../parity/fixtures/Ma9vcnpu-4lZqSffp.pgn?raw";
import positionsJson from "../parity/fixtures/Ma9vcnpu-4lZqSffp.positions.json";
import { parityLayout } from "../parity/layout";
import { parsePgn, type PgnGlyph, type PgnNode } from "../parity/pgn/parsePgn";
import { ParityPocket } from "../parity/pocket/ParityPocket";
import type { CrazyhousePosition } from "../parity/rules/crazyhouse";
import { ParityFork, ParityTree } from "../parity/tree/ParityTree";
import { parityKeyboardAction, pgnNodeById, treeControlTarget, treeNavigationTarget } from "../parity/tree/treeNavigation";
import { StudyPreview } from "./StudyPreview";
import "./parityPreview.css";

const tree = parsePgn(pgnText);
const positions = positionsJson as unknown as Record<string, CrazyhousePosition>;
const params = new URLSearchParams(location.search);
const requestedState = params.get("state") ?? "S0";
const mainlinePlyOne = tree.root.children[0];
const rookDrop = tree.nodes.find((node) => node.san === "R@c1" && node.glyphs[0]?.symbol === "!!");
if (!mainlinePlyOne || !rookDrop) throw new Error("Parity fixture nodes are incomplete");
const stateNodeIds: Record<string, string> = { S0: "root", S1: mainlinePlyOne.id, S2: rookDrop.id };
const initialActiveId = stateNodeIds[requestedState] ?? "root";
const layout = parityLayout(params.get("layout"));
const theme = parityBoardTheme(params.get("theme"));

const rootForkShapes: ParityShape[] = [
  { brush: "paleBlue", orig: "P@", dest: "e2", below: true, geometry: { x1: 20.5, y1: 11.5, x2: -0.36999214150971194, y2: -2.413328094339808 }, fork: { highlight: "#3291ff", clip: { x: -1, y: -3, width: 22, height: 15 } } },
  { brush: "paleGrey", orig: "R@", dest: "e1", below: true, geometry: { x1: 18.5, y1: 11.5, x2: -0.37736206788540216, y2: -3.403180579909528 }, fork: { highlight: "#aaa", clip: { x: -1, y: -4, width: 20, height: 16 } } },
];

function badgeGlyph(glyph: PgnGlyph | undefined, node: PgnNode | undefined, position: CrazyhousePosition): ParityGlyph[] {
  if (!glyph || !node || glyph.kind === "other" || !position.lastMove) return [];
  return [{ square: position.lastMove.to, glyph: glyph.symbol as ParityGlyph["glyph"], kind: glyph.kind }];
}

export function ParityPreview() {
  const frameRef = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [orientation, setOrientation] = useState<"black" | "white">("black");
  const active = pgnNodeById(tree, activeId);
  const activeNode = active && "parentId" in active ? active : undefined;
  const position = positions[activeId];
  if (!position) throw new Error(`Missing generated parity position for ${activeId}`);

  useEffect(() => frameRef.current?.focus(), []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const action = parityKeyboardAction(event.key);
    if (!action) return;
    if (action.type === "flip") {
      event.preventDefault();
      setOrientation((current) => current === "black" ? "white" : "black");
      return;
    }
    if (action.type === "evaluation") return;
    event.preventDefault();
    setActiveId((current) => treeNavigationTarget(tree, current, action.key, event.shiftKey));
  };

  const topColor = orientation === "black" ? "white" : "black";
  const bottomColor = orientation === "black" ? "black" : "white";
  const pocketFor = (color: "white" | "black") => color === "white" ? position.white_pocket : position.black_pocket;
  const isUsable = (color: "white" | "black") => position.side_to_move.toLowerCase() === color;
  const glyphs = useMemo(() => badgeGlyph(activeNode?.glyphs[0], activeNode, position), [activeNode, position]);
  const shapes = [...(activeNode?.shapes ?? []), ...(activeId === "root" && (active?.children.length ?? 0) >= 2 ? rootForkShapes : [])];
  const frameStyle = {
    "--parity-frame-board-x": `${layout.board.x}px`,
    "--parity-frame-board-y": `${layout.board.y}px`,
    "--parity-frame-board-size": `${layout.board.size}px`,
    "--parity-frame-tools-x": `${layout.tools.x}px`,
    "--parity-frame-tools-width": `${layout.tools.width}px`,
    "--parity-frame-pocket-top-y": `${layout.tools.pocketTopY}px`,
    "--parity-frame-pocket-bottom-y": `${layout.tools.pocketBottomY}px`,
    "--parity-frame-moves-top": `${layout.tools.movesTop}px`,
    "--parity-frame-moves-height": `${layout.tools.movesBottom - layout.tools.movesTop}px`,
    "--parity-frame-controls-y": `${layout.tools.controlsY}px`,
    "--parity-frame-controls-height": `${layout.tools.controlsHeight}px`,
    "--parity-frame-width": `${layout.viewport.width}px`,
    "--parity-frame-height": `${layout.viewport.height}px`,
  } as CSSProperties;
  return (
    <main ref={frameRef} className="parity-frame" data-state={requestedState} data-active-id={activeId} data-layout={layout.id} data-theme={theme.id} data-orientation={orientation} style={frameStyle} tabIndex={0} onKeyDown={onKeyDown}>
      <header className="parity-header" />
      <aside className="parity-side" />
      <section className="parity-board-block"><ParityBoard position={position} orientation={orientation} layout={layout} theme={theme} lastMove={position.lastMove} check={position.check} glyphs={glyphs} shapes={shapes} showCoords /></section>
      <aside className="parity-tools-column">
        <ParityPocket color={topColor} pocket={pocketFor(topColor)} position="top" usable={isUsable(topColor)} orientation={orientation} layout={layout} />
        <div className="parity-moves"><ParityTree tree={tree} activeId={activeId} onSelect={setActiveId} /></div>
        <div className="parity-fork"><ParityFork node={active} onSelect={setActiveId} /></div>
        <ParityPocket color={bottomColor} pocket={pocketFor(bottomColor)} position="bottom" usable={isUsable(bottomColor)} orientation={orientation} layout={layout} />
        <div className="parity-controls"><ParityControls onNavigate={(action) => setActiveId((current) => treeControlTarget(tree, current, action))} /></div>
      </aside>
      <section className="parity-underboard" />
    </main>
  );
}

const studyIndex = params.get("study");
const requestedPly = Number(params.get("ply") ?? 0);
const requestedFrame = params.get("frame")?.match(/^(\d+)x(\d+)$/);
const studyFrame = requestedFrame ? { width: Number(requestedFrame[1]), height: Number(requestedFrame[2]) } : null;
createRoot(document.getElementById("root")!).render(studyIndex === null
  ? <ParityPreview />
  : <StudyPreview fixtureIndex={Number(studyIndex)} requestedPly={Number.isSafeInteger(requestedPly) ? requestedPly : 0} frame={studyFrame} chrome={params.get("chrome") === "1"} />);
