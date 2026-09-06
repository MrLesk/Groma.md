---
id: TASK-83
title: Split web details into What it does and How it's built
status: Done
assignee:
  - '@claude'
created_date: '2026-08-17 20:50'
updated_date: '2026-08-17 21:23'
labels: []
dependencies: []
priority: high
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web details sheet shows one flat column of description, relationships, and children. Split it into two tabs: What it does keeps the meaning (description, relationships, children); How it's built shows the evidence: the element's source files from its code references, a technology line when its architecture Markdown declares one, and which person commands travel through the selection, each activatable. Approved example: the reference demo's What it does / How it's built pane.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The details pane offers What it does and How it's built tabs; What it does keeps today's description, relationships, and children
- [x] #2 How it's built lists the selected element's source files from its code references
- [x] #3 An element's Markdown may declare a technology; when declared it renders as chips under How it's built
- [x] #4 How it's built lists the person commands whose paths touch the selection; clicking one activates that flow
- [x] #5 Tab state and travelled-by derivation are covered by fixture tests and bun test passes
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
1. Model: documentToElement reads an optional technology string from element frontmatter (validated when present); ArchitectureElement and AnnotatedElement carry technology?; annotateRevision passes it through. The emitter already preserves unknown frontmatter lines, so scans keep it.
2. action-path.ts: travelledBy(elementId, world) = deduped pickable person commands whose walk touches the element (actionPath + elementOnPath).
3. details.ts: Inspected gains technology (split on commas into chips) and travelledBy {id, title}; DetailsTab ('what' | 'how') with a pure tabSections split: what = description/relationships/children, how = technology chips/code files/travelled-by pickable commands; paintDetails renders tab buttons and only the active tab's sections.
4. render.ts: detailsTab state kept across selections, tab click repaints; travelled-by click picks the flow. page.ts: tab and chip styles.
5. Declare technology on one observed element to exercise the chips.
6. Tests: inspect-details fixture covers technology chips and travelledBy; tabSections split test. bunx tsc, bun test, browser check of both tabs and a travelled-by pick.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
technology? rides ArchitectureElement/AnnotatedElement from element frontmatter (validated non-empty string when present; the emitter keeps unknown frontmatter lines so scans preserve it). travelledBy in action-path.ts dedupes pickable person commands and keeps those whose walk touches the element. details.ts: Inspected gains technology chips (comma-split) and travelledBy; DetailsTab + pure tabSections split what(description/relationships/children) from how(technology/code/travelledBy); paintDetails renders tab buttons and only the active tab. render.ts keeps detailsTab across selections. Declared 'technology: Three.js, Bun serve' on the observed web-viewer container. Browser evidence on 4791: tabs render with What active, How shows Technology chips [Three.js, Bun serve], Code, Travelled by [Starts the browser map]; clicking it activates the flow (header names it, row highlights); tab stays How after selecting Human architect. bunx tsc clean, bun test 151 pass.

Cold simplicity review: no accept-worthy findings; applied the named Section type nit, kept pickableActions in travelledBy for intent, kept the tabSections test as the AC's tab-state coverage. Post-nit: bunx tsc clean, bun test 151 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web details pane now has What it does (description, relationships, children) and How it's built (technology chips from a new optional element frontmatter field, code source files, and Travelled by person commands that activate their flow on click) tabs that persist across selections. Verified with fixture tests (technology comma-split chips, travelledBy exact walks, tabSections split; bun test 151 pass, bunx tsc clean) and a browser DOM script: tabs render, chips [Three.js, Bun serve] on the observed web-viewer container, Travelled by 'Starts the browser map' activates the flow, tab stays How after reselecting.
<!-- SECTION:FINAL_SUMMARY:END -->
