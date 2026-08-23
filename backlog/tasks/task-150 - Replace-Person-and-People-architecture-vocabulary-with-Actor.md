---
id: TASK-150
title: Replace Person and People architecture vocabulary with Actor
status: Done
assignee:
  - '@codex'
created_date: '2026-08-23 17:11'
updated_date: '2026-08-23 17:56'
labels: []
dependencies: []
references:
  - architecture-model
  - create
  - scan-reconciler
  - plain-world
  - instructions
  - semantic-view
  - world-layout
  - sheet
  - action-path
  - navigation
  - projection-camera
  - projection
  - screen
  - page
  - render
  - iso-map
  - iso-projection
  - typescript-files
modified_files:
  - scripts/validate-architecture.ts
  - src/architecture-model.ts
  - src/cli.ts
  - src/create.ts
  - src/element-order.ts
  - src/instructions.ts
  - src/plain-world.ts
  - src/scan-reconciler.ts
  - src/semantic-view.ts
  - src/sheet/forces.ts
  - src/sheet/measure.ts
  - src/sheet/place.ts
  - src/sheet/rank.ts
  - src/sheet/scene.ts
  - src/sheet/types.ts
  - src/types.ts
  - src/viewers/action-path.ts
  - src/viewers/tui/atoms/border.ts
  - src/viewers/tui/atoms/kind.ts
  - src/viewers/tui/atoms/theme.ts
  - src/viewers/tui/molecules/card.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/organisms/hierarchy.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/projection-camera.ts
  - src/viewers/tui/projection-display.ts
  - src/viewers/tui/projection.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/web/iso/paint-buildings.ts
  - src/viewers/web/iso/paint-ground.ts
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/style.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/organisms/flows.ts
  - src/viewers/web/page.ts
  - src/viewers/web/render.ts
  - src/viewers/web/url.ts
  - src/world-layout.ts
  - test-bun/action-path.test.ts
  - test-bun/chrome.test.ts
  - test-bun/helpers.ts
  - test-bun/inspect-details.test.ts
  - test-bun/iso-map.test.ts
  - test-bun/navigation.test.ts
  - test-bun/projection-routes.test.ts
  - test-bun/projection.test.ts
  - test-bun/semantic-view.test.ts
  - test-bun/sheet-grow.test.ts
  - test-bun/sheet-route.test.ts
  - test-bun/sheet-scene.test.ts
  - test-bun/web-url.test.ts
  - test/architecture-model-errors.test.ts
  - test/architecture-model.test.ts
  - test/architecture-reader.test.ts
  - test/create.test.ts
  - test/fixtures/openclaw-view/groma/observed/README.md
  - test/fixtures/openclaw-view/groma/observed/people/operator.md
  - test/fixtures/openclaw-view/groma/observed/systems/openclaw/system.md
  - test/fixtures/plain-view/groma/observed/people/buyer.md
  - test/fixtures/validate/groma/observed/README.md
  - test/fixtures/validate/groma/observed/people/buyer.md
  - test/fixtures/viewer-view/groma/observed/people/shop-architect.md
  - test/fixtures/viewer-view/groma/observed/people/shop-operator.md
  - test/plain-world.test.ts
  - test/validate-architecture.test.ts
  - test/world-layout.test.ts
  - test/fixtures/openclaw-view/groma/observed/actors/operator.md
  - test/fixtures/plain-view/groma/observed/actors/buyer.md
  - test/fixtures/validate/groma/observed/actors/buyer.md
  - test/fixtures/viewer-view/groma/observed/actors/shop-architect.md
  - test/fixtures/viewer-view/groma/observed/actors/shop-operator.md
  - groma/observed/people/human-architect.md
  - groma/observed/people/coding-agent.md
  - groma/observed/actors/human-architect.md
  - groma/observed/actors/coding-agent.md
  - groma/observed/README.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - docs/product-model.md
  - README.md
  - docs/viewers/web/index.md
  - docs/viewers/index.md
  - docs/viewers/tui/index.md
  - groma/README.md
  - groma/plans/mvp/README.md
  - groma/observed/systems/groma/containers/cli/components/instructions.md
  - groma/observed/systems/groma/containers/core/components/sheet.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/action-path.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/tree.md
  - groma/observed/systems/groma/containers/web-viewer/container.md
  - src/typescript-files.ts
  - test/typescript-scanner.test.ts
