import { Bookmark, BookmarkCheck, Target } from "lucide-react";
import { isLessonEligible } from "../guestProgress";
import type { ReviewLesson as ReviewLessonPayload } from "../types";

interface ReviewLessonProps {
  lesson: ReviewLessonPayload;
  onReview: (globalPly: number) => void;
  saved?: boolean;
  onToggleSave?: () => void;
}

export function ReviewLesson({ lesson, onReview, saved = false, onToggleSave }: ReviewLessonProps) {
  const depth = lesson.depth ? ` · depth ${lesson.depth}` : "";
  const context = lesson.partner_context ? ` · ${lesson.partner_context}` : "";
  const evidence = `${capitalize(lesson.severity)} · ${lesson.pattern} · estimated ${lesson.estimated_loss_cp} cp swing${context}`;

  const saveable = isLessonEligible(lesson);

  return (
    <section className="review-lesson" title={`Stored Fairy-Stockfish finding · ${lesson.confidence} confidence${depth}`}>
      <button className="review-lesson-seek" type="button" onClick={() => onReview(lesson.global_ply)}>
        <Target size={15} aria-hidden="true" />
        <span>ONE MOMENT TO REVISIT</span>
        <strong>{lesson.played_move} · consider {lesson.best_move}</strong>
        <small>{evidence}</small>
      </button>
      {onToggleSave && <button className={`library-save ${saved ? "saved" : ""}`} type="button" onClick={onToggleSave} disabled={!saveable} title={saveable ? "Store only this compact lesson reference in this browser" : "This finding does not meet the evidence requirements"}>{saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}{saved ? "Saved" : "Save to Library"}</button>}
    </section>
  );
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
