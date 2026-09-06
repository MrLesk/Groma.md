---
id: TASK-316
title: Compare compiled and source TypeScript evidence in the release smoke
status: Done
assignee:
  - '@cursor-agent'
created_date: '2026-09-06 21:05'
updated_date: '2026-09-06 21:07'
labels: []
dependencies: []
references:
  - smoke-compiled-build
modified_files:
  - scripts/build.ts
  - scripts/smoke-compiled-build.ts
ordinal: 354000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The release smoke proves a standalone binary scans TypeScript like source Groma by checking one hard-coded connection. It should instead derive the expected connections from a source scan of the same fixture and require the compiled `/world.json` to match, so the assertion states the parity directly. The build maps compile targets to TypeScript platform packages by string rewriting; an explicit map with a clear error names the supported targets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The smoke script computes expected connections with the source TypeScript scanner and relationship inference on the smoke fixture and asserts the compiled world connections equal them
- [x] #2 The smoke script asserts the scanned temp project has no `node_modules`
- [x] #3 `scripts/build.ts` maps each release compile target explicitly and fails with a message naming the unsupported target
- [x] #4 `bun run check`, `bun run build`, and the smoke script pass
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
1. `scripts/build.ts`: replace the target string rewrite with an explicit map of the five release targets to TypeScript platform names; throw naming an unsupported target.
2. `scripts/smoke-compiled-build.ts`: before starting the binary, run `scanTypeScriptSource` + `inferRelationships` on the temp project to get expected `[source, target]` pairs; after `/ready`, assert the compiled world connections equal them; assert the temp project has no `node_modules`.
3. `bun run check`, `bun run build`, smoke against `dist/groma`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Adopted from the fix/embedded-typescript-worker branch (632d22c): source-scan-derived expected connections in the smoke, the no-`node_modules` assertion, and the explicit target map. Not adopted: per-process worker extraction with exit cleanup (re-copies 25MB each run, leaks on hard kill), the bytecode unit test that compiles a binary inside `bun run check` (ci.yml already builds and smokes), and the temporary verification workflow.

Verification: `bun run check` 342 pass; `bun run build` + `bun scripts/smoke-compiled-build.ts dist/groma 0.1.0` pass, expected pairs derived from the source scan equal the compiled world connections; `GROMA_BUILD_TARGET=bun-darwin-x64` fails with "no TypeScript worker mapping for build target bun-darwin-x64"; `bun-windows-arm64` builds and contains tsc.exe.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The release smoke now derives expected connections from a source scan of the smoke fixture and asserts the compiled `/world.json` connections equal them, asserts the fixture has no `node_modules`, and `scripts/build.ts` maps release targets to TypeScript platform packages explicitly with a clear error for unknown targets. Verified with `bun run check`, a rebuilt `dist/groma`, and the smoke script.
<!-- SECTION:FINAL_SUMMARY:END -->
