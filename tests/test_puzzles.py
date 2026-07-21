from fastapi.testclient import TestClient

from backend.main import app
from backend.puzzles import RYANTIME_PUZZLE, RYANTIME_PUZZLE_ID, puzzle_content_id, validate_seed


client = TestClient(app)


def test_ryantime_puzzle_is_content_addressed_and_legal() -> None:
    assert RYANTIME_PUZZLE_ID == puzzle_content_id(
        RYANTIME_PUZZLE.boards[0],
        RYANTIME_PUZZLE.boards[1],
        RYANTIME_PUZZLE.perspective_board,
        RYANTIME_PUZZLE.perspective_color,
    )
    assert validate_seed(RYANTIME_PUZZLE) == []


def test_public_puzzle_payload_never_includes_solution() -> None:
    response = client.get(f"/api/puzzles/{RYANTIME_PUZZLE_ID}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["source"]["player"] == "RyanTime"
    assert payload["perspective"] == {"board": "A", "color": "white"}
    assert payload["positions"]["board_a"]["white_pocket"] == "BQP"
    assert payload["positions"]["board_b"]["white_pocket"] == "P"
    assert "solution" not in payload


def test_puzzle_move_rejects_wrong_legal_move_and_returns_forced_reply() -> None:
    wrong = client.post(
        f"/puzzle-move/{RYANTIME_PUZZLE_ID}",
        json={"moves": [{"board": "A", "san": "Q@d7"}]},
    )
    assert wrong.status_code == 200
    assert wrong.json() == {"status": "wrong_move"}

    correct = client.post(
        f"/puzzle-move/{RYANTIME_PUZZLE_ID}",
        json={"moves": [{"board": "A", "san": "e8=Q+"}]},
    )
    assert correct.status_code == 200
    assert correct.json() == {
        "complete": False,
        "moves": [{"board": "A", "moves": ["Rxe8"]}],
    }

    malformed = client.post(
        f"/puzzle-move/{RYANTIME_PUZZLE_ID}",
        json={"moves": [{"board": "A", "san": "e8Q+"}]},
    )
    assert malformed.status_code == 200
    assert malformed.json() == {"status": "wrong_move"}


def test_hint_and_solution_share_the_board_run_response_shape() -> None:
    hint = client.post(f"/puzzle-next-move/{RYANTIME_PUZZLE_ID}", json={"moves": []})
    assert hint.status_code == 200
    assert hint.json() == {
        "complete": False,
        "moves": [{"board": "A", "moves": ["e8=Q+", "Rxe8"]}],
    }

    revealed = client.post(f"/puzzle-solution/{RYANTIME_PUZZLE_ID}", json={"moves": []})
    assert revealed.status_code == 200
    payload = revealed.json()
    assert payload["complete"] is True
    assert payload["moves"] == [
        {
            "board": "A",
            "moves": ["e8=Q+", "Rxe8", "Nxe8", "R@e4+", "@e2", "Q@d7", "Q@a3", "N@a4"],
        }
    ]


def test_final_solver_move_returns_the_last_forced_reply_and_completion() -> None:
    history = [
        {"board": "A", "san": san}
        for san in ["e8=Q+", "Rxe8", "Nxe8", "R@e4+", "@e2", "Q@d7", "Q@a3"]
    ]
    response = client.post(f"/puzzle-move/{RYANTIME_PUZZLE_ID}", json={"moves": history})
    assert response.status_code == 200
    assert response.json() == {
        "complete": True,
        "moves": [{"board": "A", "moves": ["N@a4"]}],
    }


def test_san_replay_endpoint_advances_without_exposing_the_solution() -> None:
    response = client.post(
        "/api/exploration/san",
        json={
            "board_a_fen": RYANTIME_PUZZLE.boards[0],
            "board_b_fen": RYANTIME_PUZZLE.boards[1],
            "board": "A",
            "san": "e8=Q+",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["legal"] is True
    assert payload["notation"] == "e8=Q+"
    assert payload["board_a"]["side_to_move"] == "Black"
