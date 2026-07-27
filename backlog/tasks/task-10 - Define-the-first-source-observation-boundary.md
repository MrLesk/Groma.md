---
id: TASK-10
title: Define the first source-observation boundary
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-2
dependencies:
  - TASK-9
references:
  - README.md
  - groma/plans/03-code-observation/README.md
  - 'https://c4model.com/'
priority: high
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 02 proves that Groma can read, compare, and live-reload architecture Markdown without inspecting source code. Revision 03 adds one intentionally narrow producer for groma/observed. Define exactly which TypeScript/Bun repository shape the first observer supports: how it recognizes user entry points, what counts as a C4 component boundary, which directed source relationships it may claim, and what source location backs each claim. The purpose is to test source-to-Markdown-to-view materialization, not to understand arbitrary TypeScript projects.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A local specification names the supported TypeScript/Bun repository layout, entry-point declarations, component-boundary convention, relationship syntax, and source-location format
- [ ] #2 The specification includes one complete supported fixture and at least one input that is explicitly outside the boundary
- [ ] #3 All input outside the named boundary has one documented outcome—an explicit unsupported error—and no fallback extraction path
- [ ] #4 Observation is read-only and never executes or imports project code
- [ ] #5 The specification introduces no plugin system, framework catalog, confidence score, rename reconciliation, or generalized program analysis
<!-- AC:END -->
