import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BookOpen, BrainCircuit, Gamepad2, LockKeyhole, RotateCcw, ShieldAlert, X } from "lucide-react";
import type { GuestProgress, MapNodeId } from "../guestProgress";
import { qualifyingGameCount } from "../guestProgress";
import { LegalLinks } from "./LegalLinks";
import { AnalysisLimitations } from "./AnalysisAcknowledgement";

type MapDialog = "analyze" | "library" | "partner" | "limits" | "reset" | null;

interface Props {
  progress: GuestProgress;
  onNodeChange: (node: MapNodeId) => void;
  onReset: () => void;
  onImportBothBoards: () => void;
  onAdvancedRecovery: () => void;
  reviewForm: ReactNode;
}

const nodeOrder: MapNodeId[] = ["start", "analyze", "library", "partner"];
const nodeLabel: Record<MapNodeId, string> = {
  start: "Start",
  analyze: "Analyze a game",
  library: "Learning library",
  partner: "Partner board instructions",
};

export function OnboardingMap({ progress, onNodeChange, onReset, onImportBothBoards, onAdvancedRecovery, reviewForm }: Props) {
  const [dialog, setDialog] = useState<MapDialog>(null);
  const [movementStatus, setMovementStatus] = useState("Use Arrow keys or WASD to follow the route. Enter or Space opens a stop.");
  const mapRef = useRef<HTMLElement>(null);
  const gameCount = qualifyingGameCount(progress.savedLessons);
  const unlocked = useCallback((node: MapNodeId) => node === "start" || node === "analyze" || (node === "library" && progress.firstGameOpened) || (node === "partner" && gameCount >= 3), [gameCount, progress.firstGameOpened]);

  useEffect(() => {
    if (!unlocked(progress.mapNode)) onNodeChange(progress.firstGameOpened ? "library" : "analyze");
  }, [progress.firstGameOpened, progress.mapNode, onNodeChange, unlocked]);

  useEffect(() => {
    if (!progress.firstGameOpened && progress.mapNode === "start" && progress.savedLessons.length === 0) {
      setMovementStatus("Use Arrow keys or WASD to follow the route. Enter or Space opens a stop.");
    }
  }, [progress.firstGameOpened, progress.mapNode, progress.savedLessons.length]);

  const closeDialog = () => {
    setDialog(null);
    window.setTimeout(() => mapRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  });

  const activate = (node = progress.mapNode) => {
    if (!unlocked(node)) {
      setMovementStatus(node === "partner" ? `${gameCount}/3 distinct qualifying games saved.` : "Open one exact game to unlock this stop.");
      return;
    }
    onNodeChange(node);
    if (node === "analyze" || node === "library" || node === "partner") setDialog(node);
  };

  const move = (direction: "previous" | "next") => {
    const currentIndex = nodeOrder.indexOf(progress.mapNode);
    const target = nodeOrder[currentIndex + (direction === "next" ? 1 : -1)];
    if (!target) {
      setMovementStatus("The route ends here.");
      return;
    }
    if (!unlocked(target)) {
      setMovementStatus(target === "partner" ? `Route locked · ${gameCount}/3 distinct games saved.` : "Route locked · analyze one exact game first.");
      return;
    }
    onNodeChange(target);
    setMovementStatus(`${nodeLabel[target]} reached. Press Enter or Space to open it.`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target !== event.currentTarget) return;
    if (["ArrowLeft", "ArrowDown", "a", "A", "s", "S"].includes(event.key)) {
      event.preventDefault();
      move("next");
    } else if (["ArrowRight", "ArrowUp", "d", "D", "w", "W"].includes(event.key)) {
      event.preventDefault();
      move("previous");
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  };

  return (
    <section className="onboarding-map-shell" aria-label="Jimmy App onboarding map">
      <div className="map-topline"><span>GUEST ROUTE · LOCAL PROGRESS</span><button type="button" onClick={() => setDialog("limits")}><ShieldAlert size={13} /> Analysis limits</button></div>
      <section
        className="overworld-map"
        ref={mapRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={`Onboarding route. Current stop: ${nodeLabel[progress.mapNode]}.`}
        aria-describedby="map-keyboard-status"
      >
        <svg className="map-art" viewBox="0 0 1200 660" role="img" aria-label="A bounded slate island with a route winding from the right branch to an elevated Jimmy App lookout">
          <defs>
            <pattern id="map-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#d9e7eb" strokeOpacity=".045" strokeWidth="2" /></pattern>
            <filter id="map-shadow"><feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#03070d" floodOpacity=".65" /></filter>
          </defs>
          <path className="map-water-ring" d="M85 146 186 54 436 38 542 83 815 52 1091 149 1140 339 1049 558 784 621 480 597 214 632 69 520 34 303Z" />
          <path className="map-island-edge" filter="url(#map-shadow)" d="M111 160 205 80 425 66 528 111 800 79 1063 168 1108 337 1025 529 773 588 478 565 226 601 99 503 68 310Z" />
          <path className="map-island" d="M111 147 205 67 425 53 528 98 800 66 1063 155 1108 324 1025 516 773 575 478 552 226 588 99 490 68 297Z" />
          <path className="map-grid" d="M111 147 205 67 425 53 528 98 800 66 1063 155 1108 324 1025 516 773 575 478 552 226 588 99 490 68 297Z" fill="url(#map-grid)" />
          <path className="map-shelf" d="M122 139 207 78 395 67 443 108 398 194 216 214 139 188Z" />
          <path className="map-lowerland" d="M161 370 351 297 558 325 706 290 1028 344 982 510 768 557 484 528 235 564 113 475Z" />
          <path className={`route-segment active`} d="M983 260 C920 266 887 284 831 315" />
          <path className={`route-segment ${progress.firstGameOpened ? "active" : "locked"}`} d="M831 315 C746 355 683 431 572 456" />
          <path className={`route-segment ${gameCount >= 3 ? "active" : "locked"}`} d="M572 456 C442 472 354 405 306 327" />
          <path className="route-climb locked" d="M306 327 C276 262 280 223 292 188" />
          <g className="map-bridge" aria-hidden="true"><path d="M349 352 391 395" /><path d="m355 343 47 48m-33-60 46 48m-31-60 45 46" /></g>
          <g className="analysis-landmark" aria-hidden="true"><rect x="773" y="234" width="63" height="50" rx="6" /><path d="m785 270 13-14 10 7 16-18" /><circle cx="798" cy="256" r="3" /><circle cx="808" cy="263" r="3" /><circle cx="824" cy="245" r="3" /></g>
          <g className="library-landmark" aria-hidden="true"><path d="M526 400h72v52h-72z" /><path d="M538 388h48v64h-48z" /><path d="M546 402h32m-32 11h32m-32 11h24" /></g>
          <g className="partner-landmark" aria-hidden="true"><rect x="246" y="267" width="54" height="54" rx="5" /><rect x="300" y="289" width="54" height="54" rx="5" /><path d="M246 294h54m-27-27v54m27-5h54m-27-27v54" /></g>
        </svg>

        <div className="map-logo-landmark" aria-label="The Jimmy App lookout"><span className="brand-mark">J</span><span><strong>THE JIMMY APP</strong><small>BUGHOUSE REVIEW LOOKOUT</small></span></div>

        {nodeOrder.map((node) => {
          const isUnlocked = unlocked(node);
          return <button key={node} type="button" className={`map-node map-node-${node} ${progress.mapNode === node ? "current" : ""} ${isUnlocked ? "unlocked" : "locked"}`} disabled={!isUnlocked} aria-label={node === "partner" && !isUnlocked ? `Partner board instructions locked, ${gameCount} of 3 games` : nodeLabel[node]} onClick={() => activate(node)}><span>{isUnlocked ? node === "start" ? "S" : node === "analyze" ? "1" : node === "library" ? "2" : "3" : <LockKeyhole size={15} />}</span></button>;
        })}

        <div className={`guest-avatar guest-at-${progress.mapNode}`} aria-hidden="true"><i className="guest-head" /><i className="guest-body" /><i className="guest-scarf" /></div>

        <div className={`map-callout callout-${progress.mapNode}`}>
          <span>{progress.mapNode === "start" ? "GUEST SPAWN" : progress.mapNode === "partner" && gameCount < 3 ? "LOCKED ROUTE" : "CURRENT STOP"}</span>
          <strong>{nodeLabel[progress.mapNode]}</strong>
          {progress.mapNode === "partner" && <small>Save critical mistakes from 3 separate games to unlock partner-board instructions · {gameCount}/3 games</small>}
        </div>

        <div className="map-legend" id="map-keyboard-status" role="status"><Gamepad2 size={15} /><span>{movementStatus}</span></div>
        <div className="map-semantic-fallback" aria-label="Onboarding destinations">
          {nodeOrder.slice(1).map((node) => <button type="button" key={node} disabled={!unlocked(node)} onClick={() => activate(node)}>{node === "partner" && !unlocked(node) ? `Partner board instructions · ${gameCount}/3 games` : nodeLabel[node]}</button>)}
        </div>
      </section>
      <footer className="map-footer"><span>Progress and saved moments stay in this browser.</span><LegalLinks /><button type="button" onClick={() => setDialog("reset")}><RotateCcw size={12} /> Clear guest progress</button></footer>

      {dialog && <div className="modal-backdrop map-modal-backdrop" role="presentation">
        <section className={`map-dialog map-dialog-${dialog}`} role="dialog" aria-modal="true" aria-label={dialog === "analyze" ? "Analyze a game" : dialog === "library" ? "Learning library" : dialog === "partner" ? "Partner board instructions" : dialog === "limits" ? "Analysis limitations" : "Clear guest progress"}>
          <button type="button" className="modal-close" onClick={closeDialog} aria-label="Close"><X /></button>
          {dialog === "analyze" && reviewForm}
          {dialog === "library" && <><span className="modal-kicker"><BookOpen size={14} /> LEARNING LIBRARY</span><h1>Keep the moments worth replaying.</h1><p>Open a completed game, find the evidence-backed lesson in Review → Info, and choose <strong>Save to Library</strong>. Medium- or high-confidence mistakes and blunders with a legal suggested move count toward the partner-board tutorial.</p><div className="unlock-progress"><span style={{ width: `${Math.min(3, gameCount) / 3 * 100}%` }} /><strong>{gameCount}/3 games</strong></div></>}
          {dialog === "partner" && <><span className="modal-kicker"><BrainCircuit size={14} /> PARTNER BOARD RECOVERY</span><h1>Restore the complete two-board story.</h1><p>For completed games, import paired Board A and Board B PGNs. When you have access to your own Chess.com browser session, advanced one-time pgn-info enrichment can recover missing partner-board data for stored games.</p><p className="map-dialog-boundary">Use only your own completed-game data. The pasted pgn-info request is used once and is not stored.</p><div className="map-dialog-actions"><button type="button" className="primary" onClick={onImportBothBoards}>Import paired completed PGNs</button><button type="button" onClick={onAdvancedRecovery}>Open advanced pgn-info enrichment</button></div></>}
          {dialog === "limits" && <AnalysisLimitations />}
          {dialog === "reset" && <><span className="modal-kicker"><RotateCcw size={14} /> LOCAL RESET</span><h1>Clear guest progress?</h1><p>This removes the onboarding milestone, map position, analysis acknowledgement, and saved learning moments from this browser. Imported games and shared rooms are not deleted.</p><div className="map-dialog-actions"><button type="button" onClick={closeDialog}>Cancel</button><button type="button" className="danger" onClick={() => { onReset(); closeDialog(); }}>Clear local progress</button></div></>}
        </section>
      </div>}
    </section>
  );
}
