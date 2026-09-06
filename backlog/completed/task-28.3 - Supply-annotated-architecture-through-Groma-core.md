---
id: TASK-28.3
title: Supply annotated architecture through Groma core
status: Done
assignee:
  - '@codex'
created_date: '2026-08-09 20:01'
updated_date: '2026-08-09 21:01'
labels: []
dependencies: []
references:
  - docs/product-model.md
  - docs/viewer.md
  - groma/plans/mvp/README.md
  - groma/README.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 1500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When `groma view` requests architecture, Groma core loads every C4 element document from observed, missing, and every plan, resolves the complete renderer-independent model, and returns that model for layout and viewing. README files and other Markdown without C4 element frontmatter are not architecture items. Viewer code receives data from core and never reads architecture directories itself.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A viewer request makes core load every C4 element document under `groma/observed/`, `groma/missing/`, and every directory under `groma/plans/` without the viewer performing filesystem access; README files and other non-element Markdown do not become C4 items
- [x] #2 For every element, core returns stable ID, kind, readable name, description, containment, direct children, plan identity when applicable, lifecycle origin, and complete component Code references; relationships include source, target, description, and technology
- [x] #3 Each returned representation has exactly one origin annotation: `observed`, `planned`, or `missing`
- [x] #4 Core exposes every plan in the same response while keeping its representations and plan identity independent; the MVP does not merge or reconcile overlapping plans
- [x] #5 Runtime origin annotations are returned to the viewer and are never written to architecture frontmatter or Markdown bodies
- [x] #6 Scanner plugins still only return scan data to core and have no viewer or Markdown-writing responsibility
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [x] #5 Focused core view-model tests and the project check command pass
- [x] #6 Public product and viewer contracts describe the implemented core boundary and runtime annotations
- [x] #7 Fixtures containing observed, missing, at least two independent plans, and architecture README files verify that core loads every C4 element, ignores non-element prose, and preserves plan identity, containment, relationships, readable details, and Code references
- [x] #8 An I/O boundary test verifies that viewer modules consume the returned model without reading architecture paths
- [x] #9 A cold simplicity review explains the Markdown-to-core-model flow and removes anything not required by these acceptance criteria
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend architecture loading to include observed, missing, and every plan, parsing all Markdown but retaining only documents with C4 element frontmatter.
2. Build a core view-model boundary that resolves partial missing and plan documents against observed architecture, then returns deterministic renderer-independent element and relationship representations with stable IDs, names, descriptions, containment, direct children, Code references, origin, and plan identity.
3. Replace the obsolete browser viewer filesystem and watcher path with a minimal viewer request boundary that consumes the core response, and add an I/O boundary test proving architecture reads stay in core.
4. Add focused fixtures for observed, missing, two independent plans, prose README files, containment, relationships, and Code references; update stale tests from the retired numbered-plan examples.
5. Run focused checks, the project check command, a cold simplicity review, then specification and quality reviews; apply only acceptance-authorized fixes and record final evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial evidence: bun run check validates current Markdown but the test phase fails because existing tests still reference the removed numbered plan directories, including 02-live-viewer and 03-code-scanning. The current production reader loads observed plus plans only, treats every non-root Markdown file as an element, and the browser viewer imports the reader and owns a Markdown filesystem watcher.

Implemented the core reader and view-model slice. Focused architecture reader, model, and core tests pass. Removed the obsolete browser viewer, viewer-side Markdown watcher, browser tests, and browser dependencies so the remaining viewer request boundary only calls core. Updated stale numbered-plan test inputs to the current observed plus mvp repository shape. Verification: bun run check passed architecture validation and all 84 tests.

Cold simplicity review passed after removing an unrequested core response freeze, collapsing the viewer request wrapper to an aliased export, removing a redundant assertion, and clarifying overlay helper names. The single targeted re-review found no remaining simplicity issues. Specification review then found revision-local child lists were incomplete for the combined annotated response; core now derives direct children once from every returned representation and its resolved parent. Quality review found stale contributor commands and incomplete planned-containment evidence; CONTRIBUTING now describes only current checks, and the fixture includes a planned container with planned direct children plus full planned field assertions. The project check initially exposed a flaky OS watcher-dependent scanner integration test. The deterministic correction keeps real add, modify, remove, scan, and Markdown emission behavior while driving the existing injected watcher boundary; real watcher lifecycle coverage remains in the process test. Final verification after fixes: focused reader, model, and core suite passed 26 tests; scanner suite passed 5 tests; bun run check passed architecture validation and all 84 tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented core-owned annotated architecture loading for observed, missing, and every independent plan. The viewer boundary now delegates to core, non-C4 Markdown is ignored, and returned elements and relationships include complete identity, containment, direct children, origin, plan, Code references, and collaboration data. Removed the obsolete browser viewer, watcher, browser tests, and dependencies. Verified with 26 focused core tests, 5 scanner tests, bun run check with all 84 tests passing, a cold simplicity review, and clean specification and quality re-reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
