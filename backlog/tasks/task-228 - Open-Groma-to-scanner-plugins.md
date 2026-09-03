---
id: TASK-228
title: Open Groma to scanner plugins
status: Done
assignee:
  - '@codex'
created_date: '2026-08-31 18:08'
updated_date: '2026-09-03 20:58'
labels: []
dependencies: []
priority: high
type: feature
ordinal: 244000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers can extend Groma with TypeScript-authored scanner modules while Groma remains a self-contained binary. Groma embeds the official TypeScript scanner, manages optional scanner packages explicitly, and reports configured scanner readiness without turning the main welcome actions into package management. Official package publishing, CI, and binary build work are outside this first revision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A developer can run Groma with the embedded TypeScript scanner and explicitly configured scanner modules through one public scanner contract.
- [x] #2 Official scanners live under plugins/scanners and use the same module shape as third-party scanners.
- [x] #3 Groma can install, configure, inspect, and remove project scanner modules without relying on global discovery or an external JavaScript runtime.
- [x] #4 The welcome shows a compact scanner readiness summary, while scanner management commands remain in Advanced commands.
- [x] #5 Official package publishing, CI automation, and standalone-binary build changes are not part of this feature.
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
1. Verify the four completed scanner/plugin slices against the parent acceptance criteria. 2. Run focused scanner-module, welcome, initialization, and work-source tests plus the repository check. 3. Record objective evidence, run the required reviews, and finalize the parent without changing code unless a supported-flow gap is reproduced.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Parent verification on 2026-09-03: 50 focused scanner-module, evidence, welcome, work-source, live-viewer, web export, and live-web-task tests passed. The repository check passed with 107 Node tests and 269 Bun tests; Biome reported only the same 13 existing complexity warnings. Specification and quality review found no unmet acceptance criterion, unnecessary combined-flow complexity, or reproducible supported-flow defect. The required full-context complexity review found no material recommendation: one small public scanner contract, domain-grouped official scanners, separate module management and work-source domains, and readiness-only welcome projection are already the simplest safe shape.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the scanner-plugin feature through its four delivered child slices: one public scanner contract, official and configured modules, explicit scanner management, compact welcome readiness, and a separate Backlog work-source plugin. Verified with 50 focused tests and the full 107-Node/269-Bun repository check; final architecture review found no material simplification or safety correction.
<!-- SECTION:FINAL_SUMMARY:END -->
