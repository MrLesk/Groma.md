---
id: TASK-480
title: Review architecture changes in the web comparison
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-21 21:25'
updated_date: '2026-09-21 22:37'
labels: []
dependencies: []
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
documentation:
  - docs/viewers/web/index.md
priority: high
type: feature
ordinal: 556000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-463 delivered comparison, but a reviewer still cannot see how much changed, list it, or step through it. The way into a comparison sits at the end of the commit list: with 400 commits that list is 21,260 px tall inside a 460 px popup. Commit messages clip at 17 characters inside one 360 px control, the word diff joins removed and added words ("WritesPackages"), and the map shows through the diff pane.

Alex settled the design on 2026-09-21 against a prototype laid over the exported viewer. The design page holds the frames and the rules. This parent owns the shared rules. Each child owns one surface. Work the children in order.

## Shared rules

- Every fact comes from the comparison payload the browser already receives: component status, before, after, files with additions and deletions, and relationship status. No History, export, or stored-metadata change.
- Live and static delivery behave the same. Light, Dark and Blueprint all work.
- People name commits by message. Commit IDs appear only where width forces it.
- A control is as wide as its content. Spare header width stays empty.
- Reuse the existing web atoms and owners before writing anything new: the anchored popover and its options, the Search field input style, chrome buttons, tabs, the floating map bar surface of the Tasks panel, the shared source diff renderer, hierarchy rows and their selection, and the camera fit active tasks use. A new component needs a reason an existing one cannot serve.
- Everything the user operates moves smoothly: fields that open, widen or split, words and lists that appear, toggles, the stepper position, rows entering and leaving, pane content changes. Use the existing chrome motion and ease variables, and keep every animation off under reduced motion.
- A commit list always sits directly under the field it belongs to, left edges aligned, and follows that field when the header reflows.
- TASK-463 colours, identity rules and change rules stay.

## OKF and C4

Nothing is stored and no element or level is added. Each addition is a view over the comparison History already derives. An ordinary Markdown or OKF reader is unaffected.

## Open owner decisions, in no child yet

- Unchanged buildings and routes receding to about 40% opacity while comparing, and fitting the camera to the changed buildings. This overrides the TASK-463 rule that context keeps ordinary styling.
- Blueprint Added colour: cyan #70E1F5 has the hue of Blueprint ink and drafting lines on the map. Lime #B8F26B tested well; violet #C4A7FF blends with Removed pink.

## Verify on the real viewer

A small comparison (1 to 5 changes), an empty comparison, a 1000 px window with both panes open, a single-snapshot export, 400 commits in the list, Dark and Blueprint, and a live working-tree endpoint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A reviewer can open a comparison from the header, see what changed as a counted list, step through every change, read why each component is Modified, and read its source diffs, through the completed children.
- [ ] #2 The children behave the same in live and static delivery and in Light, Dark and Blueprint.
- [ ] #3 Every check under Verify on the real viewer passes on the finished work.
- [ ] #4 The shared rules on reuse, motion and commit list placement hold in every child.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
After TASK-477 and TASK-478 land, clean the leftovers TASK-480.1 could not touch in their files: the HTMLDetailsElement cast and the revisionSelect name at src/viewers/web/chrome/shell.ts:27, the dead grid-template-columns declaration for #header at chrome/shell.ts:192 (the header is a flex row now), and rename the createRevisionControl option `control` to `box`.
<!-- SECTION:NOTES:END -->
