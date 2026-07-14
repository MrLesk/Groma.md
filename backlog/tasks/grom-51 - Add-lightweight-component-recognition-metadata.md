---
id: GROM-51
title: Add lightweight component recognition metadata
status: To Do
assignee: []
created_date: '2026-07-14 20:37'
updated_date: '2026-07-14 22:36'
labels:
  - model
  - visualization
  - simplicity
milestone: m-2
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
type: feature
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let components carry the small optional metadata needed for legible overview cards without expanding architectural meaning or coupling the canonical model to a renderer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Components support an optional short label, optional one-sentence summary, and optional iconDomain favicon-domain recognition hint in addition to their existing name, type, and parent metadata
- [ ] #2 Projected display text uses label when supplied, otherwise name when supplied, and otherwise the stable canonical component ID; external remains a documented conventional open type rather than a closed enum or special entity kind
- [ ] #3 Normalization, application operations, Markdown persistence, reload, and deterministic serialization preserve omitted and supplied recognition metadata
- [ ] #4 iconDomain is validated as an optional favicon-domain presentation hint and never participates in identity, evidence matching, automatic network access, or trust decisions
- [ ] #5 No layout coordinate, color, theme, folded group, zoom, or other renderer state is admitted to the standard model
- [ ] #6 Tests cover create, update, clear, reload, malformed metadata, label-to-name-to-canonical-ID display fallback, and byte-stable unchanged reads
<!-- AC:END -->
