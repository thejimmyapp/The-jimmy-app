import { useMemo } from "react";
import { reconstructGuestMatch } from "../bughouseDecoder";
import fixtures from "../fixtures/guest-match-replays.json";
import { replayToParity } from "../parity/adapters/replayToParity";
import { StudyWorkspace } from "../parity/workspace/StudyWorkspace";
import { CollaboratePanel } from "../components/CollaboratePanel";
import { useCoachStore } from "../store";
import type { CallbackReplayBoard, GuestMatchReplaySource, NormalizedMatch } from "../types";

interface ReplayFixture {
  seed: string;
  boards: { A: CallbackReplayBoard; B: CallbackReplayBoard };
}

function normalizedMatch(boards: ReplayFixture["boards"]): NormalizedMatch {
  const a = boards.A; const b = boards.B;
  return {
    game_ids: { A: a.id, B: b.id }, end_time: 1_786_320_000,
    seats: {
      "A-white": { name: String(a.headers.White ?? "A White"), rating: Number(a.headers.WhiteElo ?? 2000) },
      "A-black": { name: String(a.headers.Black ?? "A Black"), rating: Number(a.headers.BlackElo ?? 1900) },
      "B-white": { name: String(b.headers.White ?? "B White"), rating: Number(b.headers.WhiteElo ?? 1800) },
      "B-black": { name: String(b.headers.Black ?? "B Black"), rating: Number(b.headers.BlackElo ?? 1700) },
    },
    ply_counts: { A: a.plyCount, B: b.plyCount }, decisive_board: "A", loser_seat: "A-black", action: "checkmated",
    highest_rated: { name: String(a.headers.White ?? "A White"), rating: Number(a.headers.WhiteElo ?? 2000), seat: "A-white", outcome: "WON" },
    loser_relative_to_highest: "oppo",
  };
}

function hasPocket(frame: ReturnType<typeof reconstructGuestMatch>["game"]["timeline"][number]) {
  return [frame.board_a.white_pocket, frame.board_a.black_pocket, frame.board_b.white_pocket, frame.board_b.black_pocket].some((value) => value && value !== "-");
}

export function StudyPreview({ fixtureIndex, requestedPly, frame, chrome = false, showEvaluation = true }: { fixtureIndex: number; requestedPly: number; frame: { width: number; height: number } | null; chrome?: boolean; showEvaluation?: boolean }) {
  const fixture = (fixtures.matches as unknown as ReplayFixture[])[fixtureIndex];
  if (!fixture) throw new Error(`Unknown study fixture ${fixtureIndex}`);
  const game = useMemo(() => reconstructGuestMatch({ match: normalizedMatch(fixture.boards), boards: fixture.boards } satisfies GuestMatchReplaySource).game, [fixture]);
  const lastPly = game.timeline.length - 1;
  const rowKey = (item: (typeof game.timeline)[number]) => `${Math.floor((Math.max(1, item.local_ply) + 1) / 2)}:${item.local_ply % 2}`;
  const pocketPlies = game.timeline.filter((item, index) => hasPocket(item) && !game.timeline.slice(index + 1).some((later) => rowKey(later) === rowKey(item))).map((item) => item.global_ply);
  const suggestedMid = pocketPlies.sort((left, right) => Math.abs(left - lastPly / 2) - Math.abs(right - lastPly / 2))[0];
  const selectedPly = Math.max(0, Math.min(lastPly, requestedPly));
  const selected = game.timeline[selectedPly];
  const expected = replayToParity(selected.board_a);
  useCoachStore.setState(chrome ? {
    game, mode: "review", globalPly: selectedPly, roomId: "preview-room", displayName: "Jimmy",
    participants: [{ client_id: "jimmy", display_name: "Jimmy" }, { client_id: "partner", display_name: "Partner" }],
    messages: [
      { id: "preview-1", author: "Jimmy", content: "Try N@h6 before the exchange.", board: "A", ply: selectedPly, timestamp: "2026-09-09T01:00:00Z", sequence: 1 },
      { id: "preview-2", author: "Partner", content: "I see the fork on the other board.", board: "A", ply: selectedPly, timestamp: "2026-09-09T01:00:01Z", sequence: 2 },
    ],
  } : { game, mode: "review", globalPly: selectedPly });
  Object.assign(window, { __STUDY_PREVIEW__: { fixtureIndex, seed: fixture.seed, game, selectedPly, suggestedMid, lastPly, expected } });
  const collaborate = chrome ? <><button className="share-button" type="button">Invite partner</button><span className="viewer-pill">1</span><button className="coach-button" type="button">Team Coach</button></> : undefined;
  return <div className="study-preview-frame" style={frame ? { width: frame.width, height: frame.height } : undefined}><StudyWorkspace collaborate={collaborate} collaboratePanel={chrome ? <CollaboratePanel active /> : undefined} showEvaluation={showEvaluation} /></div>;
}
