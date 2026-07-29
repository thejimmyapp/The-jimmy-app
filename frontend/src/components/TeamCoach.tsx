import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, BrainCircuit, Check, Copy, Cpu, ShieldCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "../api";
import { useCoachStore } from "../store";
import type { BoardId, CoachPrepareRequest, ReplayPosition } from "../types";
import type { BoardAnalysisState } from "./BoardPanel";

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
  const [jobId, setJobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const statusQuery = useQuery({ queryKey: ["coach-status"], queryFn: api.coachStatus, enabled: open, refetchInterval: open ? 5000 : false });
  const mutation = useMutation({ mutationFn: api.runCoach, onSuccess: (data) => setJobId(data.job_id) });
  const jobQuery = useQuery({
    queryKey: ["coach-job", jobId],
    queryFn: () => api.coachJob(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => ["completed", "failed"].includes(query.state.data?.status ?? "") ? false : 1200,
  });
  if (!open) return null;

  const buildRequest = (): CoachPrepareRequest | null => {
    if (!store.game || !boardA) return null;
    const engineSuggestions = (["A", "B"] as BoardId[]).flatMap((board) => {
      const result = analyses[board];
      return result?.status === "completed" ? [{ board, bestmove: result.bestmove, score_cp: result.scoreCp, mate_in: result.mateIn, depth: result.depth, pv: result.pv }] : [];
    });
    return {
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
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const request = buildRequest();
    if (!request || request.question.length < 3) return;
    setJobId(null);
    mutation.mutate(request);
  };

  const job = jobQuery.data;
  const prepared = job?.result?.prepared;
  const copyEvidence = async () => {
    if (!prepared) return;
    await navigator.clipboard.writeText(prepared.prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="coach-modal" role="dialog" aria-modal="true" aria-labelledby="coach-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close Team Coach"><X /></button>
        <span className="modal-kicker">COUPLED BUGHOUSE COACH</span>
        <h1 id="coach-title"><BrainCircuit size={25} /> Ask about both boards</h1>
        <p>Fairy-Stockfish validates tactics on each board. The coupled analyzer calculates transfers and partner danger. Qwen only explains those verified facts.</p>
        <div className="coach-pipeline" aria-label="Coaching pipeline">
          <span><Cpu size={13} /> Fairy A + B</span><i>→</i><span>Transfer validator</span><i>→</i><span><Bot size={13} /> Qwen 3.5 4B</span>
        </div>
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
          <button className="coach-prepare" disabled={!store.game || !boardA || mutation.isPending || job?.status === "running"} type="submit"><BrainCircuit size={16} />{mutation.isPending || job?.status === "running" || job?.status === "queued" ? job?.stage ?? "Starting the pipeline..." : "Run coupled AI review"}</button>
        </form>
        {!boardB && <div className="coach-warning">Board B is unavailable. The coach will preserve that limitation instead of inventing partner data.</div>}
        {(mutation.error || jobQuery.error || job?.status === "failed") && <div className="coach-error" role="alert">{mutation.error?.message ?? jobQuery.error?.message ?? job?.error}</div>}
        {statusQuery.data && <div className={`qwen-status ${statusQuery.data.state}`}><span /><strong>{statusQuery.data.model_file}</strong><small>{statusQuery.data.detail}</small></div>}
        {job?.status === "completed" && job.result && (
          <div className="coach-ready" role="status">
            <div><Check size={18} /><span><strong>{job.result.explanation ? "Coupled review ready" : "Validated evidence ready"}</strong><small>{job.stage}</small></span></div>
            <div className="coach-board-preview">
              <span>Board A <b>{prepared?.board_a.best_move ? `Best ${prepared.board_a.best_move}` : "No engine move"}</b></span>
              <span>Board B <b>{prepared?.board_b.best_move ? `Best ${prepared.board_b.best_move}` : boardB ? "No engine move" : "Unavailable"}</b></span>
            </div>
            {job.result.explanation ? <article className="coach-explanation">{job.result.explanation}</article> : <div className="coach-warning">Qwen is unavailable: {job.result.qwen_error}</div>}
            <button type="button" className="copy-coach-prompt" onClick={() => void copyEvidence()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Evidence copied" : "Copy validated evidence"}</button>
            <small className="coach-privacy"><ShieldCheck size={13} />{prepared?.privacy}</small>
          </div>
        )}
      </section>
    </div>
  );
}
