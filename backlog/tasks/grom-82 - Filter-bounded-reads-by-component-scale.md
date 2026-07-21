---
id: GROM-82
title: Filter bounded reads by component scale
status: Done
assignee: []
created_date: '2026-07-20 18:19'
updated_date: '2026-07-21 18:03'
labels:
  - pivot
  - cli
  - application
milestone: m-5
dependencies:
  - GROM-71
modified_files:
  - src/application/contracts.ts
  - src/application/operations.ts
  - src/core/graph-query.ts
  - src/persistence/projection-query-engine.ts
  - src/cli/contracts.ts
  - src/cli/parser.ts
  - src/cli/surface.ts
  - src/cli/help.ts
  - src/cli/tests/parser.test.ts
  - src/persistence/tests/projection-query-engine.test.ts
  - src/host/tests/application-operations-local.test.ts
priority: medium
type: feature
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GROM-71 gave components the closed scale axis and exposed it on every read surface. The bounded list surfaces should also filter by it so agents and humans can ask for one stratum directly: roots, children, list, and search accept an optional scale filter (and a shared filter), validated against the closed set, threaded through the exact option-shape validation in the application request contracts and the CLI flags, with help text. Semantic zoom in the web canvas (GROM-77) can then reuse the same filtered reads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 List roots, children, components, and search accept optional scale and shared filters validated against the closed set
- [ ] #2 CLI list surfaces gain matching flags with help text, and filtered pages stay bounded with cursors intact
- [ ] #3 bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend bounded component request contracts and exact validation with optional closed scale/shared filters, composing them into existing list predicates and query identities.
2. Extend the generic projection entity/search query with bounded top-level scalar payload criteria so search filters before pagination and cursors bind the criteria.
3. Add CLI --scale/--shared flags and help, focused application/projection/parser tests, then run targeted and full checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented optional closed scale and boolean shared filters across component list/root/children/search request contracts, composed filters with existing list predicates and projection search queries, bound filters into cursor query identity, and added matching CLI flags/help plus focused tests.
A targeted run before the final fixes reported two failures: filtered component pages passed filter fields into the page-only cursor contract, and unfiltered projection continuations performed one unnecessary exact entity read. Both causes were corrected. No post-fix tests or checks were run because the product owner explicitly stopped verification/review gates for this sweep. Unverified by product-owner instruction; acceptance criteria remain unchecked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added optional scale/shared filters across bounded application reads, cursor-bound projection queries, and matching CLI flags. Unverified by product-owner instruction; acceptance criteria remain unchecked and no post-fix local checks, CI wait, or review were performed.
<!-- SECTION:FINAL_SUMMARY:END -->
