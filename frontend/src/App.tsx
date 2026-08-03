import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Bot, Check, Copy, FileInput, LogOut, Palette, Radio, Redo2, RotateCcw, Settings, ShieldCheck, Swords, Undo2, UserRoundPlus, Users, X } from "lucide-react";
import { CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { bmachoUrlForGameId, bmachoUrlFromChessComUrl } from "./chesscomGameUrl";
import { BoardPanel } from "./components/BoardPanel";
import { LegalLinks } from "./components/LegalLinks";
import { ReviewLesson } from "./components/ReviewLesson";
import { ReviewStart } from "./components/ReviewStart";
import { SidePanel } from "./components/SidePanel";
import { StatsDashboard } from "./components/StatsDashboard";
import { TeamCoach } from "./components/TeamCoach";
import { Timeline } from "./components/Timeline";
import { applyRoomSnapshot, connectRoomSocket, sendRoomEvent } from "./socket";
import { currentPosition, useCoachStore } from "./store";
import { replayNotices } from "./replayIntegrity";
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
  const queryClient = useQueryClient();
  const { roomId, username, setGame, setRoom } = store;
  const joinedRoomRef = useRef<string | null>(null);
  const [boardTheme, setBoardTheme] = useState<BoardThemeId>(initialBoardTheme);
  const [pieceStyle, setPieceStyle] = useState<PieceStyleId>(initialPieceStyle);
  const [pieceSize, setPieceSize] = useState<PieceSizeId>(initialPieceSize);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const [view, setView] = useState<"review" | "stats">("review");
  const [connectOpen, setConnectOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(store.username);
  const [manualImportOpen, setManualImportOpen] = useState(false);
  const [boardAPgn, setBoardAPgn] = useState("");
  const [boardBPgn, setBoardBPgn] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [reviewGameId, setReviewGameId] = useState<number | null>(() => {
    if (store.roomId) return null;
    const value = new URLSearchParams(location.search).get("game");
    if (!value || !/^[1-9][0-9]*$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  });
  const openGame = useCallback((game: Parameters<typeof setGame>[0]) => {
    setGame(game);
    setArchiveOpen(false);
    setConnectOpen(false);
    setView("review");
    const gameId = game?.game.id;
    if (!gameId || useCoachStore.getState().roomId) return;
    const browserUrl = new URL(location.href);
    browserUrl.searchParams.set("game", String(gameId));
    history.replaceState(null, "", `${browserUrl.pathname}${browserUrl.search}${browserUrl.hash}`);
    setReviewGameId(gameId);
  }, [setGame]);
  const gamesQuery = useQuery({ queryKey: ["games", store.username], queryFn: () => api.games(store.username), enabled: Boolean(store.username) });
  const roomQuery = useQuery({ queryKey: ["room", store.roomId], queryFn: () => api.room(store.roomId as string), enabled: Boolean(store.roomId) });
  const restoredGameQuery = useQuery({ queryKey: ["game", reviewGameId], queryFn: () => api.game(reviewGameId as number), enabled: Boolean(reviewGameId && !store.roomId && !store.game) });
  useEffect(() => { if (gamesQuery.data) useCoachStore.getState().setGames(gamesQuery.data.games); }, [gamesQuery.data]);
  useEffect(() => { if (roomQuery.data) void applyRoomSnapshot(roomQuery.data.snapshot, roomQuery.data.game_id); }, [roomQuery.data]);
  useEffect(() => { if (restoredGameQuery.data) openGame(restoredGameQuery.data); }, [openGame, restoredGameQuery.data]);
  const gameMutation = useMutation({ mutationFn: api.game, onSuccess: openGame });
  const resolveMutation = useMutation({
    mutationFn: ({ url, username }: { url: string; username: string }) => api.resolveGame(url, username || undefined),
    onSuccess: (resolved, variables) => {
      if (variables.username) store.setUsername(variables.username);
      openGame(resolved.game);
    },
  });
  const connectMutation = useMutation({
    mutationFn: api.connectChessCom,
    onSuccess: () => {
      setConnectOpen(false);
      setArchiveOpen(true);
      return queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
  const importMutation = useMutation({
    mutationFn: ({ username, boardA, boardB }: { username: string; boardA: string; boardB: string }) => api.importPgn(username, boardA, boardB),
    onSuccess: async (imported) => {
      setBoardAPgn("");
      setBoardBPgn("");
      const importedGame = await api.game(imported.game_id);
      openGame(importedGame);
      await queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });
  const roomMutation = useMutation({ mutationFn: () => api.createRoom(store.game?.game.id), onSuccess: async (room) => {
    joinedRoomRef.current = room.id;
    setShareCopied(false);
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
  const integrityNotices = replayNotices(store.game, boardA, boardB);
  const userIsWhite = store.game?.game.user_color !== "black";
  const players = store.game?.players;
  const secondBoardAvailable = Boolean(store.game?.second_board_available);
  const selectGame = (game: GameSummary) => { gameMutation.mutate(game.id); sendRoomEvent("game.select", { game_id: game.id }); };
  const openImport = () => { setManualImportOpen(true); setConnectOpen(true); };
  const connect = (event: FormEvent) => { event.preventDefault(); const clean = usernameDraft.trim(); if (!clean) return; store.setUsername(clean); connectMutation.mutate(clean); };
  const importCompleteGame = (event: FormEvent) => {
    event.preventDefault();
    const clean = usernameDraft.trim();
    if (!clean || !boardAPgn.trim() || !boardBPgn.trim()) return;
    store.setUsername(clean);
    importMutation.mutate({ username: clean, boardA: boardAPgn.trim(), boardB: boardBPgn.trim() });
  };
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
  const inviteUrl = store.roomId ? `${location.origin}/?room=${store.roomId}` : "";
  const copyInviteLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  };
  const resolutionError = resolveMutation.error instanceof Error ? resolveMutation.error.message : undefined;
  const resolutionFallbackUrl = resolveMutation.error instanceof ApiError && resolveMutation.error.externalGameId
    ? bmachoUrlForGameId(resolveMutation.error.externalGameId)
    : null;
  const currentGameFallbackUrl = bmachoUrlFromChessComUrl(store.game?.game.url);
  const showReviewStart = !store.game && !store.roomId && !archiveOpen;
  return (
    <main className={`app-shell ${view === "stats" ? "stats-view" : ""} ${showReviewStart ? "review-entry-shell" : ""}`} data-board-theme={boardTheme} data-piece-style={pieceStyle} data-piece-size={pieceSize}>
      <div className="small-screen-message">The Jimmy App is optimized for desktop screens of 1366×768 or larger.</div>
      <header className="app-header">
        <div className="brand"><span className="brand-mark">J</span><div><strong>THE JIMMY APP</strong><small>COLLABORATIVE BUGHOUSE COACH</small></div></div>
        <nav className="primary-nav" aria-label="Main views">
          <button className={view === "review" ? "active" : ""} onClick={() => setView("review")}><Swords size={14} />Review</button>
          <button className={view === "stats" ? "active" : ""} onClick={() => setView("stats")}><BarChart3 size={14} />Statistics</button>
        </nav>
        <div className="header-actions">
          <LegalLinks />
          {store.mode === "exploration" && <button className="icon-button" title="Undo exploration move" onClick={store.undoExploration}><Undo2 size={16} /></button>}
          {store.explorationFuture.length > 0 && <button className="icon-button" title="Redo exploration move" onClick={store.redoExploration}><Redo2 size={16} /></button>}
          {store.mode === "exploration" && <button className="return-game" onClick={() => { store.returnToGame(); sendRoomEvent("variation.return_to_game", {}); }}><RotateCcw size={16} /> Return to move {store.explorationStartPly}</button>}
          <button className="share-button" disabled={roomMutation.isPending} onClick={() => { if (store.roomId) void copyInviteLink(); else roomMutation.mutate(); }} title={store.roomId ? inviteUrl : "Create a shared review room"}>{store.roomId ? <Copy size={16} /> : <UserRoundPlus size={16} />} {store.roomId ? "Copy invite link" : roomMutation.isPending ? "Creating room..." : "Invite partner"}</button>
          {shareCopied && <span className="copy-confirm">Link copied</span>}
          {roomMutation.error && <span className="room-error" title={roomMutation.error.message}>Invite failed</span>}
          {store.roomId && <span className="viewer-pill" title={store.participants.map((item) => item.display_name).join(", ") || "Waiting for viewers"}><Users size={14} /> {viewerCount}</span>}
          {view === "review" && <button className="coach-button" disabled={!store.game} title="Run the coupled Bughouse coaching pipeline" onClick={() => setCoachOpen(true)}><Bot size={16} /> Team Coach</button>}
          <button className="icon-button" title="Board settings" onClick={() => setSettingsOpen(true)}><Settings size={16} /></button>
          <button className="connect-button" onClick={() => setConnectOpen(true)}><Radio size={15} /> {store.username || "Connect Chess.com"}</button>
        </div>
      </header>
      {view === "review" ? <><section className={`workspace ${showReviewStart ? "review-entry-workspace" : ""}`}>
        {!showReviewStart && <SidePanel onSelectGame={selectGame} loadingGame={gameMutation.isPending} />}
        <div className={`boards-zone ${store.game ? "has-game" : ""} ${showReviewStart ? "review-entry-zone" : ""}`}>
          {showReviewStart && (
            <ReviewStart
              defaultUsername={store.username}
              pending={resolveMutation.isPending || restoredGameQuery.isFetching}
              errorMessage={resolutionError ?? (restoredGameQuery.error instanceof Error ? restoredGameQuery.error.message : undefined)}
              fallbackUrl={resolutionFallbackUrl}
              onReview={(url, requestedUsername) => resolveMutation.mutate({ url, username: requestedUsername })}
              onBrowseGames={() => setArchiveOpen(true)}
              onImportBothBoards={openImport}
            />
          )}
          {store.game && (
            <div className="review-context">
              {store.game.outcome && (
                <div className={`review-summary ${store.game.game.result}`} role="status">
                  <span>GAME RESULT</span>
                  <strong>{store.game.outcome.summary}</strong>
                  <small>{store.game.outcome.detail}</small>
                </div>
              )}
              {store.game.lesson && (
                <ReviewLesson
                  lesson={store.game.lesson}
                  onReview={(globalPly) => {
                    store.seek(globalPly);
                    sendRoomEvent("timeline.seek", { global_ply: globalPly });
                  }}
                />
              )}
              {integrityNotices.length > 0 && (
                <div className="replay-integrity" role="status">
                  <AlertTriangle size={15} />
                  <strong>REPLAY LIMITS</strong>
                  <span>{integrityNotices.join(" ")}</span>
                </div>
              )}
            </div>
          )}
          {!showReviewStart && <div className="boards-grid">
            <BoardPanel boardId="A" position={boardA} orientation={userIsWhite ? "white" : "black"} pieceStyle={pieceStyle} title="BOARD A · YOUR BOARD" playerTop={userIsWhite ? players?.board_a_black ?? "Opponent" : players?.board_a_white ?? "Opponent"} playerBottom={userIsWhite ? players?.board_a_white ?? store.username : players?.board_a_black ?? store.username} />
            <BoardPanel boardId="B" position={boardB} orientation={userIsWhite ? "black" : "white"} pieceStyle={pieceStyle} title="BOARD B · PARTNER BOARD" playerTop={secondBoardAvailable ? (userIsWhite ? players?.board_b_white ?? "Diagonal Opponent Unknown" : players?.board_b_black ?? "Diagonal Opponent Unknown") : "Diagonal Opponent Unknown"} playerBottom={secondBoardAvailable ? (userIsWhite ? players?.board_b_black ?? "Partner Unknown" : players?.board_b_white ?? "Partner Unknown") : "Partner Unknown"} unavailable={Boolean(store.game) && !secondBoardAvailable} onImportBothBoards={openImport} externalFallbackUrl={currentGameFallbackUrl} />
          </div>}
          {!store.game && !showReviewStart && <div className="empty-workspace"><strong>Select a Bughouse game</strong><span>Choose a game from the Games panel.</span></div>}
        </div>
      </section>
      {store.game && <Timeline />}
      <TeamCoach open={coachOpen} onClose={() => setCoachOpen(false)} boardA={boardA} boardB={boardB} /></> : <StatsDashboard username={store.username} />}
      {connectOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="connect-modal" onSubmit={connect}>
            <button type="button" className="modal-close" onClick={() => setConnectOpen(false)} aria-label="Close"><X /></button>
            <span className="modal-kicker">CHESS.COM CONNECTION</span>
            <h1>Connect your games</h1>
            <p>Load public games by username, or paste both board PGNs for a complete credential-free replay.</p>
            <label>Chess.com username<input autoFocus value={usernameDraft} onChange={(event) => setUsernameDraft(event.target.value)} pattern="[A-Za-z0-9_-]+" minLength={2} maxLength={25} /></label>
            {connectMutation.error && <div className="form-error">{connectMutation.error.message}</div>}
            <button className="primary" disabled={connectMutation.isPending}>{connectMutation.isPending ? "Loading public archives…" : "Load public games"}</button>
            <button type="button" className="authenticated-toggle safe-import-toggle" onClick={() => setManualImportOpen(!manualImportOpen)}>
              <FileInput size={15} /> {manualImportOpen ? "Hide PGN import" : "Import two-board PGNs"}
            </button>
            {manualImportOpen && (
              <section className="authenticated-panel safe-import-panel">
                <strong><ShieldCheck size={15} /> Credential-free two-board import</strong>
                <p>Paste completed PGNs for both boards from the same Bughouse game. Each PGN must contain a final result; clock comments are used to synchronize the boards when present.</p>
                <label>Board A PGN<textarea aria-label="Board A PGN" value={boardAPgn} onChange={(event) => setBoardAPgn(event.target.value)} placeholder={"[Variant \"Bughouse\"]\n\n1. e4 …"} spellCheck={false} /></label>
                <label>Board B PGN<textarea aria-label="Board B PGN" value={boardBPgn} onChange={(event) => setBoardBPgn(event.target.value)} placeholder={"[Variant \"Bughouse\"]\n\n1. d4 …"} spellCheck={false} /></label>
                {importMutation.error && <div className="form-error">{importMutation.error.message}</div>}
                {importMutation.data && <div className="connector-success">Complete two-board game imported. No Chess.com credentials were used or stored.</div>}
                <button type="button" className="primary" disabled={boardAPgn.trim().length < 8 || boardBPgn.trim().length < 8 || !usernameDraft.trim() || importMutation.isPending} onClick={importCompleteGame}>
                  {importMutation.isPending ? "Importing both boards…" : "Import complete game"}
                </button>
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
