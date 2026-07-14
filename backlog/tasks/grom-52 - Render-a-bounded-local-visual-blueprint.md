---
id: GROM-52
title: Render a bounded local visual blueprint
status: To Do
assignee: []
created_date: '2026-07-14 20:37'
updated_date: '2026-07-14 22:20'
labels:
  - visualization
  - first-run
  - projection
milestone: m-3
dependencies:
  - GROM-30
  - GROM-42
  - GROM-51
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give the living-blueprint release its immediate human payoff: a self-contained local visual projection that opens from Groma, stays within a readable main-layer budget, and reveals additional architecture through focus and detail without becoming canonical state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shared bounded current-view read can be rendered as a self-contained local HTML artifact with embedded SVG or equivalent deterministic graph output
- [ ] #2 The main layer uses a presentation density budget rather than a canonical component cap and supports recursive focus, detail expansion, relationship tracing, and view-local folding
- [ ] #3 The view visibly distinguishes curated intent, automatic candidates, bound evidence, ambiguity or missing coverage, containment, and ordinary relationships without relying on color alone
- [ ] #4 Selecting a projected node opens concise intent plus structured provenance, binding, uncertainty, and coverage details
- [ ] #5 Rendering the same generation is deterministic, performs no canonical write, network request, or upload by default, and stores no layout, folding, focus, zoom, or theme state in the blueprint
- [ ] #6 Bare groma can deterministically reconstruct and open the artifact for the current blueprint generation through supported CLI behavior
<!-- AC:END -->
