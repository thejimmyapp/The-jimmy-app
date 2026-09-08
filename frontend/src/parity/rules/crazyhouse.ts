import type { ParsedPgn, PgnNode } from "../pgn/parsePgn";

export type Side = "White" | "Black";

export interface CrazyhouseState {
  board: string[][];
  white_pocket: string;
  black_pocket: string;
  side_to_move: Side;
  castlingRights: string;
  enPassant: string | null;
  promoted: Set<string>;
  lastMove: { from: string | null; to: string } | null;
  check: string | null;
}

export interface CrazyhousePosition {
  board: string[][];
  white_pocket: string;
  black_pocket: string;
  side_to_move: Side;
  lastMove: { from: string | null; to: string } | null;
  check: string | null;
}

const files = "abcdefgh";
const pocketOrder = "QRBNP";

function cloneState(state: CrazyhouseState): CrazyhouseState {
  return { ...state, board: state.board.map((row) => [...row]), promoted: new Set(state.promoted), lastMove: state.lastMove ? { ...state.lastMove } : null };
}

function squareCoords(square: string) {
  return { file: files.indexOf(square[0]), row: 8 - Number(square[1]) };
}

function squareAt(file: number, row: number) {
  return `${files[file]}${8 - row}`;
}

function pieceAt(state: CrazyhouseState, square: string) {
  const { file, row } = squareCoords(square);
  return state.board[row]?.[file] ?? "";
}

function setPiece(state: CrazyhouseState, square: string, piece: string) {
  const { file, row } = squareCoords(square);
  state.board[row][file] = piece;
}

function pieceSide(piece: string): Side | null {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? "White" : "Black";
}

function otherSide(side: Side): Side {
  return side === "White" ? "Black" : "White";
}

function canonicalPocket(value: string, side: Side) {
  const upper = value.toUpperCase();
  const ordered = [...upper].sort((first, second) => pocketOrder.indexOf(first) - pocketOrder.indexOf(second)).join("");
  return side === "White" ? ordered : ordered.toLowerCase();
}

function addPocketPiece(state: CrazyhouseState, side: Side, role: string) {
  if (side === "White") state.white_pocket = canonicalPocket(state.white_pocket + role.toUpperCase(), side);
  else state.black_pocket = canonicalPocket(state.black_pocket + role.toLowerCase(), side);
}

function removePocketPiece(state: CrazyhouseState, side: Side, role: string) {
  const key = role.toUpperCase();
  const source = side === "White" ? state.white_pocket : state.black_pocket;
  const index = source.toUpperCase().indexOf(key);
  if (index === -1) throw new Error(`${side} cannot drop ${role}: pocket is ${source}`);
  const next = source.slice(0, index) + source.slice(index + 1);
  if (side === "White") state.white_pocket = canonicalPocket(next, side);
  else state.black_pocket = canonicalPocket(next, side);
}

function expandRank(rank: string) {
  const row: string[] = [];
  for (const entry of rank) {
    if (/\d/.test(entry)) row.push(...Array(Number(entry)).fill(""));
    else row.push(entry);
  }
  if (row.length !== 8) throw new Error(`Invalid FEN rank: ${rank}`);
  return row;
}

export function parseCrazyhouseFen(fen: string): CrazyhouseState {
  const [placement, turn, castling = "-", enPassant = "-"] = fen.trim().split(/\s+/);
  const ranks = placement.split("/");
  let pocket = "";
  if (ranks.length === 9) pocket = ranks.pop() ?? "";
  else {
    const match = ranks[7]?.match(/^(.*)\[([^\]]*)\]$/);
    if (match) { ranks[7] = match[1]; pocket = match[2]; }
  }
  if (ranks.length !== 8) throw new Error(`Invalid Crazyhouse FEN: ${fen}`);
  const state: CrazyhouseState = {
    board: ranks.map(expandRank),
    white_pocket: canonicalPocket([...pocket].filter((piece) => piece === piece.toUpperCase()).join(""), "White"),
    black_pocket: canonicalPocket([...pocket].filter((piece) => piece === piece.toLowerCase()).join(""), "Black"),
    side_to_move: turn === "w" ? "White" : "Black",
    castlingRights: castling === "-" ? "" : castling,
    enPassant: enPassant === "-" ? null : enPassant,
    promoted: new Set(),
    lastMove: null,
    check: null,
  };
  state.check = checkedKing(state, state.side_to_move);
  return state;
}

