---
id: TASK-260
title: Group Web flows in collapsed actor accordions
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 17:28'
updated_date: '2026-09-05 17:32'
labels: []
dependencies: []
references:
  - flow-controls
  - render
  - web-shell
modified_files:
  - src/viewers/web/flow/list.ts
  - src/viewers/web/render.ts
  - docs/viewers/web/index.md
type: enhancement
ordinal: 299000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Web hierarchy groups authored flows beneath their initiating actors. Coding agent and Human architect each have a collapsed accordion on startup. Actor entries move out of the Structure list into these flow groups; their architecture records, map presence and flow membership remain unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On a fresh Web load, each actor has a named collapsed flow accordion; opening one reveals only flows initiated by that actor and preserves the existing flow reader interaction.
- [x] #2 Actors are absent from Structure, while systems and external systems retain their hierarchy and map actors remain available.
- [x] #3 Accordion state survives viewer repaints; browser verification and bun run check pass.
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
1. Group the Web flow list by the existing first-step actor and reuse the sidebar disclosure heading, initially collapsed. 2. Exclude actor rows from the Web Structure list and update its documentation. 3. Verify startup, independent expansion, flow selection and actor map presence in the browser; run the repository check and the requested final complexity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Grouped the existing Web flow list by the actor referenced as the first step source, reusing sidebar disclosure headings and flow rows. An initially empty set retains actor expansion across repaints. Actor rows are filtered only from the Web Structure presentation; model, authored records and map stay unchanged. Updated viewer documentation. No new schema, domain module or UI-only automated tests were needed.

Browser verification against a fresh updated preview: Coding agent and Human architect both start collapsed; opening Coding agent reveals its six flows only; selecting browser review opens the existing reader and preserves expansion; Human architect can open independently; collapsing Coding agent leaves Human architect open; reloading collapses both. DOM inspection confirms coding-agent and human-architect map nodes still exist, while Structure contains only Systems and External systems. bun run check passed (104 Node tests, 301 Bun tests). Implementer specification/quality review and the requested full-context complexity review passed with no blocking findings or material simplification recommended.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Moved actors from the Web Structure list into independent flow accordions that start collapsed and keep their state across repaints. Reused authored first-step links and existing sidebar controls. Verified startup, group membership, independent folding, reader selection, reload and unchanged map actors in the browser; all 405 repository tests and the final complexity review passed.
<!-- SECTION:FINAL_SUMMARY:END -->
