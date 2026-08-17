---
id: TASK-86
title: Split TUI details into What it does and How it's built
status: To Do
assignee: []
created_date: '2026-08-17 21:38'
labels: []
dependencies: []
priority: high
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI details pane shows one flat column. Split it like the web viewer: What it does keeps the meaning (description, relationships, children); How it's built shows the evidence: declared technology, the code files with a files-and-lines weight line, and the person commands whose walk touches the selection, each pickable. t toggles the tabs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The details pane offers What it does and How it's built, toggled with t; the choice persists across selections
- [ ] #2 What it does keeps today's description, relationships, and children; How it's built shows the code references with a files-and-lines line when code is observed
- [ ] #3 A technology declared in the element's Markdown renders under How it's built
- [ ] #4 How it's built lists the person commands whose walk touches the selection; choosing one with the details cursor lights that walk
- [ ] #5 Tab state and the pickable-rows derivation are covered by fixture tests and bun test passes
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
