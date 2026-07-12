---
id: GROM-12
title: Implement the local resource provider
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:34'
updated_date: '2026-07-12 08:54'
labels:
  - persistence
  - resources
milestone: m-1
dependencies:
  - GROM-5
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - src/persistence/contracts.ts
  - src/persistence/README.md
  - src/persistence/local-resource-provider.ts
  - src/persistence/tests/contracts.test.ts
  - src/persistence/tests/fixtures/coordination-child.ts
  - src/persistence/tests/local-resource-provider.test.ts
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

Specification review corrections: stageReplacement now initializes missing workspace parents one segment at a time and revalidates every created or concurrently existing segment with lstat and realpath as an in-root non-link directory. Tests cover several missing Unicode parents, concurrent EEXIST creation, existing non-directory and link parents, and a deterministic parent swap. The provider reserves the case-insensitive .groma-stage- namespace in every locator segment, counts but filters those siblings during bounded enumeration, and rejects reads or replacements addressed through forged branded locators. The exact two-provider tamper regression now proves the observer cannot enumerate, read, or replace a live stage and the owner commits the original copied bytes. Live handles remain process-local; GROM-14 must journal the target locator and replacement bytes, restage after restart, and own private orphan cleanup policy. Same-machine coordination now has a real Bun child-process test with an IPC ready and release handshake, bounded timeouts, and forced cleanup. Documentation uses current bun.com links. There is exactly one fault injector assignment.

Correction validation: focused persistence tests pass 30 tests and 110 assertions. bun run check passes formatting, strict TypeScript, architectural boundaries, all 147 repository tests and 652 assertions, native build, and smoke. bun run check:targets passes all four promised targets. The final persistence entry directly cross-compiles for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64. git diff --check passes. Windows and Linux remain cross-compilation results rather than native runtime claims.

Quality review corrections: provider configuration now has exported absolute ceilings and rejects zero, fractional, unsafe, and over-ceiling values for read bytes, replacement bytes, page size, entries per directory, recursion depth, cursor bytes, and stale-lock duration. Reads retain safe one-byte overflow probes under a 64 MiB ceiling. Replacement input has a separate 16 MiB default and 64 MiB ceiling, returns replacement-too-large before copying, and uses captured TypedArray intrinsic getters to snapshot genuine Uint8Array values and subclasses without invoking Proxy traps; DataView and other typed arrays fail with typed diagnostics.

Coordination identity now uses a conservative NFC-normalized and case-folded canonical workspace plus absolute resource key, so case and composed/decomposed aliases over-contend across providers and child processes. Canonical lock directories are published only by atomically renaming unique candidate directories after the owner file and candidate directory are fully written, synced, and closed. Populated reaping claims serialize recovery; killed owners and abandoned reaping claims move to unique quarantines before best-effort cleanup. Release likewise moves the canonical lock first, so cleanup failures leave only ignored artifacts and cannot block reacquisition. Tests cover interrupted claim publication, malformed external locks, a killed valid child owner, concurrent reapers/acquirers, cleanup failure, and repeated race probes.

Coordination roots now reject symlinks and workspace redirection. POSIX roots require current-user ownership and no group or other bits, while the user-scoped default is tightened to mode 0700. Windows uses the per-user temporary root and platform ACL behavior without a native-runtime claim. Documentation records all ceilings, byte validation, aliasing, claim/quarantine behavior, and root security.

Quality validation: focused persistence tests pass 37 tests and 172 assertions. bun run check passes formatting, strict TypeScript, architectural boundaries, all 154 repository tests and 714 assertions, native build, and smoke. bun run check:targets passes all four promised targets. The final persistence entry directly cross-compiles for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64. The killed-owner concurrent recovery test also passed ten repeated runs. git diff --check passes. Windows and Linux remain cross-compilation results rather than native runtime claims.

