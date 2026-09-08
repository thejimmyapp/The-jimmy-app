REPORT · PARITY-02-MERGE

M6: `0d074339fadd11664a9a6a0d76cfe49d1b99474f`

Tree: `fc363cd32415334a5da5834ba33c5506af4cfeba`

Parents:

```
0d074339fadd11664a9a6a0d76cfe49d1b99474f 7dbf4506fadb94f7f3163c0a50acc206cfc80013 1d6d97cd99e49b865d927be5f4c84ed94874f654
```

`git diff --stat 7dbf450 HEAD`

```
 frontend/dev/parity/capture.mjs                    |  145 +-
 frontend/dev/parity/reference/S0.png               |  Bin 0 -> 235636 bytes
 frontend/dev/parity/reference/S1.png               |  Bin 0 -> 228332 bytes
 frontend/dev/parity/reference/S2.png               |  Bin 0 -> 228819 bytes
 frontend/dev/parity/reference/reference-meta.json  | 1654 ++++++++++++++++++++
 frontend/src/dev/ParityPreview.tsx                 |   37 +-
 frontend/src/dev/parityPreview.css                 |   18 +-
 frontend/src/parity/board/ParityBoard.test.tsx     |   32 +-
 frontend/src/parity/board/ParityBoard.tsx          |  144 +-
 frontend/src/parity/board/parityBoard.css          |   32 +-
 frontend/src/parity/board/themes.ts                |   33 +
 .../parity/fixtures/Ma9vcnpu-4lZqSffp.states.json  |   21 +-
 frontend/src/parity/layout.test.ts                 |   14 +
 frontend/src/parity/layout.ts                      |   79 +
 frontend/src/parity/pocket/ParityPocket.test.tsx   |   68 +
 frontend/src/parity/pocket/ParityPocket.tsx        |   46 +
 frontend/src/parity/pocket/parityPocket.css        |   44 +
 17 files changed, 2270 insertions(+), 97 deletions(-)
```

`git ls-remote origin main` before push:

```
7dbf4506fadb94f7f3163c0a50acc206cfc80013	refs/heads/main
```

`git ls-remote origin main` after push:

```
0d074339fadd11664a9a6a0d76cfe49d1b99474f	refs/heads/main
```

Report branch: `codex/report-parity-02-merge`
