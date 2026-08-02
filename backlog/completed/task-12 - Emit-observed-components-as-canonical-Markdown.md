---
id: TASK-12
title: Emit observed components as canonical Markdown
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 02:09'
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
1. Add a disposable-repository regression whose canonical target H1 uses a decoded newline entity; assert emission rejects before mutation and the complete observed tree stays byte-identical.
2. Reject observed target display names unless the Comark-derived text is a non-empty single-line printable value suitable for deterministic Markdown link-label rendering.
3. Extend generated-document validation to inspect the Comark relationship AST: exact canonical columns, one link per row, three cells, and the expected resolved target for every emitted relationship.
4. Run focused and full verification, record the implementation-defect correction, recheck the affected acceptance criteria, finalize TASK-12, and commit the focused change on main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a standalone src/markdown-emitter.mjs against the TASK-10 observation fixture without importing the source observer. It validates the bounded record and fixed scanner ownership path, builds a Comark-derived target index from observed Markdown outside the owned subtree, applies the contract bytewise tuple ordering and one-pass ASCII punctuation escaping, renders canonical three-field component documents with relative relationship links and readable source evidence, and validates generated text with Comark before filesystem mutation.

Replacement uses a staged transaction wholly inside groma/observed/systems/groma/containers/scanner/components/: original entries move to an in-subtree backup, staged files move into place, and caught replacement failures restore moved generated/original entries. Linked/wrong-kind owned paths reject before mutation. Tests use disposable repositories with stale owned output, hand-authored observed sentinels, an inaccessible plans subtree, missing/duplicate targets, a linked target, and injected replacement failure; focused suite passes 7/7 and proves repeated byte identity plus TASK-4 loadability.

Review corrections: separated replacement commit from cleanup so a partial backup cleanup cannot trigger destructive rollback; cleanup retries without disturbing installed output. Canonical target indexing now validates TASK-1 paths, frontmatter, heading/prose, C4 containment, external semantics, and relationship tables/links before accepting an observed element. Red/green regressions cover partial cleanup and noncanonical targets. Independent re-review found no remaining Critical, Important, or Minor issues.

Final verification: focused emitter tests passed 9/9; npm run check passed architecture validation and 125/125 Node tests; npm run test:viewer:browser passed 11/11 after adding the emitter to the explicit filesystem-reader isolation inventory; node syntax and git diff checks passed.

Reopened after quality review found an implementation defect: Comark can decode an entity such as &#10; inside an observed H1 into a newline. The target index accepted that name, escaping did not remove the control, and rendered validation checked only frontmatter, so a generated relationship row could be split before replacement.

Correction implemented with TDD. Comark-derived observed display names now retain their exact text and reject Unicode category C controls/formats plus line and paragraph separators, covering decoded newline, bidi/zero-width format controls, emptiness, and edge whitespace before any staging. Generated Markdown is re-parsed and every relationship table is validated for canonical headers, exact row/cell counts, one link, exact decoded text, and the expected revision-local target path. Disposable regressions for &#10; and &#8203; both prove zero mutation operations and byte-identical observed trees on rejection. Independent re-review found no remaining Critical, Important, or Minor issues. Classification: implementation defect.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented and corrected the deterministic groma.typescript-bun/v1 Markdown emitter. Canonical scanner components use TASK-10 bytewise ordering/escaping, readable relative links, and source evidence; canonical observed targets are validated before rendering; unsafe decoded target names are rejected before mutation; and generated relationship ASTs are checked against exact targets after Comark parsing. Replacement remains confined to the owned subtree with rollback/cleanup safeguards and no source or plan reads. Verified through disposable red/green regressions, focused/full/browser suites, syntax/diff hygiene, and independent review.
<!-- SECTION:FINAL_SUMMARY:END -->
