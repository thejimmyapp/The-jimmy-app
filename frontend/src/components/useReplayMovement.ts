import { useCallback } from "react";
import { sendRoomEvent } from "../socket";
import { useCoachStore } from "../store";

export function useReplayMovement() {
  const { game, globalPly, seek, mode } = useCoachStore();
  const max = Math.max(0, game?.timeline.length ? game.timeline.length - 1 : (game?.positions_a.length ?? 1) - 1);
  const move = useCallback((ply: number) => {
    const next = Math.max(0, Math.min(max, ply));
    seek(next);
    sendRoomEvent("timeline.seek", { global_ply: next });
  }, [max, seek]);
  return { game, globalPly, max, mode, move };
}
