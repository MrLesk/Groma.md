---
id: GROM-51
title: Add lightweight component recognition metadata
status: To Do
assignee: []
created_date: "2026-07-14 20:37"
updated_date: "2026-07-14 23:05"
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

Let components carry the small optional canonical recognition metadata needed for legible overview cards without expanding architectural meaning or coupling the canonical model to a renderer. This task stores and validates iconDomain but introduces no favicon fetcher or icon-resolution capability; any future resolution is separate and requires explicit user action and a privacy policy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Components support an optional short label, optional one-sentence summary, and optional iconDomain favicon-domain recognition hint in addition to their existing name, type, and parent metadata
- [ ] #2 A node projecting one component uses label when supplied, otherwise name when supplied, and otherwise the stable canonical component ID; external remains a documented conventional open type rather than a closed enum or special entity kind
- [ ] #3 Normalization, application operations, Markdown persistence, reload, and deterministic serialization preserve omitted and supplied recognition metadata
- [ ] #4 iconDomain is validated and persisted as optional canonical favicon-domain recognition metadata but never participates in identity, evidence matching, network access, or trust decisions; GROM-51 adds no favicon fetcher or icon-resolution capability
- [ ] #5 No layout coordinate, color, theme, folded group, zoom, or other renderer state is admitted to the standard model
- [ ] #6 Tests cover create, update, clear, reload, malformed metadata, label-to-name-to-canonical-ID display fallback, and byte-stable unchanged reads

<!-- AC:END -->
