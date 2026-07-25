export const buildChessComConnectorPrompt = (username: string, appUrl: string): string => {
  const account = username.trim() || "<CHESS.COM USERNAME>";
  const trustedAppUrl = appUrl.replace(/\/$/, "");

  return `Help me load complete two-board Bughouse data into The Jimmy App.

Use the Chrome browser profile that I already opened. I will sign in to Chess.com myself if needed. Never ask me for my Chess.com password, cookies, CSRF token, or any reusable session credential.

Before you start, verify that both pages are open in the same Chrome profile:
1. The Jimmy App: ${trustedAppUrl}
2. Chess.com archive: https://www.chess.com/games/archive

Chess.com username: ${account}

Then do the following:
1. Confirm that Chess.com is already signed in. If it is not, stop and ask me to sign in myself.
2. In Chrome DevTools, open Network, keep Fetch/XHR visible, and filter for "pgn-info".
3. Refresh the Chess.com archive or open one of my Bughouse games until a successful pgn-info request appears.
4. Copy that single request as cURL (bash).
5. Do not print the cURL in chat, save it to a file, commit it, log it, or send it anywhere except the trusted Jimmy App page above.
6. In The Jimmy App, open "Connect Chess.com", enter "${account}", expand "Load complete two-board data", paste the cURL into the private connector field, and click "Load both boards".
7. Wait for the import to finish. Report only how many games were checked, enriched, and still lack a second board. Never repeat any authentication header or cookie in your response.
8. Clear the sensitive cURL from the clipboard and close DevTools when finished.

If browser automation cannot inspect Chrome DevTools Network directly, guide me through only the minimum clicks needed to copy the pgn-info request, then take over again to paste it into The Jimmy App and finish the enrichment.

This is a temporary connector while The Jimmy App waits for supported Chess.com developer access. Stop immediately if the destination domain differs from ${trustedAppUrl}.`;
};
