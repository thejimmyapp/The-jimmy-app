export type BoardId = "A" | "B";

export interface ReplayPosition {
  ply: number;
  label: string;
  board: string[][];
  side_to_move: string;
  variant_fen: string;
  white_pocket: string;
  black_pocket: string;
  white_clock: string;
  black_clock: string;
  partner_index: number | null;
  from_square: string | null;
  to_square: string | null;
}

export interface MoveRecord {
  ply: number;
  display_move: string;
  color: string;
  elapsed_seconds: number | null;
}

export interface GameSummary {
  id: number;
  played_at: string;
  result: string;
  opponent: string | null;
  opponent_rating: number | null;
  partner: string | null;
  user_color: string | null;
  time_control: string | null;
}

export interface GamePayload {
  game: GameSummary & Record<string, unknown>;
  players: { board_a_white: string; board_a_black: string; board_b_white: string; board_b_black: string };
  moves_a: MoveRecord[];
  moves_b: MoveRecord[];
  positions_a: ReplayPosition[];
  positions_b: ReplayPosition[];
  timeline: Array<{ global_ply: number; board: BoardId; local_ply: number; move: string; board_a: ReplayPosition; board_b: ReplayPosition }>;
  second_board_available: boolean;
  limitations: string[];
}

export interface Annotation {
  id: string;
  board: BoardId;
  ply: number;
  author: string;
  color: "cyan" | "violet";
  type: "arrow" | "highlight";
  from: string;
  to?: string;
}

export interface ChatItem {
  id: string;
  author: string;
  content: string;
  board?: BoardId;
  ply?: number;
  timestamp: string;
}

export interface ExplorationPair {
  boardA: ReplayPosition;
  boardB: ReplayPosition | null;
}

export interface ExplorationMoveResult {
  legal: boolean;
  reason?: string;
  notation?: string;
  legal_destinations?: string[];
  board_a?: ReplayPosition;
  board_b?: ReplayPosition | null;
  board_a_fen?: string;
  board_b_fen?: string;
  capture_transferred?: boolean;
}
