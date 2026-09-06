---
id: TASK-28.10
title: Treat equals and underscore as plus and minus
status: Done
assignee:
  - grok
created_date: '2026-08-15 18:09'
updated_date: '2026-08-15 18:13'
labels: []
dependencies: []
references:
  - docs/viewers/tui/index.md
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: bug
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs `groma view`, `+` enters and `-` returns to the parent. On a typical keyboard `+` is Shift+=, so people hold Shift for the pair and send `_` instead of `-`. `_` must leave the same way `-` does. `=` must enter the same way `+` does. This is not camera zoom. `z` is unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `+` and `=` enter the selected system or container
- [x] #2 `-` and `_` return to the parent
- [x] #3 `-` and `_` at System Context leave the viewer running
- [x] #4 docs/viewers/tui/index.md names both key pairs
- [x] #5 Headless tests cover `=` enter and `_` leave
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
In actionFor, treat + and = as enter, and - and _ as leave. Same reducer, no new actions. Update docs/viewers/tui/index.md. Extend the headless + / - key test to press = and _. Confirm with agent-tty: type + then _ returns to System Context.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
actionFor maps + and = to enter, - and _ to leave. Same reducer. z is still the footer focus toggle.

Verification:
- bun test test-bun/terminal-viewer.test.ts 9/9
- agent-tty: + entered Containers; _ returned to System Context; = entered; - returned; session stayed running

Reviews: simplicity PASS, specification PASS, quality PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view now treats = like + and _ like -. Shift-held minus leaves the current level. Verified by viewer tests 9/9 and an agent-tty walkthrough of +, _, =, and -.
<!-- SECTION:FINAL_SUMMARY:END -->
