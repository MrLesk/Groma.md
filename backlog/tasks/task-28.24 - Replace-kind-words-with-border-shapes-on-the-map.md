---
id: TASK-28.24
title: Replace kind words with border shapes on the map
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 10:20'
updated_date: '2026-08-16 10:27'
labels: []
dependencies: []
parent_task_id: TASK-28
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every map card spends its last row on SYSTEM/CONTAINER/COMPONENT/PERSON (often painted over the bottom border as COMPONE), and boundary titles prefix the kind before the name. The C4 level is already named in the header and footer, the system boundary is already double-line, and nesting says what a card is, so the words repeat what the map shows.

Remove kind words from cards and boundary titles. Boundary titles become just the element name. The remaining ambiguity is person versus external system, both outside the system boundary: person cards get rounded corners, external cards draw their border dim. The details overlay keeps the spelled-out kind, the same pattern as origin.

Name sizing stays with TASK-28.14, which is in progress in projection.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Map cards and boundary titles render no kind words; boundary titles show only the element name
- [x] #2 Person cards render with rounded corners; non-person cards keep square corners
- [x] #3 External system cards draw their border dim
- [x] #4 The details overlay still shows the spelled-out kind for the inspected element
- [x] #5 The terminal viewer suite (bun test test-bun/terminal-viewer.test.ts) passes with kind expectations updated
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
1. Add a person border variant in border.ts: rounded corners with the origin's horizontal and vertical characters.
2. In card.ts, drop the kindLabel row and import, pick the person style for person cards, and pass DIM border attributes for external cards.
3. In boundary.ts, title becomes just the element name; drop the kindLabel import.
4. Details overlay already spells the kind via kindLabel; no change.
5. Update terminal-viewer tests: fixtures stop expecting kind words in boundary titles, map frames must not contain kind words, context frames must contain rounded corners, components frames must not.
6. Verify with bun test test-bun/terminal-viewer.test.ts and agent-tty at 120x36 and 200x60 including details; screenshot to confirm rounded glyphs and dim externals render.

7. Apply cold simplicity review findings: drop the dead kindLine guard from the relationship-label test and inline the single-caller kindLabel into details.ts, deleting kind-label.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a person BorderStyle in border.ts: rounded corners over the origin's line characters, so planned persons stay dashed. card.ts picks the person style for person cards, passes DIM border attributes when element.external, and no longer draws the kindLabel row (which painted over the bottom border on short cards). boundary.ts titles are now just the element name. kind-label.ts survives with details.ts as its only caller, keeping the spelled-out kind in the overlay.

Scope note: name sizing left to TASK-28.14 (in progress in projection.ts by @grok); this task deliberately does not touch card geometry.

Tests: fixtures assert boundary titles as name-only, rounded glyphs present at context and absent at components, and map frames free of kind words; details assertions for spelled-out kinds kept. bun test test-bun/terminal-viewer.test.ts: 17 pass / 0 fail.

Visual verification via agent-tty at 120x36 and 200x60: persons render with rounded corners, Git external renders dim, boundary titles show names only (Core, Arc, Sc at far zoom instead of uniform CO truncations), details shows SYSTEM · observed. Screenshots captured.

Docs: one paragraph added to docs/viewers/tui/index.md describing the wordless map language.

Cold simplicity review passed with two accepted findings, both applied: removed the kindLine overlap guard that asserted against a row cards no longer draw, and inlined kindLabel into details.ts (its only caller), deleting kind-label.ts. Suite re-run: 17 pass / 0 fail.

Reviewer also noted a pre-existing cleanup not attributable to this task: the ViewFixture.labels field is empty in all fixtures and its loop is dead structure. Left as a follow-up for the user to direct.

AC 3 evidence is the agent-tty screenshot showing the Git external card border rendering dim against the person cards; the suite has no span-level dim assertion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed kind words from the map: cards no longer draw the kindLabel row, boundary titles are just the element name, person cards use a rounded-corner border variant layered over the origin's line characters, and external cards draw their border dim. The details overlay keeps the spelled-out kind (now inlined after the simplicity review deleted single-caller kind-label.ts). Verified with the terminal viewer suite (17 pass / 0 fail): map frames must not contain SYSTEM/CONTAINER/COMPONENT/PERSON, boundary titles match as name-only, rounded glyphs present at context and absent at components, details frames keep kind words. Visually verified with agent-tty at 120x36 and 200x60 with screenshots: rounded persons, dim Git, name-only titles. Docs gained one paragraph on the wordless map.
<!-- SECTION:FINAL_SUMMARY:END -->
