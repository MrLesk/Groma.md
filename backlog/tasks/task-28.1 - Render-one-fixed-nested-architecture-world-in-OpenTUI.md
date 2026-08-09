---
id: TASK-28.1
title: Render one fixed nested architecture world in OpenTUI
status: To Do
assignee: []
created_date: '2026-08-09 19:07'
updated_date: '2026-08-09 20:37'
labels: []
dependencies:
  - TASK-28.3
references:
  - groma/plans/mvp/README.md
  - docs/viewer.md
  - docs/product-model.md
  - groma/README.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the human architect runs `groma view`, Groma core calculates one deterministic fixed world from its annotated architecture model and returns the ELK data as renderer-independent objects. The latest stable OpenTUI release projects those objects without calculating layout. Use ELK for best-fit nested positioning and directed routing, then tune its layout options against the Groma MVP example until the result is readable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `groma view` opens the latest stable OpenTUI viewer and obtains the annotated architecture and fixed-world ELK objects through Groma core without reading Markdown paths or calculating layout in viewer code
- [ ] #2 Core uses ELK to position every component, enclose components in containers and containers in systems, place context peers, and route every displayed relationship to its target without overlapping unrelated cards
- [ ] #3 Repeated unchanged core models produce identical element and route coordinates; semantic level, camera, panel, and terminal-size changes never run layout again
- [ ] #4 Core fixed-world calculation contains no OpenTUI rendering state, and the terminal projection consumes the returned ELK objects, IDs, annotations, containment, bounds, and routes without mutation
- [ ] #5 Observed, planned, and missing annotations appear as compact chips; observed items use a solid border and theme-derived background tint, while planned and missing items use distinct theme colors and dotted borders
- [ ] #6 A concise bordered header shows `System Context`, `Containers`, or `Components` and the current item; the footer shows `- context | containers | components +` with the current level emphasized and applicable key hints
- [ ] #7 Directed arrows, labels, nested boundaries, and selected items remain readable in the Groma MVP example at the representative terminal sizes selected during implementation
- [ ] #8 Destroying or exiting the viewer restores the original terminal screen and releases its input handler
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [ ] #5 Automated ELK layout tests assert containment, non-overlap, deterministic coordinates, directed route endpoints, and no mutation of the annotated core model
- [ ] #6 Layout options are tuned against the Groma MVP example until the manual review finds the nesting and routes readable; the accepted settings and evidence are recorded in Implementation Notes
- [ ] #7 Headless lifecycle coverage starts and destroys `groma view` and verifies renderer resources and input handling are released
- [ ] #8 The focused layout/rendering suite and project check command pass
- [ ] #9 A real-terminal smoke test confirms theme-compatible output, directed arrows, resize behavior, and terminal restoration
- [ ] #10 A cold simplicity review explains the core-model-to-layout-to-OpenTUI path and removes anything not required by these acceptance criteria
- [ ] #11 Headless OpenTUI frame tests cover System Context, Containers, and Components at two representative terminal sizes selected during implementation and verify stable geometry, header/footer content, arrows, labels, chips, and lifecycle styling
<!-- DOD:END -->
