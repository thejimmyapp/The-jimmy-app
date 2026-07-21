import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, LogOut, Palette, Radio, Redo2, RotateCcw, Settings, Undo2, UserRoundPlus, Users, X } from "lucide-react";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BoardPanel } from "./components/BoardPanel";
import { SidePanel } from "./components/SidePanel";
import { Timeline } from "./components/Timeline";
import { applyRoomSnapshot, connectRoomSocket, sendRoomEvent } from "./socket";
import { currentPosition, useCoachStore } from "./store";
import type { GameSummary } from "./types";

const boardThemes = [
  { id: "slate", name: "Slate", light: "#c8d2d8", dark: "#58717e", white: "#f7f5ed", black: "#17202b" },
  { id: "classic", name: "Classic", light: "#edd8b4", dark: "#b98b64", white: "#fff9ec", black: "#050505" },
  { id: "wood", name: "Wood", light: "#e6c690", dark: "#9b683d", white: "#fff7e3", black: "#3e3e3e" },
  { id: "green", name: "Green", light: "#eee4c9", dark: "#739352", white: "#f7f7f0", black: "#1f2933" },
  { id: "blue", name: "Blue", light: "#d8e3ea", dark: "#6d92a4", white: "#ffffff", black: "#182536" },
  { id: "violet", name: "Violet", light: "#ded6ea", dark: "#7c6798", white: "#fffaf0", black: "#1d1630" },
  { id: "mono", name: "Mono", light: "#dedede", dark: "#7b7b7b", white: "#ffffff", black: "#0b0b0b" },
] as const;

type BoardThemeId = (typeof boardThemes)[number]["id"];
const pieceStyles = [
  { id: "classic", name: "Classic", white: "\u2658", black: "\u265E" },
  { id: "solid", name: "Filled", white: "\u265E", black: "\u265E" },
  { id: "bold", name: "Bold", white: "\u265C", black: "\u265C" },
  { id: "soft", name: "Soft", white: "\u2657", black: "\u265D" },
] as const;
const pieceSizes = [
  { id: "compact", name: "Compact" },
  { id: "normal", name: "Normal" },
  { id: "large", name: "Large" },
  { id: "xl", name: "XL" },
] as const;
type PieceStyleId = (typeof pieceStyles)[number]["id"];
type PieceSizeId = (typeof pieceSizes)[number]["id"];
const themeStorageKey = "thejimmyapp.boardTheme";
const pieceStyleStorageKey = "thejimmyapp.pieceStyle";
const pieceSizeStorageKey = "thejimmyapp.pieceSize";

const initialBoardTheme = (): BoardThemeId => {
  const saved = localStorage.getItem(themeStorageKey);
  return boardThemes.some((theme) => theme.id === saved) ? saved as BoardThemeId : "slate";
};

const initialPieceStyle = (): PieceStyleId => {
  const saved = localStorage.getItem(pieceStyleStorageKey);
  return pieceStyles.some((style) => style.id === saved) ? saved as PieceStyleId : "solid";
};

const initialPieceSize = (): PieceSizeId => {
  const saved = localStorage.getItem(pieceSizeStorageKey);
  return pieceSizes.some((size) => size.id === saved) ? saved as PieceSizeId : "normal";
};

