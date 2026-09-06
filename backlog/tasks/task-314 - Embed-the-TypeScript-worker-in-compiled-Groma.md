---
id: TASK-314
title: Embed the TypeScript worker in compiled Groma
status: Done
assignee:
  - '@cursor-agent'
created_date: '2026-09-06 20:25'
updated_date: '2026-09-06 20:40'
labels: []
dependencies: []
references:
  - typescript-scanner
  - smoke-compiled-build
modified_files:
  - scripts/build.ts
  - plugins/scanners/typescript/src/worker.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - scripts/smoke-compiled-build.ts
  - CONTRIBUTING.md
  - groma/systems/groma/containers/scanner/components/typescript-scanner.md
ordinal: 352000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A user with only the single-file Groma binary who scans a repository without `@typescript/typescript-<os>-<cpu>` must get the same TypeScript evidence as source Groma: import specifiers, operations, and invocations from the TypeScript 7 checker. Today the compiled binary either borrows the scanned project's native `tsc` or falls back to regex export names with no specifiers, operations, or invocations, so maps of ordinary projects are incomplete. The build must embed the build-target native TypeScript worker and the scanner must spawn it from a real filesystem path; the degraded fallback and the borrowed-`tsc` path are removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Compiled `groma web` on a temporary project without `node_modules/@typescript` derives the same relationship from operations and invocations as a source scan of the same files
- [x] #2 Source mode (`bun` or `tsx`) keeps constructing `new API({ cwd })` without extracting or resolving any worker path
- [x] #3 `scripts/build.ts` embeds only the build-target `tsc` (or `tsc.exe`) and `lib.d.ts`, mapped from `GROMA_BUILD_TARGET` or the host platform
- [x] #4 `analyzeWithoutWorker` and the borrowed scanned-project `tsc` path no longer exist
- [x] #5 `scripts/smoke-compiled-build.ts` fails without the fix by asserting the derived relationship in `/world.json`, not only HTTP status
- [x] #6 CONTRIBUTING.md describes compiled TypeScript scanning accurately and the architecture code list of `typescript-scanner` covers any new file
- [x] #7 `bun run check` passes and `bun run build` followed by the smoke script passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verified: the native `tsc` starts only when `lib.d.ts` sits beside it; with `noLib: true` those two files are the whole worker (probe with the async API from a temp copy succeeded).
2. `scripts/build.ts`: map `GROMA_BUILD_TARGET` (or host platform/arch) to `@typescript/typescript-<os>-<cpu>`, copy `lib/tsc[.exe]` and `lib/lib.d.ts` into a packed asset directory `groma-typescript-worker`, add it to `compile.assets`.
3. New `plugins/scanners/typescript/src/worker.ts`: when the Bun packed root exists (`/$bunfs/root` or `B:\~BUN\root`), unpack the embedded worker once per TypeScript version into `os.tmpdir()/groma-typescript-worker-<version>` through a staged rename and reuse it; return undefined from source.
4. `source-analysis.ts`: delete `analyzeWithoutWorker`, `nativeTsc`, `compiledRuntime`; pass `tsserverPath` from `worker.ts` into `new API({ cwd, tsserverPath })` only when defined.
5. `scripts/smoke-compiled-build.ts`: scan a temp project built from `test/fixtures/empty-project` plus `test/fixtures/operation-wiring` under `src/`; after `/ready`, assert `/world.json` contains the worker→provider derived connection.
6. Update CONTRIBUTING.md compiled-scan sentence; `groma scan` placed `worker.ts` as its own component, folded into `typescript-scanner` with `groma edit typescript-scanner --combine worker`.
7. `bun run check`, `bun run build`, smoke script against `dist/groma`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Worker cache: a per-process temp directory with an `exit` cleanup was tried first, but `groma web` has no signal handler, so a Ctrl-C kill never ran it and every run leaked a 25MB copy. Replaced with one directory per TypeScript version in the OS temp directory, filled through a staged rename; three racing compiled `groma scan` runs on an empty cache all succeeded with one directory.

Verification: `bun run check` green (340 pass). `bun run build` then `bun scripts/smoke-compiled-build.ts dist/groma 0.1.0` passes; the same script against a binary built from cd232ab (the regex fallback) fails with "expected the worker → provider connection in []". Smoke also passes from a copy of the binary outside the checkout. Cross-target builds for bun-windows-x64-baseline (contains tsc.exe) and bun-linux-arm64 complete. Source mode: `existsSync("/$bunfs/root")` is false under bun, and node/tsx and bun test suites exercise the scanner without a worker path.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Compiled Groma now embeds the build target's native TypeScript worker (`tsc` + `lib.d.ts`) and the TypeScript scanner spawns it from a per-version directory in the OS temp directory, so a standalone binary scanning a project without `@typescript/typescript-<os>-<cpu>` yields the same checker-derived specifiers, operations, and invocations as source Groma. The regex fallback and borrowed-`tsc` path are deleted. Verified with `bun run check`, a rebuilt `dist/groma`, and the extended smoke script, which fails on the previous binary and passes on the new one.
<!-- SECTION:FINAL_SUMMARY:END -->
