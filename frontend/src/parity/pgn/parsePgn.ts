import type { ParityBrush, ParityShape } from "../board/ParityBoard";

export type PgnSide = "White" | "Black";
export type PgnGlyphKind = "brilliant" | "good" | "inaccuracy" | "interesting" | "mistake" | "blunder" | "other";

export interface PgnGlyph {
  symbol: string;
  kind: PgnGlyphKind;
  nag?: number;
}

export interface PgnNode {
  id: string;
  parentId: string;
  ply: number;
  moveNumber: number;
  sideToMove: PgnSide;
  san: string;
  glyphs: PgnGlyph[];
  comments: string[];
  shapes: ParityShape[];
  children: PgnNode[];
}

export interface PgnRoot {
  id: "root";
  comments: string[];
  shapes: ParityShape[];
  children: PgnNode[];
}

export interface ParsedPgn {
  headers: Record<string, string>;
  root: PgnRoot;
  result: string;
  nodes: PgnNode[];
}

type Token = { type: "comment" | "left" | "right" | "nag" | "atom"; value: string };

const suffixGlyphs: Record<string, PgnGlyphKind> = {
  "!!": "brilliant",
  "!": "good",
  "?!": "inaccuracy",
  "!?": "interesting",
  "?": "mistake",
  "??": "blunder",
};

const nagGlyphs: Record<number, { symbol: string; kind: PgnGlyphKind }> = {
  1: { symbol: "!", kind: "good" },
  2: { symbol: "?", kind: "mistake" },
  3: { symbol: "!!", kind: "brilliant" },
  4: { symbol: "??", kind: "blunder" },
  5: { symbol: "!?", kind: "interesting" },
  6: { symbol: "?!", kind: "inaccuracy" },
  10: { symbol: "=", kind: "other" },
  11: { symbol: "=", kind: "other" },
  13: { symbol: "∞", kind: "other" },
  14: { symbol: "⩲", kind: "other" },
  15: { symbol: "⩱", kind: "other" },
  16: { symbol: "±", kind: "other" },
  17: { symbol: "∓", kind: "other" },
  18: { symbol: "+−", kind: "other" },
  19: { symbol: "−+", kind: "other" },
  22: { symbol: "⨀", kind: "other" },
  23: { symbol: "⨀", kind: "other" },
  32: { symbol: "↑↑", kind: "other" },
  33: { symbol: "↑↑", kind: "other" },
  36: { symbol: "↑", kind: "other" },
  37: { symbol: "↑", kind: "other" },
  40: { symbol: "→", kind: "other" },
  41: { symbol: "→", kind: "other" },
  132: { symbol: "⇆", kind: "other" },
  133: { symbol: "⇆", kind: "other" },
  138: { symbol: "⊕", kind: "other" },
  139: { symbol: "⊕", kind: "other" },
  140: { symbol: "∆", kind: "other" },
  146: { symbol: "N", kind: "other" },
};

const brushLetters: Record<string, ParityBrush> = { G: "green", R: "red", B: "blue", Y: "yellow" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    if (/\s/.test(input[index])) { index += 1; continue; }
    if (input[index] === "{") {
      const end = input.indexOf("}", index + 1);
      const stop = end === -1 ? input.length : end;
      tokens.push({ type: "comment", value: input.slice(index + 1, stop).trim() });
      index = stop + 1;
      continue;
    }
    if (input[index] === "(") { tokens.push({ type: "left", value: "(" }); index += 1; continue; }
    if (input[index] === ")") { tokens.push({ type: "right", value: ")" }); index += 1; continue; }
    if (input[index] === "$" && /\d/.test(input[index + 1] ?? "")) {
      let end = index + 2;
      while (/\d/.test(input[end] ?? "")) end += 1;
      tokens.push({ type: "nag", value: input.slice(index + 1, end) });
      index = end;
      continue;
    }
    let end = index + 1;
    while (end < input.length && !/[\s{}()]/.test(input[end])) end += 1;
    tokens.push({ type: "atom", value: input.slice(index, end) });
    index = end;
  }
  return tokens;
}

