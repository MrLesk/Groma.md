---
id: TASK-426
title: Combine systems and move containers between systems
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-18 14:31'
labels: []
dependencies: []
references:
  - curate
  - src-cli
  - src-core
modified_files:
  - src/curate.ts
  - src/core.ts
  - src/move.ts
  - src/write-commands.ts
  - test-bun/system-curation.test.ts
  - docs/agent-instructions/structure.md
  - docs/product-model.md
type: feature
ordinal: 499000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scans create one system for each scanner observation, so a repository with several languages can start with several systems. Curation cannot change that: `--combine` accepts only components and containers, and `--parent` moves only components. Separate systems are acceptable when they make the map clearer, but curators need to merge them or regroup containers when they describe one product.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma edit <system> --combine <system...>` moves the absorbed systems' containers into the surviving system and removes the absorbed records, under the same authored-metadata rules as other combines.
- [x] #2 `groma edit <container> --parent <system>` moves a container with its children to another system under the same rules as component moves.
- [x] #3 Both operations report created, changed and removed paths and replacements like the existing structural commands, and two following scans create no element.
- [x] #4 Agent instructions describe both operations; focused tests cover them.
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
1. src/move.ts: split the shared restructuring rules (empty body, no authored concept relationship) into structuralBlocker; moveBlocker keeps naming components so the web Parent field stays component-only.
2. src/curate.ts: --combine accepts a system target and moves the absorbed systems' containers, and --parent accepts a container target with a system parent. One relocated() helper rewrites a moved element's document and every document stored beneath it, so a container carries its components to the new system path. requireUnrelated now covers the whole relocated subtree, because an authored concept row names a moved element by id, and a container or system cannot move into or combine with an external system, which would write an invalid tree.
3. Flows: the flow check added for detach now runs for every structural write, against the documents as the rewrites and removals would leave them, so a combine or move that would leave a flow step unresolvable is refused before anything is written.
4. src/write-commands.ts: the --combine and --parent help names systems and containers.
5. Docs: docs/agent-instructions/structure.md (command rows and a short section on merging systems and regrouping containers) and docs/product-model.md.
6. Tests in test-bun/system-curation.test.ts with synthetic scanner observations for two projects: a system combine moves both containers and their components under the survivor, removes the absorbed record, reports created, changed, removed and replacements, and two following scans create no element; a container move to another system carries its components; a flow naming a moved element refuses the write.
7. Verify with bun run check in an isolated worktree and the CLI on a scratch repository with two scanned systems.

8. Collapse the shared rules: curate calls requiresEmptyMeaning and requireUnrelated directly, the web move eligibility becomes isMovable in src/core.ts, and src/move.ts is deleted.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: requireCombinableSources accepts a system target (an actor is the only kind that cannot combine) and refuses mixing an external with an internal system; the absorbed systems' containers, like an absorbed container's components, move to the survivor through one relocated() helper that rewrites a document under its new parent path together with every document stored beneath it, so a container carries its components. movedTarget accepts a container target with a system parent (movedInto maps component to container and container to system), refuses an external system as a destination, and applies structuralBlocker, the shared empty-body and authored-concept-relationship rules split out of moveBlocker in src/move.ts; moveBlocker keeps naming components only, so the web details pane still offers Parent for components. requireUnrelated now covers the whole relocated subtree, because an authored concept row names a moved element by id and its path would change. The flow check added for detach now runs for every structural write against the documents as the rewrites and removals would leave them, so a combine or move that would leave a flow step unresolvable is refused before anything is written.
Verification: test-bun/system-curation.test.ts (synthetic observations for two projects) covers the system combine (replacements, created, changed and removed paths, containers under the survivor, unchanged file ownership, two following scans creating nothing and leaving the elements identical), the container move with its components and the emptied system staying, and the refusal of a move that would break a flow step, with nothing written. Real CLI on a scratch repository with two scanned projects: groma edit shop --combine depot printed the created container and component paths, the changed system record, three removed paths and 'replaced: depot -> shop', and two following scans reported created 0; groma edit shop-shop --parent depot moved the container with both components; groma remove on the emptied system still points at combine, and combining it away leaves one system. bun run check in an isolated worktree at fdaf2570 with only TASK-426 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 460 bun tests pass (30 skipped), 0 fail.

Cold review applied (no must-fix findings). structuralBlocker is gone: movedTarget calls requiresEmptyMeaning and requireUnrelated, which the combine path already uses, and the web move eligibility is now isMovable in src/core.ts, so src/move.ts was deleted. The parent kind comes from the exported expectedParentKinds instead of a second table, the moved-child relocation moved out of the loop header into movedDescendants, and the wrong-parent message now reads 'has kind <kind>' instead of 'is a actor'. The structure guide states both scopes (empty body on a replaced record and the children a combine absorbs directly; no concept-addressed relationship anywhere under a moved or absorbed record), and the product-model sentence was trimmed and rewrapped. Tests gained a second scan with an element comparison after the container move and a case covering the three new refusals (external destination, external with internal combine, container into a container).
Re-verification: focused tests pass (4 system-curation, detach, editing, and the node core tests). bun run check in an isolated worktree at 21e9e02c with only TASK-426 changes, including the deletion of src/move.ts, passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 464 bun tests pass (30 skipped), 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma edit <system> --combine <system...> now moves the absorbed systems' containers, with their components, under the surviving system and removes the absorbed records, and groma edit <container> --parent <system> moves a container with everything stored under it to another system. Both report created, changed and removed paths with the replacements, keep every file's owner, and leave two following scans creating no element. One relocated() helper carries a moved document's subtree, the shared rules (empty body, no authored concept relationship under the moved record) come from the existing combine checks, an external system is refused as a destination or combine partner, and the flow check now guards every structural write. Verified with test-bun/system-curation.test.ts on synthetic two-project observations (combine, container move, refusals, and two scans after each operation), the real CLI on a scratch repository with two scanned projects, and bun run check in an isolated worktree (16 node and 464 bun tests pass).
<!-- SECTION:FINAL_SUMMARY:END -->
