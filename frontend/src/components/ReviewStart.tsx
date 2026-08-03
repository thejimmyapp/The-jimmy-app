import { ExternalLink, FileInput, History, Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { chessComGameIdFromUrl } from "../chesscomGameUrl";

interface Props {
  defaultUsername: string;
  pending: boolean;
  errorMessage?: string;
  fallbackUrl?: string | null;
  onReview: (url: string, username: string) => void;
  onBrowseGames: () => void;
  onImportBothBoards: () => void;
}

export function ReviewStart({ defaultUsername, pending, errorMessage, fallbackUrl, onReview, onBrowseGames, onImportBothBoards }: Props) {
  const [gameUrl, setGameUrl] = useState("");
  const [username, setUsername] = useState(defaultUsername);
  const [localError, setLocalError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!chessComGameIdFromUrl(gameUrl)) {
      setLocalError("Enter a supported Chess.com live-game URL.");
      return;
    }
    setLocalError("");
    onReview(gameUrl.trim(), username.trim());
  };

  return (
    <section className="review-start" aria-labelledby="review-start-heading">
      <span className="review-start-kicker">EXACT GAME REVIEW</span>
      <h1 id="review-start-heading">Review the game you just played.</h1>
      <p>Paste the live-game URL and Jimmy will open that exact completed game—never a nearby archive result.</p>
      <form onSubmit={submit}>
        <label htmlFor="chesscom-game-url">Paste Chess.com game URL</label>
        <div className="review-url-row">
          <input
            id="chesscom-game-url"
            autoFocus
            inputMode="url"
            placeholder="https://www.chess.com/game/live/123456789"
            value={gameUrl}
            onChange={(event) => setGameUrl(event.target.value)}
          />
          <button className="primary" disabled={pending}>
            <Search size={16} /> {pending ? "Finding exact game…" : "Review this game"}
          </button>
        </div>
        <label className="review-username" htmlFor="review-username">Chess.com username <small>needed only when the game is not already stored</small></label>
        <input
          id="review-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          pattern="[A-Za-z0-9_-]+"
          minLength={2}
          maxLength={25}
          placeholder="Your public Chess.com username"
        />
        {(localError || errorMessage) && (
          <div className="review-start-error" role="alert">
            <strong>We could not open that exact game.</strong>
            <span>{localError || errorMessage}</span>
            {fallbackUrl && <a href={fallbackUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open this game in bMacho <small>(external third-party tool)</small></a>}
          </div>
        )}
      </form>
      <div className="review-start-secondary">
        <button type="button" onClick={onImportBothBoards}><FileInput size={15} /> Import both board PGNs</button>
        <button type="button" onClick={onBrowseGames}><History size={15} /> Browse past games</button>
      </div>
      <small className="review-start-boundary">Uses stored data, official public Chess.com archives for a supplied username, or PGNs you provide. No login secrets are requested.</small>
    </section>
  );
}
