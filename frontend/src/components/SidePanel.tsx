import { Bell, Search, Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { sendRoomEvent } from "../socket";
import { useCoachStore } from "../store";
import type { GameSummary } from "../types";

interface Props {
  onSelectGame: (game: GameSummary) => void;
  loadingGame: boolean;
}

export function SidePanel({ onSelectGame, loadingGame }: Props) {
  const [tab, setTab] = useState<"games" | "chat" | "notes">("games");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("all");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("newest");
  const [unreadChat, setUnreadChat] = useState(0);
  const [lastNotice, setLastNotice] = useState("");
  const { games, game, messages, addMessage, displayName, globalPly, participants, roomId } = useCoachStore();
  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();
    return games
      .filter((item) => !query || `${item.opponent ?? ""} ${item.partner ?? ""} ${item.played_at ?? ""}`.toLowerCase().includes(query))
      .filter((item) => result === "all" || item.result === result)
      .filter((item) => !minRating || Number(item.opponent_rating ?? 0) >= minRating)
      .sort((a, b) => sort === "rating" ? Number(b.opponent_rating ?? 0) - Number(a.opponent_rating ?? 0) : String(b.played_at).localeCompare(String(a.played_at)));
  }, [games, minRating, result, search, sort]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const item = { id: crypto.randomUUID(), author: displayName, content: draft.trim(), ply: globalPly, timestamp: new Date().toISOString() };
    addMessage(item);
    sendRoomEvent(tab === "chat" ? "chat.message" : "note.create", item);
    setDraft("");
  };

  useEffect(() => {
    if (tab === "chat") {
      setUnreadChat(0);
      setLastNotice("");
    }
  }, [tab]);

  useEffect(() => {
    const onIncomingChat = (event: Event) => {
      const item = (event as CustomEvent).detail as { author?: string; content?: string } | undefined;
      if (tab !== "chat") {
        setUnreadChat((current) => current + 1);
        setLastNotice(`${item?.author ?? "Partner"}: ${item?.content ?? "New message"}`);
      }
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        new Notification("New Jimmy App chat message", {
          body: `${item?.author ?? "Partner"}: ${item?.content ?? ""}`.slice(0, 140),
        });
      }
    };
    window.addEventListener("thejimmyapp:chat-message", onIncomingChat);
    return () => window.removeEventListener("thejimmyapp:chat-message", onIncomingChat);
  }, [tab]);

  const enableBrowserNotifications = async () => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    await Notification.requestPermission();
  };

  return (
    <aside className="side-panel">
      <div className="side-tabs">
        <button className={tab === "games" ? "active" : ""} onClick={() => setTab("games")}>Games</button>
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>Chat{unreadChat > 0 && <span className="chat-unread">{unreadChat}</span>}</button>
        <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>Notes</button>
      </div>
      {tab === "games" ? (
        <>
          <div className="game-filters">
            <label className="sidebar-search"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player, partner or date" /></label>
            <div className="filter-row">
              <select value={result} onChange={(event) => setResult(event.target.value)} aria-label="Game result"><option value="all">All results</option><option value="win">Wins</option><option value="loss">Losses</option><option value="draw">Draws</option></select>
              <select value={minRating} onChange={(event) => setMinRating(Number(event.target.value))} aria-label="Minimum opponent rating"><option value={0}>Any Elo</option><option value={1600}>1600+</option><option value={1800}>1800+</option><option value={2000}>2000+</option><option value={2200}>2200+</option></select>
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Game sort"><option value="newest">Newest</option><option value="rating">Highest Elo</option></select>
            </div>
            <span>{filteredGames.length} games</span>
          </div>
          <div className="sidebar-game-list">
            {filteredGames.map((item) => (
              <button className={game?.game.id === item.id ? "active" : ""} key={item.id} onClick={() => onSelectGame(item)} disabled={loadingGame}>
                <span className={`result-dot ${item.result}`} />
                <span className="game-opponent"><strong>{item.opponent ?? "Unknown"}</strong><small>with {item.partner ?? "unknown partner"}</small></span>
                <span className="game-meta"><strong>{item.opponent_rating ?? "—"}</strong><small>{item.played_at?.slice(0, 10)}</small></span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="presence">
            <span className="presence-dot" />
            {roomId ? (
              <span><strong>{participants.length || 1}</strong> watching · {(participants.length ? participants : [{ display_name: displayName, client_id: "local" }]).map((item) => item.display_name).join(", ")}</span>
            ) : (
              <span>Solo review · <strong>Move {globalPly}</strong></span>
            )}
            {tab === "chat" && "Notification" in window && Notification.permission === "default" && (
              <button type="button" className="notification-enable" onClick={() => void enableBrowserNotifications()}><Bell size={12} /> Enable alerts</button>
            )}
          </div>
          {lastNotice && tab !== "chat" && <div className="chat-toast" role="status"><Bell size={13} /> {lastNotice}</div>}
          <div className="message-list">
            {tab === "chat" ? messages.map((item) => <article key={item.id}><header><strong>{item.author}</strong><button title="Go to referenced move">A · {item.ply}</button></header><p>{item.content}</p></article>) : <div className="empty-panel">Notes attached to this room and move appear here.</div>}
          </div>
          <form className="composer" onSubmit={submit}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={tab === "chat" ? "Message your partner" : "Add a shared note"} maxLength={5000} /><button aria-label="Send"><Send size={17} /></button></form>
        </>
      )}
    </aside>
  );
}
