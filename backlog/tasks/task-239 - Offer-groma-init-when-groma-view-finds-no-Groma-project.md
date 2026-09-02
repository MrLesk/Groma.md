---
id: TASK-239
title: Offer groma init when groma view finds no Groma project
status: To Do
assignee: []
created_date: '2026-09-02 20:59'
labels:
  - cli
dependencies: []
ordinal: 268000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Running `groma view` in a repository that has no Groma directory ends today with the raw error "Groma is not initialized; run groma init". When a human runs `groma view` on a TTY in that state, Groma asks with the Clack prompt used by `groma init` whether to initialize now; Yes runs the init wizard and then opens the map, No exits quietly with one line pointing to `groma init`. When the output is not a TTY, or `--plain` is set, Groma prints one sentence pointing to `groma init` and exits with a non-zero code. No stack trace in either case.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On a TTY, `groma view` in a repository without a Groma directory asks with Clack whether to run `groma init`; Yes runs the same init wizard as `groma init` and then opens the terminal map
- [ ] #2 Answering No exits with code 0 and one line naming `groma init`
- [ ] #3 Without a TTY, or with `--plain`, `groma view` prints one sentence naming `groma init` and exits with a non-zero code
- [ ] #4 Neither path prints a stack trace or an unexplained error
- [ ] #5 Tests cover the non-TTY path and the TTY prompt through the init UI seam, using fixtures under test/fixtures
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
