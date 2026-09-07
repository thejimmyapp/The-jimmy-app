import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { api } from "../api";
import { formatRelativeAge } from "../guestMatchAge";
import { isRealMatch } from "../guestMatchupEntries";
import { guestMatchupsQuery, guestMatchupsQueryKey } from "../guestMatchupsQuery";
import type {
  GuestMatchupClassifiedMatch,
  GuestMatchupEntry,
  NormalizedMatch,
} from "../types";

interface Props {
  onSelect: (match: NormalizedMatch) => void | Promise<void>;
}

const firstSelectableIndex = (matches: GuestMatchupEntry[]) => {
  const index = matches.findIndex(isRealMatch);
  return index < 0 ? 0 : index;
};

const nextSelectableIndex = (matches: GuestMatchupEntry[], current: number, direction: 1 | -1) => {
  for (let offset = 1; offset <= matches.length; offset += 1) {
    const index = (current + direction * offset + matches.length) % matches.length;
    if (isRealMatch(matches[index])) return index;
  }
  return current;
};

const cardText = (match: GuestMatchupClassifiedMatch) => {
  const highest = match.highest_rated;
  const relative = match.loser_relative_to_highest ? `${match.loser_relative_to_highest} ` : "";
  const classPrefix = match.rating_class?.label ? `${match.rating_class.label} · ` : "";
  return `${classPrefix}${highest.name}(${highest.rating}) ${highest.outcome} — ${relative}${match.action}`;
};

