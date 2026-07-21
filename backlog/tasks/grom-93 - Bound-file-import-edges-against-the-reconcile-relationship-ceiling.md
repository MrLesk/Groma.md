---
id: GROM-93
title: Bound file-import edges against the reconcile relationship ceiling
status: To Do
assignee: []
created_date: '2026-07-21 17:22'
labels: []
dependencies: []
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GROM-91 added per-file import edges (relationshipType imports). These are bounded only by record/character budgets, not by a relationship count, but reconciliation enforces maxRelationships (~1000 non-containment relationships). On a repo of ~250-300+ files the file-import edges can exceed that ceiling and the scan HARD-FAILS with reconciliation-relationship-limit instead of degrading to partial — contradicting the topography's own 'partial not failed' contract (the component side already degrades gracefully). Fix: stop emitting imports/file-imports once the running non-containment relationship count approaches the ceiling and mark coverage partial, mirroring how component candidates are bounded. groma itself (77 files, 272 imports) is well under the limit, so this bites only larger repos. Found by the GROM-91 branch review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 File-import (and aggregated import) emission is bounded against the reconcile relationship ceiling and degrades to partial rather than failing the scan
- [ ] #2 A test exercises a repo whose import edges would exceed the ceiling and asserts partial coverage, not a hard failure
- [ ] #3 bun run check stays green
<!-- AC:END -->
