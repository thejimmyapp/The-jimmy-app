import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";

export function AnalysisLimitations({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`analysis-limitations ${compact ? "compact" : ""}`} aria-label="Analysis limitations">
      <div className="analysis-limitations-title"><ShieldAlert size={16} /><strong>Know what the analysis can and cannot see</strong></div>
      <p>Fairy-Stockfish evaluates the selected board. Without complete partner-board data, it cannot fully account for transfers, piece requests, timing, and danger on the other board.</p>
      <p>Chess.com does not always provide the partner board or exact cross-board timing. Pocket (“dropper”) counts may therefore be incomplete or reconstructed approximately.</p>
      <p>Saved learning moments can still be useful prompts for review, but they are not guarantees of the best Bughouse decision.</p>
    </section>
  );
}

export function AnalysisAcknowledgement({ open, onContinue, onClose }: { open: boolean; onContinue: () => void; onClose: () => void }) {
  const [singleBoard, setSingleBoard] = useState(false);
  const [missingData, setMissingData] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSingleBoard(false);
    setMissingData(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop acknowledgement-backdrop" role="presentation">
      <section className="acknowledgement-modal" role="dialog" aria-modal="true" aria-labelledby="analysis-ack-heading">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close analysis notice"><X /></button>
        <AnalysisLimitations />
        <h1 id="analysis-ack-heading" className="sr-only">Analysis acknowledgement</h1>
        <div className="acknowledgement-checks">
          <label><input type="checkbox" checked={singleBoard} onChange={(event) => setSingleBoard(event.target.checked)} />I understand that a single-board engine suggestion may miss partner-board dynamics.</label>
          <label><input type="checkbox" checked={missingData} onChange={(event) => setMissingData(event.target.checked)} />I understand that missing Chess.com data can make pocket/dropper counts incomplete or approximate.</label>
        </div>
        <div className="acknowledgement-actions">
          <button type="button" onClick={onClose}>Not now</button>
          <button type="button" className="primary" disabled={!singleBoard || !missingData} onClick={onContinue}>Continue to analysis</button>
        </div>
      </section>
    </div>
  );
}
