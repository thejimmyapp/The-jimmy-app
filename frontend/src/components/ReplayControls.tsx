import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import { useEffect, useState } from "react";
import { useReplayMovement } from "./useReplayMovement";

export function ReplayControls() {
  const { globalPly, max, move } = useReplayMovement();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || globalPly >= max) return;
    const timer = window.setTimeout(() => move(globalPly + 1), 650);
    return () => window.clearTimeout(timer);
  }, [globalPly, max, move, playing]);

  return (
    <div className="replay-controls">
      <button onClick={() => move(0)} aria-label="Start"><SkipBack size={17} /></button>
      <button onClick={() => move(globalPly - 1)} aria-label="Previous"><StepBack size={17} /></button>
      <button className="play" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
      <button onClick={() => move(globalPly + 1)} aria-label="Next"><StepForward size={17} /></button>
      <button onClick={() => move(max)} aria-label="End"><SkipForward size={17} /></button>
    </div>
  );
}
