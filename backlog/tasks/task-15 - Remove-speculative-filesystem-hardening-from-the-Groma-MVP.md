---
id: TASK-15
title: Remove speculative filesystem hardening from the Groma MVP
status: To Do
assignee: []
created_date: '2026-07-28 06:24'
labels:
  - simplification
  - mvp
  - filesystem
dependencies: []
priority: high
type: task
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma is moving toward an architecture model detached from the filesystem. The current filesystem-backed scan, Markdown emission, and live-view plumbing is temporary MVP infrastructure, not a subsystem to defend against adversarial races or generalize for arbitrary filesystem behavior.

Audit the implemented Revision 03 path and delete complexity whose only purpose is backward compatibility, hypothetical filesystem edge cases, generalized recovery, hostile concurrent mutation, or unsupported runtime variation. Preserve only the smallest behavior required to demonstrate the current supported happy path from the narrow source fixture through generated Markdown to the viewer. Do not design or implement the future detached replacement in this task.

The repository AGENTS.md approval boundary is authoritative. If retaining or adding any edge-case, fallback, recovery, compatibility, or hardening behavior appears necessary, report it to the orchestrator before implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The current supported happy path from the narrow source fixture through generated Markdown to the viewer still works end to end.
- [ ] #2 Filesystem hardening, recovery, fallback, and race-handling code and tests without authority from the supported happy path or an explicit acceptance criterion are removed rather than generalized.
- [ ] #3 The remaining implementation uses the simplest direct filesystem behavior needed by the current MVP and introduces no replacement abstraction for the planned detached architecture.
- [ ] #4 Documentation states the narrow supported assumptions and does not promise behavior for removed edge cases.
- [ ] #5 Relevant automated checks pass, and objective evidence identifies the deleted complexity and the retained happy-path behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
