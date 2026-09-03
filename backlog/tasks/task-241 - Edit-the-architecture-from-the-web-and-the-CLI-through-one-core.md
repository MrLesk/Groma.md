---
id: TASK-241
title: Edit the architecture from the web and the CLI through one core
status: Done
assignee:
  - '@codex'
created_date: '2026-09-02 21:15'
updated_date: '2026-09-03 20:52'
labels:
  - cli
  - web
  - core
dependencies: []
references:
  - 'https://claude.ai/code/artifact/902f8d7d-7267-49cd-b8cd-771e23b93d2b'
  - authoring
  - commands
  - render
  - web-server
  - writes
  - web-viewer-authoring
  - web-viewer-details
  - editable
  - observed-curation
  - architecture-model
modified_files:
  - src/authoring.ts
  - src/cli.ts
  - src/viewers/web/data.ts
  - src/viewers/web/server.ts
  - src/viewers/web/organisms/writes.ts
  - src/viewers/web/authoring.ts
  - src/viewers/web/render.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/organisms/editable.ts
  - test-bun/inspect-details.test.ts
  - test-bun/web-authoring.test.ts
  - test-bun/authoring-boundary.test.ts
  - docs/viewers/web/index.md
  - src/move.ts
  - src/curate.ts
  - src/types.ts
  - src/core.ts
  - test/core.test.ts
priority: high
type: feature
ordinal: 274000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma becomes editable without breaking the rule that every operation lives in core once and reaches the CLI and the web with the same meaning. The storage model changes first: one tree under groma/ with four folders (actors, externals, systems, drafts), OKF status draft or stable in every file, a draft tag instead of a second document, one file per id that never moves. Then five verbs, add, draft, edit, remove and accept, replace create and relate (12 commands become 13), and the web details pane offers, on the selected thing, exactly the verbs the CLI allows on it. The scanner alone creates stable systems, containers and components; people add actors, externals, drafts, relations and groups and describe anything. Design authority with the intent map, rules and build order: the referenced page. Subtasks are the slices in the order they must land; the storage slice waits for TASK-238.1 to be committed, by agreement with the terminal facelift work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every editing operation exists once in core and is reachable from the CLI and the web with the same input and the same success or refusal sentence
- [x] #2 No command or web control hand-creates a stable system, container or component; they come only from a scan or an accepted draft
- [x] #3 The CLI has 13 top-level commands: init, web, export, view, scan, scanner, instructions, agent-instructions, add, draft, edit, remove, accept
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
1. Route accept through the shared authoring facade with one AcceptInput and the same refusal text for CLI and web, preserving the CLI scan retry. 2. Add the approved live-only Accept and Parent controls to the existing web details-write domain. 3. Centralize move eligibility in one pure core moveBlocker that reads the complete Markdown body; use it in curation and project its result to the web model. 4. Add focused core-boundary, move-eligibility, and web authoring tests; update the web viewer contract and verify the rendered flows in Chromium. 5. Run focused checks and bun run check, then the required reviews and finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All six slices are Done and pushed (29ef574, 5027a96, 3b2ddd0, 82fdb72, 77f7bad, 0392daa; the TUI facelift commits sit between them). AC2 holds: nothing hand-creates stable software; groma add refuses system, container and component with the sentence naming groma draft. AC3 holds: the CLI lists 13 top-level commands after relate left. AC1 holds for add, draft, edit, remove and their things (actor, external, draft, relation, group, title, description, overview, technology, draft tag, combine) through the writes table in src/authoring.ts, which the CLI and the web server both use, with the core sentence surfacing in the pane or dialog; groma accept and groma edit <id> --parent (move) have no web control, so the owner decides whether AC1 covers them or they stay CLI-only before closing this task. Twenty-three review findings were recorded on the subtasks as owner decisions rather than built.

Closed the remaining AC1 gap from the approved editor reference: accept now enters core through writes.accept for both CLI and POST /accept, and the live details pane shows Accept for a scan-matched ghost plus Parent for an empty unrelated component. Parent posts the existing edit input; core remains the final refusal authority. Verification: focused Node core/CLI suite 19/19, focused Bun web/details/boundary suite 14/14, full bun run check 106 Node + 269 Bun with only 13 pre-existing complexity warnings, CLI --help lists exactly 13 commands, and a real headless Chromium run selected the controls, changed matched draft to observed, moved api to web, updated hierarchy/map, and reported no browser errors. The Browser bridge itself reported a client/server version mismatch, so the skill-approved Playwright fallback was used. Cold simplicity and implementer specification/quality reviews found no material issue.

Applied the approved complexity correction: src/move.ts now owns the exact component, relationship and complete-Markdown-body move blocker; core annotation projects movable and curation enforces the same function, while the details pane only consumes the core decision. Added a regression for a section-only body. Focused checks pass (7 Node, 14 Bun); full bun run check passes 107 Node + 269 Bun with the same 13 pre-existing warnings. Chromium confirmed Parent still moves an empty component, is absent for the section-only component, Accept still changes draft to observed, and no browser errors occurred. The original full-context reviewer performed a targeted re-review and confirmed the finding is fully resolved with no unnecessary complexity or related regression.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the shared authoring architecture: CLI and web route add, draft, edit, remove and accept through one core facade with matching inputs and refusal text. Added live Accept and Parent controls, and centralized move eligibility over the complete Markdown body so the UI cannot promise a core-refused move. Verified with 107 Node tests, 269 Bun tests, exact 13-command CLI help, and real Chromium interaction for accept, move, and the section-only refusal state.
<!-- SECTION:FINAL_SUMMARY:END -->
