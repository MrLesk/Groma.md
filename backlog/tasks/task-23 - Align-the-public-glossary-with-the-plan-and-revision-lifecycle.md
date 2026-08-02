---
id: TASK-23
title: Align the public glossary with the plan and revision lifecycle
status: Done
assignee:
  - '@claude'
created_date: '2026-08-02 19:53'
updated_date: '2026-08-02 20:25'
labels: []
milestone: m-4
dependencies: []
references:
  - docs/superpowers/specs/2026-08-02-plan-revision-lifecycle-design.md
type: docs
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The approved lifecycle contract (docs/superpowers/specs/2026-08-02-plan-revision-lifecycle-design.md, recorded by TASK-22) redefines the core terms: a plan is an independent feature scope holding only unimplemented element Markdown, observed architecture is the architecture known to exist, and revisions are immutable Git commits. Public documentation still teaches the older model in which plans are cumulative complete revisions: the README.md glossary written by TASK-20, groma/README.md, groma/plans/README.md, and the plan naming in docs/historical-investigations.md. Rewrite the glossary and naming so readers and agents learn the contract terms, while keeping descriptions of shipped commands truthful for the current tree. The existing numbered plan directories predate the contract and are migrated by separate work; refer to them with explicit transition notes, not by renaming them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The root README glossary defines Plan, Observed architecture, and Revision as the lifecycle contract does and links to the contract document
- [x] #2 No current-intent documentation describes plans as revisions or as cumulative states, except explicit transition notes about the existing numbered plan directories
- [x] #3 Descriptions of shipped behavior such as viewer comparison and validation remain accurate for the current tree
- [x] #4 bun run check passes
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
1. Rewrite the root README glossary table to the contract terms (Plan, Observed architecture, Revision) and link the lifecycle contract document.
2. Update the root README prose that calls plans complete desired revisions, with a transition note for the existing numbered directories.
3. Update groma/README.md: revision-locations framing, containment and link resolution wording per the contract, and the complete-example framing for the 02-live-viewer directory.
4. Rewrite groma/plans/README.md as an index of feature plans with an explicit transition note for the numbered directories.
5. Update docs/historical-investigations.md sentences that use Revision as a desired-state name.
6. Run bun run check and verify glossary consistency with a targeted grep.
7. Cold simplicity review per AGENTS.md, then finalize.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewrote the glossary and naming across README.md, groma/README.md, groma/plans/README.md, groma/observed/README.md, groma/source-observation.md, docs/historical-investigations.md, and the observed architecture-workspace container doc. The glossary table mirrors the lifecycle contract terms and links the contract; a transition note in each affected surface covers the pre-contract numbered plan directories, which stay byte-identical. The architect supplied one wording mid-review, recorded verbatim: a plan is a partial overlay, not a complete model and not a cumulative step.

Correction history: the cold simplicity review returned five findings (a leftover "one complete plan", a three-sentence completeness digression, a missing README-and-elements formula, "selected architecture models", and the last step-style "Plan 03" name); all five were applied. Its two out-of-scope observations were applied as well because acceptance criterion 2 is blanket: groma/observed/README.md and groma/source-observation.md still taught plans-as-revisions. The single targeted re-review confirmed all five fixes, found no substantive regressions, and caught one residual: the observed architecture-workspace container doc still said "named plan revisions" with a <revision-name> layout snippet; fixed to "feature plans" and <plan-name> (prose and fence only, frontmatter and relationships untouched). Plan-directory copies of that doc were deliberately left byte-identical as pre-contract states.

Verification: old-sense revision sweep clean across all current-intent docs and groma/observed (exemptions: the shipped --revision CLI flag and the emitter-internal revision-local index wording, both left for the TASK-24 code alignment); the three added contract links resolve; git diff --check clean; bun run check exited 0 on the final state. bun run check flaked twice during the task on the pre-existing test/source-refresh.test.mjs settle assertion, which passes alone (5/5) and is now tracked as TASK-27. Out-of-scope observation for the orchestrator: AGENTS.md line 63 still says "one approved revision" in the old sense; AGENTS.md is process instruction with unrelated uncommitted edits, so it was not touched.

Clean-main follow-up: committing the glossary work and detaching the in-flight semantic-zoom worktree exposed that the earlier bun run check evidence had run against in-flight test files. Three content-coupled expectations were stale on committed main (architecture-reader and validate-architecture tests missing plans 04 and 05) and the observed architecture-workspace wording change legitimately turned that element into a comparison modification against the frozen default plan, breaking one viewer e2e assertion. Fixed on main by commits 8b8f1c5 (repository content test coverage for plans 04 and 05) and aefb3db (viewer e2e expects the workspace modification and its Planned modification badge; the unchanged-element-has-no-badge intent stays covered by the git node). Final clean-main verification: git status empty, bun run check exit 0, release gate 5/5, viewer browser suite 12/12.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Aligned all public documentation with the plan and revision lifecycle contract: the root glossary now defines Plan, Observed architecture, and Revision in the contract terms and links the contract, plans are described as partial overlays rather than cumulative revisions everywhere current-intent docs speak, and explicit transition notes cover the untouched pre-contract numbered plan directories. Verified by a clean old-sense terminology sweep, resolving contract links, a cold simplicity review plus one targeted re-review with all findings applied, and bun run check exiting 0.
<!-- SECTION:FINAL_SUMMARY:END -->
