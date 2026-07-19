from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ChessComConnectRequest(BaseModel):
    username: str = Field(min_length=2, max_length=25, pattern=r"^[A-Za-z0-9_-]+$")


class ChessComEnrichRequest(BaseModel):
    username: str = Field(min_length=2, max_length=25, pattern=r"^[A-Za-z0-9_-]+$")
    curl_text: str = Field(min_length=40, max_length=100_000)
    limit: int = Field(default=5000, ge=1, le=20_000)


class PgnImportRequest(BaseModel):
    username: str = Field(min_length=2, max_length=25, pattern=r"^[A-Za-z0-9_-]+$")
    pgn: str = Field(min_length=8, max_length=2_000_000)
    second_board_pgn: str | None = Field(default=None, max_length=2_000_000)


class AnalysisRequest(BaseModel):
    game_id: int = Field(gt=0)
    global_ply: int = Field(ge=0)
    board: Literal["A", "B"] = "A"
    depth: int = Field(default=10, ge=4, le=24)


class ExplorationMoveRequest(BaseModel):
    board_a_fen: str = Field(min_length=10, max_length=200)
    board_b_fen: str | None = Field(default=None, min_length=10, max_length=200)
    board: Literal["A", "B"]
    from_square: str | None = Field(default=None, pattern=r"^[a-h][1-8]$")
    to_square: str = Field(pattern=r"^[a-h][1-8]$")
    drop_piece: Literal["P", "N", "B", "R", "Q"] | None = None
    promotion: Literal["q", "r", "b", "n"] | None = None
    dry_run: bool = False

class RoomCreateRequest(BaseModel):
    game_id: int | None = Field(default=None, gt=0)


class RoomJoinRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=40)

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return " ".join(value.split())


class NoteCreateRequest(BaseModel):
    author: str = Field(min_length=1, max_length=40)
    content: str = Field(min_length=1, max_length=5000)
    board: Literal["A", "B"] | None = None
    global_ply: int | None = Field(default=None, ge=0)
    variation_id: UUID | None = None


class SocketEvent(BaseModel):
    version: Literal[1] = 1
    event_id: UUID
    room_id: UUID
    sender_id: str = Field(min_length=1, max_length=80)
    timestamp: datetime
    type: Literal[
        "room.join",
        "room.leave",
        "presence.update",
        "game.select",
        "timeline.seek",
        "board.move",
        "variation.create",
        "variation.update",
        "variation.return_to_game",
        "annotation.create",
        "annotation.delete",
        "chat.message",
        "note.create",
        "note.update",
    ]
    payload: dict[str, Any] = Field(default_factory=dict)
