import type { ReviewLesson } from "./types";

export const GUEST_PROGRESS_KEY = "thejimmyapp.guestProgress.v1";
export const ANALYSIS_ACKNOWLEDGEMENT_KEY = "thejimmyapp.analysisAcknowledgement.v1";
export const GUEST_PROGRESS_VERSION = 1 as const;
export const ANALYSIS_ACKNOWLEDGEMENT_VERSION = "analysis-limits-2026-08-06";

export type MapNodeId = "start" | "analyze" | "library" | "partner";

export interface SavedLesson {
  id: string;
  gameId: number;
  board: "A";
  localPly: number;
  globalPly: number;
  playedMove: string;
  bestMove: string;
  severity: "mistake" | "blunder";
  estimatedLossCp: number;
  category: string;
  pattern: string;
  confidence: "high" | "medium";
  depth: number | null;
  partnerContext: string | null;
  savedAt: string;
}

export interface GuestProgress {
  version: typeof GUEST_PROGRESS_VERSION;
  firstGameOpened: boolean;
  mapNode: MapNodeId;
  savedLessons: SavedLesson[];
}

export const emptyGuestProgress = (): GuestProgress => ({
  version: GUEST_PROGRESS_VERSION,
  firstGameOpened: false,
  mapNode: "start",
  savedLessons: [],
});

const mapNodes = new Set<MapNodeId>(["start", "analyze", "library", "partner"]);

const isSavedLesson = (value: unknown): value is SavedLesson => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedLesson>;
  return typeof item.id === "string"
    && item.id.length > 0
    && Number.isSafeInteger(item.gameId)
    && Number.isInteger(item.localPly)
    && Number.isInteger(item.globalPly)
    && item.board === "A"
    && typeof item.playedMove === "string"
    && typeof item.bestMove === "string"
    && (item.severity === "mistake" || item.severity === "blunder")
    && (item.confidence === "high" || item.confidence === "medium")
    && typeof item.savedAt === "string";
};

export const loadGuestProgress = (): GuestProgress => {
  try {
    const raw = localStorage.getItem(GUEST_PROGRESS_KEY);
    if (!raw) return emptyGuestProgress();
    const parsed = JSON.parse(raw) as Partial<GuestProgress>;
    if (parsed.version !== GUEST_PROGRESS_VERSION) return emptyGuestProgress();
    return {
      version: GUEST_PROGRESS_VERSION,
      firstGameOpened: parsed.firstGameOpened === true,
      mapNode: mapNodes.has(parsed.mapNode as MapNodeId) ? parsed.mapNode as MapNodeId : "start",
      savedLessons: Array.isArray(parsed.savedLessons) ? parsed.savedLessons.filter(isSavedLesson) : [],
    };
  } catch {
    return emptyGuestProgress();
  }
};

export const storeGuestProgress = (progress: GuestProgress) => {
  localStorage.setItem(GUEST_PROGRESS_KEY, JSON.stringify(progress));
};

export const isLessonEligible = (lesson: ReviewLesson | null | undefined) => Boolean(
  lesson
  && lesson.id.trim()
  && lesson.best_move.trim()
  && (lesson.confidence === "high" || lesson.confidence === "medium")
  && (lesson.severity === "mistake" || lesson.severity === "blunder"),
);

export const lessonStorageId = (gameId: number, lesson: ReviewLesson) => `${gameId}:${lesson.id}`;

export const savedLessonFrom = (gameId: number, lesson: ReviewLesson, savedAt = new Date().toISOString()): SavedLesson | null => {
  if (!isLessonEligible(lesson)) return null;
  return {
    id: lessonStorageId(gameId, lesson),
    gameId,
    board: "A",
    localPly: lesson.local_ply,
    globalPly: lesson.global_ply,
    playedMove: lesson.played_move,
    bestMove: lesson.best_move,
    severity: lesson.severity as "mistake" | "blunder",
    estimatedLossCp: lesson.estimated_loss_cp,
    category: lesson.category,
    pattern: lesson.pattern,
    confidence: lesson.confidence,
    depth: lesson.depth,
    partnerContext: lesson.partner_context,
    savedAt,
  };
};

export const qualifyingGameCount = (items: SavedLesson[]) => new Set(
  items.filter((item) => item.bestMove.trim() && (item.severity === "mistake" || item.severity === "blunder") && (item.confidence === "high" || item.confidence === "medium"))
    .map((item) => item.gameId),
).size;

export const hasAnalysisAcknowledgement = () => localStorage.getItem(ANALYSIS_ACKNOWLEDGEMENT_KEY) === ANALYSIS_ACKNOWLEDGEMENT_VERSION;

export const acceptAnalysisAcknowledgement = () => {
  localStorage.setItem(ANALYSIS_ACKNOWLEDGEMENT_KEY, ANALYSIS_ACKNOWLEDGEMENT_VERSION);
};

export const clearGuestProgress = () => {
  localStorage.removeItem(GUEST_PROGRESS_KEY);
  localStorage.removeItem(ANALYSIS_ACKNOWLEDGEMENT_KEY);
};