Windows final policy correction: owner-record exclusive write, sync, and close remain all-platform, while candidate-directory open and sync are now POSIX-only. Windows retains atomic candidate-directory rename publication and rejects any custom coordinationRoot before workspace or coordination filesystem access, always selecting the provider default beneath the per-user temporary directory. Documentation limits the guarantee to process-crash and same-machine concurrency safety and makes no Windows power-loss directory-durability claim. Tests encode the platform policy structurally, omit custom coordination roots from Windows fixtures and child IPC, and keep POSIX root permission and owner coverage conditional. Validation: focused persistence tests pass 38 tests and 178 assertions. bun run check passes formatting, strict TypeScript, architectural boundaries, all 155 repository tests and 720 assertions, native build, and smoke. bun run check:targets passes all four promised targets. The persistence entry directly compiles for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64. git diff --check passes. Linux and Windows results remain cross-compilation only, not native runtime claims.

Claude review cleanup: every rejects assertion in the persistence provider test is now awaited, including configuration ceilings and POSIX coordination-root permission and ownership checks. Coordination callback exceptions now return coordination-action-failed. Release failures return coordination-release-failed with actionCompleted and preserve underlying release diagnostics; combined failures retain both outcomes, and tests prove each callback runs exactly once. Stale-owner replacement reacquisition is capped at eight attempts with resource-coordination-retry-exhausted and a deterministic repeated-replacement probe. Direct request tests cover read byte limits above the configured provider bound and negative enumeration depth. Documentation records callback and release semantics plus the residual lstat-to-opendir and resolve-to-rename race windows and the non-hostile namespace-mutation assumption. Validation: focused persistence tests pass 43 tests and 196 assertions. bun run check passes formatting, strict TypeScript, architectural boundaries, all 160 repository tests and 738 assertions, native build, and smoke. bun run check:targets passes all four promised targets. The persistence entry directly compiles for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64. git diff --check passes. Linux and Windows remain cross-compilation only, not native runtime claims.

Codex review corrections: same-process coordination now uses a callback readiness promise before contention, with no timing sleep. Replacement stages remain private mode 0600 while awaiting commit; commit re-resolves the target, applies its current permission and executable bits through the open stage handle or uses 0666 masked by the current umask for a missing target, syncs, closes, and renames. Windows retains Bun and Node chmod semantics without an ACL-preservation claim. Rename success now transitions to renamed-pending-finalization. POSIX syncs the target parent directory before committed acknowledgement, while Windows skips unsupported directory sync; parent-sync and after-rename failures return committed-indeterminate and repeated commit retries finalization to committed. Enumeration re-resolves the expected non-link directory at every walk entry and immediately before depth-limit inspection; a deterministic namespace-swap test proves outside entries are never returned. Validation: focused persistence tests pass 46 tests and 214 assertions. bun run check passes formatting, strict TypeScript, architectural boundaries, all 163 repository tests and 756 assertions, native build, and smoke. bun run check:targets passes all four promised targets. The persistence entry directly compiles for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64. git diff --check passes. Linux and Windows remain cross-compilation only, not native runtime claims.

Fresh Codex review corrections: replacement publication now renames the still-private mode-0600 sibling before any mode widening. The freshly resolved prior target mode or masked-0666 missing-target policy is stored on the handle record; renamed-pending-finalization then applies that mode through the target handle, syncs the target file, syncs the POSIX parent directory, and acknowledges. A deterministic post-rename pre-mode fault proves complete new bytes remain mode 0600 with committed-indeterminate, and retry restores the intended mode and reaches committed. Pre-rename rename failure leaves the stage private and not committed, so obsolete private-mode restoration machinery and its controller regression were removed. First-time parent creation now tracks successful mkdir calls and POSIX-syncs each containing directory top-down after confinement validation; a fault regression aborts staging before a target exists, and the successful Unicode chain proves all three new ancestors are synced. Windows skips unsupported directory sync. The locator factory now passes its joined segments through the parser so the 4096-byte total UTF-8 ceiling matches parsed runtime input; many individually valid segments above the total budget are rejected. Validation: focused persistence tests pass 48 tests and 223 assertions. bun run check passes formatting, strict TypeScript, architectural boundaries, all 165 repository tests and 765 assertions, native build, and smoke. bun run check:targets passes all four promised targets. The persistence entry directly compiles for macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64. git diff --check passes. Linux and Windows remain cross-compilation only, not native runtime claims.
<!-- SECTION:NOTES:END -->
