---
id: GROM-76
title: Propose component scale from evidence during reconciliation
status: Done
assignee:
  - '@codex'
created_date: '2026-07-20 17:45'
updated_date: '2026-07-20 20:15'
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
- [x] #1 The derivation is a pure versioned function of signals plus pinned thresholds; identical inputs always produce identical proposals
- [x] #2 Threshold-straddling signals produce no proposal and the component surfaces as unscaled for curation
- [x] #3 Accepting a proposed scale is an explicit curation action through shared operations, and rescans never change curated scale
- [x] #4 Evidence disagreeing with curated scale surfaces as scale drift on read surfaces without mutating intent
- [x] #5 bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a versioned pure structural-scale derivation over fileCount, exportCount, and reuseBreadth with validated pinned thresholds and fail-closed ambiguity.
2. Extend bounded workspace configuration with the v1 threshold set, serialize it deterministically, and pass it only into reconciliation.
3. Persist the derivation assessment beside each component evidence binding while leaving canonical component scale untouched.
4. Expose proposal, ambiguity, alignment, and drift through exact shared component reads; use the existing component update operation for explicit scale curation.
5. Add focused derivation, configuration, reconciliation, curation, rescan, and drift tests; regenerate the self-workspace and run bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: bun run check passed with 443 tests. The compiled self-scan completed with 71 records and two structural signals; the in-app browser showed application as “Proposed part — curate explicitly to accept.” Reconciliation tests prove explicit curation survives rescans, disagreement reads as drift, and threshold-straddling evidence stays unscaled.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added deterministic v1 structural-scale proposals with workspace-pinned thresholds, evidence-owned assessments, explicit curation semantics, and proposal/alignment/ambiguity/drift read states in shared operations and the editor. Recreated the unreleased self-workspace directly in the document format. Verified with bun run check, 443 tests, compiled self-scan, and an in-app editor interaction.
<!-- SECTION:FINAL_SUMMARY:END -->
