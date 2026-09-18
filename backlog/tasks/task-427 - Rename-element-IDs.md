---
id: TASK-427
title: Rename element IDs
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-18 23:07'
labels: []
dependencies: []
references:
  - curate
  - src-authoring
  - src-cli
  - src-architecture-model
  - src-scanner
  - write-commands
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
  - src/architecture-model.ts
  - test-bun/scan-component-naming.test.ts
  - src/architecture-path.ts
  - src/scan-component-naming.ts
  - src/scan-reconciler.ts
  - docs/component-markdown.md
  - test-bun/system-curation.test.ts
  - src/naming.ts
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

Review-fix round (external reviews at cf8e7975):
10. Fix: a reference definition indented by up to three spaces, or with its destination on the next line, is a link the Markdown reader resolves, but the rename left it pointing at the removed document, so the rename was refused when a flow used it and otherwise wrote a world that no longer loads (reproduced). src/curate-rename.ts matches the definition syntax the reader accepts, and src/curate.ts validates the architecture the write would leave (relationships and flows) before every structural write, not only when flows exist.
11. Fix: the CLI reads the words group and relation as addresses, so an element renamed to either could not be edited again (reproduced). freeId refuses both, which covers rename and the other commands that name new records.
12. Already fixed under TASK-426 (5b5a7d1b): renaming a scanned container that owns no files is refused, because the next scan would recreate it; the human guides and the product model Identity section describe --id.
13. Tests in test-bun/rename.test.ts: an indented and a next-line definition follow a rename and the world still loads; renaming to group or relation is refused through the CLI parser.

14. The command-word refusal lives in freeId, so its test calls editArchitecture, which the CLI calls, rather than the CLI parser. A rename that would leave a link naming the old document (for example a definition inside a block quote, which the reader resolves but the rewrite does not match) is refused with nothing written.

15. One reserved-ID rule: isReservedId in src/architecture-path.ts (a reserved document name or a command word) is used by freeId and by scan ID allocation (availableId in src/scan-reconciler.ts for systems and containers, componentNames in src/scan-component-naming.ts for files), so a file group.ts or a project named Group gets a qualified ID. existingChild also looks up the qualified root-level ID availableId gives, so a project without files whose name is reserved is found again instead of created on every scan. Docs: structure.md names the command words among refused IDs; component-markdown.md names them in the allocation rule. Test in test-bun/scan-component-naming.test.ts.

16. Cold review: src/curate-rename.ts states that the rewrite covers the common link forms and that requireLoadableResult refuses a rename that leaves any other link naming a moved document; availableId and existingChild share qualifiedId; commandWords is one exported constant that isReservedId and the CLI addressing in src/write-commands.ts both use; requireUnrelated stays because its refusal names the relationship's ends, which the loadability check cannot, and a test now covers it.

Simplicity round (cold junior-maintainer review of the fix round):
17. Children are relocated in one place: curateElement calls movedDescendants with the final destination and ID for a move and a rename alike, and renamedTarget no longer returns rewrites; the rename repoints links from the complete set of moved documents.
18. isReservedId moves next to isGroupAddress in src/naming.ts and names group and relation directly; the commandWords constant is gone and the CLI addressing compares the words itself.
19. StructuralResult.replacements uses { oldId, newId }; the curateElement docstring names rename; the requireSeparateEdits comment says why each pair is separate; rename.test.ts imports node:fs/promises once.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: renamedTarget in src/curate.ts validates the new id with the existing freeId (kebab-case, free of element, flow and draft ids, not a reserved document name), writes groma.id through withGromaField (which now accepts id), moves the record to the path of the new id, and relocates its children with the relocated() helper so their parent field and paths follow; an actor is refused and --id is its own edit, separate from --parent, --combine and --detach. The same step repoints the Markdown links of relationships.md and every flow document whose href names a moved document, so concept-addressed rows and flow steps resolve to the new id without further editing; Rewrite.id is now optional, because those supporting records are not elements and stay out of affectedIds. The flow check that guards structural writes reads the rewritten flow documents, so the rename passes it while a move that would break a step is still refused. The result reports the new id, the created, changed and removed paths, and 'replaced: <old-id> -> <new-id>'.
Verification: test-bun/rename.test.ts (synthetic observations) covers a component rename that keeps Code and survives two scans with the new id, a container rename that carries its components and points them at the new parent, an authored actor row and a flow step following the rename, and refusals for a taken id, a reserved document name and a rename combined with another structural change, with nothing written. Real CLI on a scratch repository: groma edit shop-shop --id storefront printed the three created and three removed paths with 'replaced: shop-shop -> storefront', two following scans reported created 0, groma edit a --id order-entry reported 'changed: groma/relationships.md' and the actor row now links the new document, renaming a flow endpoint reported 'changed: groma/flows/order-stock.md' and groma view order-stock shows the new link, and 'depot', 'index' and a rename with --combine were refused. bun run check in an isolated worktree at 849c57d3 with only TASK-427 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 470 bun tests pass (30 skipped), 0 fail.

