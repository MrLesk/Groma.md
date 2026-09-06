---
id: TASK-317
title: Resolve embedded files through Bun standalone detection
status: Done
assignee:
  - '@cursor-agent'
created_date: '2026-09-06 21:20'
updated_date: '2026-09-06 21:26'
labels: []
dependencies: []
references:
  - web-server
  - typescript-scanner
  - build
  - agent-instructions
modified_files:
  - src/compiled-asset.ts
  - src/viewers/web/compiled-asset.ts
  - src/viewers/web/compiled-marker.txt
  - src/viewers/web/runtime.ts
  - src/viewers/web/chrome/credits.ts
  - src/agent-instructions.ts
  - plugins/scanners/typescript/src/worker.ts
  - scripts/smoke-compiled-build.ts
  - .github/workflows/release.yml
  - CONTRIBUTING.md
  - test-bun/web-startup.test.ts
  - groma/systems/groma/containers/scanner/components/build.md
  - groma/systems/groma/containers/web-viewer/components/web-server.md
ordinal: 355000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The v0.0.1 release failed on both Windows targets: `groma.exe agent-instructions` looked for `B:\~BUN\docs\agent-instructions\index.md`, one level above the embedded root. `src/agent-instructions.ts` detects a compiled binary by searching `import.meta.dir` for `$bunfs`, which is only the POSIX embedded root; Windows uses `B:\~BUN\root`, so the source-mode path was used inside the binary. The codebase has three different compiled-mode detections (that substring check, a marker file imported with `type: file`, and `existsSync` on two hard-coded roots). Bun documents `Bun.isStandaloneExecutable` for detection and `import.meta.dir` as the location of `compile.assets` at runtime; every embedded lookup should use those.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Compiled `groma agent-instructions` prints the curation guide on every release target, verified by the release smoke script rather than a separate workflow step
- [x] #2 One `compiledAsset` helper in `src/` detects a standalone executable with `Bun.isStandaloneExecutable` and resolves embedded paths under `import.meta.dir`; the marker file and `$bunfs` substring check are removed
- [x] #3 The TypeScript worker module uses the same detection and asset location
- [x] #4 Source mode under Bun and Node (tsx) is unaffected
- [x] #5 `bun run check`, `bun run build`, and the smoke script pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verified in a bytecode probe binary (Bun 1.4.1): `Bun.isStandaloneExecutable` is true only in the compiled binary, `import.meta.dir` is the embedded root for every bundled module, and `compile.assets` directories resolve under it.
2. Move `compiledAsset` to `src/compiled-asset.ts`, implemented as `Bun.isStandaloneExecutable ? path.join(import.meta.dir, ...parts) : undefined` with a `globalThis.Bun` guard for Node; delete `src/viewers/web/compiled-asset.ts` and `compiled-marker.txt`; update `runtime.ts` and `credits.ts` imports.
3. `src/agent-instructions.ts`: `compiledAsset("docs", "agent-instructions", "index.md") ?? new URL(...)`.
4. `plugins/scanners/typescript/src/worker.ts`: replace the two hard-coded roots with the same detection and `import.meta.dir`.
5. `scripts/smoke-compiled-build.ts`: run `agent-instructions` and assert exit 0 with non-empty output; drop the now-redundant line from release.yml.
6. `bun run check`, `bun run build`, smoke; `groma scan` to re-place the moved file and fold it into `web-server` if needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: `src/agent-instructions.ts` recognised a compiled binary by the `$bunfs` substring in `import.meta.dir`; Windows embeds under `B:\~BUN\root`, so the binary resolved the source-mode `../docs` URL one level above the embedded root and failed with ENOENT. Bun documents `Bun.isStandaloneExecutable` for the mode check and `import.meta.dir` as the runtime location of `compile.assets`; a bytecode probe binary confirmed both (every bundled module reports the embedded root as `import.meta.dir`).

Changes: one `compiledAsset(...parts)` in `src/compiled-asset.ts` (guarded by `globalThis.Bun?.` so Node/tsx tests can load it) replaces the web `compiled-asset.ts` marker-file detection and the substring check; `runtime.ts`, `credits.ts`, and `agent-instructions.ts` use it. The TypeScript scanner plugin cannot import `src/`, so `worker.ts` applies the same two documented calls in place of `existsSync` on two hard-coded roots. `scripts/smoke-compiled-build.ts` now runs `agent-instructions` and asserts output, which covers both CI and release on all five targets; the duplicate release.yml line is gone. `src/compiled-asset.ts` scanned into a new component and was combined into `build`, which now has an overview.

Also in this change: `test-bun/web-startup.test.ts` reports the `groma/` tree and payload generation when the live-scan wait times out, so the intermittent Windows failure tells whether the source event was missed or the fold was never published. It does not change what the test asserts; the Windows flake itself is not root-caused (not reproducible on macOS; watchers subscribe before the 303 redirect, so it is not a subscribe race).

Verification: `bun run check` (342 Bun tests, Node suite green, only pre-existing complexity warnings), `bun run build`, `bun scripts/smoke-compiled-build.ts dist/groma <version>`, and `dist/groma agent-instructions` from `/tmp`.
<!-- SECTION:NOTES:END -->
