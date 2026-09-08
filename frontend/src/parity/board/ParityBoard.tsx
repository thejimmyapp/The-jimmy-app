import type { CSSProperties } from "react";
import { pieceAriaLabel, pieceAssetId } from "../../boardAppearance";
import { PARITY_LAYOUTS, type ParityLayout } from "../layout";
import { PARITY_BOARD_THEMES, type ParityBoardTheme } from "./themes";
import "./parityBoard.css";

export interface ParityPosition {
  board: string[][];
  white_pocket: string;
  black_pocket: string;
  side_to_move: "White" | "Black";
}

export interface ParityLastMove { from: string | null; to: string }
export interface ParityGlyph { square: string; glyph: "!" | "!!" | "?!" | "!?" | "?" | "??"; kind: "brilliant" | "good" | "inaccuracy" | "interesting" | "mistake" | "blunder" }
export type ParityBrush = "green" | "red" | "blue" | "yellow" | "paleBlue" | "paleGreen" | "paleRed" | "paleGrey";
export interface ParityArrowGeometry { x1: number; y1: number; x2: number; y2: number }
export interface ParityForkArrow { highlight: string; clip: { x: number; y: number; width: number; height: number } }
export interface ParityShape {
  brush: ParityBrush;
  orig: string;
  dest?: string;
  below?: boolean;
  geometry?: ParityArrowGeometry;
  fork?: ParityForkArrow;
}

export interface ParityBoardProps {
  position: ParityPosition;
  orientation: "black" | "white";
  layout?: ParityLayout;
  theme?: ParityBoardTheme;
  lastMove?: ParityLastMove | null;
  check?: string | null;
  glyphs?: ParityGlyph[];
  shapes?: ParityShape[];
  showCoords?: boolean;
}

const PARITY_BRUSHES: Record<ParityBrush, { key: string; color: string; opacity: number; lineWidth: number }> = {
  green: { key: "g", color: "#15781B", opacity: 1, lineWidth: 10 },
  red: { key: "r", color: "#882020", opacity: 1, lineWidth: 10 },
  blue: { key: "b", color: "#003088", opacity: 1, lineWidth: 10 },
  yellow: { key: "y", color: "#e68f00", opacity: 1, lineWidth: 10 },
  paleBlue: { key: "pb", color: "#003088", opacity: 0.4, lineWidth: 15 },
  paleGreen: { key: "pg", color: "#15781B", opacity: 0.4, lineWidth: 15 },
  paleRed: { key: "pr", color: "#882020", opacity: 0.4, lineWidth: 15 },
  paleGrey: { key: "pgr", color: "#4a4a4a", opacity: 0.35, lineWidth: 15 },
};

const pieceNames: Record<string, string> = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" };
const boardSquares = Array.from({ length: 64 }, (_, index) => ({ x: index % 8, y: Math.floor(index / 8) }));
const glyphColors: Record<ParityGlyph["kind"], string> = {
  brilliant: "#168226",
  good: "#22ac38",
  inaccuracy: "#53b2ea",
  interesting: "#f075e1",
  mistake: "#e69d00",
  blunder: "hsl(0 69% 60%)",
};

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

function arrowGeometry(shape: ParityShape, orientation: "black" | "white"): ParityArrowGeometry | null {
  if (shape.geometry) return shape.geometry;
  if (!shape.dest) return null;
  const start = shapePoint(shape.orig, orientation);
  const end = shapePoint(shape.dest, orientation);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}

