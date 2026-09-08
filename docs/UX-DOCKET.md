# UX DOCKET — owner design rulings → gate chunks

One line per item. The owner rules; the gate chunks; Lane 3 builds; the gate verifies on production.
Format: `UX-nn · surface · Remove / Change / Add · one sentence · ruled YYYY-MM-DD · chunk`

- UX-01a · review dock · Remove · the "Moves" sub-tab (click-to-seek move list); keyboard stepping stays; Timeline.tsx kept unreferenced pending a later ruling · ruled 2026-09-07 (owner) · UX-01 · shipped b132655 · verified on prod 2026-09-07
- UX-01b · review dock title bar · Remove · the "Map" button (duplicate of the rail's Return to onboarding) · ruled 2026-09-07 (owner) · UX-01 · shipped b132655 · verified on prod 2026-09-07
- UX-01c · board pocket rails · Change · drop the visible "Droppers" label; accessible name → "White pocket" / "Black pocket" (gate default word; owner may rename) · ruled 2026-09-07 (owner) · UX-01 · shipped b132655 · verified on prod 2026-09-07
- UX-02 · landing carousel · Change · copy and imagery — owner ruling pending (STRUCTURE / VERBATIM / DROP; brand) · open
- UX-03 · review workspace · Change · two-column full-height shell: main board dominant, persistent secondary-board rail, replay controls beneath the main board; layout layer only (colors, pieces, quest header, analysis, navigation are later layers) · ruled 2026-09-07 (owner, via design thread) · SHELL-01 · built 899e48b · HELD by gate 2026-09-07 (main board 210² @992×700 vs 488² today while the dock remains) · owner ruling pending: SHIP / HOLD-UNTIL-NAV / MODIFY
- UX-04 · guest game list · Change · three rows, one per rating class 2300+ / 1900–2300 / 1400–1900, freshest finished game per class; games whose highest-rated seat is below 1400 excluded · ruled 2026-09-07 (owner) · LIST-01 · shipped bdfa120 · verified on prod 2026-09-07
- UX-04b · guest game list · Add · Regenerate reports classes that had no other recent game ([COPY-PLACEHOLDER] status note); payload types made honest; exclusion key outside_7d · gate hygiene 2026-09-07 · LIST-02 · shipped 49c7004 · verified on prod 2026-09-08
- UX-04c · guest game list · Change · class-scoped examination budget (per-class share of the cap, rollover, cached matches exempt, top_up stops at the cap) after the 2300+ row starved on prod 2026-09-07 22:24Z · gate fix · LIST-03 · shipped 7b4b3e3 · verified on prod 2026-09-08
- UX-05 · chessboard visual system · Change · classical legible SVG pieces (Cburnett, BSD-3-Clause, notice reproduced in THIRD-PARTY-NOTICES.md) on a warm wooden board (Wood Classic, original texture); registry-driven board-theme/piece-set layer shared by main board, partner board, pockets, coordinates, overlays; legacy themes and glyph sets kept · ruled 2026-09-07 (owner, via design thread) · BOARD-01 · shipped a007918 · verified on prod 2026-09-08
