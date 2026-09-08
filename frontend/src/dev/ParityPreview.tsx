import { createRoot } from "react-dom/client";
import { ParityBoard, type ParityBoardProps } from "../parity/board/ParityBoard";
import { ParityPocket } from "../parity/pocket/ParityPocket";
import statesJson from "../parity/fixtures/Ma9vcnpu-4lZqSffp.states.json";
import "./parityPreview.css";

const states = statesJson as Record<string, Omit<ParityBoardProps, "size" | "showCoords">>;
const requestedState = new URLSearchParams(location.search).get("state") ?? "S0";
const stateId = Object.hasOwn(states, requestedState) ? requestedState : "S0";

export function ParityPreview() {
  const state = states[stateId];
  const topColor = state.orientation === "black" ? "white" : "black";
  const bottomColor = state.orientation;
  const pocketFor = (color: "white" | "black") => color === "white" ? state.position.white_pocket : state.position.black_pocket;
  const isUsable = (color: "white" | "black") => state.position.side_to_move.toLowerCase() === color;
  return (
    <main className="parity-frame" data-state={stateId}>
      <header className="parity-header" />
      <aside className="parity-side" />
      <section className="parity-board-block"><ParityBoard {...state} size={800} showCoords /></section>
      <aside className="parity-tools-column">
        <ParityPocket color={topColor} pocket={pocketFor(topColor)} position="top" usable={isUsable(topColor)} orientation={state.orientation} />
        <div className="parity-moves" />
        <div className="parity-fork" />
        <ParityPocket color={bottomColor} pocket={pocketFor(bottomColor)} position="bottom" usable={isUsable(bottomColor)} orientation={state.orientation} />
        <div className="parity-controls" />
      </aside>
      <section className="parity-underboard" />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ParityPreview />);
