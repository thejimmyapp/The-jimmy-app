import type { BoardId, ExplorationMoveResult, GamePayload, GameSummary } from "./types";

const json = async <T>(responsePromise: Promise<Response>): Promise<T> => {
  const response = await responsePromise;
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
};

export const api = {
  connectChessCom: (username: string) =>
    json<{ public_profile_connected: boolean; bughouse_games_found: number; new_games_stored: number }>(
      fetch("/api/chesscom/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      }),
    ),
  enrichChessCom: (username: string, curlText: string) =>
    json<{ checked: number; enriched: number; remaining_without_second_board: number; credentials_stored: boolean }>(
      fetch("/api/chesscom/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, curl_text: curlText, limit: 5000 }),
      }),
    ),
  games: (username: string) =>
    json<{ games: GameSummary[] }>(fetch(`/api/chesscom/${encodeURIComponent(username)}/bughouse-games?limit=1000`)),
  game: (gameId: number) => json<GamePayload>(fetch(`/api/games/${gameId}`)),
  createRoom: (gameId?: number) =>
    json<{ id: string; share_path: string }>(
      fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId ?? null }),
      }),
    ),
  joinRoom: (roomId: string, displayName: string) =>
    json<{ client_id: string; display_name: string }>(
      fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      }),
    ),
  analyze: (gameId: number, globalPly: number, board: "A" | "B") =>
    json<{ job_id: string }>(
      fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId, global_ply: globalPly, board, depth: 10 }),
      }),
    ),
  analysisJob: (jobId: string) =>
    json<{ status: string; result?: { bestmove?: string; score_cp?: number; mate_in?: number; depth?: number }; error?: string }>(fetch(`/api/analysis/${jobId}`)),
  explorationMove: (request: {
    board_a_fen: string;
    board_b_fen: string;
    board: BoardId;
    from_square?: string;
    to_square: string;
    drop_piece?: "P" | "N" | "B" | "R" | "Q";
    dry_run?: boolean;
  }) => json<ExplorationMoveResult>(fetch("/api/exploration/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })),
};
