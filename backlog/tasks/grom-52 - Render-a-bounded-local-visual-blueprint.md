---
id: GROM-52
title: Render a bounded local visual blueprint
status: To Do
assignee: []
created_date: "2026-07-14 20:37"
updated_date: "2026-07-14 23:05"
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

Give the living-blueprint release its immediate human payoff: a self-contained local visual projection that opens from Groma, stays within a readable main-layer budget, and reveals additional architecture through focus and detail without becoming canonical state. It uses iconDomain only for deterministic offline recognition and contains no remote icon-resolution capability.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A shared bounded current-view read can be rendered as a self-contained local HTML artifact with embedded SVG or equivalent deterministic graph output
- [ ] #2 The main layer uses a presentation density budget rather than a canonical component cap and supports recursive focus, detail expansion, relationship tracing, and view-local folding; a node projecting one component falls back from label to name to stable canonical component ID, while each folded group receives a deterministic view-local label derived from its grouping rule and bounded member count and never a synthetic canonical component ID or identity
- [ ] #3 When iconDomain is supplied, the renderer uses it only to derive a deterministic self-contained domain badge, monogram, or text hint and never fetches a favicon or other remote asset; icon resolution is outside GROM-52, and any future capability requires explicit user action and a privacy policy
- [ ] #4 The view visibly distinguishes curated intent, automatic candidates, bound evidence, ambiguity or missing coverage, containment, and ordinary relationships without relying on color alone
- [ ] #5 Selecting a projected node opens concise intent plus structured provenance, binding, uncertainty, and coverage details
- [ ] #6 Rendering the same generation is deterministic, performs no canonical write or network request, uploads nothing by default, and stores no layout, folding, focus, zoom, or theme state in the blueprint
- [ ] #7 Bare groma can deterministically reconstruct and open the artifact for the current blueprint generation through supported CLI behavior

<!-- AC:END -->
