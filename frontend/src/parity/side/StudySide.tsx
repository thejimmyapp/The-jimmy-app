import type { ReactNode } from "react";
import "./studySide.css";

export function StudySide({ children }: { children: ReactNode }) {
  return <aside className="study-side" aria-label="Study collaboration">
    <div className="study-side-header"><span>Collaborate</span><span className="study-side-toggle" aria-hidden="true"><i /></span></div>
    <div className="study-side-body header-actions">{children}</div>
  </aside>;
}
