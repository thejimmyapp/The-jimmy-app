import { createRoot } from "react-dom/client";
import type { CSSProperties } from "react";
import { ParityBoard, type ParityBoardProps } from "../parity/board/ParityBoard";
import { parityBoardTheme } from "../parity/board/themes";
import { parityLayout } from "../parity/layout";
import { ParityPocket } from "../parity/pocket/ParityPocket";
import statesJson from "../parity/fixtures/Ma9vcnpu-4lZqSffp.states.json";
import "./parityPreview.css";

const states = statesJson as Record<string, Omit<ParityBoardProps, "layout" | "theme" | "showCoords">>;
const params = new URLSearchParams(location.search);
const requestedState = params.get("state") ?? "S0";
const stateId = Object.hasOwn(states, requestedState) ? requestedState : "S0";
const layout = parityLayout(params.get("layout"));
const theme = parityBoardTheme(params.get("theme"));

export function ParityPreview() {
  const state = states[stateId];
  const topColor = state.orientation === "black" ? "white" : "black";
  const bottomColor = state.orientation;
  const pocketFor = (color: "white" | "black") => color === "white" ? state.position.white_pocket : state.position.black_pocket;
  const isUsable = (color: "white" | "black") => state.position.side_to_move.toLowerCase() === color;
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
  } as CSSProperties;
  return (
    <main className="parity-frame" data-state={stateId} data-layout={layout.id} data-theme={theme.id} style={frameStyle}>
      <header className="parity-header" />
      <aside className="parity-side" />
      <section className="parity-board-block"><ParityBoard {...state} layout={layout} theme={theme} showCoords /></section>
      <aside className="parity-tools-column">
        <ParityPocket color={topColor} pocket={pocketFor(topColor)} position="top" usable={isUsable(topColor)} orientation={state.orientation} layout={layout} />
        <div className="parity-moves" />
        <div className="parity-fork" />
        <ParityPocket color={bottomColor} pocket={pocketFor(bottomColor)} position="bottom" usable={isUsable(bottomColor)} orientation={state.orientation} layout={layout} />
        <div className="parity-controls" />
      </aside>
      <section className="parity-underboard" />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ParityPreview />);
