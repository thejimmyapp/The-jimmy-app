const squarePoint = (square: string) => ({
  file: "abcdefgh".indexOf(square[0]),
  rank: Number(square[1]) - 1,
});

export interface EngineMoveVisual {
  from: string | null;
  to: string;
  dropPiece: "P" | "N" | "B" | "R" | "Q" | null;
}

export const parseEngineBestmove = (bestmove?: string): EngineMoveVisual | null => {
  const move = (bestmove ?? "")
    .trim()
    .replace(/^bestmove\s+/i, "")
    .split(/\s+/)[0]
    ?.replace(/[+#]$/, "");
  if (!move) return null;

  const boardMove = move.match(/^([a-h][1-8])([a-h][1-8])(?:[qrbn])?$/i);
  if (boardMove) {
    return { from: boardMove[1].toLowerCase(), to: boardMove[2].toLowerCase(), dropPiece: null };
  }

  const drop = move.match(/^([pnbrq])@([a-h][1-8])$/i);
  if (drop) {
    return {
      from: null,
      to: drop[2].toLowerCase(),
      dropPiece: drop[1].toUpperCase() as EngineMoveVisual["dropPiece"],
    };
  }

  return null;
};

export const isMeaningfulChessVector = (from: string, to: string) => {
  const start = squarePoint(from);
  const end = squarePoint(to);
  if (start.file < 0 || end.file < 0 || start.rank < 0 || end.rank < 0 || from === to) return false;
  const fileDistance = Math.abs(end.file - start.file);
  const rankDistance = Math.abs(end.rank - start.rank);
  const straight = fileDistance === 0 || rankDistance === 0;
  const diagonal = fileDistance === rankDistance;
  const knight = (fileDistance === 1 && rankDistance === 2) || (fileDistance === 2 && rankDistance === 1);
  return straight || diagonal || knight;
};
