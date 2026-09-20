---
id: TASK-337
title: Resolve Rust manifest paths with native path semantics
status: Done
assignee:
  - '@codex'
created_date: '2026-09-10 21:53'
updated_date: '2026-09-10 21:57'
labels: []
dependencies: []
references:
  - rust-src-scanner-index
modified_files:
  - plugins/scanners/rust/native/src/scan.rs
  - test-bun/rust-scanner.test.ts
type: bug
ordinal: 383000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Rust worker rejects a Windows manifest inside the repository because it compares strings using an appended forward slash. Derive the repository-relative manifest using native path components and normalize the output to forward slashes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A manifest inside the repository yields a relative Cargo root and file memberships using native Windows or POSIX paths.
- [x] #2 Existing Rust semantic evidence remains unchanged.
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
Replace the manifest string prefix operation with Path.strip_prefix, matching source-file handling. Extend real-worker coverage for relative root identity and memberships; rebuild the worker and run its integration tests plus repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A standalone Rust reproduction confirms that the existing string prefix rejects C:\work\app\Cargo.toml under C:\work\app. Replaced that operation with the same native Path.strip_prefix used for source files; output still uses forward slashes. Existing real-worker fixture now verifies relative manifest root identity and source memberships. No schema, ownership, or C4/OKF semantics change.

Specification and quality review: manifest derivation now uses native Path components, exactly as existing source-file derivation does; normalization and observation semantics are unchanged. Standalone Rust reproduction confirmed the old string operation rejects a Windows manifest inside its root. Rebuilt the native package; all 6 Rust tests passed, including 4 real-worker integrations and relative manifest root/membership assertions. Final macOS ARM64 repository check passed with that worker enabled: 110 Node and 433 Bun tests, 3 optional skips, zero failures. Actual Linux/Windows execution remains unverified here; no cross-platform run is claimed. Existing documented contract is restored, so no documentation revision is needed. Release validation is out of scope. Uncommitted pending user acceptance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the Windows-incompatible manifest string prefix with native Path.strip_prefix and retained forward-slash observation paths. Verified the original Windows string failure, rebuilt the native worker, and passed all Rust integrations plus the full macOS ARM64 repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
