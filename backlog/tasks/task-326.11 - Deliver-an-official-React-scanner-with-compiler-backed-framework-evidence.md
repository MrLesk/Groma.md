---
id: TASK-326.11
title: Deliver an official React scanner with compiler-backed framework evidence
status: Done
assignee:
  - '@scanner_react'
created_date: '2026-09-09 12:59'
updated_date: '2026-09-09 13:20'
labels:
  - scanners
dependencies:
  - TASK-326.8
references:
  - TASK-326.9
  - scanner
documentation:
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/react/package.json
  - plugins/scanners/react/src/scan.ts
  - plugins/scanners/react/src/index.ts
  - bun.lock
  - plugins/scanners/react/build.ts
  - docs/scanners/react/index.md
  - docs/scanners/react/validation.md
  - test/fixtures/react-callback/package.json
  - test/fixtures/react-callback/tsconfig.json
  - test/fixtures/react-callback/editor.tsx.fixture
  - test/fixtures/react-callback/host.tsx.fixture
  - test-bun/react-scanner.test.ts
  - plugins/scanners/react/.gitignore
  - plugins/scanners/react/smoke.ts
parent_task_id: TASK-326
type: feature
ordinal: 373000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers can install a separate React scanner alongside embedded TypeScript and obtain useful framework evidence through the existing discovery, readiness, scan, and architecture-review journey. Follow the established Angular plugin approach: use maintained compiler, parser, and semantic tooling; preserve Groma's embedded TypeScript 7.1 SDK; keep compatible tooling local to the plugin where required. Do not create a competing language name/type resolver.

Start with one small real-project interaction and one independent fixture. The first investigation should establish a JSX component callback prop and its explicitly supplied handler, its exact original source locations, and the limits of the selected analysis tooling. Present the concrete source witnesses and bounded extraction plan to the coordinator before implementation; implement only that approved slice. Do not generalize to state stores, routing, server components, dependency injection, all framework APIs, or cross-service communication without an approved example.

Framework constructs and compiler objects are temporary evidence, not automatic C4 components or new OKF concepts. Existing core owns architecture inference, source ownership, complementary evidence, conflicts, and Markdown. Preserve one physical-file owner across scanners; uncertain claims must not become certain relationships. Source and supported template/JSX edits participate in rescans, and failed enabled scans preserve the previous architecture.

Deliver a real installable packed artifact and compiled-Groma consumer proof with the required project tooling documented. Public names, publication, and additional-platform release qualification remain coordinated in TASK-326.7; do not claim unexecuted or unpublished support.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A separate React plugin loads and runs in compiled Groma alongside embedded TypeScript without replacing its compiler SDK.
- [x] #2 Maintained React/language tooling establishes project membership and supported identities; exact tool and project versions are documented and missing prerequisites produce actionable readiness results.
- [x] #3 One coordinator-approved a JSX component callback prop and its explicitly supplied handler contributes concrete shared-contract evidence beyond the ordinary language scan; unsupported or ambiguous cases are explicit and original source positions are correct.
- [x] #4 Overlapping scanner contributions preserve one curated physical-file owner and reuse the existing complementary/conflicting-evidence rules without a plugin-priority winner.
- [x] #5 Supported source/template edits rescan, repeated scans preserve curated ownership and authored relationships, and an enabled scanner failure preserves the previous complete map.
- [x] #6 An independent fixture and one pinned real React project pass the packed-artifact consumer journey and coordinator map review; documentation states the exact supported scope and remaining qualification limits.
- [x] #7 Focused tests, the repository check, implementer specification/quality reviews, cold simplicity review, and final full-context review pass before technical acceptance.
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
1. Use plugin-local TypeScript 6.0.3 to read root tsconfig and resolve direct React TSX component callback bindings for the approved pinned Backlog CleanupModal onSuccess example. 2. Package the compiler and declarations independently of embedded TypeScript 7.1; add a minimal independent TSX fixture and focused shared-evidence, ownership, watch, readiness, and failure-preservation tests. 3. Run the actual packed artifact through compiled Groma against fixture and pinned Backlog source, preserve curation/authored relationships across repeats and edits, export the map for coordinator review. 4. Complete focused checks, cold simplicity review, implementer specification/quality reviews, coordinator serial repository check and final full-context review; document precise scope and qualification limits.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Coordinator approved Backlog commit 660cb98206660a43dfd6e52a8038fde50693074a TaskList onSuccess binding to CleanupModal direct destructured prop invocation. TS6.0.3 compiler proof resolves binding and handler; archived source and frozen dependencies prepared in /tmp/groma-react-research/project. Root config-owned TSX semantic checks are in scope; one unrelated MCP server semantic error means this is not a whole-project type-check claim.

