# TASK-173 Trial 1 evidence

`TASK-173-trial1-20260825.tar.gz` is the self-contained final evidence for the control and rejected exclusive-private-callee strategies.

- SHA-256: `aa6c2497cc5d234bc2296e06b2b115edf549be5336eb26e1d1faa51c142ebee2`
- Size: 3,463,422 bytes
- Files: 1,929
- Archive entries: 2,727
- Extracted-content digest: `deba7e19dd3a6cfe9a73e2d29899bd865b2fdbdcb2456ca4fb85912c6da4b5b6`

The archive contains the three exact frozen repositories, including their small Git indexes and object databases; `manifest.json`; all 30 raw runs; both prepared reports; six per-repository metric snapshots; and the three Trial 1 audits.

The `experiment/` directory makes the record executable in its original repository layout. It contains the pinned production source boundary and lockfile plus `experiments/scanner/`, which holds the conclusion, expectations, runner, scorer, strategy sources, durable reports and audits, and the six required cold review records. It contains no machine-root metadata, and the frozen repositories retain working Git indexes.

Restore and verify:

```sh
restore_root=$(mktemp -d)
tar -xzf experiments/scanner/evidence/TASK-173-trial1-20260825.tar.gz -C "$restore_root"
cd "$restore_root/TASK-173-trial1-20260825"
find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256 | shasum -a 256
```

The final command must print the extracted-content digest above. Prepared reports can then be compared with the durable copies inside the archive:

```sh
cmp publish/current-v3/report.json experiment/experiments/scanner/results/trial1/control/report.json
cmp publish/exclusive-private-callee-v3/report.json experiment/experiments/scanner/results/trial1/exclusive-private-callee/report.json
```

To reproduce both five-run comparisons, install the locked dependencies inside the extracted experiment, then use the same runner and frozen target list:

```sh
cd experiment
bun install --frozen-lockfile
bun experiments/scanner/run.mts run --strategy current --corpus-root .. \
  --target groma3=../corpora/groma3 \
  --target backlog-md=../corpora/backlog-md \
  --target codex-hackathons=../corpora/codex-hackathons
bun experiments/scanner/run.mts run --strategy exclusive-private-callee --corpus-root .. \
  --target groma3=../corpora/groma3 \
  --target backlog-md=../corpora/backlog-md \
  --target codex-hackathons=../corpora/codex-hackathons
```

The archive was created from a sorted entry list with fixed timestamps, normalized owner fields, no extended attributes, and a timestamp-free gzip header:

```sh
evidence_parent=$(pwd)
find TASK-173-trial1-20260825 -exec touch -t 202608250000 {} +
find TASK-173-trial1-20260825 -print | LC_ALL=C sort > archive-entries.txt
COPYFILE_DISABLE=1 tar --no-recursion --format ustar --uid 0 --gid 0 \
  --uname root --gname root --no-xattrs -cf TASK-173-trial1-evidence.tar \
  -C "$evidence_parent" -T archive-entries.txt
gzip -n -9 -c TASK-173-trial1-evidence.tar > TASK-173-trial1-20260825.tar.gz
```
