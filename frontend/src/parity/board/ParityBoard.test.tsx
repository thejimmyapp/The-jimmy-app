import { render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import statesJson from "../fixtures/Ma9vcnpu-4lZqSffp.states.json";
import { ParityBoard, type ParityBoardProps } from "./ParityBoard";

const states = statesJson as Record<string, Omit<ParityBoardProps, "layout" | "theme" | "showCoords">>;

const reportUnexpectedReactError = console.error;

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation((message, ...details) => {
    if (typeof message === "string" && message.startsWith("The tag <") && message.includes("is unrecognized in this browser")) return;
    reportUnexpectedReactError(message, ...details);
  });
});

afterAll(() => vi.restoreAllMocks());

describe("Lichess Study parity board surface", () => {
  it("renders all 26 S0 pieces at black-orientation transforms", () => {
    const { container } = render(<ParityBoard {...states.S0} />);
    expect(container.querySelectorAll("cg-board > piece")).toHaveLength(26);
    expect(container.querySelector('piece.black.king[data-square="g8"]')?.getAttribute("style")).toContain("translate(85px, 595px)");
    expect(container.querySelector('piece.black.pawn[data-square="a7"]')?.getAttribute("style")).toContain("translate(595px, 510px)");
    expect(container.querySelector('piece.black.pawn[data-square="h7"]')?.getAttribute("style")).toContain("translate(0px, 510px)");
    expect(container.querySelector('piece.white.king[data-square="f1"]')?.getAttribute("style")).toContain("translate(170px, 0px)");
  });

  it("renders S1 last-move and check layers at exact transforms", () => {
    const { container } = render(<ParityBoard {...states.S1} />);
    expect(container.querySelector('square.last-move[data-square="e2"]')?.getAttribute("style")).toContain("translate(255px, 85px)");
    expect(container.querySelector('square.check[data-square="f1"]')?.getAttribute("style")).toContain("translate(170px, 0px)");
  });

  it("orders black-orientation coordinates and alternates their colour classes", () => {
    const { container } = render(<ParityBoard {...states.S0} />);
    const ranks = [...container.querySelectorAll("coords.ranks.black coord")];
    const files = [...container.querySelectorAll("coords.files.black coord")];
    expect(ranks.map((coord) => coord.textContent)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(files.map((coord) => coord.textContent)).toEqual(["h", "g", "f", "e", "d", "c", "b", "a"]);
    expect(ranks.slice(0, 2).map((coord) => coord.className)).toEqual(["coord-dark", "coord-light"]);
    expect(files.at(-1)?.className).toBe("coord-dark");
  });

  it("renders both measured S0 variation-fork arrows below the pieces", () => {
    const { container } = render(<ParityBoard {...states.S0} />);
    const arrows = [...container.querySelectorAll("svg.cg-shapes-below g[data-orig]")];
    expect(arrows.map((arrow) => [arrow.getAttribute("data-orig"), arrow.getAttribute("data-dest")])).toEqual([["P@", "e2"], ["R@", "e1"]]);
    expect(arrows[0].getAttribute("opacity")).toBe("0.5");
    const blueLines = arrows[0].querySelectorAll("line");
    expect([...blueLines].map((line) => [line.getAttribute("x1"), line.getAttribute("y1"), line.getAttribute("x2"), line.getAttribute("y2")])).toEqual([
      ["20.5", "11.5", "-0.36999214150971194", "-2.413328094339808"],
      ["20.5", "11.5", "-0.36999214150971194", "-2.413328094339808"],
    ]);
  });

  it("renders the S2 green arrow and circle with the measured SVG attributes", () => {
    const { container } = render(<ParityBoard {...states.S2} />);
    const shapes = container.querySelector("svg.cg-shapes:not(.cg-shapes-below)");
    const arrow = shapes?.querySelector('line[data-orig="g4"][data-dest="h6"]');
    const circle = shapes?.querySelector('circle[data-orig="h6"]');
    expect(shapes?.getAttribute("viewBox")).toBe("-4 -4 8 8");
    expect([arrow?.getAttribute("x1"), arrow?.getAttribute("y1"), arrow?.getAttribute("x2"), arrow?.getAttribute("y2")]).toEqual(["-2.5", "-0.5", "-3.4301228757031317", "1.3602457514062631"]);
    expect(arrow?.getAttribute("stroke-width")).toBe("0.15625");
    expect(arrow?.getAttribute("stroke-linecap")).toBe("round");
    expect(circle?.getAttribute("r")).toBe("0.46875");
    expect(circle?.getAttribute("stroke-width")).toBe("0.0625");
  });
});
