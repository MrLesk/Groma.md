---
id: TASK-12
title: Emit observed components as canonical Markdown
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 01:57'
labels: []
milestone: m-2
dependencies:
  - TASK-1
  - TASK-4
  - TASK-10
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
  - 'https://github.com/comarkdown/comark'
  - 'https://c4model.com/'
modified_files:
  - src/markdown-emitter.mjs
  - test/markdown-emitter.test.mjs
  - e2e/release-gate.spec.js
priority: high
type: feature
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the separate Markdown emitter shown in the Revision 03 architecture plan. It consumes the bounded observation record contract from TASK-10 and writes canonical component files only inside the exact generated components directory that TASK-10 designates beneath groma/observed. A complete emission may replace files only in that owned subtree and must preserve every hand-authored person, system, container, and unrelated component. Implement against contract fixtures so it can proceed in parallel with TASK-11; TASK-13 performs their integration. Generated documents use the TASK-1 format, include readable observation evidence in a ## Source evidence body section without new lifecycle or claim frontmatter, parse with the required comark npm package, and remain loadable through the TASK-4 reader. The emitter has no permission to read or write groma/plans.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each supported observation set produces component files that satisfy the TASK-1 Markdown contract and C4 containment rules inside the TASK-10-owned generated subtree
- [x] #2 Generated relationships are readable Markdown links and each generated component has a readable ## Source evidence section with its repository-relative file and source ranges; no claim field, lifecycle state, or second model is added
- [x] #3 Emission replaces only the TASK-10-owned generated components subtree and preserves hand-authored people, systems, containers, and every unrelated component beneath groma/observed
- [x] #4 The emitter neither reads nor changes any directory beneath groma/plans
- [x] #5 Generated files parse successfully with the comark npm package and load through the TASK-4 reader
- [x] #6 Emitting the same ordered observations twice produces byte-identical Markdown files
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add disposable-repository tests first for canonical rendering from the TASK-10 observation fixture, exact escaping/link/evidence text, stale owned-file replacement, byte-identical repeats, preservation of observed sentinels, inaccessible-plan isolation, Comark parsing, and TASK-4 loading.
2. Add failure-first tests for missing/duplicate relationship targets and unsafe owned-directory preconditions, proving validation completes before replacement and unrelated data remains byte-identical.
3. Implement a standalone Markdown emitter that validates the bounded observation record, builds a Comark-derived observed target index outside the fixed owned subtree, applies TASK-10 unsigned UTF-8 bytewise ordering and single-pass punctuation escaping, renders canonical component documents, and validates staged Markdown.
4. Replace only groma/observed/systems/groma/containers/scanner/components/ using an in-subtree staged transaction and backup/rollback after real-directory ownership checks; do not import the observer or inspect source/plans.
5. Run focused tests, architecture validation, the full Node and browser suites, inspect diff/ownership/read-scope evidence, finalize TASK-12 through Backlog, and commit the scoped change on main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a standalone src/markdown-emitter.mjs against the TASK-10 observation fixture without importing the source observer. It validates the bounded record and fixed scanner ownership path, builds a Comark-derived target index from observed Markdown outside the owned subtree, applies the contract bytewise tuple ordering and one-pass ASCII punctuation escaping, renders canonical three-field component documents with relative relationship links and readable source evidence, and validates generated text with Comark before filesystem mutation.

Replacement uses a staged transaction wholly inside groma/observed/systems/groma/containers/scanner/components/: original entries move to an in-subtree backup, staged files move into place, and caught replacement failures restore moved generated/original entries. Linked/wrong-kind owned paths reject before mutation. Tests use disposable repositories with stale owned output, hand-authored observed sentinels, an inaccessible plans subtree, missing/duplicate targets, a linked target, and injected replacement failure; focused suite passes 7/7 and proves repeated byte identity plus TASK-4 loadability.

Review corrections: separated replacement commit from cleanup so a partial backup cleanup cannot trigger destructive rollback; cleanup retries without disturbing installed output. Canonical target indexing now validates TASK-1 paths, frontmatter, heading/prose, C4 containment, external semantics, and relationship tables/links before accepting an observed element. Red/green regressions cover partial cleanup and noncanonical targets. Independent re-review found no remaining Critical, Important, or Minor issues.

Final verification: focused emitter tests passed 9/9; npm run check passed architecture validation and 125/125 Node tests; npm run test:viewer:browser passed 11/11 after adding the emitter to the explicit filesystem-reader isolation inventory; node syntax and git diff checks passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the separate deterministic Markdown emitter for groma.typescript-bun/v1 observations. It emits Comark-loadable canonical scanner components with bytewise ordering, exact TASK-10 escaping, readable relative relationships, and source evidence; validates canonical observed relationship targets; and confines staged replacement, stale removal, retry, and rollback to the exact owned subtree while never reading plans or source. Disposable-repository tests prove preservation, plan isolation, preflight failure safety, rollback/cleanup behavior, Comark/TASK-4 loading, and byte-identical repeats. Verified 9/9 focused, 125/125 full Node, 11/11 browser, syntax/diff hygiene, and independent review with no remaining findings.
<!-- SECTION:FINAL_SUMMARY:END -->
