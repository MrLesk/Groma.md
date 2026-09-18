---
id: TASK-427
title: Rename element IDs
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-18 14:54'
labels: []
dependencies: []
references:
  - curate
  - src-authoring
  - src-cli
modified_files:
  - src/markdown-emitter.ts
  - src/curate.ts
  - src/edit.ts
  - src/write-commands.ts
  - test-bun/rename.test.ts
  - docs/agent-instructions/structure.md
  - docs/agent-instructions/backlog.md
  - docs/product-model.md
  - src/curate-rewrites.ts
  - src/curate-rename.ts
type: feature
ordinal: 500000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scanned element IDs come from file and project names and survive curation, so a component that now means "Development and test support" can keep the ID `playwright-config`. Agents address elements by ID, so misleading IDs cause wrong lookups and Backlog references. Scans find existing elements through the files they own (`src/scan-reconciler.ts`), not through their IDs, so a renamed ID can persist.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma edit <id> --id <new-id>` renames a system, container or component and moves its document and its children's documents to the matching paths.
- [x] #2 Children, flows and concept-addressed relationship rows refer to the new ID after the rename, and conflicting or invalid IDs are refused without writing.
- [x] #3 The command reports `replaced: <old-id> -> <new-id>` with the changed paths, and agent instructions tell agents to update Backlog references from it.
- [x] #4 Two scans after a rename keep the new ID and create no element; focused tests cover this.
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
1. src/markdown-emitter.ts: withGromaField also writes the id field.
2. src/curate.ts: CurateInput gains newId. --id must be a separate edit from --parent, --combine and --detach. renamedTarget validates the new id with the existing freeId (kebab-case, not taken by an element, flow or draft, not a reserved document name), writes groma.id, moves the target document to the path of the new id, and relocates its children with the relocated() helper so their parent field and paths follow. An actor is refused.
3. Links: the same rename computes the moved documents and repoints the Markdown links of relationships.md and every flow document at their new paths, so concept-addressed rows and flow steps resolve to the new id. The flow check that guards structural writes now reads the rewritten flow documents.
4. Rewrite.id becomes optional, because a repointed relationships or flow record is not an element; affectedIds skips it. The result reports id, the changed paths and replaced: <old-id> -> <new-id>.
5. src/write-commands.ts: groma edit --id <new-id>.
6. Docs: docs/agent-instructions/structure.md (command row and a rename section), docs/agent-instructions/backlog.md (a replacement can also be a rename: remove the old reference, add the new one), and docs/product-model.md.
7. Tests in test-bun/rename.test.ts with synthetic scanner observations: renaming a component moves its document and keeps its Code and owner, two following scans keep the new id and create no element; renaming a container moves its components and their parent field; an authored concept row and a flow step follow the rename; a taken or reserved id is refused without writing.
8. Verify with bun run check in an isolated worktree and the CLI on a scratch repository.

9. Split the rename out of src/curate.ts, which passed the 500-line limit: src/curate-rewrites.ts holds the document write shapes, the curation context, requireElement and relocated, and src/curate-rename.ts holds the rename and its link repointing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: renamedTarget in src/curate.ts validates the new id with the existing freeId (kebab-case, free of element, flow and draft ids, not a reserved document name), writes groma.id through withGromaField (which now accepts id), moves the record to the path of the new id, and relocates its children with the relocated() helper so their parent field and paths follow; an actor is refused and --id is its own edit, separate from --parent, --combine and --detach. The same step repoints the Markdown links of relationships.md and every flow document whose href names a moved document, so concept-addressed rows and flow steps resolve to the new id without further editing; Rewrite.id is now optional, because those supporting records are not elements and stay out of affectedIds. The flow check that guards structural writes reads the rewritten flow documents, so the rename passes it while a move that would break a step is still refused. The result reports the new id, the created, changed and removed paths, and 'replaced: <old-id> -> <new-id>'.
Verification: test-bun/rename.test.ts (synthetic observations) covers a component rename that keeps Code and survives two scans with the new id, a container rename that carries its components and points them at the new parent, an authored actor row and a flow step following the rename, and refusals for a taken id, a reserved document name and a rename combined with another structural change, with nothing written. Real CLI on a scratch repository: groma edit shop-shop --id storefront printed the three created and three removed paths with 'replaced: shop-shop -> storefront', two following scans reported created 0, groma edit a --id order-entry reported 'changed: groma/relationships.md' and the actor row now links the new document, renaming a flow endpoint reported 'changed: groma/flows/order-stock.md' and groma view order-stock shows the new link, and 'depot', 'index' and a rename with --combine were refused. bun run check in an isolated worktree at 849c57d3 with only TASK-427 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 470 bun tests pass (30 skipped), 0 fail.

Cold review applied. Must-fix: link repointing now resolves each parsed link with relationshipTargetFilename and compares it with the moved paths, so a './' prefix, a link title or an angle-bracketed target are repointed too instead of leaving a stale row that refuses to load (a new test writes a './' plus titled row and fails against the old raw-text matching); groma edit <flow-id> --id now throws '--id renames systems, containers, and components' before editFlow instead of silently ignoring the option; and src/curate.ts is back to 407 lines because the rename moved into src/curate-rename.ts with the shared write shapes, context, requireElement and relocated in src/curate-rewrites.ts.
Accepted optional findings: Rewrite keeps a required id and the link writes use the new DocumentWrite shape, so affectedIds maps the element rewrites and the rename replacement comes from input.newId; the redundant flow-type filter is gone; tests cover renaming an external system into externals/<new-id>.md and refusing an actor and a flow; the structure guide states that only a rename repoints concept-addressed links, that an external renames the same way, and that the value is normalized to kebab-case with the printed id authoritative.
Re-verification: focused tests pass (6 rename, plus system-curation, detach, editing and flows). bun run check in an isolated worktree at 0b4c137e with only TASK-427 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 485 bun tests pass (32 skipped), 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma edit <id> --id <new-id> renames a system, container or component: its document and the documents stored under it move to the paths of the new id, children name the new parent, and the links of relationship rows and flow steps that name those documents are repointed by resolved target, so concept-addressed rows and flows keep resolving. The value is normalized to kebab-case, and a taken id, a reserved document name, an actor, a flow and a rename combined with another structural change are refused without writing. The result reports the new id, the created, changed and removed paths and replaced: <old-id> -> <new-id>, which the Backlog guide now tells agents to follow when updating references. Scans match elements through owned files, so two scans after a rename keep the new id and create nothing. Verified with test-bun/rename.test.ts (component and container renames, two following scans, concept row and flow step following, link spellings with './' and a title, an external rename, and every refusal), the real CLI on a scratch repository, and bun run check in an isolated worktree (16 node and 485 bun tests pass).
<!-- SECTION:FINAL_SUMMARY:END -->
