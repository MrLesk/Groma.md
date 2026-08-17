---
id: TASK-83
title: Split web details into What it does and How it's built
status: To Do
assignee: []
created_date: '2026-08-17 20:50'
labels: []
dependencies: []
priority: high
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web details sheet shows one flat column of description, relationships, and children. Split it into two tabs: What it does keeps the meaning (description, relationships, children); How it's built shows the evidence: the element's source files from its code references, a technology line when its architecture Markdown declares one, and which person commands travel through the selection, each activatable. Approved example: the reference demo's What it does / How it's built pane.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The details pane offers What it does and How it's built tabs; What it does keeps today's description, relationships, and children
- [ ] #2 How it's built lists the selected element's source files from its code references
- [ ] #3 An element's Markdown may declare a technology; when declared it renders as chips under How it's built
- [ ] #4 How it's built lists the person commands whose paths touch the selection; clicking one activates that flow
- [ ] #5 Tab state and travelled-by derivation are covered by fixture tests and bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
