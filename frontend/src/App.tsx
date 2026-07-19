import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, LogOut, Radio, RotateCcw, Undo2, UserRoundPlus, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "./api";
import { BoardPanel } from "./components/BoardPanel";
import { SidePanel } from "./components/SidePanel";
import { Timeline } from "./components/Timeline";
import { connectRoomSocket, sendRoomEvent } from "./socket";
import { currentPosition, useCoachStore } from "./store";
import type { GameSummary } from "./types";

export default function App() {
  const store = useCoachStore();
  const [connectOpen, setConnectOpen] = useState(!store.username);
  const [usernameDraft, setUsernameDraft] = useState(store.username);
  const [authenticatedOpen, setAuthenticatedOpen] = useState(false);
  const [curlText, setCurlText] = useState("");
  const gamesQuery = useQuery({ queryKey: ["games", store.username], queryFn: () => api.games(store.username), enabled: Boolean(store.username) });
  useEffect(() => { if (gamesQuery.data) useCoachStore.getState().setGames(gamesQuery.data.games); }, [gamesQuery.data]);
  const gameMutation = useMutation({ mutationFn: api.game, onSuccess: store.setGame });
  const connectMutation = useMutation({ mutationFn: api.connectChessCom, onSuccess: () => gamesQuery.refetch() });
  const enrichMutation = useMutation({ mutationFn: () => api.enrichChessCom(usernameDraft.trim(), curlText), onSuccess: () => { setCurlText(""); gamesQuery.refetch(); } });
  const roomMutation = useMutation({ mutationFn: () => api.createRoom(store.game?.game.id), onSuccess: async (room) => {
    const joined = await api.joinRoom(room.id, store.username || "Coach"); store.setRoom(room.id, joined.client_id, joined.display_name); history.replaceState(null, "", room.share_path); connectRoomSocket(room.id, joined.client_id);
  }});
  useEffect(() => { if (store.roomId) connectRoomSocket(store.roomId, store.clientId); }, [store.roomId, store.clientId]);

  const boardA = store.explorationPositions?.boardA ?? currentPosition(store.game, store.globalPly, "A");
  const boardB = store.explorationPositions?.boardB ?? currentPosition(store.game, store.globalPly, "B");
  const userIsWhite = store.game?.game.user_color !== "black";
  const players = store.game?.players;
  const selectGame = (game: GameSummary) => { gameMutation.mutate(game.id); sendRoomEvent("game.select", { game_id: game.id }); };
  const connect = (event: FormEvent) => { event.preventDefault(); const clean = usernameDraft.trim(); if (!clean) return; store.setUsername(clean); connectMutation.mutate(clean); };

  return (
    <main className="app-shell">
      <div className="small-screen-message">Bughouse AI Coach is optimized for desktop screens of 1366×768 or larger.</div>
      <header className="app-header">
        <div className="brand"><span className="brand-mark">B</span><div><strong>BUGHOUSE <em>AI</em> COACH</strong><small>COLLABORATIVE REVIEW ROOM</small></div></div>
        <div className={`mode-badge ${store.mode}`}><span />{store.mode === "review" ? `GAME REVIEW · MOVE ${store.globalPly}` : `EXPLORATION · FROM MOVE ${store.explorationStartPly} · ${store.variationMoves.join(" ")}`}</div>
        <div className="header-actions">
          {store.mode === "exploration" && <button className="icon-button" title="Undo exploration move" onClick={store.undoExploration}><Undo2 size={16} /></button>}
          {store.mode === "exploration" && <button className="return-game" onClick={() => { store.returnToGame(); sendRoomEvent("variation.return_to_game", {}); }}><RotateCcw size={16} /> Return to move {store.explorationStartPly}</button>}
          <button onClick={() => roomMutation.mutate()}><UserRoundPlus size={16} /> {store.roomId ? "Room active" : "Invite partner"}</button>
          {store.roomId && <button className="icon-button" title="Copy room link" onClick={() => navigator.clipboard.writeText(location.href)}><Copy size={16} /></button>}
          <button className="connect-button" onClick={() => setConnectOpen(true)}><Radio size={15} /> {store.username || "Connect Chess.com"}</button>
        </div>
      </header>
      <section className="workspace">
        <div className="boards-zone">
          <BoardPanel boardId="A" position={boardA} orientation={userIsWhite ? "white" : "black"} title="BOARD A · YOUR BOARD" playerTop={userIsWhite ? players?.board_a_black ?? "Opponent" : players?.board_a_white ?? "Opponent"} playerBottom={userIsWhite ? players?.board_a_white ?? store.username : players?.board_a_black ?? store.username} />
          <BoardPanel boardId="B" position={boardB} orientation={userIsWhite ? "black" : "white"} title="BOARD B · PARTNER BOARD" playerTop={userIsWhite ? players?.board_b_white ?? "Opponent partner" : players?.board_b_black ?? "Opponent partner"} playerBottom={userIsWhite ? players?.board_b_black ?? "Partner" : players?.board_b_white ?? "Partner"} />
          {!store.game && <div className="empty-workspace"><strong>Select a Bughouse game</strong><span>Choose a game from the Games panel.</span></div>}
          {store.game && !store.game.second_board_available && <div className="second-board-warning">Second board unavailable · import authenticated pgn-info or a second-board PGN</div>}
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
    </main>
  );
}
