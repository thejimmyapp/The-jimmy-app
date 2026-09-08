REPORT · PARITY-03-MERGE

M7: `27dbaa318103dc1637b5066838d4f66500a00e18`

Tree: `72467028d1fc4e4e2cde657821008340a166936e`

Parents:

```
27dbaa318103dc1637b5066838d4f66500a00e18 0d074339fadd11664a9a6a0d76cfe49d1b99474f 7a6ee46907c47afedecaf3b9bfdb053b3d6ddc6b
```

`git diff --stat 0d07433 HEAD`

```
 frontend/dev/parity.html                           |     2 +-
 frontend/dev/parity/build-positions.mjs            |    12 +
 frontend/dev/parity/capture.mjs                    |    12 +-
 frontend/src/dev/ParityPreview.tsx                 |    70 +-
 frontend/src/parity/custom-elements.d.ts           |     7 +
 .../fixtures/Ma9vcnpu-4lZqSffp.positions.json      | 12511 +++++++++++++++++++
 frontend/src/parity/pgn/parsePgn.test.ts           |    29 +
 frontend/src/parity/pgn/parsePgn.ts                |   184 +
 frontend/src/parity/rules/crazyhouse.test.ts       |    55 +
 frontend/src/parity/rules/crazyhouse.ts            |   328 +
 frontend/src/parity/tree/ParityTree.test.tsx       |    47 +
 frontend/src/parity/tree/ParityTree.tsx            |   108 +
 frontend/src/parity/tree/parityTree.css            |    42 +
 frontend/src/parity/tree/treeNavigation.ts         |    22 +
 14 files changed, 13410 insertions(+), 19 deletions(-)
```

`git ls-remote origin main` before push:

```
0d074339fadd11664a9a6a0d76cfe49d1b99474f	refs/heads/main
```

`git ls-remote origin main` after push:

```
27dbaa318103dc1637b5066838d4f66500a00e18	refs/heads/main
```

Report branch: `codex/report-parity-03-merge`
