REPORT · PARITY-05a-MERGE

M9: `a43026718c2c1b2a72fc75e98caeb9edb5d9d216`

Tree: `8883691ee089cf9ee64b1bb5295667e4b3837692`

Parents:

```
a43026718c2c1b2a72fc75e98caeb9edb5d9d216 e8c6fc7d083a14ad10207602701471fc86decf7e 38ea4601b91ab7fbd72db93d8a44c168262739d9
```

`git diff --stat e8c6fc7 HEAD`

```
 frontend/src/App.studyFlag.test.tsx                |  66 ++++++++++++
 frontend/src/App.tsx                               |   8 +-
 frontend/src/components/AppShell.tsx               |   5 +-
 .../src/parity/adapters/replayToParity.test.ts     |  25 +++++
 frontend/src/parity/adapters/replayToParity.ts     |  23 ++++
 .../src/parity/adapters/timelineToTree.test.ts     |  20 ++++
 frontend/src/parity/adapters/timelineToTree.ts     |  25 +++++
 frontend/src/parity/pgn/parsePgn.ts                |   1 +
 frontend/src/parity/rules/crazyhouse.ts            |  13 +++
 .../src/parity/tree/ParityTree.boardTag.test.tsx   |  16 +++
 frontend/src/parity/tree/ParityTree.tsx            |   1 +
 frontend/src/parity/tree/parityTree.css            |   1 +
 .../src/parity/workspace/StudyWorkspace.test.tsx   |  59 ++++++++++
 frontend/src/parity/workspace/StudyWorkspace.tsx   | 120 +++++++++++++++++++++
 frontend/src/parity/workspace/studyFlag.ts         |   3 +
 frontend/src/parity/workspace/studyWorkspace.css   |  16 +++
 16 files changed, 398 insertions(+), 4 deletions(-)
```

`git ls-remote origin main` before push:

```
e8c6fc7d083a14ad10207602701471fc86decf7e	refs/heads/main
```

`git ls-remote origin main` after push:

```
a43026718c2c1b2a72fc75e98caeb9edb5d9d216	refs/heads/main
```

Date at push:

```
Tue Sep  8 23:52:50 UTC 2026
```

Report branch: `codex/report-parity-05a-merge`
