---
id: TASK-412
title: Page groma view --plain by C4 level
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-17 06:34'
labels: []
dependencies: []
references:
  - src-core
  - src-cli
modified_files:
  - src/plain-world.ts
  - src/cli.ts
  - docs/agent-instructions/inspect.md
  - docs/product-model.md
  - test-bun/plain-view.test.ts
type: enhancement
ordinal: 467000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`groma view --plain` prints every system, container, component and relationship at once without section titles (227 lines for the 98 components of callforpapers). `--plain` is ignored when a target is given, and `groma view <id>` prints Markdown without any relationships, so an agent cannot read one element with its children or find what calls it. Drilling down through C4 levels replaces pagination without adding a command.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma view --plain` prints only people, systems and external systems, the relationships between them and the flow index, each under a clear section title and separator.
- [x] #2 `groma view <id> --plain` prints the element, its direct children, its incoming relationships and its outgoing relationships, each under its own section title and separator.
- [x] #3 Relationship lines name both endpoints, the description and the technology.
- [x] #4 `groma view <id>` without `--plain` still prints the complete Markdown record; command help and agent instructions describe the drill-down.
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
1. src/plain-world.ts: replace the full tree dump with C4-level sections. A section is a title line, a dash separator of the same length, and its lines (`none` when empty); sections are separated by one blank line. Exported helpers for later file answers and paging: plainSection and plainRelationshipSection (deduplicated, text-sorted lines reading `source -> target | description | technology`, `| draft` on a draft row).
2. groma view --plain: Actors, Systems, External systems (root elements with their overview), Relationships (every relationship with both ends lifted to their root elements, dropping those inside one root), Flows (id and title), and a Drafts index (id and outcome) only when drafts exist, so draft ids stay discoverable. The element count line and the nested tree go away.
3. groma view <element-id> --plain: Element (header tokens, parent, technology, description, overview), Children (direct children with their overview), Incoming relationships and Outgoing relationships. The boundary rule is the shared showsRelationshipText from src/viewers/relationship-text.ts; direction comes from whether the source lies inside the element; lines name the stored endpoints. Flow ids, draft ids and source files keep their current answer; without --plain an element id still prints the complete Markdown record.
4. src/cli.ts: pass --plain to renderPlainRecord and describe the drill-down in the --plain option help without growing the file past 500 lines.
5. Docs: docs/agent-instructions/inspect.md Commands table (overview row, drill-down row, relationship line format) and docs/product-model.md.
6. Test: test-bun/plain-view.test.ts on test/fixtures/flows covers root lifting (internal relationships dropped) and boundary selection for a container and a component.
7. Verify with bun run check in an isolated worktree and the real CLI on a temporary copy of a fixture.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approach: src/plain-world.ts prints titled sections (title line, dash separator of the same length, `none` when empty, one blank line between sections). The overview (formatPlainWorld) lists root actors, internal systems and external systems with their overview, rootRelationships (each relationship with both ends lifted to their root element, relationships inside one root dropped, identical lines deduplicated), the flow index and, only when drafts exist, a draft index (id and outcome) so draft ids stay discoverable without listing their component items. The nested tree and the element count line were removed. The drill-down (formatPlainElement) prints Element (header tokens, parent, technology, description, overview), Children, and boundaryRelationships split into incoming and outgoing, named by the elements at their ends. Both reuse ancestorIds and parentOfElements from src/viewers/relationship-text.ts, which are unchanged by TASK-419's uncommitted edit. Relationship lines read `source -> target | description | technology` with a trailing `| draft` on a draft row. plainSection and relationshipSection are exported for the file answer (TASK-425) and paging (TASK-420). renderPlainRecord takes the plain flag; flow ids, draft ids and source files keep their existing answers. src/cli.ts only passes the flag and describes the drill-down in the --plain help, so it stays at 498 lines and no view module split was needed. Section title uses Groma's Actors vocabulary for the AC's people.
Docs: docs/agent-instructions/inspect.md (overview row, drill-down row, relationship line format) and docs/product-model.md (plain overview and drill-down; dropped the stale claim that the complete record includes relationships, and the sentence that --plain prints one element per ID).
Verification: test-bun/plain-view.test.ts on test/fixtures/flows covers root lifting and boundary selection for a container and a component. CLI on scratch copies of test/fixtures/flows and test/fixtures/plain-view: view --plain printed Actors, Systems, External systems, Relationships (requester -> service, service -> journal; entry<->worker dropped), Flows, and Drafts only on plain-view; view api --plain listed entry and worker, incoming requester -> entry, outgoing entry -> journal; view entry --plain listed both directions with worker; groma --plain view api used the global flag; view api without --plain printed the complete Markdown record; flow id and file targets unchanged; unknown id exits 1 with unknown target. This repository: view --plain went from 277 to 48 lines. bun run check in an isolated HEAD worktree with only TASK-412 changes: biome, scrollbar lint and tsc clean (the only complexity warning is the existing test-bun/iso-map.test.ts one), 16 node tests and 366 bun tests pass (17 skipped), 0 fail.

Cold review (no blocking findings) applied without new behavior: boundaryRelationships now filters with the shared showsRelationshipText and splits on whether the source lies inside the element; plainElement was inlined into renderPlainRecord, which documents its routing order; relationshipSection was renamed plainRelationshipSection (markdown-emitter.ts has an unrelated private function of that name); the ordering comment explains why sorting the printed text orders by source and target; formatPlainWorld and formatPlainElement are private and the unused drafts default is gone; a comment explains why an empty Drafts section is omitted while Flows prints none; inspect.md says draft relationship, marks the complete-record row as without --plain, and says a drill-down names stored endpoints that can sit below the listed children. The Drafts section and the Actors title were accepted by the coordinator.
Re-verification: focused tests and CLI runs on the fixture copies unchanged; bun run check in an isolated worktree at f20e9bf9 with only TASK-412 changes passed (biome and tsc clean apart from existing warnings in other files, 16 node tests and 373 bun tests pass, 17 skipped, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view --plain now prints the C4 context level under titled sections (Actors, Systems, External systems, Relationships lifted to root elements, Flows, and a Drafts index when drafts exist) instead of the full tree: this repository's output fell from 277 to 48 lines. groma view <element-id> --plain drills one level down with Element, Children, Incoming relationships and Outgoing relationships sections; relationships crossing the element boundary use the rule shared with the web and terminal panes. Relationship lines read source -> target | description | technology. Without --plain, targets keep their complete Markdown answers. Command help, the inspect agent guide and the product model describe the drill-down. Verified with test-bun/plain-view.test.ts (root lifting and boundary selection on test/fixtures/flows), CLI runs on copies of the flows and plain-view fixtures, and bun run check in an isolated worktree (16 node and 373 bun tests pass).
<!-- SECTION:FINAL_SUMMARY:END -->