First implementation reports the approved Backlog binding with caller offset 1703, invocation 1898, JSX attribute 37623, handler 18551. Four focused packaged-fixture tests passed (29 assertions); scoped lint clean. Root dependency lease integrated React/Vue manifests with 89 additive lock lines; compiler resolution React6.0.3,Vue5.9.3,Angular5.9.3,embedded7.1 unchanged. Packed consumer uses /tmp/groma-react-research/groma built from current shared sources because older binary predates React discovery. First source-removal experiment hit Backlog noUnusedParameters; adjusted disposable edit to retain a harmless prop reference while removing the call, preserving the approved strict TSX preparation boundary.

Actual npm-packed React plugin passed compiled-Groma consumer journeys for pinned Backlog and independent fixture. Backlog proof /tmp/groma-react-research/proof; fixture proof /tmp/groma-react-research/fixture-proof; exported maps and validation.json/commands.json retained. Real scan83TSX/25bindings/166explicitdiagnostics; all316architecture documents preserved on repeat and failure;507source/config files restored byte-identical to pinnedHEAD. Four focused tests now pass30assertions including both conflict orders; lint and root typecheck pass. Cold simplicity review passed without findings. Implementer specification review confirms AC1-5 and artifact portion of AC6; map review and shared/full-context gates remain. Quality review confirms compiler-owned identities, bounded direct JSX extraction, no shared SDK/core changes, no partial reconciliation, and no blocking defects in the supported flow.

Coordinator browser map review passed at http://127.0.0.1:48329/?relationship=cleanupmodal/tasklist served from proof/map. Cleanupmodal retains curated responsibility, derived onSuccess points to Tasklist with React evidence, authored Tasklist-to-Cleanupmodal remains. General auto-inferred map grouping is outside scope. AC6 now verified; AC7 awaits coordinator serial full check and final full-context review.

Final coordinator gates passed: full-context review required no changes; serial bun run check passed with 110 Node tests and 398 Bun tests, seven existing tooling-dependent skips, zero test failures, and six pre-existing complexity warnings. Validation document now records these results. Qualification remains local macOS arm64 with Bun 1.4.1 and compiled Groma; no public publication or additional-platform claim. Per coordinator direction, task remains In Progress and uncommitted pending serialized finalization after TASK-326.7 helper delivery.

Coordinator technical acceptance is complete. Actual packed fixture and pinned Backlog journeys, original-source positions, curated ownership, complementary/conflicting evidence, source rescan, failure preservation and rendered-map review all pass. Cold, implementer specification/quality and full-context reviews pass; shared repository check passes at /tmp/groma-vue-react-check.log. The shared artifact-registry helper is committed under TASK-326.7; this commit includes only remaining React-owned lock additions. Public publication and additional-platform release qualification remain TASK-326.7.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered a separate compiler-backed React scanner for the approved direct JSX callback-prop interaction. A plugin-private TypeScript compiler supplies source identities and positions through the existing evidence contract, preserving embedded TypeScript. Verified actual packed fixture and pinned Backlog consumers, source edits, curated ownership, failed-scan preservation, rendered map, all reviews and the shared repository check. Local macOS arm64 technical acceptance is complete; public and other-platform qualification remains separate.
<!-- SECTION:FINAL_SUMMARY:END -->
