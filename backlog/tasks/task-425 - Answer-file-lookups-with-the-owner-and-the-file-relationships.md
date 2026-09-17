---
id: TASK-425
title: Answer file lookups with the owner and the file relationships
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-17 06:47'
labels: []
dependencies: []
references:
  - src-core
  - src-cli
  - instructions
modified_files:
  - src/plain-world.ts
  - src/cli.ts
  - docs/agent-instructions/inspect.md
  - docs/agent-instructions/backlog.md
  - docs/product-model.md
  - test-bun/plain-view.test.ts
  - src/core.ts
  - src/instructions.ts
  - README.md
type: enhancement
ordinal: 498000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`groma view <source-file>` prints the complete Markdown record of the owning element. For a large component that is hundreds of lines of Code references (582 for one callforpapers component) without any pointer to the requested file. Agents usually look up a file they just changed to find the element ID for Backlog references and to see what that file talks to.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma view <source-file>` prints the owning element's ID, kind, title and parent, followed by the relationships whose source or target is that file, split into incoming and outgoing.
- [x] #2 The output ends with the command that prints the owner's complete record.
- [x] #3 Command help and agent instructions describe the file answer; focused tests cover files with and without relationships.
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
1. src/plain-world.ts: renderPlainRecord ends with fileAnswer(world, file), the one function that receives every target no earlier branch resolved (TASK-413 can extend it for unowned files). It finds the owning component and prints an Owner section (id, kind, title, parent line), Incoming relationships and Outgoing relationships built with plainRelationshipSection, and a last line naming `groma view <owner-id>` for the complete record. The answer is the same with or without --plain.
2. fileConnections(world, file) selects the file connections of the model's relationships whose source or target is exactly that file; rows addressed to the owning element and rows between files of one component are not listed. Each connection keeps its own draft status through the shared originOf from src/core.ts.
3. Drop the unreachable 'several elements share' branch: building the model already rejects a file with two owners.
4. src/cli.ts: the view target help names the file answer, without adding lines. src/instructions.ts: the human workflow says a path prints its owner and relationships.
5. Docs: docs/agent-instructions/inspect.md and backlog.md source-file rows, docs/product-model.md, and the README file-lookup comment (only that hunk).
6. Tests in test-bun/plain-view.test.ts: a file with incoming and outgoing file connections (test/fixtures/flows, whose rows to the owner element stay out) and a file without relationships that answers with its owner record command (test/fixtures/plain-view src/routes/orders.ts).
7. Verify with bun run check in an isolated worktree and CLI runs on fixture copies.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approach: renderPlainRecord ends with fileAnswer(world, file) in src/plain-world.ts, the one place for source-file lookups. It finds the owning component, prints an Owner section (id, kind, title, then parent), Incoming relationships and Outgoing relationships through plainRelationshipSection, and a last line `Complete owner record: groma view <owner-id>`. The answer is the same with or without --plain; an unowned path still answers `unknown target`. fileRelationships(world, file) reads the connections the model keeps on each relationship and keeps those whose source or target is exactly that file, so rows addressed to the owning concept (for example an actor row to the component) are not listed; each row keeps its own draft marker. The old 'several elements share' branch was removed because building the model already fails with 'source file ... has more than one owner' (reproduced on a scratch copy of test/fixtures/plain-view). src/cli.ts only changes the view target help (still 498 lines). Docs: inspect.md and backlog.md source-file rows, and docs/product-model.md (file answer; the complete-Markdown target list is now element and flow IDs).
Non-blocking observation: the model drops relationship rows whose two files share one owner, so the file answer does not list such rows either.
Verification: test-bun/plain-view.test.ts covers a file with incoming and outgoing file rows while the concept rows to its owner stay out (test/fixtures/flows src/entry.ts) and a file without relationships that still answers with its owner command (test/fixtures/plain-view src/routes/orders.ts). CLI on fixture copies: src/entry.ts, src/stock.ts, src/routes/orders.ts (with --plain) and an unknown path (exit 1). This repository: groma view src/cli.ts prints 21 lines with three incoming and six outgoing file rows instead of the full record. bun run check in an isolated worktree at 71061d17 with only TASK-425 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 375 bun tests pass (17 skipped), 0 fail. Correction: a first attempt built an empty patch (zsh does not split an unquoted path variable), so that run executed the read-only check in the shared tree instead; it was discarded and rerun in the isolated worktree.

Cold review applied without new behavior: src/instructions.ts and the README file-lookup comment describe the file answer; the fileConnections comment, inspect.md row and product model say the answer lists file connections of map relationships and not rows between files of one component, and the inspect row points to groma view <owner-id> --plain for relationships naming the owner element; fileAnswer documents that it receives every unresolved target, including mistyped ids; originOf is exported from src/core.ts and reused; fileRelationships was renamed fileConnections; the trailing newline is added where the answer text is built; the product model says loading fails when several elements share a file; tests were renamed (plainViewFixture, rows), assert ok and the text separately, and no longer restate the fixture's empty rows.
Re-verification: focused tests pass; CLI on the flows fixture copy ends the file answer with one newline and a mistyped id still answers unknown target (exit 1). bun run check in an isolated worktree at 9d565d6a with only TASK-425 changes (README limited to its own hunk) passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 377 bun tests pass (20 skipped), 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view <source-file> now answers with the owning component's ID, kind, title and parent, the file's incoming and outgoing connections from map relationships, and the command that prints the owner's complete record, instead of the full owner record (21 lines for src/cli.ts in this repository). The lookup lives in fileAnswer in src/plain-world.ts, which receives every unresolved target; the unreachable shared-owner branch was removed because loading already rejects it. Command help, the human workflow, the inspect and backlog agent guides, the product model and the README describe the answer. Verified with focused tests on test/fixtures/flows and test/fixtures/plain-view, CLI runs on fixture copies, and bun run check in an isolated worktree (16 node and 377 bun tests pass).
<!-- SECTION:FINAL_SUMMARY:END -->