type: enhancement
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma currently calls architecture initiators person in the C4 model and People on the web sheet, even though the same domain includes humans and coding agents. Replace that architecture-domain vocabulary directly with actor everywhere it is current product behavior. This is an experimental prototype replacement: keep no person compatibility, legacy path, URL alias, or migration behavior. Ordinary prose about actual humans and historical Backlog records are not part of the rename.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Architecture documents, validation, creation, scanning, plain output, and public contracts use the actor kind and actors directory; person is no longer a supported architecture kind
- [x] #2 Both viewers use Actor vocabulary for kinds, commands, selection context, and the Actors island, including actor URL parameters and actor-oriented internal names
- [x] #3 Current Groma architecture, fixtures, tests, and product documentation use Actor consistently wherever they describe the architecture domain, while ordinary human prose and historical Backlog records remain intact
- [x] #4 Focused and full project checks pass with no retained person or people architecture-domain behavior
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
1. Replace the canonical architecture kind and storage contract directly: C4Kind actor, actors directories, CLI/create/scan/validation/plain output, current Groma state and fixtures; person becomes invalid with no compatibility path.
2. Rename the shared interaction domain from person to actor: actor commands, actorId selection scope, viewer state, details, flows and camera helpers, while preserving current behavior.
3. Rename the web-sheet projection coherently to the Actors island: actor collection, island key and kind, CSS, painting language and focused layout tests.
4. Update current public documentation, architecture Markdown and tests wherever they describe the architecture domain; preserve ordinary prose about humans and historical Backlog records.
5. Run focused contract, model, action, viewer and sheet checks, then the full check and a domain-vocabulary audit. Perform the required cold simplicity review followed by the full-context architecture review before finalization.

6. Exclude tracked files that no longer exist from TypeScript scanner inputs, cover the reproduced deleted-file case, and rerun the complete project check before finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a direct architecture-domain replacement with no compatibility path:

- Canonical C4 kind, create/scan output, validation, plain rendering, TUI/web vocabulary, action scope, URL state, sheet island, architecture Markdown, fixtures, tests, and product docs now use Actor/actors.
- Runtime model rejects Actor documents outside a revision top-level actors/ directory.
- Web by= state is parsed and serialized only when it resolves to an Actor.
- Ordinary prose about humans remains natural; person/people appears in current code only in explicit negative compatibility tests.
- Moved current and fixture Actor documents from people/ to actors/.

Verification:
- TypeScript typecheck passes.
- Focused model/create/plain/action/navigation/sheet/URL checks pass.
- Full viewer suite passes: 161 tests.
- All Node tests except test/scan.test.ts pass: 87 tests.
- TUI 120x36 snapshot shows Actor legend and both actors.
- Browser QA shows ACTORS island and ACTOR details; selecting Human architect writes ?actor=human-architect with no console warnings/errors.
- Vocabulary, corrupted-substring, grammar, and diff checks pass.
- Cold simplicity review passed after enforcing the actors/ runtime boundary, restricting by= to Actors, and correcting viewer prose.
- Full-context architecture review recommends the current direct, domain-grouped approach and no further in-scope abstraction or refactor.

Shared-worktree blocker:
- Full bun run check cannot pass while another active change has deleted src/backlog-plugin.ts but test/scan.test.ts still opens that file. TASK-150 did not touch either path. Rerun the full check after that concurrent work settles.

Resolved the shared-worktree scanner failure inside TASK-150 with Alex approval. listTypeScriptFiles now excludes tracked paths that no longer exist before the import graph reads them; the existing file-selection test covers a tracked deletion. Focused scanner checks pass (14 tests). Final bun run check passes TypeScript, 93 Node tests and 161 viewer tests; git diff --check passes. The final full-context complexity review found no blocking issue and approved the one-filter/one-test implementation as the minimum clear solution.

The exact staged TASK-150 snapshot was applied over main at 8dafee2 in a clean temporary worktree and passed typecheck, 93 Node tests and 145 viewer tests. This verifies the commit without any unstaged TASK-135, TASK-142, TASK-146 or TASK-151 work.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the Person/People architecture domain with Actor/Actors across the canonical model, storage paths, creation and scan contracts, both viewers, URL state, sheet layout, current architecture, fixtures, tests, and documentation, with no compatibility alias. Added owning-boundary checks for actors/ locations and Actor-only by= state, and made TypeScript scanning ignore tracked files deleted from the worktree. Verified through TUI and browser QA, cold and full-context architecture reviews, git diff checks, and the full project suite: 93 Node tests and 161 viewer tests.
<!-- SECTION:FINAL_SUMMARY:END -->
