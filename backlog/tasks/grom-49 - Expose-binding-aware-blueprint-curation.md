---
id: GROM-49
title: Expose binding-aware blueprint curation
status: To Do
assignee: []
created_date: '2026-07-14 20:00'
labels: []
milestone: m-3
dependencies:
  - GROM-30
  - GROM-37
  - GROM-41
  - GROM-42
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let humans and agents improve an automatically discovered blueprint through supported semantic operations that preserve scanner evidence while making explicit binding and conceptual-boundary decisions durable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A human or agent can add or revise curated intent on an automatic component without copying evidence into intent or losing the component stable identity
- [ ] #2 Supported operations can explicitly bind or rebind an observation candidate, ignore or restore evidence, and inspect the resulting binding history
- [ ] #3 Moving, splitting, merging, and pinning conceptual components update aliases, relationships, and Groma-owned bindings atomically without changing scanner output
- [ ] #4 Ambiguous targets, stale content revisions, conflicting bindings, and prohibited regrouping fail closed with no canonical changes
- [ ] #5 All curation and binding decisions use shared application operations with deterministic plain and JSON CLI results rather than direct canonical file editing
- [ ] #6 An unchanged rescan preserves curated intent, pins, ignores, merges, and explicit bindings while refreshing only source-owned evidence
<!-- AC:END -->
