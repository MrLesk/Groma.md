---
id: TASK-480.4
title: Explain why a component is Modified and show rewritten prose
status: To Do
assignee: []
created_date: '2026-09-21 21:25'
labels: []
dependencies:
  - TASK-480.3
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
documentation:
  - docs/viewers/web/index.md
parent_task_id: TASK-480
priority: high
type: feature
ordinal: 560000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A Modified badge gives no reason. When only owned source changed, the default tab shows nothing different. Heavily rewritten prose becomes unreadable because removed and added words alternate and join ("WritesPackages", "savedowns"). Shared rules and frames: parent TASK and the design page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Modified component shows one line under its title that starts with "Changed:" and names what changed: description, name, technology, parent, group, status, draft, ownership, "N files +a −d" and "N relationships". An item that lives in a tab opens that tab.
- [ ] #2 Details open on How it's built when only owned source or ownership changed and the URL names no tab.
- [ ] #3 Description and overview keep word marks while under half of their text changed. Past that they show the new text under Now and the old text under Before. Text that exists only in the destination shows as Added, text that exists only in the start as Removed.
- [ ] #4 Adjacent removed and added words are separated by a space.
- [ ] #5 Added and Removed components keep the TASK-463.3 content rules.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
