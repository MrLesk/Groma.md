---
id: GROM-2
title: Refine the v0.1 component vocabulary
status: Done
assignee:
  - '@codex'
created_date: '2026-07-11 16:44'
updated_date: '2026-07-11 16:45'
labels:
  - architecture
  - bootstrap
  - documentation
milestone: m-0
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update Groma's manifesto and handmade architecture to record the approved minimal component model. v0.1 structures only intent, inputs, outputs, actions, and relationships; richer concepts remain prose or derive from those primitives so users and scanners are not forced into premature complexity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MANIFESTO.md records the minimal v0.1 component vocabulary and the rule that scanner contributions are partial
- [x] #2 ARCHITECTURE.md explains how state, requirements, guarantees, triggers, effects, failures, configuration, and events map onto the minimal vocabulary
- [x] #3 ARCHITECTURE.md contains an intent-level ordering-system example showing the component file structure
- [x] #4 The standard model and scanner descriptions do not require scanners to populate every component field
- [x] #5 The changes remain aligned with simplicity, scanner blindness, and intent over implementation detail
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Record the approved minimal v0.1 component vocabulary and partial-scanner rule in MANIFESTO.md.
2. Add the vocabulary mapping and ordering-system example to ARCHITECTURE.md.
3. Align the standard model and TypeScript scanner component cards with optional scanner contributions.
4. Review the changes against the manifesto and all task acceptance criteria.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Recorded the minimal v0.1 component vocabulary in the manifesto and architecture. Added the Ordering example, richer-concept mapping, scanner partiality rule, and matching model/scanner invariants. Verified all 32 architecture component cards retain the complete card structure and found no trailing whitespace.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refined the v0.1 component model to structure only intent, inputs, outputs, actions, and relationships. Documented how richer concepts fit without new scanner obligations and added a complete architectural Ordering example. Verified terminology, card completeness, whitespace, and manifesto alignment.
<!-- SECTION:FINAL_SUMMARY:END -->
