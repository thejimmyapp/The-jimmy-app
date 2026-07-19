const squarePoint = (square: string) => ({
  file: "abcdefgh".indexOf(square[0]),
  rank: Number(square[1]) - 1,
});

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
