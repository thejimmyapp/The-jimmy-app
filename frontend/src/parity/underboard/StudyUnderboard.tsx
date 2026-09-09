import { useState, type CSSProperties, type ReactNode } from "react";
import type { GamePayload } from "../../types";
import type { ParityLayout } from "../layout";
import "./studyUnderboard.css";

export interface StudyUnderboardProps {
  game: GamePayload;
  layout: ParityLayout;
  savedMomentCount?: number;
  onSaveMoment?: () => void;
  onOpenLibrary?: () => void;
  onInfoVisibilityChange?: (visible: boolean) => void;
  saveMomentDisabled?: boolean;
}

function TabIcon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

const SaveIcon = () => <TabIcon><path d="M6 3.75h9.5L18 6.3v13.95l-6-3.6-6 3.6z" /><path d="M12 7.25v5.5M9.25 10h5.5" /></TabIcon>;
const LibraryIcon = () => <TabIcon><path d="M5 5.25h11.5a2 2 0 0 1 2 2v11.5H7a2 2 0 0 1-2-2z" /><path d="M7 3.25h9.5M8 8.25h7.5M8 11.75h6" /></TabIcon>;
const InfoIcon = () => <TabIcon><circle cx="12" cy="12" r="8.25" /><path d="M12 10.5v6M12 7.5h.01" /></TabIcon>;

function playerLabels(game: GamePayload) {
  const reviewer = game.game.user_color === "black" ? "black" : "white";
  const withRating = (name: string, side: "white" | "black") => side !== reviewer && game.game.opponent_rating != null ? `${name} (${game.game.opponent_rating})` : name;
  return {
    aWhite: withRating(game.players.board_a_white, "white"), aBlack: withRating(game.players.board_a_black, "black"),
    bWhite: game.players.board_b_white, bBlack: game.players.board_b_black,
  };
}

export function StudyUnderboard({ game, layout, savedMomentCount = 0, onSaveMoment = () => undefined, onOpenLibrary = () => undefined, onInfoVisibilityChange = () => undefined, saveMomentDisabled = false }: StudyUnderboardProps) {
  const [showInfo, setShowInfo] = useState(true);
  const measured = layout.underboard;
  if (!measured) return null;
  const players = playerLabels(game);
  const rows = [
    ["Variant", "Bughouse"], ["Board A White", players.aWhite], ["Board A Black", players.aBlack],
    ["Board B White", players.bWhite], ["Board B Black", players.bBlack],
    ["Result", String(game.game.result ?? "Unknown")], ["TimeControl", String(game.game.time_control ?? "Unknown")],
    ["Date", String(game.game.played_at ?? "Unknown")],
    ["Termination", [game.outcome.summary, game.outcome.detail].filter(Boolean).join(" · ") || "Unknown"],
  ];
  const style = {
    left: layout.board.x, top: measured.y, width: layout.board.size,
    "--study-underboard-buttons-height": `${measured.buttonsHeight}px`, "--study-underboard-font-size": `${measured.fontSize}px`,
    "--study-underboard-button-font-size": `${measured.buttonFontSize}px`, "--study-underboard-heading-height": `${measured.headingHeight}px`,
    "--study-underboard-heading-font-size": `${measured.headingFontSize}px`, "--study-underboard-heading-padding": `${measured.headingPadding}px`,
    "--study-underboard-row-height": `${measured.rowHeight}px`,
  } as CSSProperties;
  return <section className="study-underboard" style={style} aria-label="Study actions and match information">
    <div className="study-underboard-buttons">
      <div className="study-underboard-buttons-left">
        <button type="button" aria-label="Save moment" aria-disabled={saveMomentDisabled} title="Save moment" onClick={onSaveMoment} disabled={saveMomentDisabled}><SaveIcon /></button>
        <button type="button" aria-label="Library" title="Library" onClick={onOpenLibrary}><LibraryIcon /><span className="study-underboard-count">{savedMomentCount}</span></button>
        <button type="button" className={showInfo ? "active" : undefined} aria-label="Match info" title="Match info" aria-expanded={showInfo} onClick={() => {
          const next = !showInfo;
          setShowInfo(next);
          onInfoVisibilityChange(next);
        }}><InfoIcon /></button>
      </div>
      <div className="study-underboard-buttons-right" aria-hidden="true" />
    </div>
    {showInfo && <div className="study-underboard-metadata">
      <h2>Bughouse · {players.aWhite} vs {players.aBlack}</h2>
      <table><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>
    </div>}
  </section>;
}
