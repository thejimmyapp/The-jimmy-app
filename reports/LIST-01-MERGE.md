REPORT · LIST-01-MERGE

Candidate SHA: `bdfa1207819c7f838c26cdc05f1caf51423b977e`

Tree SHA: `fe4b1787ce14ccda85e67f556c798ba4d0acb46e`

Parents:

```
bdfa1207819c7f838c26cdc05f1caf51423b977e a1fe803d893d703cbabe454fa5e52008a19216ed 634fcc254bc5754e38aa6126504b0c3e71fc624f
```

`git diff --stat a1fe803 HEAD`

```
 backend/chesscom_matchups.py                      | 480 ++++++++++++++--------
 backend/config.py                                 |  63 ++-
 frontend/src/App.test.tsx                         |   9 +-
 frontend/src/components/GuestMatchupList.test.tsx |  59 ++-
 frontend/src/components/GuestMatchupList.tsx      | 102 ++++-
 tests/test_chesscom_matchups.py                   | 293 +++++++++++--
 6 files changed, 767 insertions(+), 239 deletions(-)
```

`git ls-remote origin main` before push:

```
a1fe803d893d703cbabe454fa5e52008a19216ed	refs/heads/main
```

`git push origin HEAD:main`

```
To https://github.com/thejimmyapp/the-jimmy-app.git
   a1fe803..bdfa120  HEAD -> main
```

`git ls-remote origin main` after push:

```
bdfa1207819c7f838c26cdc05f1caf51423b977e	refs/heads/main
```

Report branch: `codex/report-list-01-merge`

Railway deploy status: not visible; no Railway command was run.
