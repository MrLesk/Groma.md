# Automatic-blueprint benchmark tests

`proofs/` contains the bounded offline evidence for the two immutable reference audits. Each proof
stores the raw pinned commit, every tree object reachable from that commit's root tree, and only the
unique blob contents referenced by fact and forbidden-claim witnesses. The test verifier reconstructs
the complete tree and checks the audit without Git, a sibling checkout, child processes, or network
access. Its import graph remains limited to the verification contract and cryptographic primitives;
Git and `node:child_process` belong only to the generator.

Proof parsing and verification fail closed under one exported resource budget. The limits are
deliberately above the checked-in proofs while remaining finite: 4 MiB JSON input before parsing;
4,096 tree objects; 1,024 witness blobs; 5,121 total Git objects; 2 MiB encoded and 1.5 MiB decoded
per object; 64 MiB decoded in total; 128 tree levels; 250,000 tree entries and paths; and 4,096 UTF-8
bytes per path. Tests use a bounded file loader that checks the file size before reading and checks
the bytes again before `JSON.parse`. Verification also requires every include-matched source path,
before exclusions and in the final inventory, to be a strict portable case-insensitive descendant
of a declared protected root.

Regenerate the proofs only when deliberately refreshing an audit pin:

```sh
bun run tests/iteration-2/automatic-blueprint/generate-offline-proofs.ts \
  --groma-repository /path/to/Groma.md \
  --backlog-repository /path/to/Backlog.md
```

The generator accepts both repository paths explicitly, checks each pinned commit and root tree,
sorts object IDs deterministically, applies the same object and traversal limits as the verifier,
checks the serialized JSON through the bounded parser, verifies the resulting proof in memory, and
only then writes the JSON fixtures. Git is a generation-time dependency only; CI reads the checked-in
JSON.
