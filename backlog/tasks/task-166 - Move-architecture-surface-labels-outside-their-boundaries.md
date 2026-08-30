---
id: TASK-166
title: Move architecture surface labels outside their boundaries
status: To Do
assignee: []
created_date: '2026-08-24 18:10'
labels: []
dependencies:
  - TASK-165
priority: medium
type: enhancement
ordinal: 177000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the blueprint sheet decorations are established, move system-island, group-zone, and container-slab names below or just outside their boundary lines. Use a short leader line where separation is needed, so names identify surfaces without sitting on their fills or competing with contained architecture. Preserve the existing isometric plane, selection behavior, camera fit, and the separate roof-label treatment for buildings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 System, group, and container names render below or just outside their own boundary instead of over the surface fill or pattern.
- [ ] #2 A short leader line connects a separated label to its surface when needed, and representative nested maps remain readable without label-content overlap.
- [ ] #3 External labels keep the surface plane alignment, selection and lit-state behavior, and the initial camera fit includes their visible bounds.
- [ ] #4 Building roof labels remain distinct from surface labels, and focused tests plus browser QA cover the supported label flow.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
