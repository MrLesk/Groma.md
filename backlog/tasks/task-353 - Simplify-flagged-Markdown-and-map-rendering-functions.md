---
id: TASK-353
title: Simplify flagged Markdown and map rendering functions
status: Done
assignee:
  - '@codex'
created_date: '2026-09-11 14:50'
updated_date: '2026-09-11 14:52'
labels: []
dependencies: []
references:
  - project-profile
  - iso-projection
  - iso-map
  - work-overlay
  - flow-controls
modified_files:
  - src/project-markdown.ts
  - src/viewers/web/iso/blueprint.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/work/pins.ts
  - src/viewers/web/flow/list.ts
type: chore
ordinal: 399000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reduce the six existing cognitive complexity warnings without changing Markdown projection, text wrapping, flow grouping, floor painting or task pin behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All six flagged functions and any extracted helpers meet the complexity limit of 15.
- [x] #2 Existing supported behavior is preserved and the repository check passes without new tests of UI or content.
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
Use small local helpers for style lookup, list blocks, styled tokens, actor rows and pin updates. Preserve execution order and state transitions. Review the diff and run existing checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extracted local helpers for Markdown styles and list items, styled wrapping tokens, floor patterns, actor rows and individual pin updates. Removed redundant paragraph and blank-string branches already handled by default projection and final filtering. No product behavior, public contracts, dependencies or tests added. Implementer simplicity, specification and quality review confirmed unchanged output ordering, wrapping state, callback captures and pin timer/update ordering. Manual temporary-browser check confirmed the map, project plate and actor sidebar render. bun run check passed: zero Biome warnings, 16 Node tests and 262 Bun tests, including enabled Rust/Go; zero failures. git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cleared all six cognitive complexity warnings through small local refactors in five existing files. Existing behavior and state ownership preserved; no tests added. Repository check passed with zero lint warnings and 278 passing tests; temporary map rendering inspected.
<!-- SECTION:FINAL_SUMMARY:END -->
