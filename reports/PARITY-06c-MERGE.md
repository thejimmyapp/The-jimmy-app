REPORT · PARITY-06c-MERGE

M16
ac75e429f207e319cab8c73375b076f852de4fde

Fetched parity branch tip / merged pinned SHA
bb3c22f1f8c1561314e901cb231e81fa05c1b59e

Tree
1bc9ce09e07932138645cf0d308a03f932d86366

Parents
ac75e429f207e319cab8c73375b076f852de4fde ddb44172e20131826f15d9e9abe5b993989be70c bb3c22f1f8c1561314e901cb231e81fa05c1b59e

Diff stat
 frontend/dev/parity/capture-study.mjs              |   19 +
 frontend/dev/parity/capture.mjs                    |   83 ++
 .../dev/parity/reference/jimmy1440-menu-open.png   |  Bin 0 -> 167058 bytes
 frontend/dev/parity/reference/jimmy1440-side.png   |  Bin 0 -> 217915 bytes
 frontend/dev/parity/reference/reference-meta.json  | 1000 ++++++++++++++++++++
 frontend/src/App.studyFlag.test.tsx                |   28 +-
 frontend/src/App.tsx                               |   21 +-
 frontend/src/dev/ParityPreview.tsx                 |    2 +-
 frontend/src/dev/StudyPreview.tsx                  |    5 +-
 frontend/src/parity/controls/ParityControls.tsx    |    6 +-
 frontend/src/parity/controls/parityControls.css    |    2 +
 frontend/src/parity/menu/StudyMenu.tsx             |   25 +
 frontend/src/parity/menu/studyMenu.css             |   14 +
 frontend/src/parity/side/StudySide.tsx             |    9 +
 frontend/src/parity/side/studySide.css             |   10 +
 .../src/parity/underboard/StudyUnderboard.test.tsx |    7 +
 frontend/src/parity/underboard/StudyUnderboard.tsx |    5 +-
 frontend/src/parity/underboard/studyUnderboard.css |    1 +
 .../parity/workspace/StudyWorkspace.frame.test.tsx |   10 +
 .../src/parity/workspace/StudyWorkspace.test.tsx   |   19 +-
 frontend/src/parity/workspace/StudyWorkspace.tsx   |   33 +-
 21 files changed, 1279 insertions(+), 20 deletions(-)

ls-remote before
ddb44172e20131826f15d9e9abe5b993989be70c	refs/heads/main

ls-remote after
ac75e429f207e319cab8c73375b076f852de4fde	refs/heads/main

Pushed at
2026-09-09T01:53:49Z
