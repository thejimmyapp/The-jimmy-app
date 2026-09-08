REPORT · BOARD-01-MERGE

M1: `a007918a48e5b15a71a9551e029026cc6d4eb143`

Tree: `336818f6f352b4a8df089c7af074cdea122bec5e`

Parents:

```
a007918a48e5b15a71a9551e029026cc6d4eb143 bdfa1207819c7f838c26cdc05f1caf51423b977e bff6e5a641fac3d1af1e950f45765f74abf8b094
```

`git diff --stat bdfa120 HEAD`

```
 THIRD-PARTY-NOTICES.md                             |  15 ++
 frontend/dev/board-appearance.html                 |  12 ++
 frontend/package.json                              |   2 +
 frontend/pnpm-lock.yaml                            | 209 ++++++++++++---------
 frontend/public/boards/wood-classic.svg            |  17 ++
 frontend/public/pieces/cburnett/bB.svg             |   1 +
 frontend/public/pieces/cburnett/bK.svg             |   1 +
 frontend/public/pieces/cburnett/bN.svg             |   1 +
 frontend/public/pieces/cburnett/bP.svg             |   1 +
 frontend/public/pieces/cburnett/bQ.svg             |   1 +
 frontend/public/pieces/cburnett/bR.svg             |   1 +
 frontend/public/pieces/cburnett/wB.svg             |   1 +
 frontend/public/pieces/cburnett/wK.svg             |   1 +
 frontend/public/pieces/cburnett/wN.svg             |   1 +
 frontend/public/pieces/cburnett/wP.svg             |   1 +
 frontend/public/pieces/cburnett/wQ.svg             |   1 +
 frontend/public/pieces/cburnett/wR.svg             |   1 +
 frontend/src/App.test.tsx                          |  30 ++-
 frontend/src/App.tsx                               |  73 +++----
 frontend/src/boardAppearance.css                   | 101 ++++++++++
 frontend/src/boardAppearance.test.ts               |  26 +++
 frontend/src/boardAppearance.ts                    | 127 +++++++++++++
 frontend/src/components/AppShell.tsx               |   5 +-
 .../src/components/BoardPanel.appearance.test.tsx  |  77 ++++++++
 frontend/src/components/BoardPanel.tsx             |  41 ++--
 frontend/src/components/LegalPage.test.tsx         |   1 +
 frontend/src/components/LegalPage.tsx              |   3 +
 frontend/src/dev/BoardAppearancePreview.tsx        |  71 +++++++
 frontend/src/dev/boardAppearancePreview.css        |  19 ++
 frontend/src/main.tsx                              |   1 +
 30 files changed, 677 insertions(+), 165 deletions(-)
```

`git ls-remote origin main` before push:

```
bdfa1207819c7f838c26cdc05f1caf51423b977e	refs/heads/main
```

`git ls-remote origin main` after push:

```
a007918a48e5b15a71a9551e029026cc6d4eb143	refs/heads/main
```
