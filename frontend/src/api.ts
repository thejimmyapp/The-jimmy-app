import type { BoardId, ExplorationMoveResult, GamePayload, GameSummary, PuzzleMove, PuzzlePayload, PuzzleResponse, RoomPayload } from "./types";

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
  importPgn: (username: string, pgn: string, secondBoardPgn: string) =>
    json<{ created: boolean; source: "manual"; second_board_supplied: boolean }>(
      fetch("/api/games/import-pgn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pgn, second_board_pgn: secondBoardPgn }),
      }),
    ),
  games: (username: string) =>
    json<{ games: GameSummary[] }>(fetch(`/api/chesscom/${encodeURIComponent(username)}/bughouse-games?limit=1000`)),
  game: (gameId: number) => json<GamePayload>(fetch(`/api/games/${gameId}`)),
  createRoom: (gameId?: number) =>
    json<{ id: string; game_id: number | null; share_path: string }>(
      fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId ?? null }),
      }),
    ),
  room: (roomId: string) => json<RoomPayload>(fetch(`/api/rooms/${roomId}`)),
  joinRoom: (roomId: string, displayName: string) =>
    json<{ client_id: string; display_name: string }>(
      fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      }),
    ),
  analyze: (request: { gameId: number; globalPly: number; board: "A" | "B"; variantFen: string; boardAFen?: string; boardBFen?: string }) =>
    json<{ job_id: string; status: string; engine: string }>(
      fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: request.gameId,
          global_ply: request.globalPly,
          board: request.board,
          depth: 10,
          variant_fen: request.variantFen,
          board_a_fen: request.boardAFen,
          board_b_fen: request.boardBFen,
        }),
      }),
    ),
  analysisJob: (jobId: string) =>
    json<{
      status: "queued" | "running" | "completed" | "failed";
      engine?: string;
      queue_position?: number;
      result?: { bestmove?: string; score_cp?: number; mate_in?: number; depth?: number; pv?: string[]; engine_name?: string; variant_supported?: boolean };
      error?: string;
    }>(fetch(`/api/analysis/${jobId}`)),
  explorationMove: (request: {
    board_a_fen: string;
    board_b_fen?: string;
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
  explorationSanMove: (request: { board_a_fen: string; board_b_fen: string; board: BoardId; san: string }) =>
    json<ExplorationMoveResult>(fetch("/api/exploration/san", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })),
  puzzle: (puzzleId: string) => json<PuzzlePayload>(fetch(`/api/puzzles/${encodeURIComponent(puzzleId)}`)),
  puzzleMove: (puzzleId: string, moves: PuzzleMove[]) =>
    json<PuzzleResponse>(fetch(`/puzzle-move/${encodeURIComponent(puzzleId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves }),
    })),
  puzzleNextMove: (puzzleId: string, moves: PuzzleMove[]) =>
    json<PuzzleResponse>(fetch(`/puzzle-next-move/${encodeURIComponent(puzzleId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves }),
    })),
  puzzleSolution: (puzzleId: string, moves: PuzzleMove[]) =>
    json<PuzzleResponse>(fetch(`/puzzle-solution/${encodeURIComponent(puzzleId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves }),
    })),
};
