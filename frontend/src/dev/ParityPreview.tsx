import { createRoot } from "react-dom/client";
import { ParityBoard, type ParityBoardProps } from "../parity/board/ParityBoard";
import statesJson from "../parity/fixtures/Ma9vcnpu-4lZqSffp.states.json";
import "./parityPreview.css";

const states = statesJson as Record<string, Omit<ParityBoardProps, "size" | "showCoords">>;
const requestedState = new URLSearchParams(location.search).get("state") ?? "S0";
const stateId = Object.hasOwn(states, requestedState) ? requestedState : "S0";

export function ParityPreview() {
  return (
    <main className="parity-frame" data-state={stateId}>
      <header className="parity-header" />
      <aside className="parity-side" />
      <section className="parity-board-block"><ParityBoard {...states[stateId]} size={800} showCoords /></section>
      <aside className="parity-tools-column">
        <div className="parity-pocket-top" />
        <div className="parity-moves" />
        <div className="parity-fork" />
        <div className="parity-pocket-bottom" />
        <div className="parity-controls" />
      </aside>
      <section className="parity-underboard" />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ParityPreview />);
