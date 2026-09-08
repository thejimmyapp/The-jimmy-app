import type { CSSProperties } from "react";
import { pieceAriaLabel, pieceAssetId } from "../../boardAppearance";
import { PARITY_LAYOUTS, type ParityLayout } from "../layout";
import "./parityPocket.css";

export interface ParityPocketProps {
  color: "white" | "black";
  pocket: string;
  position: "top" | "bottom";
  usable: boolean;
  orientation: "black" | "white";
  layout?: ParityLayout;
}

const slots = [
  { symbol: "P", name: "pawn" },
  { symbol: "N", name: "knight" },
  { symbol: "B", name: "bishop" },
  { symbol: "R", name: "rook" },
  { symbol: "Q", name: "queen" },
] as const;

export function ParityPocket({ color, pocket, position, usable, orientation, layout = PARITY_LAYOUTS.reference }: ParityPocketProps) {
  const normalized = color === "white" ? pocket.toUpperCase() : pocket.toLowerCase();
  const layoutStyle = {
    "--parity-pocket-width": `${layout.tools.width}px`,
    "--parity-pocket-height": `${layout.tools.pocketHeight}px`,
    "--parity-pocket-slot-size": `${layout.tools.pocketSlotSize}px`,
    "--parity-pocket-badge-width": `${layout.badge.width}px`,
    "--parity-pocket-badge-height": `${layout.badge.height}px`,
    "--parity-pocket-badge-radius": `${layout.badge.radius}px`,
    "--parity-pocket-badge-font-size": `${layout.badge.fontSize}px`,
    "--parity-pocket-badge-line-height": `${layout.badge.lineHeight}px`,
  } as CSSProperties;
  return (
    <div className={`pocket pocket-${position} pos-${orientation} ${usable ? "usable" : ""}`.trim()} data-color={color} aria-label={`${color} pocket`} style={layoutStyle}>
      {slots.map(({ symbol, name }) => {
        const piece = color === "white" ? symbol : symbol.toLowerCase();
        const count = [...normalized].filter((entry) => entry === piece).length;
        const asset = pieceAssetId(piece);
        const style = { backgroundImage: `url("/pieces/cburnett/${asset}.svg")` } as CSSProperties;
        return <piece key={symbol} className={`${name} ${color} ${count === 0 ? "empty" : ""}`.trim()} data-piece={asset ?? undefined} data-nb={count} role="img" aria-label={`${pieceAriaLabel(piece)} × ${count}`} style={style} />;
      })}
    </div>
  );
}
