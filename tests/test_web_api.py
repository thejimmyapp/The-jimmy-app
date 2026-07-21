from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.main import app


def test_health_and_openapi() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["service"] == "thejimmyapp"
        assert "/ws/rooms/{room_id}" not in client.get("/openapi.json").json()["paths"]


def test_room_websocket_relays_versioned_event() -> None:
    with TestClient(app) as client:
        room = client.post("/api/rooms", json={"game_id": None}).json()
        joined = client.post(f"/api/rooms/{room['id']}/join", json={"display_name": "Alex"}).json()
        with client.websocket_connect(f"/ws/rooms/{room['id']}?client_id={joined['client_id']}") as socket:
            snapshot = socket.receive_json()
            assert snapshot["type"] == "room.snapshot"
            event = {
                "version": 1,
                "event_id": str(uuid4()),
                "room_id": room["id"],
                "sender_id": joined["client_id"],
                "timestamp": datetime.now(UTC).isoformat(),
                "type": "timeline.seek",
                "payload": {"global_ply": 12},
            }
            socket.send_json(event)
            assert socket.receive_json()["payload"]["global_ply"] == 12


def test_room_shares_selected_game_and_latest_timeline_with_late_joiners() -> None:
    with TestClient(app) as client:
        room = client.post("/api/rooms", json={"game_id": None}).json()
        leader = client.post(f"/api/rooms/{room['id']}/join", json={"display_name": "Leader"}).json()
        guest = client.post(f"/api/rooms/{room['id']}/join", json={"display_name": "Guest"}).json()
        with (
            client.websocket_connect(f"/ws/rooms/{room['id']}?client_id={leader['client_id']}") as leader_socket,
            client.websocket_connect(f"/ws/rooms/{room['id']}?client_id={guest['client_id']}") as guest_socket,
        ):
            assert leader_socket.receive_json()["type"] == "room.snapshot"
            assert guest_socket.receive_json()["type"] == "room.snapshot"
            selected = {
                "version": 1,
                "event_id": str(uuid4()),
                "room_id": room["id"],
                "sender_id": leader["client_id"],
                "timestamp": datetime.now(UTC).isoformat(),
                "type": "game.select",
                "payload": {"game_id": 4242},
            }
            leader_socket.send_json(selected)
            assert leader_socket.receive_json()["type"] == "game.select"
            assert guest_socket.receive_json()["payload"]["game_id"] == 4242
            seek = {
                "version": 1,
                "event_id": str(uuid4()),
                "room_id": room["id"],
                "sender_id": leader["client_id"],
                "timestamp": datetime.now(UTC).isoformat(),
                "type": "timeline.seek",
                "payload": {"global_ply": 27},
            }
            leader_socket.send_json(seek)
            assert leader_socket.receive_json()["type"] == "timeline.seek"
            assert guest_socket.receive_json()["payload"]["global_ply"] == 27

        state = client.get(f"/api/rooms/{room['id']}").json()
        assert state["game_id"] == 4242
        assert state["snapshot"]["room"]["game_id"] == 4242
        assert state["snapshot"]["game.select"]["payload"]["game_id"] == 4242
        assert state["snapshot"]["timeline.seek"]["payload"]["global_ply"] == 27


def test_exploration_accepts_legal_move_and_rejects_illegal_arrow() -> None:
    start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1"
    with TestClient(app) as client:
        legal = client.post(
            "/api/exploration/move",
            json={"board_a_fen": start, "board_b_fen": start, "board": "A", "from_square": "e2", "to_square": "e4"},
        )
        assert legal.status_code == 200
        assert legal.json()["legal"] is True
        illegal = client.post(
            "/api/exploration/move",
            json={"board_a_fen": start, "board_b_fen": start, "board": "A", "from_square": "e2", "to_square": "e5", "dry_run": True},
        )
        assert illegal.json()["legal"] is False
        assert "e4" in illegal.json()["legal_destinations"]


def test_exploration_capture_transfers_piece_to_partner_pocket() -> None:
    board_a = "4k3/8/8/8/3p4/4P3/8/4K3[] w - - 0 1"
    board_b = "4k3/8/8/8/8/8/8/4K3[] w - - 0 1"
    with TestClient(app) as client:
        response = client.post(
            "/api/exploration/move",
            json={"board_a_fen": board_a, "board_b_fen": board_b, "board": "A", "from_square": "e3", "to_square": "d4"},
        )
    assert response.json()["legal"] is True
    assert response.json()["capture_transferred"] is True
    assert response.json()["board_b"]["black_pocket"] == "p"


def test_exploration_works_when_partner_board_is_unavailable() -> None:
    start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1"
    with TestClient(app) as client:
        response = client.post(
            "/api/exploration/move",
            json={"board_a_fen": start, "board": "A", "from_square": "g1", "to_square": "f3"},
        )
    payload = response.json()
    assert payload["legal"] is True
    assert payload["board_a"]["to_square"] == "f3"
    assert payload["board_b"] is None


def test_exploration_accepts_a_legal_pocket_drop() -> None:
    board_a = "4k3/8/8/8/8/8/8/4K3[N] w - - 0 1"
    with TestClient(app) as client:
        response = client.post(
            "/api/exploration/move",
            json={"board_a_fen": board_a, "board": "A", "to_square": "f7", "drop_piece": "N"},
        )
    payload = response.json()
    assert payload["legal"] is True
    assert payload["notation"].startswith("N@f7")
    assert payload["board_a"]["board"][1][5] == "N"


def test_exploration_lists_legal_targets_for_piece_selection() -> None:
    start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR[] w KQkq - 0 1"
    with TestClient(app) as client:
        response = client.post(
            "/api/exploration/move",
            json={"board_a_fen": start, "board": "A", "from_square": "g1", "to_square": "g1", "dry_run": True},
        )
    payload = response.json()
    assert payload["legal"] is False
    assert payload["legal_destinations"] == ["f3", "h3"]


def test_authenticated_connector_does_not_store_credentials() -> None:
    curl_text = "curl 'https://www.chess.com/callback/game/pgn-info' -H 'content-type: application/json' -b 'session=fake' --data-raw '{\"_token\":\"fake\"}'"
    with TestClient(app) as client:
        response = client.post(
            "/api/chesscom/enrich",
            json={"username": "fixture-user", "curl_text": curl_text, "limit": 10},
        )
    assert response.status_code == 200
    assert response.json()["credentials_stored"] is False
