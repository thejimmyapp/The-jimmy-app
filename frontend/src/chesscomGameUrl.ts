const supportedChessComGameUrl = /^https:\/\/www\.chess\.com\/(?:game\/live|live\/game)\/([1-9][0-9]{0,19})\/?(?:\?[^#]*)?$/;
const externalGameId = /^[1-9][0-9]{0,19}$/;

export const chessComGameIdFromUrl = (value: string): string | null => {
  const match = supportedChessComGameUrl.exec(value.trim());
  return match?.[1] ?? null;
};

export const bmachoUrlForGameId = (gameId: string): string | null => {
  if (!externalGameId.test(gameId)) return null;
  return `https://bmacho.github.io/bughouse-viewer/view.html?game_id=${gameId}`;
};

export const bmachoUrlFromChessComUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const gameId = chessComGameIdFromUrl(value);
  return gameId ? bmachoUrlForGameId(gameId) : null;
};
