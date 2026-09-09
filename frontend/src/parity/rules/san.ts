import type { ParityPosition } from "../board/ParityBoard";
import { canLegallyReach, isPositionCheckmate, kingSquareInCheck, type Side } from "./crazyhouse";

const files = "abcdefgh";
const coords = (square: string) => ({ file: files.indexOf(square[0]), row: 8 - Number(square[1]) });
const pieceAt = (position: ParityPosition, square: string) => { const { file, row } = coords(square); return position.board[row]?.[file] ?? ""; };
const sideOf = (piece: string): Side | null => !piece ? null : piece === piece.toUpperCase() ? "White" : "Black";

function sameRoleSquares(position: ParityPosition, role: string, side: Side, except: string) {
  const matches: string[] = [];
  for (let row = 0; row < 8; row += 1) for (let file = 0; file < 8; file += 1) {
    const piece = position.board[row][file];
    const square = `${files[file]}${8 - row}`;
    if (square !== except && piece.toUpperCase() === role && sideOf(piece) === side) matches.push(square);
  }
  return matches;
}

function disambiguation(before: ParityPosition, from: string, to: string, role: string, side: Side) {
  if (role === "P" || role === "K") return "";
  const alternatives = sameRoleSquares(before, role, side, from).filter((square) => canLegallyReach(before, square, to, side));
  if (!alternatives.length) return "";
  const sameFile = alternatives.some((square) => square[0] === from[0]);
  const sameRank = alternatives.some((square) => square[1] === from[1]);
  if (!sameFile) return from[0];
  if (!sameRank) return from[1];
  return from;
}

export function sanForTransition(before: ParityPosition, after: ParityPosition, from: string | null, to: string, sideMoved: Side) {
  const placed = pieceAt(after, to);
  if (!placed || sideOf(placed) !== sideMoved) throw new Error(`No ${sideMoved} piece at ${to}`);
  const role = placed.toUpperCase();
  let san: string;
  if (from === null) san = `${role}@${to}`;
  else {
    const moving = pieceAt(before, from);
    if (!moving || sideOf(moving) !== sideMoved) throw new Error(`No ${sideMoved} mover at ${from}`);
    const movingRole = moving.toUpperCase();
    const start = coords(from); const end = coords(to);
    if (movingRole === "K" && Math.abs(end.file - start.file) === 2) san = end.file > start.file ? "O-O" : "O-O-O";
    else {
      const target = pieceAt(before, to);
      const capture = Boolean(target) || (movingRole === "P" && start.file !== end.file);
      const prefix = movingRole === "P" ? (capture ? from[0] : "") : movingRole + disambiguation(before, from, to, movingRole, sideMoved);
      const promoted = movingRole === "P" && role !== "P" ? `=${role}` : "";
      san = `${prefix}${capture ? "x" : ""}${to}${promoted}`;
    }
  }
  if (kingSquareInCheck(after, after.side_to_move)) san += isPositionCheckmate(after) ? "#" : "+";
  return san;
}
