import type { ReactNode } from "react";
import "./studyEval.css";

export interface StudyEvalProps {
  enabled: boolean;
  analysis?: ReactNode;
  onToggle: () => void;
}

export function StudyEval({ enabled, analysis, onToggle }: StudyEvalProps) {
  return <section className={`study-eval${enabled ? " enabled" : ""}`} aria-label="Computer analysis" data-enabled={enabled}>
    <span className="study-eval-toggle">
      <button type="button" role="switch" aria-label="Toggle local evaluation" aria-checked={enabled} onClick={onToggle}><span /></button>
    </span>
    <span className="study-eval-pearl" aria-hidden={!enabled}>{enabled ? "J" : ""}</span>
    <div className="study-eval-engine"><span>JIMMY</span><span className="technology">LOCAL</span><small>{enabled ? "analysis ready" : "in local browser"}</small></div>
    <button className="study-eval-settings" type="button" title="Engine settings" aria-label="Engine settings" disabled>⚙</button>
    {enabled && analysis && <div className="study-eval-analysis">{analysis}</div>}
  </section>;
}
