---
id: TASK-10
title: Define the first source-observation boundary
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 00:35'
labels: []
milestone: m-2
dependencies:
  - TASK-9
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
  - 'https://c4model.com/'
priority: high
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 02 proves that Groma can read, compare, and live-reload architecture Markdown without inspecting source code. Revision 03 adds one intentionally narrow producer of component Markdown beneath groma/observed. Define a local specification for exactly one supported TypeScript/Bun repository shape: its entry points, source declarations, component boundaries, directed relationships, and repository-relative source ranges. Each supported component declaration must provide its exact stable C4 ID, and each relationship declaration must provide exact source and target IDs. The observer emits those IDs unchanged, never reads plans, and performs no rename inference.

The specification must designate exactly one generated components directory beneath a named observed container as the scanner/emitter-owned subtree. A refresh may replace only files inside that subtree and must preserve hand-authored people, systems, containers, and every unrelated component. Direct observer invocation on an unsupported input shape returns one specified unsupported-shape error. Filesystem changes outside the supported source scope are ignored before observation and are not observer errors. Observation evidence belongs in a readable canonical Markdown body section, not in frontmatter or a second model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A local specification names the supported TypeScript/Bun repository layout, entry-point declarations, component-boundary convention, relationship syntax, repository-relative source-range format, and exact stable C4 ID syntax for components and relationship targets
- [ ] #2 The specification includes one complete supported fixture whose declared IDs can exactly match elements in 03-code-observation and at least one directly invoked input that is explicitly outside the supported shape
- [ ] #3 Direct observer invocation on any unsupported input shape returns the one documented unsupported-shape error and never falls back to partial extraction
- [ ] #4 The specification names the exact supported filesystem-watch scope; changes outside it are ignored without invoking the observer and are not reported as unsupported-shape errors
- [ ] #5 The specification names exactly one scanner/emitter-owned generated components directory beneath groma/observed; refresh replaces only that subtree and preserves hand-authored people, systems, containers, and unrelated components
- [ ] #6 The specification defines a readable ## Source evidence section containing repository-relative file and source-range evidence, without adding a claim field, lifecycle frontmatter, or a second canonical model
- [ ] #7 Observation is read-only and never executes or imports project code
- [ ] #8 The specification introduces no plugin system, framework catalog, confidence score, rename reconciliation, or generalized program analysis
<!-- AC:END -->
