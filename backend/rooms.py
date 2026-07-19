from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from typing import Any

from fastapi import WebSocket


class RoomHub:
    def __init__(self) -> None:
        self.connections: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        self.snapshots: dict[str, dict[str, Any]] = defaultdict(dict)
        self.seen_events: dict[str, deque[str]] = defaultdict(lambda: deque(maxlen=1000))
        self.lock = asyncio.Lock()

    async def connect(self, room_id: str, client_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self.lock:
            self.connections[room_id][client_id] = websocket

    async def disconnect(self, room_id: str, client_id: str) -> None:
        async with self.lock:
            self.connections[room_id].pop(client_id, None)

    async def publish(self, room_id: str, event: dict[str, Any]) -> None:
        event_id = str(event.get("event_id") or "")
        if event_id in self.seen_events[room_id]:
            return
        self.seen_events[room_id].append(event_id)
        event_type = str(event.get("type") or "")
        if event_type in {"game.select", "timeline.seek", "variation.create", "variation.update", "variation.return_to_game"}:
            self.snapshots[room_id][event_type] = event
        elif event_type == "annotation.create":
            annotations = self.snapshots[room_id].setdefault("annotations", [])
            if isinstance(annotations, list):
                annotations.append(event.get("payload", {}))
        elif event_type == "annotation.delete":
            annotation_id = str(event.get("payload", {}).get("id") or "")
            annotations = self.snapshots[room_id].get("annotations", [])
            if isinstance(annotations, list):
                self.snapshots[room_id]["annotations"] = [item for item in annotations if str(item.get("id")) != annotation_id]
        elif event_type == "chat.message":
            messages = self.snapshots[room_id].setdefault("messages", [])
            if isinstance(messages, list):
                messages.append(event.get("payload", {}))
        stale: list[str] = []
        for client_id, socket in list(self.connections[room_id].items()):
            try:
                await socket.send_json(event)
            except Exception:
                stale.append(client_id)
        for client_id in stale:
            await self.disconnect(room_id, client_id)


room_hub = RoomHub()
