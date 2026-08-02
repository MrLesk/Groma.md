---
id: TASK-17
title: Select a rendering foundation and build the semantic-zoom architecture map
status: To Do
assignee: []
created_date: '2026-07-29 20:28'
updated_date: '2026-07-30 16:54'
labels: []
dependencies: []
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
priority: high
type: feature
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect opens the local viewer, Groma presents one fixed, nested C4 world in which camera zoom changes the globally visible architecture level — Context, Containers, Components, and Code — without geometry jumps. The rendering foundation is selected from the documented inventory of MIT-licensed browser graph renderers, restricted to modern, actively maintained libraries and judged UX-first. The framework a library targets is not a filter: Groma is early-stage TypeScript, so the winner may retain React Flow, keep React with another library, or drop React entirely; libraries whose latest release only supports outdated framework versions are excluded. Markdown and the existing architecture model remain the input. Candidate proofs, benchmarks, and the selected-library prototype remain uncommitted until the human architect approves the direction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opening the local viewer presents context, containers, components, and code in one pan-and-zoom map rather than separate decomposition sections.
- [ ] #2 Crossing the Context, Containers, Components, and Code zoom landmarks changes visibility and emphasis across the whole map as a crossfade, without relayout, geometry jumps, or sudden card-size changes at the boundary.
- [ ] #3 The map supports wheel zoom, drag pan, plus and minus controls, and a continuous slider carrying the four fixed level breakpoints; all controls drive the same camera.
- [ ] #4 Cards, boundaries, labels, code items, and relationship lines are crisp and readable when their level is primary.
- [ ] #5 The rendering foundation is selected from the documented MIT candidate inventory restricted to modern, actively maintained libraries, judged UX-first (interaction fidelity and visual quality, then 1,000-component readability, then measured performance, then integration simplicity); a library's target framework is not a filter and React may be dropped with the old viewer.
- [ ] #6 The winning library is used directly without a hand-built SVG, Canvas, or WebGL renderer, compatibility adapter, dual renderer, or fallback.
- [ ] #7 The supported local flow still reads the existing Groma architecture model, shows one selected plan or observed source at a time, and preserves plan switching and live reload.
- [ ] #8 The prototype stops at code detail and remains uncommitted until the human architect approves it in the working session.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope correction: the original parent description prematurely required replacing React Flow and its first comparison tasks hard-coded only G6 and MSAGL. The human architect clarified that the goal is to find the best library without preselection. Revision 04 now defines a practical exhaustive MIT candidate inventory, common proofs, survivor benchmarks, and an evidence-backed selection before viewer implementation.

2026-08-01 scope correction: the human architect reopened the completed TASK-17.7 selection and reset its criteria. The approved interaction now includes the C4 Code level as a fourth landmark and a continuous slider with four fixed breakpoints, confirmed against a live reference example. Selection is UX-first, restricted to modern actively maintained libraries, and framework-agnostic — Groma may drop React together with the current viewer, so only libraries pinned to outdated framework versions are excluded on framework grounds. Level emphasis crossfades with zoom rather than switching discretely.
<!-- SECTION:NOTES:END -->
