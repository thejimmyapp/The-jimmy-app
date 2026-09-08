import type { ReplayPosition } from "../../types";
import type { ParityLastMove, ParityPosition } from "../board/ParityBoard";
import { kingSquareInCheck, type Side } from "../rules/crazyhouse";

export interface ReplayParityPosition {
  position: ParityPosition;
  lastMove: ParityLastMove | null;
  check: string | null;
}

export function replayToParity(source: ReplayPosition): ReplayParityPosition {
  const position: ParityPosition = {
    board: source.board.map((row) => [...row]),
    white_pocket: source.white_pocket === "-" ? "" : source.white_pocket,
    black_pocket: source.black_pocket === "-" ? "" : source.black_pocket,
    side_to_move: source.side_to_move === "Black" ? "Black" : "White",
  };
  return {
    position,
    lastMove: source.to_square ? { from: source.from_square, to: source.to_square } : null,
    check: kingSquareInCheck(position, position.side_to_move as Side),
  };
}
