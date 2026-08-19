---
id: TASK-99
title: Show every Backlog assignee on a marked element
status: Done
assignee:
  - '@grok'
created_date: '2026-08-19 18:25'
updated_date: '2026-08-19 18:27'
labels: []
dependencies:
  - TASK-96
references:
  - src/viewers/tui/organisms/world.ts
  - src/work-projection.ts
  - view-host
  - terminal-viewer
priority: high
type: bug
ordinal: 112000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When more than one in-progress Backlog task references the same architecture id, the map must show every assignee, not only the first task. Standing agent instructions keep the exact-id reference rule and drop session notes. Live architecture Markdown records that groma view starts the view host, which composes Core, the Backlog plugin, and the terminal viewer. Work types do not claim Core owns Backlog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An element referenced by two in-progress tasks shows both tasks assignees on the map
- [x] #2 AGENTS.md keeps the exact-id reference rule and does not mention live interference
- [x] #3 Cli starts View host for groma view; View host and Backlog plugin state their jobs and relationships
- [x] #4 Work types and join comments do not say Core is supplied Backlog data
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Combine unique assignees from every WorkMarker on an element and draw that badge.
2. Trim AGENTS.md to the exact-id rule.
3. Point Cli groma view at View host; give View host and Backlog plugin a one-line job and relationships.
4. Delete narrating work JSDoc that claims Core receives Backlog.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
assigneesOnElement unique-joins every marker on an id; the map badge uses that list. AGENTS.md is only the exact-id rule. Cli groma view points at View host. View host and Backlog plugin have jobs and relationships. Deleted Core-owns-Backlog JSDoc. bun test test-bun/work.test.ts — 7 pass. bunx tsc --noEmit clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The map shows every unique assignee when several in-progress tasks share an element. Agent instructions, live architecture Markdown, and work types match the host-owned Backlog join. Verified with bun test test-bun/work.test.ts (7 pass) and bunx tsc --noEmit.
<!-- SECTION:FINAL_SUMMARY:END -->
