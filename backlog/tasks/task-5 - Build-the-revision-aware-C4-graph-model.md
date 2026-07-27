---
id: TASK-5
title: Build the revision-aware C4 graph model
status: To Do
assignee: []
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:17'
labels: []
milestone: m-1
dependencies:
  - TASK-4
references:
  - README.md
  - groma/plans/02-live-viewer/README.md
  - 'https://c4model.com/'
priority: high
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Consume the revision documents returned by TASK-4 and derive the deterministic application model used by every view. Groma follows the C4 model: people use software systems; a software system contains runtime containers; a container contains components. Parent IDs express containment and Markdown relationship tables express directed collaboration. Build this model independently for groma/observed or one complete directory under groma/plans; do not merge revisions or add drawing state in this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The model represents people, software systems, containers, components, parent containment, external-system status, directed relationships, and source filenames
- [ ] #2 Containment enforces the supported C4 hierarchy and reports duplicate IDs, unknown IDs, or invalid parents with the offending filename
- [ ] #3 Relationship targets resolve through their Markdown links and stable element IDs
- [ ] #4 Loading the same unchanged revision twice produces an equivalent, deterministically ordered model
- [ ] #5 The model contains no coordinates, zoom, selection, colors, or other presentation state
<!-- AC:END -->
