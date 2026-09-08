REPORT · PARITY-04-MERGE

M8: `e8c6fc7d083a14ad10207602701471fc86decf7e`

Tree: `5cdc757590b86299092c32c6ed930aec657f0198`

Parents:

```
e8c6fc7d083a14ad10207602701471fc86decf7e 27dbaa318103dc1637b5066838d4f66500a00e18 d5b7c02c1753fe24cb2912d2296d9dcac82f51c3
```

`git diff --stat 27dbaa3 HEAD`

```
 frontend/dev/parity/capture.mjs                    |  64 +++++++++++
 frontend/dev/parity/reference/1024x768-S1.png      | Bin 0 -> 141543 bytes
 frontend/dev/parity/reference/1200x800-S1.png      | Bin 0 -> 155309 bytes
 frontend/dev/parity/reference/reference-meta.json  | 126 ++++++++++++++++++++-
 frontend/src/dev/ParityPreview.tsx                 |  44 ++++---
 frontend/src/dev/parityPreview.css                 |   6 +-
 .../src/parity/controls/ParityControls.test.tsx    |  18 +++
 frontend/src/parity/controls/ParityControls.tsx    |  28 +++++
 frontend/src/parity/controls/parityControls.css    |  16 +++
 frontend/src/parity/layout.test.ts                 |   7 ++
 frontend/src/parity/layout.ts                      |  33 +++++-
 frontend/src/parity/pgn/parsePgn.test.ts           |  11 ++
 frontend/src/parity/pgn/parsePgn.ts                |  23 ++++
 frontend/src/parity/tree/ParityTree.test.tsx       |  33 +++++-
 frontend/src/parity/tree/treeNavigation.ts         |  33 ++++++
 15 files changed, 417 insertions(+), 25 deletions(-)
```

`git ls-remote origin main` before push:

```
27dbaa318103dc1637b5066838d4f66500a00e18	refs/heads/main
```

`git ls-remote origin main` after push:

```
e8c6fc7d083a14ad10207602701471fc86decf7e	refs/heads/main
```

Report branch: `codex/report-parity-04-merge`
