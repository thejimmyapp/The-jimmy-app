import { useMutation } from "@tanstack/react-query";
import { Bot, Check, Copy, ExternalLink, ShieldCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../api";
import { useCoachStore } from "../store";
import type { BoardAnalysisState } from "./BoardPanel";
import type { BoardId, CoachPrepareRequest, ReplayPosition } from "../types";

const quickQuestions = [
  "What should our team play next?",
  "Was the last move a mistake?",
  "What is my partner threatening?",
  "Should I defend or attack?",
  "Which piece should I ask my partner for?",
  "Why did our position collapse?",
];

interface Props {
  open: boolean;
  onClose: () => void;
  boardA: ReplayPosition | null;
  boardB: ReplayPosition | null;
  orientationA: "white" | "black";
  orientationB: "white" | "black";
  analyses: Partial<Record<BoardId, BoardAnalysisState>>;
}

const boardInput = (position: ReplayPosition) => ({
  variant_fen: position.variant_fen,
  side_to_move: position.side_to_move,
  white_pocket: position.white_pocket,
  black_pocket: position.black_pocket,
  white_clock: position.white_clock,
  black_clock: position.black_clock,
  from_square: position.from_square,
  to_square: position.to_square,
});

export function TeamCoach({ open, onClose, boardA, boardB, orientationA, orientationB, analyses }: Props) {
  const store = useCoachStore();
  const [question, setQuestion] = useState(quickQuestions[0]);
  const [copied, setCopied] = useState(false);
  const mutation = useMutation({ mutationFn: api.prepareCoach });
  if (!open) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!store.game || !boardA || question.trim().length < 3) return;
    const engineSuggestions = (["A", "B"] as BoardId[]).flatMap((board) => {
      const result = analyses[board];
      return result?.status === "completed" ? [{ board, bestmove: result.bestmove, score_cp: result.scoreCp, mate_in: result.mateIn, depth: result.depth, pv: result.pv }] : [];
    });
    const request: CoachPrepareRequest = {
      game_id: store.game.game.id,
      global_ply: store.globalPly,
      question: question.trim(),
      username: store.username || "Player",
      user_color: store.game.game.user_color === "black" ? "black" : "white",
      orientation_a: orientationA,
      orientation_b: orientationB,
      board_a: boardInput(boardA),
      board_b: boardB ? boardInput(boardB) : undefined,
      annotations: store.annotations.filter((item) => item.ply === store.globalPly).map((item) => ({ board: item.board, type: item.type, from: item.from, to: item.to, color: item.color })),
      engine_suggestions: engineSuggestions,
    };
    mutation.mutate(request);
  };

  const copyPrompt = async () => {
    if (!mutation.data) return;
    await navigator.clipboard.writeText(mutation.data.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="coach-modal" role="dialog" aria-modal="true" aria-labelledby="coach-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close Team Coach"><X /></button>
        <span className="modal-kicker">ZERO-COST TEAM COACH</span>
        <h1 id="coach-title"><Bot size={25} /> Ask about both boards</h1>
        <p>The Jimmy App prepares the exact Bughouse position. You use your own AI account, so no shared API key or usage charge is passed to the app owner.</p>
        <div className="coach-context-strip">
          <span><strong>A</strong>{boardA ? `${boardA.side_to_move} to move` : "Unavailable"}</span>
          <span><strong>B</strong>{boardB ? `${boardB.side_to_move} to move` : "Unavailable"}</span>
          <span><strong>PLY</strong>{store.globalPly}</span>
        </div>
        <div className="coach-question-chips">
          {quickQuestions.map((item) => <button type="button" className={question === item ? "active" : ""} key={item} onClick={() => setQuestion(item)}>{item}</button>)}
        </div>
        <form onSubmit={submit}>
          <label htmlFor="coach-question">Your question</label>
          <textarea id="coach-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} />
          <button className="coach-prepare" disabled={!store.game || !boardA || mutation.isPending} type="submit"><Bot size={16} />{mutation.isPending ? "Preparing both boards..." : "Prepare AI review"}</button>
        </form>
        {mutation.error && <div className="coach-error" role="alert">{mutation.error.message}</div>}
        {mutation.data && (
          <div className="coach-ready" role="status">
            <div><Check size={18} /><span><strong>Context ready</strong><small>{mutation.data.summary}</small></span></div>
            <div className="coach-board-preview">
              <span>Board A <b>{mutation.data.board_a.best_move ? `Best ${mutation.data.board_a.best_move}` : "Run engine for best move"}</b></span>
              <span>Board B <b>{mutation.data.board_b.best_move ? `Best ${mutation.data.board_b.best_move}` : boardB ? "Run engine for best move" : "Unavailable"}</b></span>
            </div>
            <button type="button" className="copy-coach-prompt" onClick={() => void copyPrompt()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied for Codex" : "Copy for Codex or any AI"}</button>
            <div className="coach-open-links">
              <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT <ExternalLink size={13} /></a>
              <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer">Open Gemini <ExternalLink size={13} /></a>
            </div>
            <small className="coach-privacy"><ShieldCheck size={13} />{mutation.data.privacy}</small>
          </div>
        )}
      </section>
    </div>
  );
}
