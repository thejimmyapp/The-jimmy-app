import { Target } from "lucide-react";
import type { ReviewLesson as ReviewLessonPayload } from "../types";

interface ReviewLessonProps {
  lesson: ReviewLessonPayload;
  onReview: (globalPly: number) => void;
}

export function ReviewLesson({ lesson, onReview }: ReviewLessonProps) {
  const depth = lesson.depth ? ` · depth ${lesson.depth}` : "";
  const context = lesson.partner_context ? ` · ${lesson.partner_context}` : "";
  const evidence = `${capitalize(lesson.severity)} · ${lesson.pattern} · estimated ${lesson.estimated_loss_cp} cp swing${context}`;

  return (
    <button
      className="review-lesson"
      type="button"
      onClick={() => onReview(lesson.global_ply)}
      title={`Stored Fairy-Stockfish finding · ${lesson.confidence} confidence${depth}`}
    >
      <Target size={15} aria-hidden="true" />
      <span>ONE MOMENT TO REVISIT</span>
      <strong>{lesson.played_move} · consider {lesson.best_move}</strong>
      <small>{evidence}</small>
    </button>
  );
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
