from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.chesscom import ChessComService
from backend.config import get_settings
from backend.database import Base, SessionLocal, engine, get_session
from backend.models import ChatMessage, ReviewRoom, SharedNote
from backend.exploration import apply_exploration_move, apply_exploration_san_move
from backend.rooms import room_hub
from backend.puzzles import check_move, get_puzzle, next_move, solution
from backend.schemas import (
    AnalysisRequest,
    ChessComConnectRequest,
    ExplorationMoveRequest,
    ExplorationSanMoveRequest,
    NoteCreateRequest,
    PgnImportRequest,
    PuzzleHistoryRequest,
    RoomCreateRequest,
    RoomJoinRequest,
    SocketEvent,
)
from thejimmyapp.chesscom_api import parse_pgn_headers
from thejimmyapp.game_completion import is_completed_pgn, pgn_result, player_results
from backend.services import AnalysisJobs, GameService


settings = get_settings()
Base.metadata.create_all(bind=engine)
games = GameService(settings.legacy_database_path)
analysis_jobs = AnalysisJobs(settings, games)
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def _is_disk_full_error(exc: Exception) -> bool:
    return "disk is full" in str(exc).lower() or "database or disk is full" in str(exc).lower()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "thejimmyapp"}


@app.post("/api/chesscom/connect")
async def connect_chesscom(request: ChessComConnectRequest) -> dict[str, object]:
    service = ChessComService(settings)
    try:
        profile, imported = await service.connect(request.username)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    stored = sum(games.db.upsert_game(request.username, game) for game in imported)
    return {
        "username": request.username,
        "profile": {"avatar": profile.get("avatar"), "url": profile.get("url")},
        "public_profile_connected": True,
        "bughouse_games_found": len(imported),
        "new_games_stored": stored,
    }


@app.get("/api/chesscom/{username}/bughouse-games")
def list_bughouse_games(username: str, limit: int = Query(default=500, ge=1, le=5000)) -> dict[str, object]:
    return {"username": username, "games": games.list_games(username, limit)}


