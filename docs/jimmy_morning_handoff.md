# Morning Handoff for Jimmy

Jimmy,

I wanted this to feel like contribution, not another pile of support work. The cURL issue was painful because the app asks users to leave the app, open DevTools, identify a hidden Chess.com request, copy a secret-bearing command, put it in the right local file, and then hope the app explains failure clearly. That is too much to ask from normal users.

This PR turns the first part of that problem into product behavior:

- Users can upload or paste cURL inside the app.
- The app validates it without displaying cookies or tokens.
- Chrome, Brave, Edge, Windows CMD, and common data/cookie flag variants are accepted.
- A validated copy can be saved locally with restrictive file permissions.
- `certifi` is explicit so HTTPS does not depend on a machine's accidental certificate setup.
- Sanitized parser tests cover the formats involved in this incident.

The cURL itself remains optional. Public import still works without it, and no real cookie or token is included in this branch.

The ask from you is small: review the approach, keep what fits, discard what does not, and build in whatever direction you prefer. My goal is closure on the support burden, not to constrain the architecture.

The next useful product steps are manual PGN upload/paste in the first-run flow, a recovery page for import failures, and French copy for the DevTools fallback. Those are documented separately and intentionally left out of this focused PR.
