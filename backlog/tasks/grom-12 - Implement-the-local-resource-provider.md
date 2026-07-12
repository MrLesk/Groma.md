---
id: GROM-12
title: Implement the local resource provider
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 07:05'
labels:
  - persistence
  - resources
milestone: m-1
dependencies:
  - GROM-5
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the official Bun-backed local resource capability used by configuration and canonical persistence without leaking filesystem concepts into Core. Provide confined reads, bounded enumeration, coordination, staged writes, and atomic replacement with explicit unsupported-context diagnostics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Callers use typed resource locators and capability methods rather than Bun file APIs or raw filesystem paths outside the provider
- [ ] #2 Workspace-scoped locators reject traversal or resolution outside the selected workspace boundary
- [ ] #3 Reads distinguish missing, unreadable, malformed-locator, and provider-failure outcomes
- [ ] #4 Enumeration requires explicit bounds, returns deterministic order, and reports truncation or continuation without silently loading an unbounded tree
- [ ] #5 Atomic replacement never exposes a partially written target and preserves either the prior or replacement bytes across injected failures
- [ ] #6 Local coordination supports the documented 1A host contexts and returns an explicit unsupported diagnostic elsewhere
- [ ] #7 Temporary-directory tests cover Unicode paths, interrupted writes, concurrent coordination, traversal attempts, ordering, and bounds
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define technology-neutral branded workspace resource locators, bounded capability requests/results, stable diagnostics, staged-replacement handles, and local coordination contracts in the persistence boundary; reject forged runtime shapes and non-portable path segments before filesystem access.
2. Implement the Bun local provider around one canonicalized workspace root. Confine every operation lexically and through real-path/symlink checks, keep absolute paths private, classify missing/unreadable/malformed/provider failures, and use Bun-supported node:fs primitives only where the current Bun file API lacks the required operation.
3. Add byte-bounded regular-file reads and deterministic bounded recursive enumeration. Stream and cap each directory before sorting, bind opaque continuation cursors to the enumeration request, avoid following links, and report page continuation or explicit size/depth/provider diagnostics.
4. Implement same-directory staged replacement with exclusive creation, complete writes, file sync, close, atomic rename-over-target, and cleanup. Return explicit not-committed versus committed/indeterminate outcomes around the rename boundary and provide phase fault injection for write, flush, rename, and cleanup tests.
5. Implement callback-scoped local-machine coordination using an atomic local lock primitive outside canonical workspace contents, including same-process contention and safe stale-owner handling. Return an explicit unsupported-context diagnostic for shared or multi-host coordination.
6. Add boundary-local temporary-directory tests for Unicode and portable locators, traversal and symlink escape, missing/unreadable/provider failures, deterministic ordering/cursors/bounds, concurrent coordination, unsupported contexts, and every staged replacement fault phase while proving targets expose only old or new complete bytes.
7. Run focused/full checks and all four standalone targets, complete independent specification and quality reviews, publish a ready task-linked PR, run Claude for naming/simplicity/user perspective, and wait for Codex acceptance/comments before finalization and merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 persistence and portability boundary. GROM-12 belongs in src/persistence and exposes capability contracts rather than Core semantics. Current Bun documentation recommends Bun.file and Bun.write for ordinary file I/O and Bun node:fs compatibility for missing operations; the provider needs bounded FileHandle reads, exclusive staging, FileHandle.sync, realpath, lstat, opendir, and rename-over-target, so those Bun-supported node:fs APIs remain private to the implementation. The official 1A host is interpreted as same-machine local processes; hosted and shared-filesystem multi-host coordination is explicitly outside v0.1 and returns unsupported-context. Portable locator validation and symlink rejection keep the same contract safe on macOS arm64, Linux x64, Windows x64, and Windows arm64.

Implemented the persistence-local resource contracts and Bun provider without Core filesystem changes. Portable branded locators revalidate runtime strings, accept well-formed Unicode, and reject traversal, separator, absolute, drive, and UNC injection, Windows ADS, device, and trailing-name hazards, and size overflow. Reads use bounded FileHandle I/O and stable diagnostics. Enumeration streams and caps each directory before deterministic sorting, prunes cursor resumes, enforces explicit page, depth, and directory budgets, reports depth truncation and overflow, and never follows links. Replacements copy caller bytes into an exclusive same-directory stage, fully write, sync, close, and rename with provider-owned handles and explicit not-committed, committed, and committed-indeterminate outcomes. Persistence-local fault injection covers read, enumeration, partial write, flush, rename, after-rename, and cleanup. Same-machine callback coordination uses volatile atomic lock and reaper directories outside the canonical workspace, process-local contention protection, conservative dead-owner recovery, and typed unsupported diagnostics for shared and multi-host contexts.

Validation: focused persistence suite passes 24 tests. bun run check passes formatting, strict TypeScript, architectural boundaries, all 141 repository tests and 627 assertions, native build, and smoke. bun run check:targets verifies all four promised artifacts and restores the native binary. The persistence entry was also compiled directly for bun-darwin-arm64, bun-linux-x64-baseline, bun-windows-x64-baseline, and bun-windows-arm64. git diff --check passes. Windows and Linux results are cross-compilation only, not native runtime claims. Documentation records contracts, guarantees, coordination scope, and the official Bun file-I/O and node:fs rationale.
<!-- SECTION:NOTES:END -->
