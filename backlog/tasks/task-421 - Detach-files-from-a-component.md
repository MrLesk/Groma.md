---
id: TASK-421
title: Detach files from a component
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-18 23:09'
labels: []
dependencies: []
references:
  - curate
  - src-authoring
  - relationship-markdown
  - src-architecture-model
  - src-cli
  - instructions
  - write-commands
modified_files:
  - src/curate.ts
  - src/edit.ts
  - src/relationship-markdown.ts
  - src/cli.ts
  - src/write-commands.ts
  - test-bun/detach.test.ts
  - docs/agent-instructions/structure.md
  - docs/product-model.md
  - src/instructions.ts
  - src/source-relationships.ts
  - docs/component-markdown.md
type: feature
ordinal: 487000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Curation can combine components and move empty ones, but it cannot take a file out of a component. A mistaken or oversized component therefore stays wrong forever, and the agent instructions tell agents to stop and report the problem. In callforpapers one component owns 204 files, including security, configuration and error handling that belong to other responsibilities. Scans already give every unowned file its own component, so removing ownership is enough to make splits and single-file moves possible with the existing combine and move commands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma edit <component> --detach <file...>` removes those files from the component's Code and reports the changed architecture paths.
- [x] #2 The next scan gives each detached file its own component, which the existing combine and move commands can place; files a scanner declares as one source unit return together unless the whole unit is detached, and the documentation says so.
- [x] #3 Detaching a file the component does not own is refused without writing anything.
- [x] #4 Authored and derived file relationships remain and follow the files' new owners.
- [x] #5 The agent instructions describe splitting and moving files with detach instead of telling agents to stop; focused tests cover detach, rescan and recombination.
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
1. src/curate.ts: CurateInput gains detach (file paths). curateElement removes every Code reference to those files from the target's frontmatter before the move step, after checking that the target owns each file; an unowned file is refused before anything is written. --detach and --combine must be separate edits, because a combine rebuilds Code from the stored target. The StructuralResult reports the changed component document and affected id.
2. src/edit.ts: EditArchitectureInput.detach counts as a structural edit and is passed to curateElement.
3. Relationships keep loading while a detached file has no owner (reproduced: loading fails with 'endpoint has no file owner or concept', which also blocks the next scan). src/relationship-markdown.ts accepts a link outside the architecture folder as a source-file endpoint even without a current owner; a link into the folder must still name a concept. src/architecture-model.ts leaves connections with an unowned file off the map, so the rows stay in Markdown and follow the new owner after the next scan (derived rows are recomputed by the scan; retained and authored rows are kept).
4. src/cli.ts is at 498 lines: move the architecture write commands (draft, add, remove, edit, accept) and their helpers into src/write-commands.ts as registerWriteCommands, like registerLintCommand, and add `groma edit <component> --detach <files...>`.
5. Docs: docs/agent-instructions/structure.md (command row; detach, rescan, then combine or move instead of stopping; source units return together unless the whole unit is detached), docs/product-model.md, and the human workflow line in src/instructions.ts.
6. Tests in test-bun/detach.test.ts with synthetic scanner observations on test/fixtures/scanner-composition: detach reports the changed document and keeps authored and derived rows in Markdown; detaching an unowned file writes nothing; the rescan gives the file its own component whose relationships follow it; the file recombines; a partly detached source unit returns to its owner while a wholly detached unit gets one new component.
7. Verify with bun run check in an isolated worktree and the CLI on a fixture copy.

8. Refuse a detach that would leave a flow step without its relationship: rebuild the model with the detached document and resolve each stored flow before writing, like relation removal refuses a relationship a flow uses.

Review-fix round (external reviews at cf8e7975): Codex and Grok report no material finding for detach. One verified documentation finding (grok-all): the --detach help in src/write-commands.ts and the human overview in src/instructions.ts say the next scan gives detached files their own component, but a scan returns a detached file to the owner of the rest of its source unit (test-bun/detach.test.ts covers that). Both now say so. Skipped: repointing links for combine and move (declined by the orchestrator, recorded in TASK-426); the 'not scanned yet' explanation of a detached file belongs to TASK-413 in another lane.

Simplicity round (cold junior-maintainer review): the source-unit clause of detach stays only in the structure guide's Splits section; the --detach help, the human overview and the product model say only that detach takes files out of a component.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: curateElement applies detachedSource after grouping and before the move step. It refuses files the component does not own (listing them) before any write and rewrites groma.code without every reference to the detached files. --detach and --combine are separate edits because combine rebuilds Code from the stored target and would silently restore detached files. edit.ts treats detach as structural, so printWriteResult reports the changed component document and the affected id.
Reproduced blocker: after a manual detach of a file named in relationships.md, loading failed with 'endpoint "src/orders.ts" has no file owner or concept', which would also block the next scan. relationship-markdown.ts now accepts a link outside the architecture folder as a source-file endpoint without a current owner, while a link into the folder must still name a concept (test/architecture-model-errors.test.ts still passes). architecture-model.ts leaves connections with an unowned endpoint off the map; the rows stay stored, the scan recomputes derived rows with the new owners and keeps authored and retained rows. source-relationships.ts (TASK-416) was not touched.
CLI: src/cli.ts was at 498 lines, so the architecture write commands (draft, add, remove, edit, accept) and their helpers moved unchanged into src/write-commands.ts (registerWriteCommands, registered after registerLintCommand so help order stays); edit gained --detach <files...>. src/cli.ts is now 316 lines, src/write-commands.ts 191.
Docs: structure.md (command row, order of work, a Splits and single-file moves section replacing the stop-and-report advice, source-unit behavior), product-model.md, and the human workflow line in src/instructions.ts. docs/component-markdown.md has uncommitted edits from another session, so its relationship section does not yet mention stored rows whose file has no owner.
Verification: test-bun/detach.test.ts (synthetic observations on test/fixtures/scanner-composition) covers detach with the changed-document report, stored authored and derived rows while the file is unowned, refusal without writing, rescan to a new component whose relationships follow it in both directions, recombination, and source units (a partly detached unit returns to its owner; a wholly detached unit gets one new component). CLI on a scratch Git repository with a local fake scanner: scan, combine audit into payments, add relation src/audit.ts -> src/orders.ts, `groma edit payments --detach src/audit.ts` printed ok, payments, changed: groma/systems/shop/containers/shop-shop/components/payments.md, affected: payments; the rows stayed in relationships.md; `groma scan` created one component (audit) and `groma view src/audit.ts` listed the authored row; `groma edit payments --combine audit` recombined it. On a plain-view fixture copy, detaching an unowned file and combining with detach were refused with the document unchanged. bun run check in an isolated worktree at 42905a1b with only TASK-421 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 380 bun tests pass (21 skipped), 0 fail.

Cold review applied. Must-fix: curateElement now takes the loaded records and, before writing a detach, rebuilds the model with the detached document and resolves each stored flow; a flow whose step loses its relationship refuses the edit with 'cannot detach <files>: used by flows <ids>' and nothing is written (new test on test/fixtures/flows, plus a CLI check on a copy: groma edit worker --detach src/worker.ts refused and the world still loaded). docs/component-markdown.md now says a stored row may name a file with no current owner, stays in relationships.md, stays off the map, and joins it again after a scan; only that hunk is staged, TASK-416's hunk in the same file stays uncommitted.
Accepted optional findings: relationship-markdown.ts no longer looks up file owners (the fileOwners import and the owners map are gone) and its message says the link names no architecture concept, with the architecture root named; sourceRelationships skips a connection whose endpoint has no owner, so architecture-model.ts is unchanged; curate.ts calls the refused list unowned; structure.md says detaching every file leaves an empty component that keeps its id, to combine back or remove before scanning; the test suite also covers the refusal of --detach with --combine.
Re-verification: bun run check in an isolated worktree at 9b574bc5 with only TASK-421 changes (docs/component-markdown.md limited to my hunk) passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 390 bun tests pass (24 skipped), 0 fail. The scratch-repository CLI flow still detaches, rescans into its own component, and recombines.

Review-fix round (external reviews at cf8e7975): Codex and Grok reported no material finding for detach. Fixed one documentation finding (grok-all): the --detach help (src/write-commands.ts), the human overview (src/instructions.ts) and docs/product-model.md now all say that the next scan gives a detached file its own component, shared with the other files of its source unit, unless part of that unit still has an owner; test-bun/detach.test.ts already covers both outcomes, and the structure guide already said so. Skipped: repointing links on combine and move (declined by the orchestrator, recorded in TASK-426); the 'not scanned yet' explanation of a detached file belongs to TASK-413. Verification: wording only; biome clean on the changed source files, groma edit --help and groma instructions render the new text, test-bun/agent-instructions.test.ts and test-bun/detach.test.ts pass.

Simplicity round (cold junior-maintainer review): the source-unit clause of detach stays only in the structure guide's Splits section; the --detach help, the human overview and docs/product-model.md now say only that detach takes files out of a component, so the rule has one home. Verification: bun run check in an isolated worktree at 3fdd5572 with only these changes passed: biome clean apart from existing diagnostics in other files, tsc clean, 16 node and 593 bun tests pass (35 skipped), 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma edit <component> --detach <file...> takes source files out of a component: it refuses files the component does not own, a detach that would leave a flow step without its relationship, and a combine in the same edit, writing nothing in each case, and otherwise reports the changed document and affected id. Relationship rows naming a file that lost its owner stay stored and off the map, so loading and the next scan keep working; the scan then gives each detached file its own component, which combine or move places, while a partly detached scanner source unit returns to its owner. The architecture write commands moved from src/cli.ts (498 lines) into src/write-commands.ts to make room. Verified with test-bun/detach.test.ts (detach, refusals, rescan, recombination, source units, flow safety), a scratch Git repository driven through the real CLI, and bun run check in an isolated worktree (16 node and 390 bun tests pass).

Review-fix round: the --detach help, the human overview and the product model now agree with the scan: a detached file gets its own component, shared with the rest of its source unit, unless part of that unit still has an owner. Wording only; verified by rendering the help and guide and by the detach and agent-instructions tests.

Simplicity round: the detach source-unit rule now lives only in the structure guide, and the help, overview and product model say only that detach takes files out of a component; verified with bun run check in an isolated worktree.
<!-- SECTION:FINAL_SUMMARY:END -->
