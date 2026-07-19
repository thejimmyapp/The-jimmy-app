import { useMemo, useRef, useState } from "react";
import { BrainCircuit } from "lucide-react";
import { api } from "../api";
import { sendRoomEvent } from "../socket";
import { currentPosition, useCoachStore } from "../store";
import type { Annotation, BoardId, ReplayPosition } from "../types";

const pieces: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const squareName = (row: number, col: number, orientation: "white" | "black") => {
  const file = orientation === "white" ? col : 7 - col;
  const rank = orientation === "white" ? 7 - row : row;
  return `${"abcdefgh"[file]}${rank + 1}`;
};

interface Props {
  boardId: BoardId;
  position: ReplayPosition | null;
  orientation: "white" | "black";
  title: string;
  playerTop: string;
  playerBottom: string;
}

export function BoardPanel({ boardId, position, orientation, title, playerTop, playerBottom }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [arrowStart, setArrowStart] = useState<string | null>(null);
  const [interactionStatus, setInteractionStatus] = useState("");
  const [analysis, setAnalysis] = useState<{ status: string; bestmove?: string; score?: string }>({ status: "idle" });
  const { game, globalPly, mode, explorationPositions, annotations, addAnnotation, removeAnnotation, applyExploration } = useCoachStore();
  const visible = useMemo(
    () => annotations.filter((item) => item.board === boardId && item.ply === globalPly),
    [annotations, boardId, globalPly],
  );
  const matrix = position?.board ?? Array.from({ length: 8 }, () => Array<string>(8).fill(""));
  const rows = orientation === "white" ? matrix : [...matrix].reverse().map((row) => [...row].reverse());

  const removeDrawing = (annotation: Annotation) => {
    removeAnnotation(annotation.id);
    sendRoomEvent("annotation.delete", { id: annotation.id });
  };

  const createAnnotation = async (from: string, to: string) => {
    const officialA = currentPosition(game, globalPly, "A");
    const officialB = currentPosition(game, globalPly, "B");
    const boardA = explorationPositions?.boardA ?? officialA;
    const boardB = explorationPositions?.boardB ?? officialB;
    if (!boardA || !boardB) return;
    const validation = await api.explorationMove({
      board_a_fen: boardA.variant_fen,
      board_b_fen: boardB.variant_fen,
      board: boardId,
      from_square: from,
      to_square: to,
      dry_run: true,
    });
    if (!validation.legal) {
      setInteractionStatus("Illegal move");
      window.setTimeout(() => setInteractionStatus(""), 1300);
      return;
    }
    const annotation: Annotation = {
      id: crypto.randomUUID(), board: boardId, ply: globalPly, author: "You", color: "cyan",
      type: "arrow", from, to,
    };
    addAnnotation(annotation);
    sendRoomEvent("annotation.create", annotation as unknown as Record<string, unknown>);
  };

  const playExplorationMove = async (from: string | undefined, to: string, dropPiece?: "P" | "N" | "B" | "R" | "Q") => {
    const officialA = currentPosition(game, globalPly, "A");
    const officialB = currentPosition(game, globalPly, "B");
    const boardA = explorationPositions?.boardA ?? officialA;
    const boardB = explorationPositions?.boardB ?? officialB;
    if (!boardA || !boardB) return;
    const result = await api.explorationMove({
      board_a_fen: boardA.variant_fen,
      board_b_fen: boardB.variant_fen,
      board: boardId,
      from_square: from,
      to_square: to,
      drop_piece: dropPiece,
    });
    if (!result.legal || !result.board_a || !result.board_b) {
      setInteractionStatus(result.reason ?? "Illegal move");
      window.setTimeout(() => setInteractionStatus(""), 1500);
      return;
    }
    result.board_a.white_clock = boardA.white_clock;
    result.board_a.black_clock = boardA.black_clock;
    result.board_b.white_clock = boardB.white_clock;
    result.board_b.black_clock = boardB.black_clock;
    applyExploration(result.board_a, result.board_b, result.notation ?? `${from ?? dropPiece}@${to}`);
    sendRoomEvent(mode === "review" ? "variation.create" : "variation.update", {
      board_a: result.board_a,
      board_b: result.board_b,
      notation: result.notation,
      start_ply: globalPly,
    });
    setInteractionStatus(result.capture_transferred ? "Move applied · capture sent to partner" : "Move applied");
    window.setTimeout(() => setInteractionStatus(""), 1200);
  };

  const analyze = async () => {
    if (!game) return;
    setAnalysis({ status: "Analyzing…" });
    try {
      const submitted = await api.analyze(game.game.id, globalPly, boardId);
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        const job = await api.analysisJob(submitted.job_id);
        if (job.status === "completed") {
          const score = job.result?.mate_in != null ? `M${job.result.mate_in}` : job.result?.score_cp != null ? `${job.result.score_cp} cp` : "—";
          setAnalysis({ status: "completed", bestmove: job.result?.bestmove, score });
          return;
        }
        if (job.status === "failed") throw new Error(job.error ?? "Engine analysis failed");
      }
      throw new Error("Engine analysis timed out");
    } catch (error) {
      setAnalysis({ status: error instanceof Error ? error.message : "Engine analysis failed" });
    }
  };

  return (
    <section className={`board-panel ${mode === "exploration" ? "is-exploring" : ""}`}>
      <div className="board-heading"><strong>{title}</strong><span>{position?.side_to_move ?? "Unavailable"} to move</span></div>
      <PlayerBar name={playerTop} clock={orientation === "white" ? position?.black_clock : position?.white_clock} />
      <div className="board-stage">
        <PocketRail color="White" value={position?.white_pocket ?? "-"} draggable={position?.side_to_move === "White"} onDragPiece={eventDropPiece} />
        <div
          className="board"
          ref={boardRef}
          onContextMenu={(event) => event.preventDefault()}
          aria-label={`${title} chessboard`}
        >
        {rows.flatMap((row, rowIndex) => row.map((piece, colIndex) => {
          const square = squareName(rowIndex, colIndex, orientation);
          const marked = visible.some((item) => item.from === square || item.to === square);
          const lastMove = position?.from_square === square || position?.to_square === square;
          const pieceColor = piece && piece === piece.toUpperCase() ? "White" : "Black";
          const canDrag = Boolean(piece) && position?.side_to_move === pieceColor;
          return (
            <button
              className={`square ${(rowIndex + colIndex) % 2 ? "dark" : "light"} ${marked ? "annotated" : ""} ${lastMove ? "last-move" : ""}`}
              key={square}
              aria-label={`${square}${piece ? ` ${piece}` : ""}`}
              onContextMenu={(event) => event.preventDefault()}
              onMouseDown={(event) => { if (event.button === 2) setArrowStart(square); }}
              onMouseUp={(event) => { if (event.button === 2 && arrowStart) { void createAnnotation(arrowStart, square); setArrowStart(null); } }}
              onClick={() => {
                const drawing = visible.find((item) => item.type === "highlight" && item.from === square);
                if (drawing) removeDrawing(drawing);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const from = event.dataTransfer.getData("bughouse/from") || undefined;
                const dropPiece = event.dataTransfer.getData("bughouse/drop") as "P" | "N" | "B" | "R" | "Q" | "";
                void playExplorationMove(from, square, dropPiece || undefined);
              }}
            >
              <span className="coordinate">{square}</span>
              <span
                className={`piece ${piece === piece.toUpperCase() ? "white-piece" : "black-piece"}`}
                draggable={canDrag}
                onDragStart={(event) => { event.dataTransfer.setData("bughouse/from", square); event.dataTransfer.effectAllowed = "move"; }}
              >{pieces[piece] ?? ""}</span>
            </button>
          );
        }))}
          <svg className="annotation-layer" viewBox="0 0 800 800" aria-label="Board annotations">
            {visible.filter((item) => item.type === "arrow" && item.to).map((item) => <Arrow key={item.id} annotation={item} orientation={orientation} onRemove={() => removeDrawing(item)} />)}
          </svg>
        </div>
        <PocketRail color="Black" value={position?.black_pocket ?? "-"} draggable={position?.side_to_move === "Black"} onDragPiece={eventDropPiece} />
      </div>
      <PlayerBar name={playerBottom} clock={orientation === "white" ? position?.white_clock : position?.black_clock} bottom />
      <div className="board-footer"><button className="analyze-button" title="Analyze this position" onClick={analyze} disabled={!game}><BrainCircuit size={15} /> {analysis.bestmove ? `${analysis.bestmove} · ${analysis.score}` : analysis.status === "idle" ? "Analyze position" : analysis.status}</button><span className="interaction-status">{interactionStatus}</span></div>
    </section>
  );

  function eventDropPiece(piece: "P" | "N" | "B" | "R" | "Q") {
    setInteractionStatus(`Drag ${piece} from the pocket to a square`);
  }
}

