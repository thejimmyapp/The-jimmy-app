import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { sendRoomEvent } from "../socket";
import { useCoachStore } from "../store";

export function Timeline() {
  const { game, globalPly, seek, mode } = useCoachStore();
  const [playing, setPlaying] = useState(false);
  const max = Math.max(0, game?.timeline.length ? game.timeline.length - 1 : (game?.positions_a.length ?? 1) - 1);
  useEffect(() => {
    if (!playing || globalPly >= max) return;
    const timer = window.setTimeout(() => {
      const next = globalPly + 1;
      seek(next);
      sendRoomEvent("timeline.seek", { global_ply: next });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [playing, globalPly, max, seek]);
  const move = useCallback((ply: number) => { const next = Math.max(0, Math.min(max, ply)); seek(next); sendRoomEvent("timeline.seek", { global_ply: next }); }, [max, seek]);
  useEffect(() => {
    const handleArrowNavigation = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
      if (!game || mode !== "review" || isTyping) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(globalPly - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(globalPly + 1);
      }
    };
    window.addEventListener("keydown", handleArrowNavigation);
    return () => window.removeEventListener("keydown", handleArrowNavigation);
  }, [game, globalPly, mode, move]);
  return (
    <footer className="timeline">
      <div className="timeline-actions">
        <button onClick={() => move(0)} aria-label="Start"><SkipBack size={17} /></button>
        <button onClick={() => move(globalPly - 1)} aria-label="Previous"><StepBack size={17} /></button>
        <button className="play" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button onClick={() => move(globalPly + 1)} aria-label="Next"><StepForward size={17} /></button>
        <button onClick={() => move(max)} aria-label="End"><SkipForward size={17} /></button>
      </div>
      <div className="timeline-tracks">
        <div className="track-label">A</div><div className="move-track">{game?.timeline.filter((item) => item.board === "A").map((item) => <button className={item.global_ply === globalPly ? "active" : ""} key={item.global_ply} onClick={() => move(item.global_ply)}>{item.move}</button>)}</div>
        <div className="track-label">B</div><div className="move-track">{game?.timeline.filter((item) => item.board === "B").map((item) => <button className={item.global_ply === globalPly ? "active" : ""} key={item.global_ply} onClick={() => move(item.global_ply)}>{item.move}</button>)}</div>
      </div>
      <div className="timeline-position"><strong>{mode === "review" ? "GAME" : "VAR"}</strong><span>{globalPly}/{max}</span></div>
    </footer>
  );
}