Cold review applied. Must-fix: link repointing now resolves each parsed link with relationshipTargetFilename and compares it with the moved paths, so a './' prefix, a link title or an angle-bracketed target are repointed too instead of leaving a stale row that refuses to load (a new test writes a './' plus titled row and fails against the old raw-text matching); groma edit <flow-id> --id now throws '--id renames systems, containers, and components' before editFlow instead of silently ignoring the option; and src/curate.ts is back to 407 lines because the rename moved into src/curate-rename.ts with the shared write shapes, context, requireElement and relocated in src/curate-rewrites.ts.
Accepted optional findings: Rewrite keeps a required id and the link writes use the new DocumentWrite shape, so affectedIds maps the element rewrites and the rename replacement comes from input.newId; the redundant flow-type filter is gone; tests cover renaming an external system into externals/<new-id>.md and refusing an actor and a flow; the structure guide states that only a rename repoints concept-addressed links, that an external renames the same way, and that the value is normalized to kebab-case with the printed id authoritative.
Re-verification: focused tests pass (6 rename, plus system-curation, detach, editing and flows). bun run check in an isolated worktree at 0b4c137e with only TASK-427 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 485 bun tests pass (32 skipped), 0 fail.

Review-fix round (external reviews at cf8e7975):
- Indented reference definitions (Codex must-fix, reproduced: after the rename the world failed to load with 'names no architecture concept'). src/curate-rename.ts rewrites the common link forms: an inline target, optionally titled, and a reference definition indented by up to three spaces with its target on the same or the next line. Other forms the reader accepts (a definition in a block quote or list item, an angle-bracketed target with spaces) are not rewritten. requireLoadableResult in src/curate.ts (formerly requireResolvableFlows) now builds the architecture the write would leave before every structural write, not only when flows exist, so such a rename is refused with nothing written (about 2 ms per write, measured by the cold review).
- Command words (Codex should-fix, reproduced: an element renamed to group could not be edited through the CLI). isReservedId in src/architecture-path.ts (a reserved document name or one of the exported commandWords that the CLI addressing reads) is the single rule behind freeId and scan ID allocation (availableId for systems and containers, componentNames for files), so a file group.ts or a project named Group gets a qualified ID. existingChild looks up the same qualifiedId as availableId, so a project without files whose name is reserved is found again instead of recreated on every scan.
- Already fixed under TASK-426 (5b5a7d1b): renaming a scanned container that owns no files is refused; the human guides and the product model Identity section describe --id.
- requireUnrelated overlaps the loadability check but stays: its refusal names the relationship's ends, while the check reports an endpoint that names no concept. test-bun/system-curation.test.ts now covers it.
- Follow-up (not fixed): existingChild also matches the qualified root-level ID, so a new project named X can match a system created earlier from a project named 'Source X' (id source-x).
Verification: test-bun/rename.test.ts (indented and next-line definitions follow two renames and the world loads; a block-quote definition refuses the rename with nothing written; group and Relation refused), test-bun/scan-component-naming.test.ts (group.ts and relation.ts get qualified IDs; a project named Group without files is not recreated by a second scan), test-bun/system-curation.test.ts (the authored-row refusal names its ends); each fails with its fix reverted. bun run check in an isolated worktree at 7fdc0446 with only these changes passed: biome clean apart from existing diagnostics in other files, tsc clean, 16 node and 524 bun tests pass (35 skipped), 0 fail.

Simplicity round (cold junior-maintainer review): curateElement relocates the children of a moved or renamed record in one movedDescendants call with the final destination and ID, and renamedTarget returns only the record's new id, source and path; a rename repoints links through linkWrites from all element rewrites whose path changed. isReservedId sits next to isGroupAddress in src/naming.ts and names group and relation directly; the commandWords constant is gone and the CLI addressing compares the words itself. StructuralResult.replacements now carries { oldId, newId }; the printed 'replaced:' line is unchanged. The curateElement docstring names rename, the requireSeparateEdits comment gives the reasons, and rename.test.ts imports node:fs/promises once. Verification: in an isolated worktree at fe407bc9 with only these changes, biome, tsc and the 16 node tests passed; the first bun run timed out three test-bun/large-world.test.ts tests at a load average near 130 from concurrent lanes, that file then passed alone (4 pass) and a second full bun run passed (590 pass, 35 skipped, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma edit <id> --id <new-id> renames a system, container or component: its document and the documents stored under it move to the paths of the new id, children name the new parent, and the links of relationship rows and flow steps that name those documents are repointed by resolved target, so concept-addressed rows and flows keep resolving. The value is normalized to kebab-case, and a taken id, a reserved document name, an actor, a flow and a rename combined with another structural change are refused without writing. The result reports the new id, the created, changed and removed paths and replaced: <old-id> -> <new-id>, which the Backlog guide now tells agents to follow when updating references. Scans match elements through owned files, so two scans after a rename keep the new id and create nothing. Verified with test-bun/rename.test.ts (component and container renames, two following scans, concept row and flow step following, link spellings with './' and a title, an external rename, and every refusal), the real CLI on a scratch repository, and bun run check in an isolated worktree (16 node and 485 bun tests pass).

Review-fix round: renames now rewrite indented and next-line reference definitions, and every structural write checks that the architecture it leaves still loads and its flows resolve, so a link the rewrite cannot repoint refuses the rename instead of breaking the world. The words group and relation, which the CLI reads as addresses, are reserved through one rule shared by renames, new records and scan ID allocation, and scans find a project with a reserved name again by its qualified ID. Verified with new rename, scan-naming and system-curation tests and bun run check in an isolated worktree.

Simplicity round: children of a moved or renamed record are relocated in one place, the reserved-ID rule is one function beside the group-address check, and replacements read { oldId, newId }; verified with an isolated worktree check.
<!-- SECTION:FINAL_SUMMARY:END -->
