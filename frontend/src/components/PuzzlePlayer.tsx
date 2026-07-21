import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, ExternalLink, Lightbulb, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { BoardId, ExplorationMoveResult, PuzzleMove, PuzzlePayload, PuzzleResponse, ReplayPosition } from "../types";
import { BoardPanel } from "./BoardPanel";

interface PuzzlePair {
  boardA: ReplayPosition;
  boardB: ReplayPosition;
}

interface MoveIntent {
  board: BoardId;
  from?: string;
  to: string;
  dropPiece?: "P" | "N" | "B" | "R" | "Q";
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
};

const pairFromResult = (result: ExplorationMoveResult): PuzzlePair | null => {
  if (!result.board_a || !result.board_b) return null;
  return { boardA: result.board_a, boardB: result.board_b };
};

export function PuzzlePlayer({ puzzleId }: { puzzleId: string }) {
  const puzzleQuery = useQuery({ queryKey: ["puzzle", puzzleId], queryFn: () => api.puzzle(puzzleId), retry: false });

  if (puzzleQuery.isPending) {
    return <PuzzleMessage title="Loading real-game puzzle…" detail="Reconstructing both Bughouse boards." />;
  }
  if (puzzleQuery.isError || !puzzleQuery.data) {
    return <PuzzleMessage title="Puzzle unavailable" detail={puzzleQuery.error?.message ?? "This puzzle could not be loaded."} />;
  }
  return <PuzzleSession key={puzzleQuery.data.id} puzzle={puzzleQuery.data} />;
}

