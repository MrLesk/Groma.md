---
id: TASK-11
title: Observe the supported TypeScript source shape
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-2
dependencies:
  - TASK-10
references:
  - README.md
  - groma/plans/03-code-observation/README.md
priority: high
type: feature
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the read-only observer defined by TASK-10 for its supported TypeScript/Bun fixture. The observer’s output is bounded in-memory evidence, not architecture Markdown: stable observation keys, the supported entry points and component boundaries, directed relationships, and repository-relative source locations. It must not read groma/plans, infer intent, execute project code, or attempt a broader TypeScript interpretation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The supported fixture yields the entry points, component boundaries, and directed relationships required by the TASK-10 specification
- [ ] #2 Every observation includes the repository-relative file and source range that supports it
- [ ] #3 Running the observer twice on unchanged source produces equivalent deterministically ordered observations
- [ ] #4 The observer emits no Markdown, reads no plan directory, and executes no project code
- [ ] #5 The documented unsupported fixture fails with the specified unsupported error and does not fall back to partial extraction
<!-- AC:END -->
