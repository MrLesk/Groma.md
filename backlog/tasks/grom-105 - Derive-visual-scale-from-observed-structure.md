---
id: GROM-105
title: Derive visual scale from observed structure
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-21 21:47'
updated_date: '2026-07-21 22:22'
labels:
  - frontend
  - ux
  - visual-blueprint
  - scanner
dependencies: []
references:
  - MANIFESTO.md
  - brand/STYLE.md
  - docs/interface-glossary.md
priority: high
type: bug
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace GROM-103's ranked truncation with an adaptive disposable hierarchy. Groma must represent every component in the current scope by moving to a coarser observed level until the layer is human-readable. The OpenClaw stress case should use existing bound provenance to recognize src, extensions/plugins, packages, and ui rather than presenting 85 workspace members as root-scale siblings. Missing evidence for a bounded deeper level is a mapping result to expose, not permission to hide arbitrary components or write guessed canonical intent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The OpenClaw overview represents all 85 current children through deterministic higher-level observed groups, with no arbitrary top-N omission or pagination
- [ ] #2 Groma repeatedly selects the coarsest defensible observed level needed to keep the current visual layer roughly within 16-20 nodes; a level that remains over budget is not silently truncated
- [ ] #3 Automatic groups are derived through bounded shared application reads from scanner evidence and remain disposable projection state; canonical components, parents, scale, and intent are unchanged
- [ ] #4 Focusing an automatic group expands that same boundary with nearby context, and returning reverses the spatial transition
- [ ] #5 When observations cannot produce a bounded meaningful level, the UI reports the unresolved mapping while still accounting for every component
- [ ] #6 Focused fixtures cover the 85-component OpenClaw shape, deterministic grouping, complete component accounting, and an ungroupable over-budget level
- [ ] #7 The overview uses available viewport space and routes visible relationship connectors from the nearest card sides without crossing component content or the system heading
- [ ] #8 An expanded area provides an explicit Collapse control that returns one exploration level while preserving the reverse spatial transition
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the bounded component view with the minimum scanner-owned resource-path evidence needed for visual grouping. 2. Replace rankedLevel with a deterministic disposable path hierarchy that accounts for every sibling and chooses a coarser level until bounded. 3. Make Focus expand the same observed-area box in place, derive the next meaningful child grouping rather than landing on an opaque unresolved cohort, retain nearby areas, and reverse cleanly. 4. Use balanced card rows and relationship gutters while suppressing redundant containment lines. 5. Verify focused fixtures plus live Groma and OpenClaw overview/focus/reverse transitions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented scanner-provenance path reads and disposable observed-area projection with complete accounting. Replaced ranked truncation with deterministic grouping and explicit mapping-gap output. Reworked the sheet into balanced rows with routing gutters, nearest-side handles, same-layer relationships, and redundant containment-line suppression. Fixed the Groma regression where known-but-unloaded children showed Inspect instead of Explore; canonical domain cards now expose Explore from bounded child counts and load their parts on demand. Live Browser QA confirmed OpenClaw's 85 components normalize to four observed areas and Groma's application domain expands in place to 11 parts, retains neighboring-domain context, reverses to overview, and emits no console warnings.

Relationship rendering now draws only clear adjacent gutter routes; longer relationships remain discoverable in component detail. Added an explicit Collapse control to reverse one exploration level.
<!-- SECTION:NOTES:END -->