@app.get("/api/games/{game_id}")
def get_game(game_id: int) -> dict[str, object]:
    if games.db.get_game(game_id) and not games.is_completed_game(game_id):
        raise HTTPException(status_code=409, detail="Only completed games can be reviewed")
    payload = games.get_game_payload(game_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Game not found")
    return payload


@app.post("/api/games/import-pgn")
def import_pgn(request: PgnImportRequest) -> dict[str, object]:
    if not is_completed_pgn(request.pgn):
        raise HTTPException(
            status_code=422,
            detail='Board A PGN must be completed and contain Result "1-0", "0-1", or "1/2-1/2"',
        )
    if request.second_board_pgn and not is_completed_pgn(request.second_board_pgn):
        raise HTTPException(
            status_code=422,
            detail='Board B PGN must be completed and contain Result "1-0", "0-1", or "1/2-1/2"',
        )
    headers = parse_pgn_headers(request.pgn)
    result = pgn_result(request.pgn)
    if result is None:
        raise HTTPException(status_code=422, detail="Board A PGN does not contain a terminal result")
    white_result, black_result = player_results(result)
    white_name = headers.get("White") or "White"
    black_name = headers.get("Black") or "Black"
    if request.username.lower() not in {white_name.lower(), black_name.lower()}:
        raise HTTPException(status_code=422, detail="The importing username must be a player on Board A")
    game_key = uuid4()
    raw_game = {
        "url": f"manual://{game_key}",
        "uuid": str(game_key),
        "pgn": request.pgn,
        "rules": "bughouse",
        "time_control": headers.get("TimeControl"),
        "white": {"username": white_name, "result": white_result},
        "black": {"username": black_name, "result": black_result},
    }
    if request.second_board_pgn:
        partner_headers = parse_pgn_headers(request.second_board_pgn)
        raw_game["bughousePartnerPgn"] = request.second_board_pgn
        raw_game["bughousePlayer1Name"] = white_name
        raw_game["bughousePlayer2Name"] = black_name
        raw_game["bughousePartnerPlayer1Name"] = partner_headers.get("White") or "White"
        raw_game["bughousePartnerPlayer2Name"] = partner_headers.get("Black") or "Black"
    created = games.db.upsert_game(request.username, raw_game)
    return {"created": created, "source": "manual", "second_board_supplied": bool(request.second_board_pgn)}


@app.get("/api/games/{game_id}/snapshot/{global_ply}")
def get_snapshot(game_id: int, global_ply: int) -> dict[str, object]:
    if not games.is_completed_game(game_id):
        raise HTTPException(status_code=409, detail="Only completed games can be reviewed")
    snapshot = games.snapshot(game_id, global_ply)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Game not found")
    return snapshot


@app.post("/api/exploration/move")
def exploration_move(request: ExplorationMoveRequest) -> dict[str, object]:
    if not request.from_square and not request.drop_piece:
        raise HTTPException(status_code=422, detail="A source square or drop piece is required")
    try:
        return apply_exploration_move(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/exploration/san")
def exploration_san_move(request: ExplorationSanMoveRequest) -> dict[str, object]:
    try:
        return apply_exploration_san_move(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/puzzles/{puzzle_id}")
def puzzle_detail(puzzle_id: str) -> dict[str, object]:
    puzzle = get_puzzle(puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    return puzzle.public_payload()


@app.post("/puzzle-move/{puzzle_id}")
def puzzle_move(puzzle_id: str, request: PuzzleHistoryRequest) -> dict[str, object]:
    puzzle = get_puzzle(puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    return check_move(puzzle, request.moves)


@app.post("/puzzle-next-move/{puzzle_id}")
def puzzle_next_move(puzzle_id: str, request: PuzzleHistoryRequest) -> dict[str, object]:
    puzzle = get_puzzle(puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    return next_move(puzzle, request.moves)


@app.post("/puzzle-solution/{puzzle_id}")
def puzzle_solution(puzzle_id: str, request: PuzzleHistoryRequest) -> dict[str, object]:
    puzzle = get_puzzle(puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Puzzle not found")
    return solution(puzzle, request.moves)


@app.post("/api/analysis", status_code=status.HTTP_202_ACCEPTED)
async def start_analysis(request: AnalysisRequest) -> dict[str, str]:
    if not games.is_completed_game(request.game_id):
        raise HTTPException(status_code=409, detail="Engine analysis is available only for stored completed games")
    job_id = await analysis_jobs.submit(
        request.game_id,
        request.global_ply,
        request.board,
        request.depth,
    )
    return {"job_id": job_id, "status": "queued", "engine": "Fairy-Stockfish"}


@app.get("/api/analysis/{job_id}")
def get_analysis(job_id: str) -> dict[str, object]:
    job = analysis_jobs.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    response = dict(job)
    if response.get("status") == "queued":
        queued = [key for key, value in analysis_jobs.jobs.items() if value.get("status") == "queued"]
        response["queue_position"] = queued.index(job_id) + 1 if job_id in queued else 1
    return response


@app.post("/api/rooms")
def create_room(request: RoomCreateRequest, session: Session = Depends(get_session)) -> dict[str, object]:
    room = ReviewRoom(game_id=request.game_id)
    try:
        session.add(room)
        session.commit()
        room_id = room.id
    except SQLAlchemyError as exc:
        session.rollback()
        if not _is_disk_full_error(exc):
            raise
        room_id = str(uuid4())
    room_hub.set_room_game(room_id, request.game_id)
    return {"id": room_id, "game_id": request.game_id, "share_path": f"/?room={room_id}"}


@app.get("/api/rooms/{room_id}")
def get_room(room_id: str, session: Session = Depends(get_session)) -> dict[str, object]:
    room = session.get(ReviewRoom, room_id)
    if not room and not room_hub.has_room(room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    snapshot = room_hub.snapshots.get(room_id, {})
    fallback_game_id = snapshot.get("room", {}).get("game_id") if isinstance(snapshot.get("room"), dict) else None
    return {"id": room_id, "game_id": room.game_id if room else fallback_game_id, "snapshot": snapshot}


@app.post("/api/rooms/{room_id}/join")
def join_room(room_id: str, request: RoomJoinRequest, session: Session = Depends(get_session)) -> dict[str, object]:
    if not session.get(ReviewRoom, room_id) and not room_hub.has_room(room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    return {"room_id": room_id, "client_id": str(uuid4()), "display_name": request.display_name}


@app.get("/api/rooms/{room_id}/notes")
def list_notes(room_id: str, session: Session = Depends(get_session)) -> list[dict[str, object]]:
    if not session.get(ReviewRoom, room_id) and room_hub.has_room(room_id):
        return []
    rows = session.scalars(select(SharedNote).where(SharedNote.room_id == room_id).order_by(SharedNote.created_at)).all()
    return [
        {
            "id": row.id,
            "author": row.author,
            "content": row.content,
            "board": row.board,
            "global_ply": row.global_ply,
            "variation_id": row.variation_id,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@app.post("/api/rooms/{room_id}/notes")
def create_note(room_id: str, request: NoteCreateRequest, session: Session = Depends(get_session)) -> dict[str, object]:
    if not session.get(ReviewRoom, room_id) and not room_hub.has_room(room_id):
        raise HTTPException(status_code=404, detail="Room not found")
    note = SharedNote(room_id=room_id, **request.model_dump(mode="json"))
    try:
        session.add(note)
        session.commit()
        return {"id": note.id, "created_at": note.created_at}
    except SQLAlchemyError as exc:
        session.rollback()
        if not _is_disk_full_error(exc):
            raise
        return {"id": str(uuid4()), "created_at": None}


@app.websocket("/ws/rooms/{room_id}")
async def room_socket(
    websocket: WebSocket,
    room_id: str,
    client_id: str = Query(min_length=1, max_length=80),
    display_name: str = Query(default="Guest", min_length=1, max_length=40),
) -> None:
    clean_display_name = " ".join(display_name.split()) or "Guest"
    await room_hub.connect(room_id, client_id, websocket, clean_display_name)
    try:
        await websocket.send_json({"type": "room.snapshot", "payload": room_hub.snapshots.get(room_id, {})})
        await room_hub.broadcast_presence(room_id, exclude_client_id=client_id)
        while True:
            raw = await websocket.receive_json()
            event = SocketEvent.model_validate(raw)
            if str(event.room_id) != room_id:
                await websocket.send_json({"type": "error", "payload": {"message": "Room ID mismatch"}})
                continue
            payload = event.payload
            if event.type == "game.select":
                selected_game_id = payload.get("game_id")
                if isinstance(selected_game_id, int):
                    try:
                        with SessionLocal() as session:
                            room = session.get(ReviewRoom, room_id)
                            if room:
                                room.game_id = selected_game_id
                                session.commit()
                    except SQLAlchemyError as exc:
                        if not _is_disk_full_error(exc):
                            raise
                    room_hub.set_room_game(room_id, selected_game_id)
            if event.type == "chat.message":
                content = str(payload.get("content") or "").strip()[:5000]
                if content:
                    try:
                        with SessionLocal() as session:
                            session.add(ChatMessage(room_id=room_id, author=str(payload.get("author") or "Guest")[:64], content=content, board=payload.get("board"), global_ply=payload.get("ply")))
                            session.commit()
                    except SQLAlchemyError as exc:
                        if not _is_disk_full_error(exc):
                            raise
            elif event.type == "note.create":
                content = str(payload.get("content") or "").strip()[:5000]
                if content:
                    try:
                        with SessionLocal() as session:
                            session.add(SharedNote(room_id=room_id, author=str(payload.get("author") or "Guest")[:64], content=content, board=payload.get("board"), global_ply=payload.get("ply")))
                            session.commit()
                    except SQLAlchemyError as exc:
                        if not _is_disk_full_error(exc):
                            raise
            await room_hub.publish(room_id, event.model_dump(mode="json"))
    except WebSocketDisconnect:
        await room_hub.disconnect(room_id, client_id)
        await room_hub.broadcast_presence(room_id)


frontend_dist = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str) -> FileResponse:
        candidate = frontend_dist / full_path
        return FileResponse(candidate if candidate.is_file() else frontend_dist / "index.html")
