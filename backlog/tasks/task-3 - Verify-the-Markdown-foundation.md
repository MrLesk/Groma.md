---
id: TASK-3
title: Verify the Markdown foundation
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 21:48'
labels: []
milestone: m-0
dependencies:
  - TASK-2
references:
  - README.md
  - groma/plans/01-markdown-foundation/README.md
  - 'https://c4model.com/'
modified_files:
  - .gitignore
  - README.md
  - groma/observed/README.md
  - package-lock.json
  - package.json
  - scripts/validate-architecture.mjs
  - test/validate-architecture.test.mjs
priority: high
type: task
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 01 is the gate that proves Groma architecture works as repository-owned documentation before any application exists. Validate the groma/observed tree created by TASK-2 against the contract from TASK-1, and demonstrate that a person unfamiliar with Groma can navigate the files and review a component change through Git. This task must not introduce a viewer, watcher, scanner, layout engine, or reconciliation system.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Automated validation rejects duplicate stable IDs, unknown parent IDs, invalid C4 containment, and broken relationship links
- [x] #2 The validation passes for groma/observed and every complete revision under groma/plans
- [x] #3 A reader can identify Groma, its users, its architecture workspace, and its Git relationship directly from the Markdown files
- [x] #4 A representative component description or relationship change produces a focused, understandable Git diff
- [x] #5 No runtime viewer, watcher, source scanner, persisted layout, or reconciliation machinery is introduced
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a Comark-based repository validator that discovers groma/observed and each immediate groma/plans revision, validates contract frontmatter, stable-ID uniqueness, parent resolution and C4 containment, and local Markdown relationship targets.
2. Add Node built-in tests covering the current snapshots plus duplicate IDs, unknown parents, invalid containment, and broken links; expose validation and the full check as npm scripts with a locked Comark 0.5.1 dependency.
3. Add concise Markdown navigation for the observed Revision 01 foundation so an unfamiliar reader can find Groma, both users, the architecture workspace, and Git, and document the repeatable command.
4. Run positive and negative validation, demonstrate a temporary one-line component-description Git diff without retaining it, self-review scope, finalize TASK-3 through Backlog, and commit directly to main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a Comark 0.5.1 validator for observed and all immediate plan revisions, with a repository command and Node built-in tests for the four required failure modes. Added an observed-architecture Markdown index and root validation instructions.

Context-hunter classified the work as L1 and kept the implementation bounded to repository-native validation: revision-root README files are navigation, element files follow the existing contract paths, and no viewer/watcher/scanner/model runtime was introduced.

Interim verification: npm run check passes (4 revisions, 35 elements, 34 relationships; 5/5 tests), and a temporary readable→reviewable description edit produced a one-file, one-line Git diff before being restored.

Final verification: npm run check exited 0. The validator reported 4 revisions, 35 elements, and 34 relationships; node:test reported 6 tests, 6 passed, 0 failed. Negative fixtures independently exercised duplicate IDs, unknown parents, invalid C4 containment, and broken relationship links. The observed index test parsed its Markdown with Comark and resolved links to Groma, both users, the architecture workspace, and Git.

A fresh temporary edit to groma/observed/systems/groma/system.md changed only one prose line in git diff and was restored; git diff --exit-code confirmed no retained mutation. git diff --cached --check passed, groma/plans remained unchanged, and the implementation contains only a validator and tests—no viewer, watcher, scanner, persisted layout, or reconciliation machinery.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a repeatable Comark-based Markdown architecture validator, locked its dependency, and added automated positive/negative tests. Added an observed-architecture index and root command documentation so readers can navigate the foundation. Verified all four revisions (35 elements, 34 relationships), all six tests, a focused one-line Git review diff, clean patch formatting, unchanged plan snapshots, and absence of runtime architecture machinery.
<!-- SECTION:FINAL_SUMMARY:END -->