function PuzzleSession({ puzzle }: { puzzle: PuzzlePayload }) {
  const initialPair: PuzzlePair = { boardA: puzzle.positions.board_a, boardB: puzzle.positions.board_b };
  const [history, setHistory] = useState<PuzzleMove[]>([]);
  const [snapshots, setSnapshots] = useState<PuzzlePair[]>([initialPair]);
  const [viewIndex, setViewIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState(puzzle.prompt);
  const busyRef = useRef(false);
  const visiblePair = snapshots[viewIndex] ?? snapshots[snapshots.length - 1];
  const atPresent = viewIndex === history.length;
  const boardLocked = busy || solved || !atPresent;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (busyRef.current || isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setViewIndex((current) => Math.max(0, current - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setViewIndex((current) => Math.min(history.length, current + 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [history.length]);

  const applyServerMoves = async (
    response: PuzzleResponse,
    startingPair: PuzzlePair,
    startingHistory: PuzzleMove[],
    startingSnapshots: PuzzlePair[],
  ) => {
    let nextPair = startingPair;
    let nextHistory = startingHistory;
    let nextSnapshots = startingSnapshots;
    const moves = (response.moves ?? []).flatMap((run) => run.moves.map((san) => ({ board: run.board, san })));
    for (const move of moves) {
      await wait(420);
      const result = await api.explorationSanMove({
        board_a_fen: nextPair.boardA.variant_fen,
        board_b_fen: nextPair.boardB.variant_fen,
        board: move.board,
        san: move.san,
      });
      const advancedPair = pairFromResult(result);
      if (!result.legal || !advancedPair) throw new Error(result.reason ?? "The puzzle line could not be replayed.");
      nextPair = advancedPair;
      nextHistory = [...nextHistory, { board: move.board, san: result.notation ?? move.san }];
      nextSnapshots = [...nextSnapshots, nextPair];
      setHistory(nextHistory);
      setSnapshots(nextSnapshots);
      setViewIndex(nextHistory.length);
    }
    return { pair: nextPair, history: nextHistory, snapshots: nextSnapshots };
  };

  const handleMoveIntent = async (intent: MoveIntent): Promise<ExplorationMoveResult> => {
    if (busyRef.current || !atPresent || solved) return { legal: false, reason: "Return to the current position before moving." };
    busyRef.current = true;
    setBusy(true);
    setStatus("Checking the position…");
    try {
      const currentPair = snapshots[history.length];
      const result = await api.explorationMove({
        board_a_fen: currentPair.boardA.variant_fen,
        board_b_fen: currentPair.boardB.variant_fen,
        board: intent.board,
        from_square: intent.from,
        to_square: intent.to,
        drop_piece: intent.dropPiece,
      });
      const movedPair = pairFromResult(result);
      if (!result.legal || !movedPair) {
        setStatus(result.reason ?? "That move is not legal in this position.");
        return result;
      }

      const candidateMove = { board: intent.board, san: result.notation ?? "" };
      const candidateHistory = [...history, candidateMove];
      const verdict = await api.puzzleMove(puzzle.id, candidateHistory);
      if (verdict.status === "wrong_move") {
        setStatus("That move is legal, but it misses the forcing idea. Try again.");
        return { ...result, legal: false, reason: "Puzzle failed — try another move." };
      }

      let nextHistory = candidateHistory;
      let nextSnapshots = [...snapshots, movedPair];
      setHistory(nextHistory);
      setSnapshots(nextSnapshots);
      setViewIndex(nextHistory.length);
      setStatus(verdict.complete ? "Finishing the forced reply…" : "Good move — watch the reply.");
      const advanced = await applyServerMoves(verdict, movedPair, nextHistory, nextSnapshots);
      nextHistory = advanced.history;
      nextSnapshots = advanced.snapshots;
      if (verdict.complete) {
        setSolved(true);
        setStatus("Solved. You found the complete forcing sequence.");
      } else {
        setStatus("Your move. Keep every reply forced.");
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The move could not be checked.";
      setStatus(message);
      return { legal: false, reason: message };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const playAssistance = async (kind: "hint" | "solution") => {
    if (busyRef.current || solved || !atPresent) return;
    busyRef.current = true;
    setBusy(true);
    setStatus(kind === "hint" ? "Playing the next idea…" : "Revealing the forcing line…");
    try {
      const response = kind === "hint"
        ? await api.puzzleNextMove(puzzle.id, history)
        : await api.puzzleSolution(puzzle.id, history);
      if (response.status === "wrong_move") throw new Error("Reset the puzzle before requesting help.");
      const advanced = await applyServerMoves(response, snapshots[history.length], history, snapshots);
      if (kind === "solution") setRevealed(true);
      if (response.complete) {
        setSolved(true);
        setStatus(kind === "solution" ? "Solution revealed. Use the move history to study it." : "Solved with a hint.");
      } else {
        setStatus(`Hint played through ${advanced.history.at(-1)?.san ?? "the next reply"}. Your move.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Help could not be loaded.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    busyRef.current = false;
    setHistory([]);
    setSnapshots([initialPair]);
    setViewIndex(0);
    setBusy(false);
    setSolved(false);
    setRevealed(false);
    setStatus(puzzle.prompt);
  };

  const player = puzzle.players;
  return (
    <main className="app-shell puzzle-shell" data-board-theme="slate" data-piece-style="solid" data-piece-size="normal">
      <div className="small-screen-message">The Jimmy App puzzle board is optimized for desktop screens of 1366×768 or larger.</div>
      <header className="app-header puzzle-header">
        <div className="brand"><span className="brand-mark">J</span><div><strong>THE JIMMY APP</strong><small>REAL-GAME BUGHOUSE PUZZLE</small></div></div>
        <div className={`mode-badge puzzle-mode ${solved ? "solved" : ""}`}><span />{solved ? (revealed ? "SOLUTION REVEALED" : "PUZZLE SOLVED") : busy ? "LINE IN MOTION" : "RYANTIME TO MOVE · BOARD A"}</div>
        <a className="puzzle-source" href={puzzle.source.url} target="_blank" rel="noreferrer">Original game <ExternalLink size={14} /></a>
      </header>
      <section className="puzzle-workspace">
        <div className="boards-zone puzzle-boards">
          <BoardPanel
            boardId="A"
            position={visiblePair.boardA}
            pairedPosition={visiblePair.boardB}
            orientation="white"
            pieceStyle="solid"
            title="BOARD A · RYANTIME"
            playerTop={player.board_a_black}
            playerBottom={player.board_a_white}
            locked={boardLocked}
            onMoveIntent={handleMoveIntent}
          />
          <BoardPanel
            boardId="B"
            position={visiblePair.boardB}
            pairedPosition={visiblePair.boardA}
            orientation="black"
            pieceStyle="solid"
            title="BOARD B · PARTNER CONTEXT"
            playerTop={player.board_b_white}
            playerBottom={player.board_b_black}
            locked={boardLocked}
            onMoveIntent={handleMoveIntent}
          />
        </div>
        <aside className="puzzle-panel" aria-label="Puzzle controls">
          <span className="puzzle-kicker">{puzzle.category} · {puzzle.rating}</span>
          <h1>{puzzle.title}</h1>
          <p>{puzzle.prompt}</p>
          <div className={`puzzle-status ${solved ? "complete" : ""}`} role="status">
            {solved && <CheckCircle2 size={18} />}
            <strong>{status}</strong>
          </div>
          <div className="puzzle-actions">
            <button type="button" onClick={() => void playAssistance("hint")} disabled={busy || solved || !atPresent}><Lightbulb size={16} /> Hint</button>
            <button type="button" onClick={() => void playAssistance("solution")} disabled={busy || solved || !atPresent}><Eye size={16} /> Show solution</button>
            <button type="button" onClick={reset} disabled={busy}><RotateCcw size={16} /> Retry</button>
          </div>
          <dl className="puzzle-details">
            <div><dt>Source</dt><dd>{puzzle.source.player}, game {puzzle.source.game_id}</dd></div>
            <div><dt>Context</dt><dd>Both live boards and pockets</dd></div>
            <div><dt>Validation</dt><dd>Server-checked, stateless history</dd></div>
          </dl>
          <div className="puzzle-tags">{puzzle.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </aside>
      </section>
      <footer className="puzzle-timeline">
        <div className="puzzle-history-controls">
          <button type="button" aria-label="Previous puzzle move" onClick={() => setViewIndex((current) => Math.max(0, current - 1))} disabled={busy || viewIndex === 0}><ChevronLeft /></button>
          <button type="button" aria-label="Next puzzle move" onClick={() => setViewIndex((current) => Math.min(history.length, current + 1))} disabled={busy || viewIndex === history.length}><ChevronRight /></button>
        </div>
        <div className="puzzle-history" aria-label="Puzzle move history">
          <button type="button" className={viewIndex === 0 ? "active" : ""} onClick={() => setViewIndex(0)}>Start</button>
          {history.map((move, index) => <button type="button" className={viewIndex === index + 1 ? "active" : ""} key={`${index}-${move.board}-${move.san}`} onClick={() => setViewIndex(index + 1)}><b>{move.board}</b> {move.san}</button>)}
        </div>
        <div className="puzzle-progress"><strong>{viewIndex}/{history.length}</strong><span>← → review</span></div>
      </footer>
    </main>
  );
}

function PuzzleMessage({ title, detail }: { title: string; detail: string }) {
  return <main className="app-shell puzzle-message-shell"><section className="puzzle-message"><span className="brand-mark">J</span><h1>{title}</h1><p>{detail}</p></section></main>;
}
