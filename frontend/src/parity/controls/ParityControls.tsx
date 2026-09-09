import type { ParityNavigationAction } from "../tree/treeNavigation";
import "./parityControls.css";

export interface ParityControlsProps {
  onNavigate: (action: ParityNavigationAction) => void;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
}

function Icon({ action }: { action: ParityNavigationAction }) {
  const previous = action === "first" || action === "prev";
  const outer = action === "first" || action === "last";
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={outer ? "outer" : "inner"}>
    {outer && <path d={previous ? "M5 4v16" : "M19 4v16"} />}
    <path d={previous ? "m16 5-7 7 7 7" : "m8 5 7 7-7 7"} />
    {outer && <path d={previous ? "m12 5-7 7 7 7" : "m12 5 7 7-7 7"} />}
  </svg>;
}

export function ParityControls({ onNavigate, menuOpen = false, onMenuToggle }: ParityControlsProps) {
  const labels: Record<ParityNavigationAction, string> = { first: "First move", prev: "Previous move", next: "Next move", last: "Last move" };
  const actions = Object.keys(labels) as ParityNavigationAction[];
  return <div className="analyse__controls parity-control-row">
    <button className="fbt placeholder practice" type="button" aria-hidden="true" tabIndex={-1} disabled />
    <div className="parity-move-controls">
      {actions.map((action) => <button key={action} className="fbt move" type="button" data-act={action} title={labels[action]} aria-label={labels[action]} onClick={() => onNavigate(action)}><Icon action={action} /></button>)}
    </div>
    <button className={`fbt placeholder menu${menuOpen ? " active" : ""}`} type="button" title="Menu" aria-label="Menu" aria-expanded={menuOpen} onClick={onMenuToggle}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14" /></svg></button>
  </div>;
}
