---
id: TASK-8
title: Reload the viewer when Markdown changes
status: To Do
assignee: []
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-1
dependencies:
  - TASK-6
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://github.com/comarkdown/comark'
priority: high
type: feature
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The viewer delivered by TASK-6 reads canonical architecture only from Markdown. Add a local filesystem watcher for groma/observed and groma/plans so an open viewer rebuilds its selected model after a component document or plan README changes. The watcher observes architecture documents only in Revision 02; watching or interpreting project source code is explicitly deferred to Revision 03.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adding, changing, or removing a component Markdown file under groma/observed or groma/plans updates the open viewer without process restart
- [ ] #2 Changing a plan README updates revision title or description context without creating a C4 node
- [ ] #3 Each update reparses Markdown through the TASK-4 reader and rebuilds the TASK-5 model rather than mutating canonical files
- [ ] #4 Files outside groma/ do not trigger a viewer update in Revision 02
- [ ] #5 The watcher introduces no source scanner or incremental reconciliation engine
<!-- AC:END -->
