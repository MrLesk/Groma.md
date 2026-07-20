---
id: GROM-76
title: Propose component scale from evidence during reconciliation
status: To Do
assignee: []
created_date: '2026-07-20 17:45'
labels:
  - pivot
  - reconciliation
milestone: m-5
dependencies:
  - GROM-71
  - GROM-75
priority: medium
type: feature
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A versioned pure derivation maps structural signals to a proposed scale, with thresholds pinned in workspace configuration so proposals are exactly as deterministic as the scan. It lives in reconciliation, outside every scanner. Ambiguity fails closed: threshold-straddling signals produce no proposal and the component surfaces as unscaled — a curation prompt, not a guess. Accepting a proposal is explicit curation; once curated, scale is intent and rescans never change it. When later evidence disagrees with curated scale, the disagreement surfaces as reviewable scale drift — architectural drift detection for free, and arguably the most valuable output of the whole strata model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The derivation is a pure versioned function of signals plus pinned thresholds; identical inputs always produce identical proposals
- [ ] #2 Threshold-straddling signals produce no proposal and the component surfaces as unscaled for curation
- [ ] #3 Accepting a proposed scale is an explicit curation action through shared operations, and rescans never change curated scale
- [ ] #4 Evidence disagreeing with curated scale surfaces as scale drift on read surfaces without mutating intent
- [ ] #5 bun run check stays green
<!-- AC:END -->