function pathIsClear(state: CrazyhouseState, from: string, to: string) {
  const start = squareCoords(from);
  const end = squareCoords(to);
  const fileStep = Math.sign(end.file - start.file);
  const rowStep = Math.sign(end.row - start.row);
  let file = start.file + fileStep;
  let row = start.row + rowStep;
  while (file !== end.file || row !== end.row) {
    if (state.board[row][file]) return false;
    file += fileStep;
    row += rowStep;
  }
  return true;
}

function canReach(state: CrazyhouseState, from: string, to: string, role: string, capture: boolean) {
  const start = squareCoords(from);
  const end = squareCoords(to);
  const dx = end.file - start.file;
  const dy = end.row - start.row;
  if (role === "N") return (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
  if (role === "K") return Math.max(Math.abs(dx), Math.abs(dy)) === 1;
  if (role === "B") return Math.abs(dx) === Math.abs(dy) && pathIsClear(state, from, to);
  if (role === "R") return (dx === 0 || dy === 0) && pathIsClear(state, from, to);
  if (role === "Q") return (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && pathIsClear(state, from, to);
  const direction = state.side_to_move === "White" ? -1 : 1;
  if (capture) return Math.abs(dx) === 1 && dy === direction;
  if (dx !== 0 || pieceAt(state, to)) return false;
  if (dy === direction) return true;
  const startRow = state.side_to_move === "White" ? 6 : 1;
  return start.row === startRow && dy === direction * 2 && !state.board[start.row + direction][start.file];
}

function kingSquare(state: CrazyhouseState, side: Side) {
  const king = side === "White" ? "K" : "k";
  for (let row = 0; row < 8; row += 1) for (let file = 0; file < 8; file += 1) if (state.board[row][file] === king) return squareAt(file, row);
  return null;
}

export function isSquareAttacked(state: CrazyhouseState, square: string, bySide: Side) {
  const target = squareCoords(square);
  for (let row = 0; row < 8; row += 1) for (let file = 0; file < 8; file += 1) {
    const piece = state.board[row][file];
    if (!piece || pieceSide(piece) !== bySide) continue;
    const role = piece.toUpperCase();
    const dx = target.file - file;
    const dy = target.row - row;
    if (role === "P") {
      const direction = bySide === "White" ? -1 : 1;
      if (Math.abs(dx) === 1 && dy === direction) return true;
    } else if (role === "N" && ((Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1))) return true;
    else if (role === "K" && Math.max(Math.abs(dx), Math.abs(dy)) === 1) return true;
    else if (role === "B" && Math.abs(dx) === Math.abs(dy) && pathIsClear(state, squareAt(file, row), square)) return true;
    else if (role === "R" && (dx === 0 || dy === 0) && pathIsClear(state, squareAt(file, row), square)) return true;
    else if (role === "Q" && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && pathIsClear(state, squareAt(file, row), square)) return true;
  }
  return false;
}

function checkedKing(state: CrazyhouseState, side: Side) {
  const king = kingSquare(state, side);
  return king && isSquareAttacked(state, king, otherSide(side)) ? king : null;
}

export function kingSquareInCheck(position: Pick<CrazyhousePosition, "board" | "white_pocket" | "black_pocket" | "side_to_move">, side: Side) {
  const state: CrazyhouseState = {
    ...position,
    board: position.board.map((row) => [...row]),
    castlingRights: "",
    enPassant: null,
    promoted: new Set(),
    lastMove: null,
    check: null,
  };
  return checkedKing(state, side);
}

function removeCastlingRight(state: CrazyhouseState, chars: string) {
  for (const char of chars) state.castlingRights = state.castlingRights.replace(char, "");
}

function finishTurn(state: CrazyhouseState, from: string | null, to: string) {
  state.lastMove = { from, to };
  state.side_to_move = otherSide(state.side_to_move);
  state.check = checkedKing(state, state.side_to_move);
  return state;
}

function applyCoordinateMove(state: CrazyhouseState, from: string, to: string, promotion: string | null, capture: boolean) {
  const mover = state.side_to_move;
  const piece = pieceAt(state, from);
  let capturedSquare = to;
  let captured = pieceAt(state, to);
  if (piece.toUpperCase() === "P" && capture && !captured && state.enPassant === to) {
    const target = squareCoords(to);
    capturedSquare = squareAt(target.file, target.row + (mover === "White" ? 1 : -1));
    captured = pieceAt(state, capturedSquare);
  }
  if (captured) {
    addPocketPiece(state, mover, state.promoted.has(capturedSquare) ? "P" : captured.toUpperCase());
    state.promoted.delete(capturedSquare);
    setPiece(state, capturedSquare, "");
  }
  const wasPromoted = state.promoted.delete(from);
  setPiece(state, from, "");
  const placed = promotion ? (mover === "White" ? promotion : promotion.toLowerCase()) : piece;
  setPiece(state, to, placed);
  if (promotion || wasPromoted) state.promoted.add(to);
  state.enPassant = null;
  const start = squareCoords(from);
  const end = squareCoords(to);
  if (piece.toUpperCase() === "P" && Math.abs(end.row - start.row) === 2) state.enPassant = squareAt(start.file, (start.row + end.row) / 2);
  if (piece === "K") removeCastlingRight(state, "KQ");
  if (piece === "k") removeCastlingRight(state, "kq");
  if (from === "a1" || to === "a1") removeCastlingRight(state, "Q");
  if (from === "h1" || to === "h1") removeCastlingRight(state, "K");
  if (from === "a8" || to === "a8") removeCastlingRight(state, "q");
  if (from === "h8" || to === "h8") removeCastlingRight(state, "k");
  return finishTurn(state, from, to);
}

function legalOrigins(state: CrazyhouseState, role: string, to: string, capture: boolean, disambiguation: string) {
  const candidates: string[] = [];
  for (let row = 0; row < 8; row += 1) for (let file = 0; file < 8; file += 1) {
    const piece = state.board[row][file];
    if (!piece || pieceSide(piece) !== state.side_to_move || piece.toUpperCase() !== role) continue;
    const from = squareAt(file, row);
    if (disambiguation && !from.startsWith(disambiguation) && from[1] !== disambiguation) continue;
    if (!canReach(state, from, to, role, capture)) continue;
    const target = pieceAt(state, to);
    if (target && pieceSide(target) === state.side_to_move) continue;
    const probe = cloneState(state);
    applyCoordinateMove(probe, from, to, null, capture);
    if (!checkedKing(probe, state.side_to_move)) candidates.push(from);
  }
  return candidates;
}

export function applySan(source: CrazyhouseState, sanSource: string): CrazyhouseState {
  const state = cloneState(source);
  const mover = state.side_to_move;
  const san = sanSource.replace(/[+#]+$/, "");
  const drop = san.match(/^([PNBRQK])@([a-h][1-8])$/);
  if (drop) {
    const [, role, to] = drop;
    if (pieceAt(state, to)) throw new Error(`Cannot apply ${sanSource}: ${to} is occupied`);
    removePocketPiece(state, mover, role);
    setPiece(state, to, mover === "White" ? role : role.toLowerCase());
    state.enPassant = null;
    return finishTurn(state, null, to);
  }
  if (/^(?:O-O|0-0)(?:-O|-0)?$/.test(san)) {
    const queenSide = san.includes("O-O-O") || san.includes("0-0-0");
    const rank = mover === "White" ? "1" : "8";
    const kingFrom = `e${rank}`;
    const kingTo = `${queenSide ? "c" : "g"}${rank}`;
    const rookFrom = `${queenSide ? "a" : "h"}${rank}`;
    const rookTo = `${queenSide ? "d" : "f"}${rank}`;
    const king = pieceAt(state, kingFrom);
    const rook = pieceAt(state, rookFrom);
    setPiece(state, kingFrom, ""); setPiece(state, rookFrom, ""); setPiece(state, kingTo, king); setPiece(state, rookTo, rook);
    removeCastlingRight(state, mover === "White" ? "KQ" : "kq");
    state.enPassant = null;
    return finishTurn(state, kingFrom, kingTo);
  }
  const match = san.match(/^([KQRBN])?([a-h1-8]{0,2})(x)?([a-h][1-8])(?:=([QRBN]))?$/);
  if (!match) throw new Error(`Unsupported SAN: ${sanSource}`);
  const [, explicitRole, disambiguation, captureMarker, to, promotion] = match;
  const role = explicitRole ?? "P";
  const capture = Boolean(captureMarker);
  const origins = legalOrigins(state, role, to, capture, disambiguation);
  if (origins.length !== 1) throw new Error(`Cannot resolve ${sanSource} for ${mover}: ${origins.join(",") || "no origin"}`);
  return applyCoordinateMove(state, origins[0], to, promotion ?? null, capture);
}

export function publicPosition(state: CrazyhouseState): CrazyhousePosition {
  return { board: state.board.map((row) => [...row]), white_pocket: state.white_pocket, black_pocket: state.black_pocket, side_to_move: state.side_to_move, lastMove: state.lastMove ? { ...state.lastMove } : null, check: state.check };
}

export function buildPositionMap(tree: ParsedPgn, initialFen = tree.headers.FEN): Record<string, CrazyhousePosition> {
  if (!initialFen) throw new Error("Crazyhouse PGN requires a FEN header");
  const positions: Record<string, CrazyhousePosition> = {};
  const rootState = parseCrazyhouseFen(initialFen);
  positions.root = publicPosition(rootState);
  const visit = (node: PgnNode, parent: CrazyhouseState) => {
    const state = applySan(parent, node.san);
    positions[node.id] = publicPosition(state);
    for (const child of node.children) visit(child, state);
  };
  for (const child of tree.root.children) visit(child, rootState);
  return positions;
}

function hasLegalEscape(state: CrazyhouseState) {
  const side = state.side_to_move;
  for (let row = 0; row < 8; row += 1) for (let file = 0; file < 8; file += 1) {
    const piece = state.board[row][file];
    if (!piece || pieceSide(piece) !== side) continue;
    const from = squareAt(file, row);
    for (let targetRow = 0; targetRow < 8; targetRow += 1) for (let targetFile = 0; targetFile < 8; targetFile += 1) {
      const to = squareAt(targetFile, targetRow);
      const target = state.board[targetRow][targetFile];
      if (target && pieceSide(target) === side) continue;
      const capture = Boolean(target) || (piece.toUpperCase() === "P" && state.enPassant === to && targetFile !== file);
      if (!canReach(state, from, to, piece.toUpperCase(), capture)) continue;
      const probe = cloneState(state);
      applyCoordinateMove(probe, from, to, piece.toUpperCase() === "P" && (targetRow === 0 || targetRow === 7) ? "Q" : null, capture);
      if (!checkedKing(probe, side)) return true;
    }
  }
  const pocket = side === "White" ? state.white_pocket : state.black_pocket;
  for (const role of new Set(pocket.toUpperCase())) for (let row = 0; row < 8; row += 1) for (let file = 0; file < 8; file += 1) {
    if (state.board[row][file] || (role === "P" && (row === 0 || row === 7))) continue;
    const probe = cloneState(state);
    const to = squareAt(file, row);
    removePocketPiece(probe, side, role);
    setPiece(probe, to, side === "White" ? role : role.toLowerCase());
    finishTurn(probe, null, to);
    if (!checkedKing(probe, side)) return true;
  }
  return false;
}

export function isCheckmate(state: CrazyhouseState) {
  return Boolean(checkedKing(state, state.side_to_move)) && !hasLegalEscape(state);
}
