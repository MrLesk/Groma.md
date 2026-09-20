---
id: TASK-405
title: Deliver a COBOL scanner
status: To Do
assignee: []
created_date: '2026-09-15 15:16'
labels: []
dependencies: []
documentation:
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/evidence.md
  - docs/component-markdown.md
type: feature
ordinal: 451000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers need to inspect COBOL projects in Groma. Add a scanner through the existing scanner plugin flow so COBOL source evidence can support architecture discovery and human curation. Establish one supported COBOL example before implementation; document its dialect, source format, and tooling assumptions. Keep source evidence separate from authored architectural meaning and follow the existing OKF application profile and C4 boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A developer can install or register the COBOL scanner and run it through the existing Groma scan flow.
- [ ] #2 For the agreed COBOL example, the scanner reports supported source files, symbols, and resolvable dependency evidence through the shared scanner contract, with useful source locations.
- [ ] #3 Scanning the supported example again preserves existing ownership and authored architecture meaning without creating duplicate components.
- [ ] #4 Documentation states setup requirements, supported COBOL dialect and source format, evidence coverage, and known limitations.
- [ ] #5 Fixture-based tests verify the supported scan flow, and bun run check passes.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
