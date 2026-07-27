---
id: TASK-9
title: Verify the complete live-viewer flow
status: To Do
assignee: []
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-1
dependencies:
  - TASK-7
  - TASK-8
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://c4model.com/'
  - 'https://github.com/comarkdown/comark'
priority: high
type: task
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 02 is the release gate for the complete Markdown-to-view workflow. Using the observed snapshot from Revision 01 and the three named plans already committed under groma/plans, verify that the local application parses architecture through Comark, derives the C4 model, supports system-to-container-to-component decomposition, compares observed and planned snapshots, and reloads after Markdown changes. No source-code scanning may be introduced to make this test pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An automated browser test opens groma/observed and navigates from the Groma system context to a container and one of its components
- [ ] #2 Selecting a named plan demonstrates ghost additions, planned modifications, planned removals, and unchanged elements using controlled fixture differences
- [ ] #3 Adding or editing a component Markdown file updates the already-open browser view
- [ ] #4 Restarting the application from unchanged Markdown produces an equivalent C4 graph and revision comparison
- [ ] #5 The verified workflow reads no project source files and contains no scanner implementation
<!-- AC:END -->
