---
id: TASK-293
title: Pulse the whole focused flow arrow
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 22:40'
updated_date: '2026-09-05 22:42'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/style.ts
type: bug
ordinal: 332000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The focused flow step pulses its line and endpoint components but leaves the arrowhead static. Apply the focus pulse to the complete route so its line and arrowhead flash together.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The focused route line and arrowhead pulse together; ordinary flow dashes keep moving.
- [x] #2 Clear focus removes the pulse and reduced-motion mode keeps the focused route static.
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
Move the existing focus opacity animation from the route line to the whole route group, retain the line dash animation, and include the group in the reduced-motion rule. Verify the focused arrow in the browser, run bun run check, and perform self and required final complexity reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Moved the existing focus opacity animation to the route group, so the line and arrowhead share one pulse timeline. The line retains its existing dash animation. The reduced-motion rule now disables the route group animation too. Browser inspection confirms group map-flow-focus opacity changes while the child line retains map-flow; Clear focus removes the focused class and all route groups report animation none. Self specification/quality/simplicity review found no blockers. This restores the documented whole-relationship pulse, so no documentation change or decorative CSS test is needed. bun run check passed with 313 Bun tests plus Node, lint and types. No model, layout or camera changes.

Final full-context complexity review passed with no blockers or material recommendations; the route group is the simplest owner of the shared pulse.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The focused flow arrowhead now flashes in sync with its line through one opacity animation on the complete route group. Moving dashes, Clear focus, and reduced-motion behavior are preserved. Browser verification and bun run check passed (313 Bun tests plus Node, lint and types); final complexity review found no blockers.
<!-- SECTION:FINAL_SUMMARY:END -->
