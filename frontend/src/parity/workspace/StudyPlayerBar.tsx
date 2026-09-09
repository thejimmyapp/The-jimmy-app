import type { CSSProperties } from "react";
import "./studyPlayerBar.css";

export interface StudyPlayerBarProps {
  position: "top" | "bot";
  name: string;
  rating?: number | null;
  clock: string;
}

export function StudyPlayerBar({ position, name, rating, clock }: StudyPlayerBarProps) {
  const style = {
    display: "flex", height: "22.390625px", alignItems: "center", justifyContent: "space-between", padding: 0,
    backgroundColor: "transparent", backgroundImage: "linear-gradient(rgb(60, 57, 52), rgb(51, 49, 46))",
    color: "rgb(186, 186, 186)", font: '700 14px "Noto Sans", sans-serif',
    borderRadius: position === "top" ? "7px 7px 0 0" : "0 0 7px 7px",
  } satisfies CSSProperties;
  return <div className={`study__player study__player-${position}`} style={style}>
    <div className="left"><span className="info">{name}{rating == null ? "" : ` ${rating}`}</span></div>
    <div className="material" data-jimmy-departure="clock"><time>{clock}</time></div>
  </div>;
}
