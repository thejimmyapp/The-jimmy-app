import type { ReactNode } from "react";
import "./studyEval.css";

export interface StudyEvalProps {
  enabled: boolean;
  analysis?: ReactNode;
  onToggle: () => void;
}

export const STUDY_EVAL_ROW_HEIGHT = 44;

export function StudyEval({ enabled, analysis, onToggle }: StudyEvalProps) {
  return <section className={`study-eval${enabled ? " enabled" : ""}`} aria-label="Computer analysis" data-enabled={enabled} style={{ height: STUDY_EVAL_ROW_HEIGHT }}>
    <span className="study-eval-toggle">
      <button type="button" role="switch" aria-label="Toggle local evaluation" aria-checked={enabled} onClick={onToggle}><span /></button>
    </span>
    <span className="study-eval-pearl" aria-hidden="true" />
    <div className="study-eval-engine">Fairy-Stockfish</div>
    {enabled && analysis && <div className="study-eval-analysis">{analysis}</div>}
  </section>;
}