function PlayerBar({ name, clock, bottom = false }: { name: string; clock?: string; bottom?: boolean }) {
  return <div className={`player-bar ${bottom ? "bottom" : ""}`}><strong>{name}</strong><span className="clock">{clock ?? "--:--"}</span></div>;
}

function PocketRail({ color, value, draggable, onDragPiece }: { color: "White" | "Black"; value: string; draggable: boolean; onDragPiece?: (piece: "P" | "N" | "B" | "R" | "Q") => void }) {
  const counts = [...value].filter((piece) => pieces[piece]).reduce<Record<string, number>>((result, piece) => ({ ...result, [piece]: (result[piece] ?? 0) + 1 }), {});
  const entries = Object.entries(counts).filter(([piece]) => color === "White" ? piece === piece.toUpperCase() : piece === piece.toLowerCase());
  return <div className={`pocket-rail ${color.toLowerCase()}`} aria-label={`${color} pocket ${value}`}><small>{color[0]}</small>{entries.length ? entries.map(([piece, count]) => <span key={piece} draggable={draggable} onDragStart={(event) => { if (!draggable) { event.preventDefault(); return; } const symbol = piece.toUpperCase() as "P" | "N" | "B" | "R" | "Q"; event.dataTransfer.setData("bughouse/drop", symbol); event.dataTransfer.effectAllowed = "move"; onDragPiece?.(symbol); }}>{pieces[piece]}{count > 1 && <b>{count}</b>}</span>) : <i>·</i>}</div>;
}

function Arrow({ annotation, orientation, onRemove }: { annotation: Annotation; orientation: "white" | "black"; onRemove: () => void }) {
  const point = (square: string) => {
    let file = "abcdefgh".indexOf(square[0]); let rank = Number(square[1]) - 1;
    if (orientation === "black") { file = 7 - file; rank = 7 - rank; }
    return { x: file * 100 + 50, y: (7 - rank) * 100 + 50 };
  };
  const from = point(annotation.from); const to = point(annotation.to ?? annotation.from);
  return <line className="annotation-arrow" x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={annotation.color === "cyan" ? "#24d6e8" : "#a879ff"} strokeWidth="18" strokeLinecap="round" opacity=".72" onClick={onRemove} />;
}
