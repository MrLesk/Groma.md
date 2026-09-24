---
id: TASK-429
title: Simplify scanner setup and wait for the initial scan
status: Done
assignee:
  - '@codex'
created_date: '2026-09-16 20:57'
updated_date: '2026-09-16 21:07'
labels: []
dependencies: []
references:
  - web-server
  - scanner-session
modified_files:
  - src/viewers/web/startup/scanners.ts
  - src/viewers/web/startup/page.ts
  - src/scanner/session.ts
  - src/viewers/web/map-session.ts
  - test-bun/web-startup.test.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 502000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web setup exposes repeated per-file discovery diagnostics, making scanner choices hard to understand in large repositories. The map also opens before its initial scanner session finishes, briefly claiming that no components exist.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scanner setup groups detections by scanner, summarizes known versions and state, and keeps searchable evidence collapsed by default.
- [x] #2 Installation choices preserve existing scanner selection behavior and the primary action reflects selected installs.
- [x] #3 The loading screen remains until the initial scan and its map update complete; empty results are shown only after completion.
- [x] #4 Responsive dark and light setup views, selection and evidence search are checked in the browser; lifecycle regression and bun run check pass.
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
1. Render compact scanner rows using existing discovery data and theme tokens, with optional searchable evidence. 2. Expose initial scanner-session completion and await it before publishing the ready web map. 3. Verify the approved TypeScript example, mixed scanner states and a delayed initial scan, then update web documentation and run repository checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Focused lifecycle checks pass. Browser validation reproduced implicit submission when Enter was pressed in the evidence search; prevented that default so filtering cannot start scanner installation.

Implemented scanner rows using the existing theme, checkbox submission and discovery data. Known installed/declared versions are deduplicated; evidence without a version is not a warning. Issues sort first; paths and package names are available in collapsed searchable details. The button follows selected additions. Browser verification used the real setup renderer with the approved six-declaration TypeScript example, mixed installation/compatibility states, and 1,000 declarations. Checked dark/light, 375px and normal widths, filtering to one path, Enter without submission, selected scanner submission and empty selection submission. Preview endpoint records form data without installing packages. Temporary viewport override reset. Initial scanner session now exposes completion; the web map waits for scanning and its onFold map update before it becomes ready. Two parallel-safe HTTP-gated lifecycle cases prove no premature empty map for either a populated or empty scan. Focused checks: five passed. Final bun run check: 16 Node tests; 360 Bun passed, 17 skipped, zero failures. Existing unrelated complexity warning remains. git diff --check passed. Implementer specification and quality review: approved UI flow and initial-scan timing are covered; no scanner discovery/storage semantics, C4 elements or OKF metadata changed, no new dependencies or blocking findings. Documentation updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaces raw setup diagnostics with compact scanner choices, known versions, clear states and searchable collapsed evidence. Install selection and action label work together. Web startup waits for the first scan and map update before exposing an empty result. Browser-verified at narrow/normal widths in dark/light, with six and 1,000 declarations and actual form submission to a harmless preview endpoint. HTTP-gated startup regressions and bun run check pass (16 Node; 360 Bun passed, 17 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