export default function App() {
  const store = useCoachStore();
  const { roomId, username, setRoom } = store;
  const joinedRoomRef = useRef<string | null>(null);
  const [boardTheme, setBoardTheme] = useState<BoardThemeId>(initialBoardTheme);
  const [pieceStyle, setPieceStyle] = useState<PieceStyleId>(initialPieceStyle);
  const [pieceSize, setPieceSize] = useState<PieceSizeId>(initialPieceSize);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(!store.username && !store.roomId);
  const [usernameDraft, setUsernameDraft] = useState(store.username);
  const [authenticatedOpen, setAuthenticatedOpen] = useState(false);
  const [curlText, setCurlText] = useState("");
  const gamesQuery = useQuery({ queryKey: ["games", store.username], queryFn: () => api.games(store.username), enabled: Boolean(store.username) });
  const roomQuery = useQuery({ queryKey: ["room", store.roomId], queryFn: () => api.room(store.roomId as string), enabled: Boolean(store.roomId) });
  useEffect(() => { if (gamesQuery.data) useCoachStore.getState().setGames(gamesQuery.data.games); }, [gamesQuery.data]);
  useEffect(() => { if (roomQuery.data) void applyRoomSnapshot(roomQuery.data.snapshot, roomQuery.data.game_id); }, [roomQuery.data]);
  const gameMutation = useMutation({ mutationFn: api.game, onSuccess: store.setGame });
  const connectMutation = useMutation({ mutationFn: api.connectChessCom, onSuccess: () => gamesQuery.refetch() });
  const enrichMutation = useMutation({ mutationFn: () => api.enrichChessCom(usernameDraft.trim(), curlText), onSuccess: () => { setCurlText(""); gamesQuery.refetch(); } });
  const roomMutation = useMutation({ mutationFn: () => api.createRoom(store.game?.game.id), onSuccess: async (room) => {
    joinedRoomRef.current = room.id;
    const joined = await api.joinRoom(room.id, store.username || "Coach"); store.setRoom(room.id, joined.client_id, joined.display_name); history.replaceState(null, "", room.share_path); connectRoomSocket(room.id, joined.client_id, joined.display_name);
  }});
  useEffect(() => {
    if (!roomId || joinedRoomRef.current === roomId) return;
    const currentRoomId = roomId;
    joinedRoomRef.current = currentRoomId;
    void api.joinRoom(currentRoomId, username || "Guest").then((joined) => {
      setRoom(currentRoomId, joined.client_id, joined.display_name);
      connectRoomSocket(currentRoomId, joined.client_id, joined.display_name);
    });
  }, [roomId, username, setRoom]);

  const boardA = store.explorationPositions?.boardA ?? currentPosition(store.game, store.globalPly, "A");
  const boardB = store.explorationPositions?.boardB ?? currentPosition(store.game, store.globalPly, "B");
  const userIsWhite = store.game?.game.user_color !== "black";
  const players = store.game?.players;
  const secondBoardAvailable = Boolean(store.game?.second_board_available);
  const selectGame = (game: GameSummary) => { gameMutation.mutate(game.id); sendRoomEvent("game.select", { game_id: game.id }); };
  const connect = (event: FormEvent) => { event.preventDefault(); const clean = usernameDraft.trim(); if (!clean) return; store.setUsername(clean); connectMutation.mutate(clean); };
  const chooseBoardTheme = (theme: BoardThemeId) => {
    setBoardTheme(theme);
    localStorage.setItem(themeStorageKey, theme);
  };
  const choosePieceStyle = (style: PieceStyleId) => {
    setPieceStyle(style);
    localStorage.setItem(pieceStyleStorageKey, style);
  };
  const choosePieceSize = (size: PieceSizeId) => {
    setPieceSize(size);
    localStorage.setItem(pieceSizeStorageKey, size);
  };
  const viewerCount = store.participants.length || (store.roomId ? 1 : 0);

  return (
    <main className="app-shell" data-board-theme={boardTheme} data-piece-style={pieceStyle} data-piece-size={pieceSize}>
      <div className="small-screen-message">The Jimmy App is optimized for desktop screens of 1366×768 or larger.</div>
      <header className="app-header">
        <div className="brand"><span className="brand-mark">J</span><div><strong>THE JIMMY APP</strong><small>COLLABORATIVE BUGHOUSE COACH</small></div></div>
        <div className={`mode-badge ${store.mode}`}><span />{store.mode === "review" ? `GAME REVIEW · MOVE ${store.globalPly}` : `EXPLORATION · FROM MOVE ${store.explorationStartPly} · ${store.variationMoves.join(" ")}`}</div>
        <div className="header-actions">
          {store.mode === "exploration" && <button className="icon-button" title="Undo exploration move" onClick={store.undoExploration}><Undo2 size={16} /></button>}
          {store.explorationFuture.length > 0 && <button className="icon-button" title="Redo exploration move" onClick={store.redoExploration}><Redo2 size={16} /></button>}
          {store.mode === "exploration" && <button className="return-game" onClick={() => { store.returnToGame(); sendRoomEvent("variation.return_to_game", {}); }}><RotateCcw size={16} /> Return to move {store.explorationStartPly}</button>}
          <button onClick={() => roomMutation.mutate()}><UserRoundPlus size={16} /> {store.roomId ? "Room active" : "Invite partner"}</button>
          {store.roomId && <button className="icon-button" title="Copy room link" onClick={() => navigator.clipboard.writeText(location.href)}><Copy size={16} /></button>}
          {store.roomId && <span className="viewer-pill" title={store.participants.map((item) => item.display_name).join(", ") || "Waiting for viewers"}><Users size={14} /> {viewerCount}</span>}
          <button className="icon-button" title="Board settings" onClick={() => setSettingsOpen(true)}><Settings size={16} /></button>
          <button className="connect-button" onClick={() => setConnectOpen(true)}><Radio size={15} /> {store.username || "Connect Chess.com"}</button>
        </div>
      </header>
      <section className="workspace">
        <div className="boards-zone">
          <BoardPanel boardId="A" position={boardA} orientation={userIsWhite ? "white" : "black"} pieceStyle={pieceStyle} title="BOARD A · YOUR BOARD" playerTop={userIsWhite ? players?.board_a_black ?? "Opponent" : players?.board_a_white ?? "Opponent"} playerBottom={userIsWhite ? players?.board_a_white ?? store.username : players?.board_a_black ?? store.username} />
          <BoardPanel boardId="B" position={boardB} orientation={userIsWhite ? "black" : "white"} pieceStyle={pieceStyle} title="BOARD B · PARTNER BOARD" playerTop={secondBoardAvailable ? (userIsWhite ? players?.board_b_white ?? "Opponent partner" : players?.board_b_black ?? "Opponent partner") : "Opponent partner"} playerBottom={secondBoardAvailable ? (userIsWhite ? players?.board_b_black ?? "Partner" : players?.board_b_white ?? "Partner") : "Partner"} />
          {!store.game && <div className="empty-workspace"><strong>Select a Bughouse game</strong><span>Choose a game from the Games panel.</span></div>}
        </div>
        <SidePanel onSelectGame={selectGame} loadingGame={gameMutation.isPending} />
      </section>
      <Timeline />
      {connectOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="connect-modal" onSubmit={connect}>
            <button type="button" className="modal-close" onClick={() => setConnectOpen(false)} aria-label="Close"><X /></button>
            <span className="modal-kicker">CHESS.COM CONNECTION</span>
            <h1>Connect your games</h1>
            <p>Public archives load from a username. Chess.com login access is needed only to recover partner boards that the public API omits.</p>
            <label>Chess.com username<input autoFocus value={usernameDraft} onChange={(event) => setUsernameDraft(event.target.value)} pattern="[A-Za-z0-9_-]+" minLength={2} maxLength={25} /></label>
            {connectMutation.error && <div className="form-error">{connectMutation.error.message}</div>}
            <button className="primary" disabled={connectMutation.isPending}>{connectMutation.isPending ? "Loading public archives…" : "Load public games"}</button>
            <button type="button" className="authenticated-toggle" onClick={() => setAuthenticatedOpen(!authenticatedOpen)}>{authenticatedOpen ? "Hide partner-board connector" : "Load complete two-board data"}</button>
            {authenticatedOpen && (
              <section className="authenticated-panel">
                <strong>Partner-board connector</strong>
                <p>Open Chess.com and sign in. In Network, copy one <code>pgn-info</code> request as cURL (bash), then paste it here. It is used once and never stored.</p>
                <a href="https://www.chess.com/games/archive" target="_blank" rel="noreferrer">Open Chess.com archive</a>
                <textarea value={curlText} onChange={(event) => setCurlText(event.target.value)} placeholder="Paste the pgn-info cURL request" spellCheck={false} />
                {enrichMutation.error && <div className="form-error">{enrichMutation.error.message}</div>}
                {enrichMutation.data && <div className="connector-success">Loaded {enrichMutation.data.enriched} complete games. Credentials stored: no.</div>}
                <button type="button" className="primary" disabled={curlText.length < 40 || enrichMutation.isPending} onClick={() => enrichMutation.mutate()}>{enrichMutation.isPending ? "Loading both boards…" : "Load both boards"}</button>
              </section>
            )}
            {store.username && <button type="button" className="text-button" onClick={() => setConnectOpen(false)}><LogOut size={15} /> Continue as {store.username}</button>}
          </form>
        </div>
      )}
      {settingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="settings-modal" role="dialog" aria-label="Board settings">
            <button type="button" className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close"><X /></button>
            <span className="modal-kicker">BOARD SETTINGS</span>
            <h1>Board style</h1>
            <div className="theme-grid">
              {boardThemes.map((theme) => {
                const active = theme.id === boardTheme;
                const previewStyle = {
                  "--preview-light": theme.light,
                  "--preview-dark": theme.dark,
                  "--preview-white": theme.white,
                  "--preview-black": theme.black,
                } as CSSProperties;
                return (
                  <button key={theme.id} className={`theme-card ${active ? "active" : ""}`} type="button" onClick={() => chooseBoardTheme(theme.id)}>
                    <span className="theme-preview" style={previewStyle}>
                      <i />
                      <i />
                      <i />
                      <i />
                      <b className="preview-white">{"\u2658"}</b>
                      <b className="preview-black">{"\u265E"}</b>
                    </span>
                    <span>{theme.name}</span>
                    {active && <Check size={14} />}
                  </button>
                );
              })}
            </div>
            <h2>Piece style</h2>
            <div className="piece-style-grid">
              {pieceStyles.map((style) => (
                <button key={style.id} className={`piece-style-card ${style.id === pieceStyle ? "active" : ""}`} type="button" onClick={() => choosePieceStyle(style.id)}>
                  <span className="piece-style-preview"><b className="preview-white">{style.white}</b><b className="preview-black">{style.black}</b></span>
                  <span>{style.name}</span>
                  {style.id === pieceStyle && <Check size={14} />}
                </button>
              ))}
            </div>
            <h2>Piece size</h2>
            <div className="segmented-control" role="group" aria-label="Piece size">
              {pieceSizes.map((size) => <button key={size.id} className={pieceSize === size.id ? "active" : ""} type="button" onClick={() => choosePieceSize(size.id)}>{size.name}</button>)}
            </div>
            <button className="settings-done" type="button" onClick={() => setSettingsOpen(false)}><Palette size={15} /> Apply style</button>
          </section>
        </div>
      )}
    </main>
  );
}
