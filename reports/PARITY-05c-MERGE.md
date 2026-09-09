REPORT · PARITY-05c-MERGE

M12
f9b3e3955a20e9a8afefbe58119d9811beb724bd

Fetched parity branch tip
003156de8b3530a58093eede8ae8af560cab7623

Merged pinned SHA
930b070d0e2363e20f572404cc89f75c4f85b290

Tree
74c1bbfb2df5f5a21d2cdc680dc0c1c72eb066a8

Parents
f9b3e3955a20e9a8afefbe58119d9811beb724bd e49000163f28639badc804bad04c93fca8fae6f0 930b070d0e2363e20f572404cc89f75c4f85b290

Diff stat
 frontend/dev/parity/capture-study.mjs              |  132 +
 frontend/dev/parity/capture.mjs                    |   74 +
 frontend/dev/parity/reference/jimmy1024-S1.png     |  Bin 0 -> 131395 bytes
 frontend/dev/parity/reference/jimmy1200-S1.png     |  Bin 0 -> 152984 bytes
 frontend/dev/parity/reference/jimmy1440-S1.png     |  Bin 0 -> 217915 bytes
 frontend/dev/parity/reference/reference-meta.json  | 2725 +++++++++++++++++++-
 frontend/src/dev/ParityPreview.tsx                 |    9 +-
 frontend/src/dev/StudyPreview.tsx                  |   48 +
 frontend/src/dev/parityPreview.css                 |    1 +
 frontend/src/parity/controls/parityControls.css    |    6 +
 frontend/src/parity/layout.frame.test.ts           |   21 +
 frontend/src/parity/layout.ts                      |   49 +-
 .../parity/workspace/StudyWorkspace.frame.test.tsx |   58 +
 frontend/src/parity/workspace/StudyWorkspace.tsx   |   34 +-
 frontend/src/parity/workspace/studyWorkspace.css   |   14 +-
 15 files changed, 3147 insertions(+), 24 deletions(-)

ls-remote before
e49000163f28639badc804bad04c93fca8fae6f0	refs/heads/main

ls-remote after
f9b3e3955a20e9a8afefbe58119d9811beb724bd	refs/heads/main

Pushed at
2026-09-09T00:52:27Z
