---
id: TASK-12
title: Emit observed components as canonical Markdown
status: To Do
assignee: []
created_date: '2026-07-27 20:56'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-2
dependencies:
  - TASK-10
references:
  - README.md
  - groma/plans/03-code-observation/README.md
  - 'https://github.com/comarkdown/comark'
  - 'https://c4model.com/'
priority: high
type: feature
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the separate Markdown emitter shown in the Revision 03 architecture plan. It consumes the bounded observation record contract defined by TASK-10 and writes the canonical component format from TASK-1 beneath groma/observed using the same containment-first C4 directory structure as the plans. Implement it against contract fixtures so it can proceed in parallel with the TASK-11 observer; TASK-13 performs their integration. Generated Markdown must remain readable and parseable by Comark, the required comark npm package, and the emitter has no permission to read or write groma/plans.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each supported observation set produces component files that satisfy the TASK-1 Markdown contract and C4 containment rules
- [ ] #2 Generated relationships are readable Markdown links and every generated claim includes its repository-relative source location
- [ ] #3 The emitter writes only beneath groma/observed and neither reads nor changes any directory beneath groma/plans
- [ ] #4 The generated files parse successfully with the comark npm package and load through the TASK-4 reader
- [ ] #5 Emitting the same ordered observations twice produces byte-identical Markdown files
<!-- AC:END -->
