---
id: TASK-132
title: Announce a newly active task with one coloured pin bounce
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 13:34'
updated_date: '2026-08-23 13:48'
labels: []
dependencies: []
references:
  - render
modified_files:
  - src/viewers/web/organisms/pins.ts
  - docs/viewers/web/index.md
type: feature
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an open web map receives a Backlog task that has newly entered In Progress, each new pin should briefly announce its arrival with one bounce in its assigned colour, then return to the normal inactive greyscale state. This makes newly started work noticeable without changing task activation or selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A pin that first appears after the web map is already open bounces once in its assigned colour
- [x] #2 After the arrival animation, an inactive pin returns to greyscale and keeps the existing activation and selection behavior
- [x] #3 Pins present on the first page paint do not bounce, and later updates to an existing pin do not replay the animation
- [x] #4 Creating a new task file and moving it to In Progress reaches the open web map through the existing Backlog watch and live world channel
- [x] #5 The web viewer documentation describes the one-time arrival animation
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
1. src/viewers/web/organisms/pins.ts: keep the pin layer as the lifecycle owner; the first paint establishes the known pins, while a node first created on a later paint receives an arriving class. One CSS keyframe animates the whole pin once and its filter from colour back to the normal inactive greyscale, without changing activation or selection.
2. docs/viewers/web/index.md: describe the one-time arrival signal.
3. Verify the existing new-file watcher test, the browser bundle/check suite, and the live pin lifecycle: boot pins do not animate, a later new pin animates once in colour, an existing pin update does not replay, and it ends greyscale.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the pin-domain lifecycle: the first paint establishes the baseline, and only nodes first created on a later paint receive one 700 ms whole-pin arrival animation whose filter runs from colour to inactive greyscale. Existing pin nodes stay in place, so later payload updates do not replay it. Updated the web viewer contract. Focused new-file watcher test passes; bun run check passes (92 Node and 137 Bun tests); git diff --check passes. Browser validation is pending because the required in-app Browser runtime failed during setup with: Importing module "node:process" is not allowed in node_repl. No fallback browser was used without Alexs permission.

Alex approved regular Playwright after the required in-app Browser runtime failed. To avoid unrelated concurrent TASK-134 and TASK-135 edits, visual QA ran in a temporary worktree at committed HEAD plus only TASK-132. At 1400x900 the page opened as groma.md with one SVG map, zero initial pins and zero console warnings/errors. A later live work update created TASK-ARRIVAL: during its animation the pin had class pin arriving, filter grayscale(0), a -8.19 px vertical transform and one running animation; after 700 ms it had grayscale(1), no transform and no running animation. An identical later update kept one node with no animation, proving no replay. Screenshots: /tmp/groma-task-132-arriving.png and /tmp/groma-task-132-settled.png. Cold simplicity review: PASS, no findings. Full-context complexity and defensive-architecture review: PASS, keep as written; pin reconciliation is the right domain owner and no server, payload, renderer or animation-service state should be added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
New pins that arrive after the web map opens now bounce once as a complete coloured pin, then return to inactive greyscale; boot pins and existing-node updates do not animate. The Backlog directory watcher already includes new files. Verified by its focused test, bun run check (92 Node and 137 Bun tests), clean diff validation, an isolated Playwright live-update check with no console errors, and both required architecture reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
