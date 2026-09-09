import type { ReactNode } from "react";
import "./studySide.css";

export function StudySide({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return <aside className="study-side" aria-label="Study collaboration">
    {actions && <div className="study-side-actions header-actions">{actions}</div>}
    <div className="study-side-panel">{children}</div>
  </aside>;
}
