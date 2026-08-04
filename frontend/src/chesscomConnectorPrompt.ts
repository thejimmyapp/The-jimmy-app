export const buildChessComConnectorPrompt = (appUrl: string) => `Open The Jimmy App at ${appUrl}, then help me enrich my own Bughouse games with Chess.com pgn-info data.

Safety rules:
- Do not ask for, print, save, log, commit, or share my Chess.com password.
- Do not print, save, log, commit, or share the copied cURL request, cookies, CSRF token, session headers, or any reusable credential.
- Use the copied pgn-info cURL only once by pasting it into the trusted Jimmy App page that I have open.
- After the import, report only the number of games checked, enriched, and still missing a partner board.

Steps:
1. Confirm The Jimmy App is open in my browser.
2. Open https://www.chess.com/games/archive in Chrome while I am logged into my own Chess.com account.
3. Open DevTools, go to Network, keep Fetch/XHR visible, and filter for "pgn-info".
4. Refresh the archive or open one of my Bughouse games until a successful https://www.chess.com/callback/game/pgn-info request appears.
5. Copy that request as cURL.
6. Return to The Jimmy App, open Connect games, open Advanced pgn-info enrichment, paste the cURL into the private textarea, and run the enrichment.
7. Do not repeat any authentication header, cookie, token, or cURL content in chat.`;
