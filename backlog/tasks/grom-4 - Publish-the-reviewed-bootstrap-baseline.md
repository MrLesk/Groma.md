---
id: GROM-4
title: Publish the reviewed bootstrap baseline
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:33'
updated_date: '2026-07-11 20:28'
labels:
  - bootstrap
  - repository
milestone: m-1
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - AGENTS.md
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish the reviewed manifesto, architecture overview, repository instructions, and Backlog records as the immutable starting point for implementation. Publish that baseline to a new private GitHub repository at MrLesk/Groma.md before implementation commits begin.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A private GitHub repository named MrLesk/Groma.md exists and is accessible with the configured gh authentication
- [ ] #2 The initial main branch commit contains the reviewed MANIFESTO.md, ARCHITECTURE.md, AGENTS.md, .gitignore, and Backlog records without IDE metadata or operating-system artifacts
- [ ] #3 The local main branch tracks the GitHub origin and the worktree is clean after publication
- [ ] #4 The baseline commit predates all Iteration 1A implementation changes and can be checked out independently
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove ignored workspace artifacts from the publication scope without modifying reviewed project content.
2. Create one baseline commit containing the constitutional, architectural, and Backlog state.
3. Create the private MrLesk/Groma.md repository through authenticated GitHub tooling.
4. Configure origin, push main, and verify repository visibility and a clean local checkout.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started after Alex approved the Iteration 1A map. Verified gh 2.83.1 is authenticated as MrLesk, no origin is configured, and MrLesk/Groma.md does not yet exist.
<!-- SECTION:NOTES:END -->
