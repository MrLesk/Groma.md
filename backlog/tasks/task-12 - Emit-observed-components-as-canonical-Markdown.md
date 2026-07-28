---
id: TASK-12
title: Emit observed components as canonical Markdown
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 00:35'
labels: []
milestone: m-2
dependencies:
  - TASK-1
  - TASK-4
  - TASK-10
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
  - 'https://github.com/comarkdown/comark'
  - 'https://c4model.com/'
priority: high
type: feature
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the separate Markdown emitter shown in the Revision 03 architecture plan. It consumes the bounded observation record contract from TASK-10 and writes canonical component files only inside the exact generated components directory that TASK-10 designates beneath groma/observed. A complete emission may replace files only in that owned subtree and must preserve every hand-authored person, system, container, and unrelated component. Implement against contract fixtures so it can proceed in parallel with TASK-11; TASK-13 performs their integration. Generated documents use the TASK-1 format, include readable observation evidence in a ## Source evidence body section without new lifecycle or claim frontmatter, parse with the required comark npm package, and remain loadable through the TASK-4 reader. The emitter has no permission to read or write groma/plans.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each supported observation set produces component files that satisfy the TASK-1 Markdown contract and C4 containment rules inside the TASK-10-owned generated subtree
- [ ] #2 Generated relationships are readable Markdown links and each generated component has a readable ## Source evidence section with its repository-relative file and source ranges; no claim field, lifecycle state, or second model is added
- [ ] #3 Emission replaces only the TASK-10-owned generated components subtree and preserves hand-authored people, systems, containers, and every unrelated component beneath groma/observed
- [ ] #4 The emitter neither reads nor changes any directory beneath groma/plans
- [ ] #5 Generated files parse successfully with the comark npm package and load through the TASK-4 reader
- [ ] #6 Emitting the same ordered observations twice produces byte-identical Markdown files
<!-- AC:END -->
