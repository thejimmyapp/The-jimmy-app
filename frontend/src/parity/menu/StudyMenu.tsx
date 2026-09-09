import type { ParityBoardThemeId } from "../board/themes";
import "./studyMenu.css";

export interface StudyMenuProps {
  theme: ParityBoardThemeId;
  onFlip: () => void;
  onThemeChange: (theme: ParityBoardThemeId) => void;
  onClassicView: () => void;
}

export function StudyMenu({ theme, onFlip, onThemeChange, onClassicView }: StudyMenuProps) {
  return <div className="study-action-menu" role="region" aria-label="Study menu">
    <div className="study-action-menu-title">Analysis board</div>
    <div className="study-action-menu-inner">
      <button type="button" onClick={onFlip}><span className="study-menu-icon" aria-hidden="true">↕</span><span>Flip board</span></button>
      <div className="study-menu-theme-row">
        <span><span className="study-menu-icon" aria-hidden="true">◐</span>Board theme</span>
        <span className="study-menu-theme-switch" role="group" aria-label="Board theme">
          {(["brown", "wood"] as const).map((choice) => <button key={choice} type="button" aria-pressed={theme === choice} onClick={() => onThemeChange(choice)}>{choice === "brown" ? "Brown" : "Wood"}</button>)}
        </span>
      </div>
      <button type="button" onClick={onClassicView}><span className="study-menu-icon" aria-hidden="true">↩</span><span>Classic view</span></button>
    </div>
  </div>;
}
