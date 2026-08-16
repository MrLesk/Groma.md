---
id: TASK-28.23
title: Give the details overlay a scannable visual hierarchy
status: Done
assignee:
  - '@claude'
created_date: '2026-08-16 10:05'
updated_date: '2026-08-16 10:18'
labels: []
dependencies: []
parent_task_id: TASK-28
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The details overlay stacks name, kind, origin, description, relationships, and children as similar plain lines inside a full-height box. Sections blur together, relationship direction is invisible, and the mostly empty box hides the map behind it. Restyle the overlay so a reader can scan it at a glance and the box only covers what it needs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The selected element's name appears in the overlay's top border and the kind and origin share one line inside the panel
- [x] #2 Section headers render with a trailing horizontal rule that separates sections
- [x] #3 Each relationship row starts with an arrow showing direction relative to the selected element, then the other element's name, then the description
- [x] #4 The side overlay is only as tall as its content, capped at the available height; full-screen details still fill the screen
- [x] #5 Terminal viewer tests cover the new overlay layout and the existing suite passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rework drawDetails in src/viewers/tui/organisms/details.ts to lay out styled rows first (measure), then draw: name embedded in the top border, one 'KIND · origin' line, ruled section headers, direction arrows on relationship rows.
2. Size the side panel box to its content height (capped at available height); keep full mode at full size.
3. Stop using drawChip in details; color the origin word with the origin theme color instead.
4. Extend test-bun/terminal-viewer.test.ts to cover the new layout (name on border, arrows, ruled headers, content-fit height).
5. Verify with bun test and agent-tty snapshots/screenshots at 120x36 and 200x60, side and full panels, across levels.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewrote drawDetails around a detailsRows layout pass (Span rows), then drawing: name sits bold in the origin color on the top border, kind and origin share one dim line with the origin word colored, section headers carry trailing dim rules, relationship rows start with a direction arrow (incoming ← / outgoing →) with the peer name plain and the description dim; long rows fall back to a name line plus an indented dim description block. Code refs render as file line plus dim 'symbol · scanner' line. Side panel height now fits content (capped); full mode still fills the screen (drawDetails takes the panel mode). Verified live via agent-tty at 120x36 and 200x60, side and full, context/containers selections; added a covering test; terminal-viewer suite 17/17 green.

Cold simplicity review returned two consolidations (shared ' · ' suffix in the relationship fits-check; reuse of the derived interior width for the border title), both applied; bun test test-bun/terminal-viewer.test.ts green after (17/17). Verification evidence: test 'details overlay fits its content with ruled sections and direction arrows' asserts the name on the top border with 'SYSTEM · observed' beneath it, ruled Relationships/Children/Code headers, incoming and outgoing arrows, a side-panel bottom border above the full-height row, the full-mode border on the last content row, and the Code file/symbol lines. Live agent-tty screenshots at 120x36 and 200x60 confirm side and full renderings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Restyled the details overlay for scannability: element name bold in the origin color on the top border, kind and origin on one line, dim ruled section headers, relationship rows with direction arrows (peer name plain, description dim, long rows falling back to an indented dim description block), and code refs as file plus dim symbol · scanner. The side panel now sizes to its content while full mode still fills the screen. Verified with the new terminal-viewer test plus the full suite for that file (17/17) and live agent-tty screenshots at 120x36 and 200x60 in side and full modes.
<!-- SECTION:FINAL_SUMMARY:END -->
