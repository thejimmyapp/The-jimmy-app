import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import statesJson from "../fixtures/Ma9vcnpu-4lZqSffp.states.json";
import { ParityPocket } from "./ParityPocket";

const reportUnexpectedReactError = console.error;

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation((message, ...details) => {
    if (typeof message === "string" && message.includes("is unrecognized in this browser") && (message.startsWith("The tag <piece>") || (message.startsWith("The tag <%s>") && details[0] === "piece"))) return;
    reportUnexpectedReactError(message, ...details);
  });
});

afterEach(cleanup);
afterAll(() => vi.restoreAllMocks());

const states = statesJson as typeof statesJson;
const slots = (container: HTMLElement) => [...container.querySelectorAll(".pocket > piece")];

describe("Crazyhouse parity pockets", () => {
  it("always renders five white slots in pawn, knight, bishop, rook, queen order with Cburnett URLs", () => {
    const { container } = render(<ParityPocket color="white" pocket={states.S0.position.white_pocket} position="top" usable={false} orientation="black" />);
    const pieces = slots(container);
    expect(pieces.map((piece) => piece.classList.item(0))).toEqual(["pawn", "knight", "bishop", "rook", "queen"]);
    expect(pieces.map((piece) => piece.getAttribute("data-nb"))).toEqual(["2", "2", "1", "1", "1"]);
    expect(pieces.map((piece) => piece.getAttribute("style"))).toEqual(["background-image: url(\"/pieces/cburnett/wP.svg\");", "background-image: url(\"/pieces/cburnett/wN.svg\");", "background-image: url(\"/pieces/cburnett/wB.svg\");", "background-image: url(\"/pieces/cburnett/wR.svg\");", "background-image: url(\"/pieces/cburnett/wQ.svg\");"]);
  });

  it("always renders five black slots in pawn, knight, bishop, rook, queen order with Cburnett URLs", () => {
    const { container } = render(<ParityPocket color="black" pocket={states.S0.position.black_pocket} position="bottom" usable orientation="black" />);
    const pieces = slots(container);
    expect(pieces.map((piece) => piece.classList.item(0))).toEqual(["pawn", "knight", "bishop", "rook", "queen"]);
    expect(pieces.map((piece) => piece.getAttribute("data-nb"))).toEqual(["3", "1", "1", "3", "0"]);
    expect(pieces.map((piece) => piece.getAttribute("style"))).toEqual(["background-image: url(\"/pieces/cburnett/bP.svg\");", "background-image: url(\"/pieces/cburnett/bN.svg\");", "background-image: url(\"/pieces/cburnett/bB.svg\");", "background-image: url(\"/pieces/cburnett/bR.svg\");", "background-image: url(\"/pieces/cburnett/bQ.svg\");"]);
  });

  it("derives the S1 and S2 slot counts from each fixture pocket string", () => {
    const expected = {
      S1: { white: [2, 2, 1, 1, 1], black: [2, 1, 1, 3, 0] },
      S2: { white: [3, 1, 1, 2, 0], black: [0, 1, 0, 2, 1] },
    };
    for (const stateId of ["S1", "S2"] as const) for (const color of ["white", "black"] as const) {
      const pocket = color === "white" ? states[stateId].position.white_pocket : states[stateId].position.black_pocket;
      const { container, unmount } = render(<ParityPocket color={color} pocket={pocket} position={color === "white" ? "top" : "bottom"} usable={false} orientation="black" />);
      expect(slots(container).map((piece) => Number(piece.getAttribute("data-nb")))).toEqual(expected[stateId][color]);
      unmount();
    }
  });

  it("marks zero-count slots empty so CSS dims the asset and suppresses the pseudo badge", () => {
    const { container } = render(<ParityPocket color="black" pocket={states.S0.position.black_pocket} position="bottom" usable orientation="black" />);
    const emptyQueen = container.querySelector("piece.queen.black");
    expect(emptyQueen?.getAttribute("data-nb")).toBe("0");
    expect(emptyQueen?.classList.contains("empty")).toBe(true);
    expect(emptyQueen?.childElementCount).toBe(0);
  });

  it("marks only the side-to-move pocket usable in every state", () => {
    for (const stateId of ["S0", "S1", "S2"] as const) {
      const state = states[stateId];
      const { container, unmount } = render(<div><ParityPocket color="white" pocket={state.position.white_pocket} position="top" usable={state.position.side_to_move === "White"} orientation="black" /><ParityPocket color="black" pocket={state.position.black_pocket} position="bottom" usable={state.position.side_to_move === "Black"} orientation="black" /></div>);
      expect(container.querySelector(".pocket-top")?.classList.contains("usable")).toBe(state.position.side_to_move === "White");
      expect(container.querySelector(".pocket-bottom")?.classList.contains("usable")).toBe(state.position.side_to_move === "Black");
      unmount();
    }
  });
});