function ShapeLayer({ shapes, orientation, below }: { shapes: ParityShape[]; orientation: "black" | "white"; below: boolean }) {
  const visibleShapes = shapes.filter((shape) => Boolean(shape.below) === below);
  return (
    <svg className={below ? "cg-shapes cg-shapes-below" : "cg-shapes"} viewBox="-4 -4 8 8" preserveAspectRatio="xMidYMid slice" aria-label={below ? "Board shapes below pieces" : "Board shapes"}>
      <defs>
        <filter id={`parity-filter-blur-${below ? "below" : "above"}`}><feGaussianBlur stdDeviation="0.013" /></filter>
        {Object.entries(PARITY_BRUSHES).map(([name, brush]) => <marker key={name} id={`parity-arrowhead-${name}-${below ? "below" : "above"}`} orient="auto" overflow="visible" markerWidth="4" markerHeight="4" refX="2.05" refY="2"><path d="M0,0 V4 L3,2 Z" fill={brush.color} /></marker>)}
        <marker id="parity-arrowhead-variation" orient="auto" overflow="visible" markerWidth="4" markerHeight="4" refX="2.05" refY="2"><path d="M0,0 V4 L3,2 Z" fill="white" /></marker>
      </defs>
      <g>{visibleShapes.map((shape) => {
        const brush = PARITY_BRUSHES[shape.brush];
        const geometry = arrowGeometry(shape, orientation);
        if (!geometry) {
          const center = shapePoint(shape.orig, orientation);
          return <g key={`circle-${shape.orig}-${shape.brush}`}><circle className={`shape ${shape.brush}`} data-orig={shape.orig} stroke={brush.color} strokeWidth="0.0625" fill="none" opacity={brush.opacity} cx={center.x} cy={center.y} r="0.46875" /></g>;
        }
        if (shape.fork) {
          const markerId = `parity-arrowhead-highlight-${shape.brush}`;
          return <g key={`fork-${shape.orig}-${shape.dest}-${shape.brush}`} data-orig={shape.orig} data-dest={shape.dest} opacity="0.5">
            <defs><marker id={markerId} orient="auto" overflow="visible" markerWidth="4" markerHeight="4" refX="1.86" refY="2"><path d="M0,0 V4 L3,2 Z" fill={shape.fork.highlight} /></marker></defs>
            <g filter="url(#parity-filter-blur-below)">
              <rect x={shape.fork.clip.x} y={shape.fork.clip.y} width={shape.fork.clip.width} height={shape.fork.clip.height} fill="none" stroke="none" />
              <line stroke={shape.fork.highlight} strokeWidth="0.21375" strokeLinecap="round" markerEnd={`url(#${markerId})`} opacity="1" {...geometry} />
            </g>
            <line stroke="white" strokeWidth="0.1875" strokeLinecap="round" markerEnd="url(#parity-arrowhead-variation)" opacity="1" {...geometry} />
          </g>;
        }
        return <g key={`arrow-${shape.orig}-${shape.dest}-${shape.brush}`}><line className={`shape ${shape.brush}`} data-orig={shape.orig} data-dest={shape.dest} stroke={brush.color} strokeWidth={brush.lineWidth / 64} strokeLinecap="round" markerEnd={`url(#parity-arrowhead-${shape.brush}-${below ? "below" : "above"})`} opacity={brush.opacity} {...geometry} /></g>;
      })}</g>
    </svg>
  );
}

function GlyphLayer({ glyphs, orientation }: { glyphs: ParityGlyph[]; orientation: "black" | "white" }) {
  return <svg className="cg-custom-svgs" viewBox="-3.5 -3.5 8 8" preserveAspectRatio="xMidYMid slice" aria-label="Move assessment glyphs"><g>{glyphs.map((glyph, index) => {
    const point = shapePoint(glyph.square, orientation);
    const filterId = `parity-glyph-shadow-${index}`;
    const fontSize = glyph.glyph.length === 1 ? 74 : 60;
    return <g key={`${glyph.square}-${glyph.glyph}`} className={`glyph-badge ${glyph.kind}`} data-square={glyph.square} transform={`translate(${point.x},${point.y})`}>
      <svg width="1" height="1" viewBox="0 0 100 100">
        <defs><filter id={filterId}><feDropShadow dx="4" dy="7" floodOpacity=".5" stdDeviation="5" /></filter></defs>
        <g transform="matrix(.4 0 0 .4 71 -12)">
          <circle cx="50" cy="50" r="50" fill={glyphColors[glyph.kind]} filter={`url(#${filterId})`} />
          <text x="50" y="50" fill="#fff" fontFamily="Noto Sans, sans-serif" fontSize={fontSize} fontWeight="700" textAnchor="middle" dominantBaseline="central">{glyph.glyph}</text>
        </g>
      </svg>
    </g>;
  })}</g></svg>;
}

