REPORT · PARITY-01-MERGE

M5: `7dbf4506fadb94f7f3163c0a50acc206cfc80013`

Tree: `37f0b30b9e9ecf31715c61b89e1086feabbdface`

Parents:

```
7dbf4506fadb94f7f3163c0a50acc206cfc80013 132068aed9ef42fa2c8de9b9dbe393a737200f5c 07a74b35a25b8125ef4f9db8879bff83ad93db47
```

`git diff --stat 132068a HEAD`

```
 .gitignore                                         |   1 +
 THIRD-PARTY-NOTICES.md                             |   1 +
 frontend/dev/parity.html                           |  15 ++
 frontend/dev/parity/capture.mjs                    | 212 +++++++++++++++++++++
 frontend/package.json                              |   5 +
 frontend/pnpm-lock.yaml                            |  39 ++++
 frontend/public/boards/parity-wood.svg             |  21 ++
 frontend/src/dev/ParityPreview.tsx                 |  28 +++
 frontend/src/dev/parityPreview.css                 |  14 ++
 frontend/src/parity/board/ParityBoard.test.tsx     |  57 ++++++
 frontend/src/parity/board/ParityBoard.tsx          |  95 +++++++++
 frontend/src/parity/board/parityBoard.css          |  65 +++++++
 frontend/src/parity/custom-elements.d.ts           |  18 ++
 frontend/src/parity/fixtures/Ma9vcnpu-4lZqSffp.pgn |  18 ++
 .../parity/fixtures/Ma9vcnpu-4lZqSffp.states.json  |  71 +++++++
 15 files changed, 660 insertions(+)
```

`git ls-remote origin main` before push:

```
132068aed9ef42fa2c8de9b9dbe393a737200f5c	refs/heads/main
```

`git ls-remote origin main` after push:

```
7dbf4506fadb94f7f3163c0a50acc206cfc80013	refs/heads/main
```

Report branch: `codex/report-parity-01-merge`
