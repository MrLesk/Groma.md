---
id: GROM-18
title: Verify and package the complete Iteration 1A walking skeleton
status: To Do
assignee: []
created_date: '2026-07-11 17:35'
updated_date: '2026-07-11 22:38'
labels:
  - integration
  - verification
  - release
milestone: m-1
dependencies:
  - GROM-6
  - GROM-17
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close Iteration 1A with a black-box correctness and durability suite over the compiled executable. Prove the complete initialize, mutate, persist, restart, query, conflict, recovery, and terminal-view path from a clean checkout without relying on Bun or internal modules at runtime.
<!-- SECTION:DESCRIPTION:END -->


















## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build the standalone executable in clean environments.
2. Exercise the complete recursive component workflow exclusively through CLI and terminal surfaces.
3. Verify restart durability, deterministic bytes, stable identity across rename and reparent, containment invariants, conflict behavior, and malformed-input safety.
4. Run exhaustive journal crash-recovery scenarios in fresh processes.
5. Test supported packaged targets and publish the 1A scope and verification evidence for review.
<!-- SECTION:PLAN:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 From a clean checkout, the documented command produces one standalone groma executable and the full verification suite passes
- [ ] #2 A black-box scenario initializes a temporary workspace, creates multiple domain roots and recursively nested same-type and mixed-type components with sparse and rich intent, connects components across branches, lists and reads them, updates one with an expected revision, and reloads identical semantics after process restart
- [ ] #3 Repeating serialization without semantic changes produces no canonical byte changes and moving, reparenting, or renaming a component preserves its stable identity
- [ ] #4 A stale revision, containment cycle, multiple-parent attempt, invalid ordinary relation, ambiguous target, malformed document, and missing workspace each fail with the expected nonzero diagnostic and no unintended canonical changes
- [ ] #5 Crash injection at every journal phase followed by a new process exposes exactly the complete old or complete new graph and permits subsequent valid work
- [ ] #6 The bare terminal entry point renders only bounded hierarchy data and the noninteractive modes remain deterministic and nonstreaming
- [ ] #7 The packaged executable runs the supported 1A workflow on every host target promised by the support matrix without a separately installed Bun runtime
- [ ] #8 Milestone documentation states that scanners, automatic architecture generation, projection, dynamic plugin loading, plans, history, HTTP, and React UI remain later-iteration work
<!-- AC:END -->