export function GuestMatchupList({ onSelect }: Props) {
  const surfaceRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const [rotationNoteLabels, setRotationNoteLabels] = useState<string[]>([]);
  const preserveRotationNoteRef = useRef(false);
  const queryClient = useQueryClient();
  const query = useQuery({ ...guestMatchupsQuery, retry: false });
  const matches = useMemo(
    () => query.data?.matches ?? [],
    [query.data?.matches],
  );
  const regenerate = useMutation({
    mutationFn: () => api.guestMatchups({
      refresh: true,
      excludeGameIds: matches.filter(isRealMatch).flatMap((match) => [match.game_ids.A, match.game_ids.B]),
    }),
    onSuccess: (data) => {
      preserveRotationNoteRef.current = true;
      queryClient.setQueryData(guestMatchupsQueryKey, data);
      setActiveIndex(firstSelectableIndex(data.matches));
      setSelectionError("");
      setRotationNoteLabels(data.classes
        .filter((ratingClass) => ratingClass.rotated === false)
        .filter((ratingClass) => {
          const row = data.matches.find((match) => match.rating_class.label === ratingClass.label);
          return row !== undefined && isRealMatch(row);
        })
        .map((ratingClass) => ratingClass.label));
    },
  });

  useEffect(() => {
    if (preserveRotationNoteRef.current) {
      preserveRotationNoteRef.current = false;
      return;
    }
    setRotationNoteLabels([]);
  }, [query.dataUpdatedAt]);

  useEffect(() => {
    if (!matches[activeIndex] || !isRealMatch(matches[activeIndex])) {
      setActiveIndex(firstSelectableIndex(matches));
    }
  }, [activeIndex, matches]);

  useLayoutEffect(() => {
    (matches.length ? listRef.current : surfaceRef.current)?.focus();
  }, [matches.length, query.isError]);

  useEffect(() => {
    const keepFocusInside = (event: FocusEvent) => {
      if (surfaceRef.current?.contains(event.target as Node)) return;
      (matches.length ? listRef.current : surfaceRef.current)?.focus();
    };
    document.addEventListener("focusin", keepFocusInside);
    return () => document.removeEventListener("focusin", keepFocusInside);
  }, [matches.length]);

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => nextSelectableIndex(matches, current, direction));
      return;
    }
    const selectedMatch = matches[activeIndex];
    if (event.key === "Enter" && selectedMatch && isRealMatch(selectedMatch) && !selecting) {
      event.preventDefault();
      setSelecting(true);
      setSelectionError("");
      void Promise.resolve(onSelect(selectedMatch)).catch((error: unknown) => {
        const typedDecoderFailure = error instanceof Error && (error.name === "MoveListDecodeError" || error.name === "MatchReconstructionError");
        setSelectionError(typedDecoderFailure
          ? "This match uses replay data the decoder cannot verify. It was refused."
          : "This match could not be loaded. Press Enter to try again.");
      }).finally(() => setSelecting(false));
    }
  };

  const handleSurfaceKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && event.key === "Enter" && query.isError) {
      event.preventDefault();
      void query.refetch();
    }
  };

  return (
    <section
      ref={surfaceRef}
      className="onboarding-map-shell locked-shell-onboarding guest-matchup-surface"
      aria-label="Choose a guest matchup"
      tabIndex={-1}
      onKeyDown={handleSurfaceKeyDown}
    >
      <div className="guest-matchup-copy">
        <span>GUEST MATCHUPS</span>
        <h1>Choose a game to review.</h1>
        <p>Use Arrow Up or Arrow Down to move. Press Enter to select.</p>
      </div>
      {query.isPending && <div className="guest-matchup-status" role="status">Loading matchups…</div>}
      {query.isError && <div className="guest-matchup-status guest-matchup-error" role="alert">Matchups unavailable. Press Enter to retry.</div>}
      {selecting && <div className="guest-matchup-status" role="status">Verifying both boards…</div>}
      {selectionError && <div className="guest-matchup-status guest-matchup-error" role="alert">{selectionError}</div>}
      {regenerate.isError && <div className="guest-matchup-status guest-matchup-error" role="alert">Could not regenerate matchups. Try again.</div>}
      {matches.length > 0 && (
        <div className="guest-matchup-list-shell">
          <div
            ref={listRef}
            className="guest-matchup-list"
            role="listbox"
            aria-label="Guest matchups"
            aria-activedescendant={`guest-matchup-${activeIndex}`}
            tabIndex={0}
            onKeyDown={handleListKeyDown}
          >
            {matches.map((match, index) => isRealMatch(match) ? (
                <article
                  id={`guest-matchup-${index}`}
                  key={`${match.game_ids.A}-${match.game_ids.B}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`guest-matchup-card ${index === activeIndex ? "active" : ""}`}
                >
                  <strong>{cardText(match)}</strong>
                  <small>Boards {match.game_ids.A} / {match.game_ids.B} · {match.ply_counts.A}/{match.ply_counts.B} plies · {formatRelativeAge(match.end_time)}</small>
                </article>
              ) : (
                <article
                  id={`guest-matchup-${index}`}
                  key={`placeholder-${match.rating_class.label}`}
                  role="option"
                  aria-selected={false}
                  aria-disabled="true"
                  className="guest-matchup-card"
                  data-copy-placeholder
                >
                  <strong>[COPY-PLACEHOLDER] {match.rating_class.label} · no finished game in the last 7 days</strong>
                </article>
              ))}
          </div>
          <div className="guest-matchup-list-tools">
            <button
              type="button"
              className="guest-matchup-regenerate"
              disabled={regenerate.isPending || selecting}
              onClick={() => {
                setRotationNoteLabels([]);
                regenerate.mutate();
              }}
            >{regenerate.isPending ? "Regenerating…" : "Regenerate list"}</button>
            <details className="guest-matchup-explainer">
              <summary>why is this the list of options</summary>
              <p data-copy-placeholder>[COPY-PLACEHOLDER] Three games, one per rating class.</p>
            </details>
          </div>
          {rotationNoteLabels.length > 0 && (
            <p className="guest-matchup-rotation-note" role="status" aria-live="polite" data-copy-placeholder>
              [COPY-PLACEHOLDER] {rotationNoteLabels.join(", ")} · no other recent game yet
            </p>
          )}
        </div>
      )}
    </section>
  );
}
