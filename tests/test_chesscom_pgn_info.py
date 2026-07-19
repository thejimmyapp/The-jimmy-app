from __future__ import annotations

import unittest

from src.chesscom_pgn_info import PgnInfoError, parse_curl_auth, validate_curl_text


class PgnInfoCurlParsingTests(unittest.TestCase):
    def test_chrome_bash_curl_with_cookie_flag(self) -> None:
        curl_text = (
            "curl 'https://www.chess.com/callback/game/pgn-info' "
            "-H 'accept: application/json' "
            "-H 'content-type: application/json' "
            "-H 'x-chesscom-csrf-token: csrf123' "
            "-b 'sessionid=abc; other=def' "
            "--data-raw '{\"_token\":\"tok123\",\"ids\":\"1\"}'"
        )

        validation = validate_curl_text(curl_text)
        auth = parse_curl_auth(curl_text)

        self.assertTrue(validation.ok)
        self.assertTrue(validation.endpoint_found)
        self.assertTrue(validation.cookie_found)
        self.assertTrue(validation.token_found)
        self.assertEqual(auth.cookie, "sessionid=abc; other=def")
        self.assertEqual(auth.token, "tok123")

    def test_windows_caret_curl_with_cookie_header(self) -> None:
        curl_text = (
            'curl ^\n  "https://www.chess.com/callback/game/pgn-info" ^\n'
            '  -H "accept: application/json" ^\n'
            '  -H "cookie: sessionid=abc; other=def" ^\n'
            '  --data "_token=tok123&ids=1"'
        )

        validation = validate_curl_text(curl_text)
        auth = parse_curl_auth(curl_text)

        self.assertTrue(validation.ok)
        self.assertTrue(validation.endpoint_found)
        self.assertTrue(validation.cookie_found)
        self.assertTrue(validation.token_found)
        self.assertEqual(auth.cookie, "sessionid=abc; other=def")
        self.assertEqual(auth.token, "tok123")

    def test_cookie_from_another_chesscom_request_can_seed_auth(self) -> None:
        curl_text = (
            "curl 'https://www.chess.com/r2/client-packages/checkmate/common.js' "
            "-H 'cookie: sessionid=abc'"
        )

        validation = validate_curl_text(curl_text)

        self.assertTrue(validation.ok)
        self.assertFalse(validation.endpoint_found)
        self.assertTrue(any("pgn-info endpoint" in issue for issue in validation.issues))

    def test_missing_cookie_is_not_valid_for_auth(self) -> None:
        curl_text = "curl 'https://www.chess.com/callback/game/pgn-info' -H 'accept: application/json'"

        validation = validate_curl_text(curl_text)

        self.assertFalse(validation.ok)
        self.assertFalse(validation.cookie_found)
        with self.assertRaises(PgnInfoError):
            parse_curl_auth(curl_text)


if __name__ == "__main__":
    unittest.main()