export function extractCommentShapes(source: string): { text: string; shapes: ParityShape[] } {
  const shapes: ParityShape[] = [];
  const text = source.replace(/\[%(csl|cal)\s+([^\]]+)\]/gi, (_match, kind: string, values: string) => {
    for (const value of values.split(",").map((entry) => entry.trim()).filter(Boolean)) {
      const brush = brushLetters[value[0]?.toUpperCase()];
      if (!brush) continue;
      if (kind.toLowerCase() === "csl" && /^[GRBY][a-h][1-8]$/i.test(value)) shapes.push({ brush, orig: value.slice(1).toLowerCase() });
      if (kind.toLowerCase() === "cal" && /^[GRBY][a-h][1-8][a-h][1-8]$/i.test(value)) shapes.push({ brush, orig: value.slice(1, 3).toLowerCase(), dest: value.slice(3, 5).toLowerCase() });
    }
    return " ";
  }).replace(/\s+/g, " ").trim();
  return { text, shapes };
}

function splitSanGlyph(atom: string): { san: string; glyph: PgnGlyph | null } {
  for (const symbol of ["!!", "??", "!?", "?!", "!", "?"]) {
    if (atom.endsWith(symbol)) return { san: atom.slice(0, -symbol.length), glyph: { symbol, kind: suffixGlyphs[symbol] } };
  }
  return { san: atom, glyph: null };
}

function headersAndMoves(source: string) {
  const headers: Record<string, string> = {};
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let firstMoveLine = 0;
  for (; firstMoveLine < lines.length; firstMoveLine += 1) {
    const line = lines[firstMoveLine].trim();
    if (!line) continue;
    const match = line.match(/^\[([^\s]+)\s+"((?:\\.|[^"])*)"\]$/);
    if (!match) break;
    headers[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return { headers, moves: lines.slice(firstMoveLine).join("\n") };
}

export function parsePgn(source: string): ParsedPgn {
  const { headers, moves } = headersAndMoves(source);
  const root: PgnRoot = { id: "root", comments: [], shapes: [], children: [] };
  const nodes: PgnNode[] = [];
  const byId = new Map<string, PgnRoot | PgnNode>([[root.id, root]]);
  const resumeStack: (PgnRoot | PgnNode)[] = [];
  let current: PgnRoot | PgnNode = root;
  let result = headers.Result ?? "*";

  for (const token of tokenize(moves)) {
    if (token.type === "left") {
      resumeStack.push(current);
      current = "parentId" in current && typeof current.parentId === "string" ? byId.get(current.parentId) ?? root : root;
      continue;
    }
    if (token.type === "right") {
      current = resumeStack.pop() ?? root;
      continue;
    }
    if (token.type === "comment") {
      const extracted = extractCommentShapes(token.value);
      if (extracted.text) current.comments.push(extracted.text);
      current.shapes.push(...extracted.shapes);
      continue;
    }
    if (token.type === "nag") {
      if ("parentId" in current) {
        const nag = Number(token.value);
        const mapped = nagGlyphs[nag] ?? { symbol: `$${nag}`, kind: "other" as const };
        current.glyphs.push({ ...mapped, nag });
      }
      continue;
    }
    const atom = token.value;
    if (/^\d+\.(?:\.\.)?$/.test(atom) || /^\d+\.\.\.$/.test(atom)) continue;
    if (["1-0", "0-1", "1/2-1/2", "*"].includes(atom)) { result = atom; continue; }

    const parentPly = "parentId" in current ? current.ply : 0;
    const ply = parentPly + 1;
    const sideToMove: PgnSide = ply % 2 === 1 ? "Black" : "White";
    const moveNumber = Math.floor(ply / 2) + 1;
    const { san, glyph } = splitSanGlyph(atom);
    const id = `n-${String(nodes.length + 1).padStart(3, "0")}`;
    const node: PgnNode = { id, parentId: current.id, ply, moveNumber, sideToMove, san, glyphs: glyph ? [glyph] : [], comments: [], shapes: [], children: [] };
    current.children.push(node);
    nodes.push(node);
    byId.set(id, node);
    current = node;
  }

  return { headers, root, result, nodes };
}

export function findPgnNode(tree: ParsedPgn, predicate: (node: PgnNode) => boolean): PgnNode | undefined {
  return tree.nodes.find(predicate);
}

export function pgnDepth(node: PgnRoot | PgnNode): number {
  return node.children.length ? 1 + Math.max(...node.children.map((child) => pgnDepth(child))) : 0;
}
