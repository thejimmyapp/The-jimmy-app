import type { GamePayload, ReplayPosition } from "./types";

export function replayNotices(
  game: GamePayload | null,
  boardA: ReplayPosition | null,
  boardB: ReplayPosition | null,
): string[] {
  if (!game) return [];
  const notices = [...game.limitations];
  const warnings = new Map<string, string[]>();
  for (const [board, position] of [["A", boardA], ["B", boardB]] as const) {
    const warning = position?.warning?.trim();
    if (!warning || notices.includes(warning)) continue;
    warnings.set(warning, [...(warnings.get(warning) ?? []), board]);
  }
  for (const [warning, boards] of warnings) {
    const scope = boards.length === 2 ? "Both boards at this move" : `Board ${boards[0]} at this move`;
    notices.push(`${scope}: ${warning}`);
  }
  return [...new Set(notices.filter(Boolean))];
}
