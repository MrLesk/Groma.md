---
id: TASK-3
title: Verify the Markdown foundation
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:55'
updated_date: '2026-07-27 22:01'
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

5. Add failing regressions for relationship targets that omit .md or use an absolute URL, and for documents missing the required H1 or immediate prose.
6. Extend the existing Comark-AST validation to require relative .md targets for every declared relationship and require exactly one H1 followed immediately by at least one prose paragraph.
7. Run the focused regressions and full repository check, re-verify all acceptance criteria and scope, finalize TASK-3 again, and commit the correction to main.

8. Add failing regressions for a one-column relationship table, a blank Description cell, and a blank Technology cell using copied Revision 01 fixtures.
9. Preserve each relationship row's three cells from the Comark AST, require the exact Target/Description/Technology header and exactly three body cells, then validate a relative target link plus non-empty description and technology text.
10. Run focused RED/GREEN verification and the full repository check, re-verify all acceptance criteria and scope, finalize TASK-3 again, and commit only the validator, tests, and Backlog record.

11. Add failing regressions for two links in one Target cell, a canonical relationship table under a renamed heading with a broken target, and a frontmatter-bearing duplicate-ID document at systems/rogue.md.
12. Require exactly one link in each Target cell; detect canonical relationship-shaped tables outside ## Relationships and reject their placement while still validating/counting their rows; reject frontmatter-bearing Markdown outside supported element paths.
13. Add a minimal Node >=20.19.0 engine declaration, refresh the lockfile, run focused RED/GREEN and full repository checks, re-verify all acceptance criteria and scope, finalize TASK-3, and commit only the correction.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a Comark 0.5.1 validator for observed and all immediate plan revisions, with a repository command and Node built-in tests for the four required failure modes. Added an observed-architecture Markdown index and root validation instructions.

Context-hunter classified the work as L1 and kept the implementation bounded to repository-native validation: revision-root README files are navigation, element files follow the existing contract paths, and no viewer/watcher/scanner/model runtime was introduced.

Interim verification: npm run check passes (4 revisions, 35 elements, 34 relationships; 5/5 tests), and a temporary readable→reviewable description edit produced a one-file, one-line Git diff before being restored.

Final verification: npm run check exited 0. The validator reported 4 revisions, 35 elements, and 34 relationships; node:test reported 6 tests, 6 passed, 0 failed. Negative fixtures independently exercised duplicate IDs, unknown parents, invalid C4 containment, and broken relationship links. The observed index test parsed its Markdown with Comark and resolved links to Groma, both users, the architecture workspace, and Git.

A fresh temporary edit to groma/observed/systems/groma/system.md changed only one prose line in git diff and was restored; git diff --exit-code confirmed no retained mutation. git diff --cached --check passed, groma/plans remained unchanged, and the implementation contains only a validator and tests—no viewer, watcher, scanner, persisted layout, or reconciliation machinery.

Specification review found two contract gaps: non-relative/non-Markdown relationship targets were filtered out instead of rejected, and required H1/prose body structure was not validated. Reopened for focused correction with regression-first verification.

Corrective TDD cycle: added four focused regression tests first. The test file then reported 10 tests: 6 passed and 4 failed with Missing expected rejection, reproducing non-.md targets, absolute URLs, missing H1, and missing immediate prose. Added minimal Comark-AST validation for relationship target cells and required body structure; the focused suite then passed 10/10.

Corrective final verification: npm run check exited 0. Validation passed for groma/observed and all three complete plan revisions (4 revisions, 35 elements, 34 relationships). node:test reported 10 tests, 10 passed, 0 failed, including explicit rejections for non-.md relationship targets, absolute relationship URLs, missing H1 headings, and missing immediate prose.

A fresh representative description edit again produced exactly one changed prose line in one observed element and was restored; git diff --exit-code confirmed no retained mutation. git diff --check and the unchanged-plans check exited 0. The corrective diff is limited to the Backlog record, validator, and regression tests, with no runtime viewer/watcher/scanner/layout/reconciliation work.

Second specification review found that collectRelationshipTargets reduced each relationship row to its first-cell href. Comark evidence shows malformed one-column and blank-cell tables remain distinguishable in the AST, so the focused correction will validate that existing row structure without adding a schema layer.

Second corrective TDD cycle: added three regressions first. The focused run reported 13 tests: 10 passed and 3 failed with Missing expected rejection, reproducing a one-column relationship table, blank Description, and blank Technology. The minimal fix now validates the exact three table headers and three cells per row, retains target-link checks, and requires non-empty description and technology text. The focused suite then passed 13/13.

Second corrective final verification: npm run check exited 0. Validation passed for groma/observed and all three plan revisions (4 revisions, 35 elements, 34 relationships). node:test reported 13 tests, 13 passed, 0 failed, including the one-column relationship table and blank Description/Technology regressions.

The exact Target | Description | Technology header, exactly three body cells, non-empty human intent, and non-empty mechanism are now enforced directly on the Comark AST. A fresh representative description edit produced one changed line in one observed file and was restored. git diff --check and the unchanged-plans check exited 0; the diff remains limited to the Backlog record, validator, and tests.

Code-quality review found three filter/truncation escapes. The written contract supports the requested fixes: each relationship row has one linked target, relationship tables belong under the exact ## Relationships section, and element documents use the documented canonical paths. Comark 0.5.1's dependency graph requires Node >=20.19.0, so the optional version note fits as one package engines field without affecting later Bun application plans.

Third corrective TDD cycle: added three real-fixture regressions first. The focused run reported 16 tests: 13 passed and 3 failed with Missing expected rejection, reproducing multiple Target links, a canonical relationship table under ## Connections with a broken target, and systems/rogue.md carrying duplicate-id frontmatter. Minimal fixes now enforce one Target link, classify/validate misplaced canonical relationship tables while reporting placement, and reject frontmatter-bearing Markdown outside supported paths. The focused suite then passed 16/16. Added package engines.node >=20.19.0, matching the locked dependency floor; npm install --package-lock-only completed with 0 vulnerabilities on Node v24.13.0.

Third corrective final verification: npm run check exited 0. Validation passed for groma/observed and all three planned revisions (4 revisions, 35 elements, 34 relationships). node:test reported 16 tests, 16 passed, 0 failed, including multiple Target links, renamed relationship-section placement plus its broken target, and frontmatter-bearing systems/rogue.md.

npm install --package-lock-only exited 0 with 0 vulnerabilities and confirmed the Node >=20.19.0 engine metadata. A fresh representative description edit produced one changed line in one observed file and was restored. git diff --check and unchanged-plans checks exited 0. The change set is limited to the Backlog record, package metadata/lockfile, validator, and tests; no viewer/runtime machinery was added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed and hardened the Markdown foundation validator. It now validates canonical element paths, stable IDs, C4 containment, H1/prose bodies, exact relationship section/table placement and structure, one resolvable relative .md Target link, and non-empty relationship intent/mechanism. Regression-first evidence captured 3 expected failures before this correction and 16/16 passing tests afterward; all four revisions (35 elements, 34 relationships) validate, navigation links resolve, the representative Git diff remains one file/one line, plans are unchanged, and no runtime architecture machinery was introduced. Added an accurate Node >=20.19.0 engine floor for the validation tooling.
<!-- SECTION:FINAL_SUMMARY:END -->
