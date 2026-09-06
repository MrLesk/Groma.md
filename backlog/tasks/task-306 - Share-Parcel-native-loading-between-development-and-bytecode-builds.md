---
id: TASK-306
title: Share Parcel native loading between development and bytecode builds
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 15:38'
updated_date: '2026-09-06 15:41'
labels: []
dependencies: []
modified_files:
  - patches/@parcel%2Fwatcher@2.6.0.patch
  - package.json
  - bun.lock
  - test/fixtures/parcel-watch/probe.ts
  - test-bun/parcel-bytecode.test.ts
  - CONTRIBUTING.md
ordinal: 344000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep Groma imports of @parcel/watcher unchanged while making its native binding visible to Bun 1.4.1 compilation. Apply one dependency patch for development, tests, and standalone builds. Scope is Parcel loading; other standalone packaging gaps remain separate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Development and compilation use the same patched Parcel package without a build-only replacement.
- [x] #2 On macOS ARM64, both source execution and a standalone bytecode executable receive native file events and unsubscribe successfully outside the checkout.
- [x] #3 The dependency patch survives a frozen-lockfile install and bun run check passes.
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
1. Patch existing Parcel platform selection with explicit native requires. 2. Add a focused compiled watcher regression using the unchanged package import. 3. Verify a clean install, focused tests, full repository check, and full Groma startup progress.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented one Bun-managed patch to Parcel 2.6.0. It preserves the existing platform/libc selection and wrapper while spelling out native requires for the packages Parcel already declares. Groma imports are unchanged; no build plugin or standalone-only loader is introduced. CONTRIBUTING documents patch maintenance. This is packaging-only and does not alter OKF metadata, C4 elements, scanner semantics, or architecture ownership.

Verification on Bun 1.4.1 / macOS ARM64: the concurrent regression runs an actual create-event subscription and unsubscribe in source mode and a single-file bytecode binary from an isolated directory. Both pass. A clean temporary checkout with bun install --frozen-lockfile reapplied the patch and passed the same regression. Full bun run check passes: 106 Node tests and 331 Bun tests; six existing complexity warnings. git diff --check passes. Implementer specification and quality reviews found no blocking issue in the scoped change. Other native platforms remain unverified.

Full Groma compiles with --compile --bytecode --format=esm --minify --sourcemap and passes Parcel loading. Startup now fails because welcome/model.ts reads ../../package.json at runtime. This separate executable asset-packaging gap is not fixed by the Parcel task; the full application binary is not release-ready.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Development and bytecode builds share the same patched Parcel native loader. Native event delivery and unsubscribe pass in both modes and after a clean frozen install. Repository checks pass (106 Node, 331 Bun). Full Groma proceeds beyond Parcel and exposes the separate runtime package.json packaging gap.
<!-- SECTION:FINAL_SUMMARY:END -->
