---
id: TASK-11
title: Observe the supported TypeScript source shape
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 00:35'
labels: []
milestone: m-2
dependencies:
  - TASK-10
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
priority: high
type: feature
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the read-only observer defined by TASK-10 for its supported TypeScript/Bun fixture. The observer returns bounded in-memory observation evidence, not architecture Markdown: exact stable C4 component and relationship target IDs supplied by supported source declarations, entry points, component boundaries, directed relationships, and repository-relative source ranges. It must not read groma/plans, infer intent or renames, execute project code, or attempt a broader TypeScript interpretation. Direct invocation on an unsupported shape returns the single TASK-10 unsupported-shape error.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The supported fixture yields the exact declared stable C4 IDs, entry points, component boundaries, and directed relationships required by the TASK-10 specification
- [ ] #2 Every component and relationship observation includes the repository-relative file and source range that supports it
- [ ] #3 Running the observer twice on unchanged source produces equivalent deterministically ordered observations
- [ ] #4 The observer emits no Markdown, reads no plan directory, executes no project code, and performs no plan matching or rename inference
- [ ] #5 Directly invoking the observer on the documented unsupported fixture returns the exact TASK-10 unsupported-shape error and does not fall back to partial extraction
<!-- AC:END -->
