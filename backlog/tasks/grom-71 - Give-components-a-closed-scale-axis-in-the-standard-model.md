---
id: GROM-71
title: Give components a closed scale axis in the standard model
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 17:44'
updated_date: '2026-07-20 18:18'
labels:
  - pivot
  - model
  - cli
milestone: m-5
dependencies:
  - GROM-70
priority: high
type: feature
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Components gain a curated scale property from a closed set — system, domain, part, element — plus an explicit shared flag, both intent (never scanner-written). This is the atomic-design lesson folded into Groma without the chemistry: a closed vocabulary of granularity with containment rules, so every surface can say how big a thing is. Rules: a child is never coarser than its parent; same-scale nesting is allowed; absent scale is legal (unscaled) and is never guessed or defaulted — it surfaces as a curation prompt. The open type token is untouched and stays flavor only. Depends on the manifesto amendment (GROM-70).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The standard model validates scale against the closed set and rejects any child coarser than its parent on create, update, and move, with actionable diagnostics
- [x] #2 Absent scale stays legal as unscaled and is never defaulted, inferred, or guessed
- [x] #3 shared is an explicit boolean flag orthogonal to scale and to the open type token
- [x] #4 Deterministic serialization covers both fields and bun run check stays green
- [x] #5 CLI component create and update accept scale and shared through the component record input, and get, roots, children, search, export, and the plain overview expose both fields
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add scale (closed set system/domain/part/element) and shared (boolean) as optional curated fields in the standard model: normalize, patch, parse, serialize, deterministic ordering, mirroring the recognition-field pattern.
2. Enforce child-never-coarser against the parent scale wherever parent context is validated (create, update, move), unscaled always legal, fail-closed diagnostics.
3. Thread --scale and --shared through CLI create/update; expose both on get/roots/children/search/export output and add scale filtering to bounded reads.
4. Unit tests for validation, invariant, CLI mapping; bun run check green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scale and shared are standard-model fields validated in every layer that re-validates components independently: the model capability (closed-set diagnostic invalid-component-scale, boolean check invalid-component-shared), the application snapshot-state decoder, and the Markdown intent store (frontmatter writer, reader allow-list, and the read-side input rebuild — the last one was silently dropping unknown fields and was the subtle bug of the change). The containment invariant lives in application operations where parent context exists: create checks the drafted component against its resolved parent, update and reparent share one path that checks the resulting component against its parent and every currently loaded child against the resulting scale, all rejecting with component-scale-coarser-than-parent. Unscaled components never participate in checks. Supported boundary: merge (alias supersession) does not re-validate scale containment for children that resolve to the survivor through aliases; the invariant re-validates on the next direct mutation, and merge-time validation belongs with the reconciliation work in GROM-76 if wanted. Scale filtering on bounded reads was split out to GROM-82 to keep this change PR-sized. Evidence: five new tests (four model-level, one host-level end-to-end covering rejection, same-scale nesting, unscaled legality, and the child-direction update rejection); bun run check green with 449 tests including the compiled Iteration 1A workflow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Components now carry the closed curated scale ladder (system, domain, part, element) and the shared flag through the whole stack — model validation, application decoding, containment enforcement at create, update, and reparent, Markdown persistence, and CLI exposure including the plain overview tree. Unscaled stays legal and never guessed. Bounded-read filtering by scale follows in GROM-82.
<!-- SECTION:FINAL_SUMMARY:END -->