export function ParityBoard({ position, orientation, layout = PARITY_LAYOUTS.reference, theme = PARITY_BOARD_THEMES.brown, lastMove = null, check = null, glyphs = [], shapes = [], showCoords = true }: ParityBoardProps) {
  const { size, squareSize, ranksWidth, filesHeight } = layout.board;
  const style = {
    "--parity-board-size": `${size}px`,
    "--parity-square-size": `${squareSize}px`,
    "--parity-ranks-width": `${ranksWidth}px`,
    "--parity-files-height": `${filesHeight}px`,
    "--parity-board-image": theme.image,
    "--parity-light-square": theme.light,
    "--parity-dark-square": theme.dark,
    "--parity-coord-on-light": theme.coordOnLight,
    "--parity-coord-on-dark": theme.coordOnDark,
  } as CSSProperties;
  const highlights = [...new Set([lastMove?.from, lastMove?.to].filter((square): square is string => Boolean(square))), ...(check ? [check] : [])];
  const rankLabels = orientation === "black" ? ["1", "2", "3", "4", "5", "6", "7", "8"] : ["8", "7", "6", "5", "4", "3", "2", "1"];
  const fileLabels = orientation === "black" ? ["h", "g", "f", "e", "d", "c", "b", "a"] : ["a", "b", "c", "d", "e", "f", "g", "h"];
  return (
    <div className={`parity-board cg-wrap orientation-${orientation}`} style={style} data-orientation={orientation} data-theme={theme.id}>
      <cg-container>
        <cg-board>
          {boardSquares.map(({ x, y }) => <square key={`board-${x}-${y}`} className={`board-square ${(x + y) % 2 === 0 ? "light" : "dark"}`} style={{ transform: `translate(${x * squareSize}px, ${y * squareSize}px)` }} />)}
          {highlights.map((square) => <square key={square} data-square={square} className={`${lastMove?.from === square || lastMove?.to === square ? "last-move" : ""} ${check === square ? "check" : ""}`.trim()} style={{ transform: squareTransform(square, orientation, squareSize) }} />)}
          {boardPieces(position).map(({ piece, square }) => {
            const asset = pieceAssetId(piece);
            const color = piece === piece.toUpperCase() ? "white" : "black";
            const name = pieceNames[piece.toUpperCase()];
            return <piece key={square} data-square={square} data-piece={asset ?? undefined} className={`${color} ${name}`} role="img" aria-label={`${pieceAriaLabel(piece)} on ${square}`} style={{ transform: squareTransform(square, orientation, squareSize), backgroundImage: asset ? `url("/pieces/cburnett/${asset}.svg")` : undefined }} />;
          })}
          {showCoords && <>
            <coords className={`ranks ${orientation}`}>{rankLabels.map((label, index) => <coord key={label} className={index % 2 === 0 ? "coord-dark" : "coord-light"}>{label}</coord>)}</coords>
            <coords className={`files ${orientation}`}>{fileLabels.map((label, index) => <coord key={label} className={index % 2 === 0 ? "coord-light" : "coord-dark"}>{label}</coord>)}</coords>
          </>}
          <ShapeLayer shapes={shapes} orientation={orientation} below />
          <ShapeLayer shapes={shapes} orientation={orientation} below={false} />
          <GlyphLayer glyphs={glyphs} orientation={orientation} />
        </cg-board>
      </cg-container>
    </div>
  );
}
