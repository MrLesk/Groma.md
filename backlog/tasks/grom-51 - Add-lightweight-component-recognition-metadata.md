---
id: GROM-51
title: Add lightweight component recognition metadata
status: To Do
assignee: []
created_date: '2026-07-14 20:37'
updated_date: '2026-07-14 20:41'
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
- [ ] #1 Components support an optional short label, optional one-sentence summary, and optional favicon domain in addition to their existing name, type, and parent metadata
- [ ] #2 The component name remains the projected label when no short label is supplied, and external remains a documented conventional open type rather than a closed enum or special entity kind
- [ ] #3 Normalization, application operations, Markdown persistence, reload, and deterministic serialization preserve omitted and supplied recognition metadata
- [ ] #4 Favicon domains are validated as presentation hints and never participate in identity, evidence matching, automatic network access, or trust decisions
- [ ] #5 No layout coordinate, color, theme, folded group, zoom, or other renderer state is admitted to the standard model
- [ ] #6 Tests cover create, update, clear, reload, malformed metadata, and byte-stable unchanged reads
<!-- AC:END -->
