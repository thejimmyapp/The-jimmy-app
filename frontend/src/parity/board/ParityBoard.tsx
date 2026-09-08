import type { CSSProperties } from "react";
import { pieceAriaLabel, pieceAssetId } from "../../boardAppearance";
import "./parityBoard.css";

export interface ParityPosition {
  board: string[][];
  white_pocket: string;
  black_pocket: string;
  side_to_move: "White" | "Black";
}

export interface ParityLastMove { from: string | null; to: string }
export interface ParityGlyph { square: string; glyph: string; kind: "good" | "brilliant" }
export interface ParityShape { brush: "green"; orig: string; dest?: string }

export interface ParityBoardProps {
  position: ParityPosition;
  orientation: "black" | "white";
  size?: number;
  lastMove?: ParityLastMove | null;
  check?: string | null;
  glyphs?: ParityGlyph[];
  shapes?: ParityShape[];
  showCoords?: boolean;
}

const pieceNames: Record<string, string> = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" };

function squareCoordinates(square: string, orientation: "black" | "white") {
  const file = "abcdefgh".indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  return orientation === "black" ? { x: 7 - file, y: rank } : { x: file, y: 7 - rank };
}

function squareTransform(square: string, orientation: "black" | "white", squareSize: number) {
  const { x, y } = squareCoordinates(square, orientation);
  return `translate(${x * squareSize}px, ${y * squareSize}px)`;
}

function shapePoint(square: string, orientation: "black" | "white") {
  const { x, y } = squareCoordinates(square, orientation);
  return { x: x - 3.5, y: y - 3.5 };
}

function boardPieces(position: ParityPosition) {
  return position.board.flatMap((row, rowIndex) => row.map((piece, fileIndex) => ({ piece, square: `${"abcdefgh"[fileIndex]}${8 - rowIndex}` }))).filter(({ piece }) => piece);
}

export function ParityBoard({ position, orientation, size = 800, lastMove = null, check = null, glyphs = [], shapes = [], showCoords = true }: ParityBoardProps) {
  const squareSize = size / 8;
  const style = { "--parity-board-size": `${size}px`, "--parity-square-size": `${squareSize}px` } as CSSProperties;
  const highlights = [
    ...new Set([lastMove?.from, lastMove?.to].filter((square): square is string => Boolean(square))),
    ...(check ? [check] : []),
  ];
  const rankLabels = orientation === "black" ? ["1", "2", "3", "4", "5", "6", "7", "8"] : ["8", "7", "6", "5", "4", "3", "2", "1"];
  const fileLabels = orientation === "black" ? ["h", "g", "f", "e", "d", "c", "b", "a"] : ["a", "b", "c", "d", "e", "f", "g", "h"];
  return (
    <div className={`parity-board cg-wrap orientation-${orientation}`} style={style} data-orientation={orientation}>
      <cg-container>
        <cg-board>
          {highlights.map((square) => <square key={square} data-square={square} className={`${lastMove?.from === square || lastMove?.to === square ? "last-move" : ""} ${check === square ? "check" : ""}`.trim()} style={{ transform: squareTransform(square, orientation, squareSize) }} />)}
          {boardPieces(position).map(({ piece, square }) => {
            const asset = pieceAssetId(piece);
            const color = piece === piece.toUpperCase() ? "white" : "black";
            const name = pieceNames[piece.toUpperCase()];
            return <piece key={square} data-square={square} data-piece={asset ?? undefined} className={`${color} ${name}`} role="img" aria-label={`${pieceAriaLabel(piece)} on ${square}`} style={{ transform: squareTransform(square, orientation, squareSize), backgroundImage: asset ? `url("/pieces/cburnett/${asset}.svg")` : undefined }} />;
          })}
          {showCoords && <>
            <coords className={`ranks ${orientation}`}>{rankLabels.map((label, index) => <coord key={label} className={index % 2 === 0 ? "coord-light" : "coord-dark"}>{label}</coord>)}</coords>
            <coords className={`files ${orientation}`}>{fileLabels.map((label, index) => <coord key={label} className={index % 2 === 0 ? "coord-light" : "coord-dark"}>{label}</coord>)}</coords>
          </>}
          <svg className="cg-shapes" viewBox="-4 -4 8 8" preserveAspectRatio="none" aria-label="Board shapes">
            <defs><marker id="parity-green-arrowhead" markerWidth="4" markerHeight="4" refX="3.4" refY="2" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,4 L4,2 z" fill="#15781b" /></marker></defs>
            {shapes.map((shape) => {
              const start = shapePoint(shape.orig, orientation);
              if (!shape.dest) return <circle key={`circle-${shape.orig}`} className={`shape ${shape.brush}`} data-orig={shape.orig} cx={start.x} cy={start.y} r={0.46875} fill="none" stroke="#15781b" strokeWidth={0.0625} />;
              const end = shapePoint(shape.dest, orientation);
              return <line key={`arrow-${shape.orig}-${shape.dest}`} className={`shape ${shape.brush}`} data-orig={shape.orig} data-dest={shape.dest} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#15781b" strokeWidth={0.15625} strokeLinecap="round" markerEnd="url(#parity-green-arrowhead)" />;
            })}
          </svg>
          <svg className="cg-custom-svgs" viewBox={`0 0 ${size} ${size}`} aria-label="Move assessment glyphs">
            {glyphs.map((glyph) => {
              const point = squareCoordinates(glyph.square, orientation);
              const offset = squareSize * 0.19;
              const x = point.x * squareSize + squareSize - offset;
              const y = point.y * squareSize + offset;
              return <g key={`${glyph.square}-${glyph.glyph}`} className={`glyph-badge ${glyph.kind}`} data-square={glyph.square}><circle cx={x} cy={y} r={squareSize * 0.145} /><text x={x} y={y}>{glyph.glyph}</text></g>;
            })}
          </svg>
        </cg-board>
      </cg-container>
    </div>
  );
}
