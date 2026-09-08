export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
  coordOnLight: string;
  coordOnDark: string;
  lastMove: string;
  selectedSource: string;
  legalTarget: string;
  annotated: string;
  texture?: string;
}

const sharedOverlays = {
  lastMove: "#ffd24d66",
  selectedSource: "#24d6e8",
  legalTarget: "#24d6e899",
  annotated: "#24d6e8aa",
} as const;

export const BOARD_THEMES = [
  { id: "wood-classic", name: "Wood Classic", light: "#f0d9b5", dark: "#b58863", coordOnLight: "#6b4c2f", coordOnDark: "#f8ead8", texture: "/boards/wood-classic.svg", ...sharedOverlays },
  { id: "slate", name: "Slate", light: "#c8d2d8", dark: "#58717e", coordOnLight: "#17202b99", coordOnDark: "#17202b99", ...sharedOverlays },
  { id: "classic", name: "Classic", light: "#edd8b4", dark: "#b98b64", coordOnLight: "#5e3e2399", coordOnDark: "#5e3e2399", ...sharedOverlays },
  { id: "wood", name: "Wood", light: "#e6c690", dark: "#9b683d", coordOnLight: "#3d281699", coordOnDark: "#3d281699", ...sharedOverlays },
  { id: "green", name: "Green", light: "#eee4c9", dark: "#739352", coordOnLight: "#26351599", coordOnDark: "#26351599", ...sharedOverlays },
  { id: "blue", name: "Blue", light: "#d8e3ea", dark: "#6d92a4", coordOnLight: "#17283899", coordOnDark: "#17283899", ...sharedOverlays },
  { id: "violet", name: "Violet", light: "#ded6ea", dark: "#7c6798", coordOnLight: "#23193799", coordOnDark: "#23193799", ...sharedOverlays },
  { id: "mono", name: "Mono", light: "#dedede", dark: "#7b7b7b", coordOnLight: "#16161699", coordOnDark: "#16161699", ...sharedOverlays },
] as const satisfies readonly BoardTheme[];

export type BoardThemeId = (typeof BOARD_THEMES)[number]["id"];
export const DEFAULT_BOARD_THEME: BoardThemeId = "wood-classic";

export const PIECE_ASSET_FILES = ["wK.svg", "wQ.svg", "wR.svg", "wB.svg", "wN.svg", "wP.svg", "bK.svg", "bQ.svg", "bR.svg", "bB.svg", "bN.svg", "bP.svg"] as const;
export type PieceAssetFile = (typeof PIECE_ASSET_FILES)[number];
export type PieceAssetId = PieceAssetFile extends `${infer Id}.svg` ? Id : never;

interface PieceSetAttribution {
  author: string;
  license: string;
  source: string;
}

interface PieceSetBase {
  id: string;
  name: string;
  kind: "svg" | "glyph";
  dir?: string;
  files: readonly PieceAssetFile[];
  glyphs?: Readonly<Record<string, string>>;
  attribution: PieceSetAttribution;
}

const glyphPieces: Readonly<Record<string, string>> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const filledGlyphPieces: Readonly<Record<string, string>> = {
  K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

export const PIECE_SETS = [
  {
    id: "cburnett",
    name: "Cburnett",
    kind: "svg",
    dir: "/pieces/cburnett/",
    files: PIECE_ASSET_FILES,
    attribution: {
      author: "Colin M.L. Burnett (Cburnett)",
      license: "BSD-3-Clause",
      source: "https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces/Standard_transparent",
    },
  },
  { id: "classic", name: "Classic", kind: "glyph", files: [], glyphs: glyphPieces, attribution: { author: "Unicode Consortium", license: "Unicode character shapes", source: "https://www.unicode.org/charts/PDF/U2600.pdf" } },
  { id: "solid", name: "Filled", kind: "glyph", files: [], glyphs: filledGlyphPieces, attribution: { author: "Unicode Consortium", license: "Unicode character shapes", source: "https://www.unicode.org/charts/PDF/U2600.pdf" } },
  { id: "bold", name: "Bold", kind: "glyph", files: [], glyphs: glyphPieces, attribution: { author: "Unicode Consortium", license: "Unicode character shapes", source: "https://www.unicode.org/charts/PDF/U2600.pdf" } },
  { id: "soft", name: "Soft", kind: "glyph", files: [], glyphs: glyphPieces, attribution: { author: "Unicode Consortium", license: "Unicode character shapes", source: "https://www.unicode.org/charts/PDF/U2600.pdf" } },
] as const satisfies readonly PieceSetBase[];

export type PieceSet = PieceSetBase;
export type PieceSetId = (typeof PIECE_SETS)[number]["id"];
export const DEFAULT_PIECE_SET: PieceSetId = "cburnett";

export function resolveBoardTheme(id: string | null | undefined): BoardTheme {
  return BOARD_THEMES.find((theme) => theme.id === id) ?? BOARD_THEMES[0];
}

export function resolvePieceSet(id: string | null | undefined): PieceSet {
  return PIECE_SETS.find((pieceSet) => pieceSet.id === id) ?? PIECE_SETS[0];
}

export function boardThemeVariables(id: string | null | undefined) {
  const theme = resolveBoardTheme(id);
  return {
    "--board-light": theme.light,
    "--board-dark": theme.dark,
    "--board-texture": theme.texture ? `url("${theme.texture}")` : "none",
    "--coord-on-light": theme.coordOnLight,
    "--coord-on-dark": theme.coordOnDark,
    "--overlay-last-move": theme.lastMove,
    "--overlay-selected": theme.selectedSource,
    "--overlay-legal": theme.legalTarget,
    "--overlay-annotated": theme.annotated,
  };
}

const pieceNames = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" } as const;

export function pieceAssetId(piece: string): PieceAssetId | null {
  const name = pieceNames[piece.toUpperCase() as keyof typeof pieceNames];
  if (!name) return null;
  return `${piece === piece.toUpperCase() ? "w" : "b"}${piece.toUpperCase()}` as PieceAssetId;
}

export function pieceAriaLabel(piece: string): string {
  const name = pieceNames[piece.toUpperCase() as keyof typeof pieceNames];
  return `${piece === piece.toUpperCase() ? "white" : "black"} ${name}`;
}

export function displayPiece(piece: string, pieceSetId: string): string {
  return resolvePieceSet(pieceSetId).glyphs?.[piece] ?? "";
}
