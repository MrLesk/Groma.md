---
id: TASK-346
title: Keep generated component labels distinct and readable
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 07:01'
updated_date: '2026-09-11 07:14'
labels: []
dependencies: []
references:
  - scan-component-naming
  - scan-lifecycle
  - adapter
  - scanner-adapter
  - process
  - scanner-process
  - scan
  - scanner-scan
  - scanner-smoke-compiled
  - smoke-compiled
modified_files:
  - test-bun/scan-component-naming.test.ts
  - src/scan-component-naming.ts
  - src/scan-reconciler.ts
  - docs/scanners/index.md
  - groma/systems/groma/containers/scanner/components/adapter.md
  - groma/systems/groma/containers/scanner/components/scanner-adapter.md
  - groma/systems/groma/containers/scanner/components/process.md
  - groma/systems/groma/containers/scanner/components/scanner-process.md
  - groma/systems/groma/containers/scanner/components/scan.md
  - groma/systems/groma/containers/scanner/components/scanner-scan.md
  - groma/systems/groma/containers/scanner/components/scanner-smoke-compiled.md
  - groma/systems/groma/containers/scanner/components/smoke-compiled.md
  - test-bun/scanner-evidence.test.ts
type: bug
ordinal: 392000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use source-directory context to distinguish repeated file roles before adding container context. Ensure fallback labels remain distinct and new labels avoid existing architecture titles. Preserve existing IDs and authored titles during scans; clarify the four duplicate-label pairs identified in the current Groma map through normal curation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New same-role components get distinct labels based on source context, independent of observation order.
- [x] #2 Fallback hash collisions and existing titles do not produce duplicate generated labels.
- [x] #3 Later scans preserve existing IDs and authored labels; the four reviewed map label pairs become distinguishable.
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
Extend naming regressions for title collisions and incremental scans; prefer directory context and include unavoidable identity suffixes in labels; reserve existing titles when allocating new components. Curate the reviewed pairs using Groma commands and verify the map.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Generated names prefer source-directory context, reserve existing titles and retain unavoidable hash suffixes in displayed names. Naming and reconciliation tests verify ordering, collisions, reserved names and repeat identity. Curated eight titles through Groma commands while preserving IDs and Code references. Existing reconciliation expectations were updated for the approved source-context naming; scenarios were retained. Implementer simplicity, specification and quality review found no authority-backed blocking defect. These are bounded fixes and behavior-preserving refactors, with no new architecture level or stored metadata. Full repository check passed outside the sandbox: 110 Node tests and 447 Bun tests, 3 tooling-dependent skips (Maven and Go), 6 existing lint warnings. macOS ARM64 only; other supported OS/CPU targets were not executed. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Generated names prefer source-directory context, reserve existing titles and retain unavoidable hash suffixes in displayed names. Naming and reconciliation tests verify ordering, collisions, reserved names and repeat identity. Curated eight titles through Groma commands while preserving IDs and Code references. Existing reconciliation expectations were updated for the approved source-context naming; scenarios were retained. Verified by focused tests and the passing repository check on macOS ARM64.
<!-- SECTION:FINAL_SUMMARY:END -->
