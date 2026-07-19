---
id: GROM-43
title: Expose the automatic scan workflow through the CLI
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:58'
updated_date: '2026-07-19 17:39'
labels: []
milestone: m-3
dependencies:
  - GROM-30
  - GROM-39
  - GROM-40
  - GROM-41
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the existing built-in scanner and reconciliation path through one deterministic public CLI command. After groma init, groma scan configures the initialized default project with the built-in TypeScript/Bun scanner and runs it, or selects an existing configured project and scanner without inventing new semantics. This slice stops at a completed canonical scan report and the already-supported blueprint reads; generalized evidence queries remain GROM-42 and the visual artifact remains GROM-52.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After groma init, groma scan configures the default current-workspace project for the official TypeScript/Bun scanner, executes it, reconciles the completed snapshot, and leaves a nonempty blueprint for supported TypeScript/Bun input
- [x] #2 With existing registrations, scan defaults only when exactly one project and one scanner are available; --project and --scanner select explicitly, while ambiguous or unavailable selections fail without starting a scan
- [x] #3 Plain and JSON output deterministically report the selected scanned project, scanner, bounded observation counts, diagnostics, and terminal status; completed succeeds, cancelled uses the cancellation exit, indeterminate preserves recovery and uses the indeterminate exit, and failures are nonzero
- [x] #4 The default workflow performs no AI call, upload, project code execution, or write outside the local Groma workspace
- [x] #5 An unchanged rescan leaves canonical bytes unchanged, while a failed, cancelled, or indeterminate scan never erases curated intent or the last complete blueprint
- [x] #6 Focused parser, surface, and compiled end-to-end fixtures prove init -> scan -> bounded blueprint reads, and Groma runs the command on its own source tree to guide the next slice
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a small scan command contract and parser for optional explicit project and scanner selection. 2. Compose seeded-project configuration, selection, scanner start, completion, and exit mapping directly in the CLI surface using existing project and scanner operations. 3. Update help and focused parser/runtime tests without adding progress infrastructure or a second semantic path. 4. Extend the compiled smoke fixture to prove init -> scan -> blueprint output. 5. Run Groma scan against its own source tree, inspect bounded output, update current product/architecture docs, then run the full gates.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 public cross-layer slice. Supported boundary: one local workspace, the built-in official.typescript scanner, zero or already-configured local project registrations, and one completed bounded result. Explicitly unsupported here: visual opening, generalized evidence/binding queries, interactive progress, concurrent multi-scanner orchestration, and new recovery machinery. The implementation must reuse HostSurfaceContext.projects and scanners directly.

Self-dogfood result: the compiled public command completed against Groma with 62 observations in one batch and two signals. It exposed both curated roots and scanner-owned package/source-boundary/external components, a density signal for the visual slice. A restart-sensitive no-op defect was found: persisted JSON key order made epoch-only snapshots compare unequal. Reconciliation now compares graph data structurally, and repeated self-scans are canonical byte no-ops.

Pre-PR review resolution: the CLI no longer invents a second zero-project registration path or duplicates workspace-name sanitization. Fresh init uses the shared seeded project.default identity, while an uninitialized zero-project registry fails with guidance. The shared default ID is exported by Host; scan diagnostics use one prefix. Public tests now cover plain output, unconfigured selection, cancelled, failed, and indeterminate/recovery mappings. The old plugin instructions were removed and the certification-style benchmark was collapsed to a compact fixture note.

Boundary clarification after review: a zero-project initialized registry is supported only as a deterministic selection failure with init/project-add guidance; automatic scanner configuration is reserved for the seeded project.default registration.

Final local proof: 401 tests passed; formatting, typecheck, and architecture boundaries passed; compiled smoke ran init -> scan -> component list; Iteration 1A compiled workflow and crash recovery passed. Final Groma self-scan completed with 63 records in one batch and two signals, and the immediately repeated scan left the complete canonical diff hash unchanged.

First automatic Codex review handled: fixed pre-start scanner cancellation to exit 130 and added coverage; removed nonexistent verification commands and stale plugin-conformance guidance; documented curated versus scanner-owned roots; removed the obsolete frozen-baseline verifier instructions. Alex's explicitly supplied MANIFESTO.md rewrite remains by product-owner authorization. Full check stayed green with 401 tests, and the review-fix self-scan remained byte-stable.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the public groma scan command over the built-in TypeScript/Bun scanner and existing reconciliation path, with deterministic selection, bounded terminal reports, cancellation/indeterminate handling, byte-stable rescans, compiled smoke coverage, and Groma self-dogfood evidence. Incorporated Alex's documentation rewrite and simplified stale plugin, benchmark, and verification guidance. Verified by 401 tests, bun run check, three green CI jobs, two Terra xhigh reviews, Claude, and the first automatic Codex review; merged as PR #45 (cff9f2b).
<!-- SECTION:FINAL_SUMMARY:END -->
