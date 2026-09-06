---
id: TASK-295
title: Derive architecture interactions from temporary operation evidence
status: Done
assignee:
  - '@codex'
created_date: '2026-09-06 11:42'
updated_date: '2026-09-06 13:03'
labels: []
dependencies: []
references:
  - scan-lifecycle
  - scan-observation
  - typescript-scanner
  - source-relationships
  - architecture-model
  - architecture-reader
  - architecture-writer
  - authoring
  - agent-instructions
  - commands
  - draft
  - edit
  - init-command
  - instructions
  - observed-curation
  - plain-text-view
  - project-initialization
  - welcome
  - accept
  - groma-filesystem
  - project-profile
  - search
  - sheet-composition
  - sheet-routing
  - world-loader
  - c-scanner
  - large-world-fixture
  - scanner-modules
  - chrome
  - details
  - flow
  - hierarchy
  - navigation-history
  - navigation
  - projection
  - screen
  - terminal-painting
  - work-focus
  - architecture-watch
  - backlog-plugin
  - read-read
  - revisions
  - terminal-host
  - viewer-semantics
  - work-projection
  - work-source-contract
  - component-tasks
  - control
  - export
  - flow-controls
  - iso-camera
  - iso-map
  - iso-projection
  - layer-modes
  - motion
  - page
  - popover
  - project-editor
  - relationship-card
  - render
  - revision-history
  - session
  - source-viewer
  - stats
  - task-diff
  - view
  - web-server
  - web-shell
  - web-viewer-authoring
  - web-viewer-details
  - web-viewer-hierarchy
  - work-overlay
  - orders
documentation:
  - docs/relationship-inference.md
  - docs/scanners/evidence.md
modified_files:
  - packages/scanner/src/index.ts
  - plugins/scanners/typescript/src/source-operations.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/typescript/src/source-worker.ts
  - plugins/scanners/typescript/src/graph.ts
  - plugins/scanners/typescript/src/scan.ts
  - src/types.ts
  - src/code-reference.ts
  - src/source-relationships.ts
  - src/relationship-markdown.ts
  - src/architecture-model.ts
  - src/markdown-emitter.ts
  - src/relation.ts
  - src/remove.ts
  - src/relationship-inference.ts
  - src/scan-reconciler.ts
  - test/fixtures/operation-wiring/provider.ts
  - test/fixtures/operation-wiring/api.ts
  - test/fixtures/operation-wiring/worker.ts
  - test/fixtures/operation-wiring/caller.ts
  - test/fixtures/operation-wiring/wrapper.ts
  - test-bun/source-relationships.test.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/okf-writers.test.ts
  - groma/systems/groma/containers/cli/components/agent-instructions.md
  - groma/systems/groma/containers/cli/components/commands.md
  - groma/systems/groma/containers/cli/components/draft.md
  - groma/systems/groma/containers/cli/components/edit.md
  - groma/systems/groma/containers/cli/components/init-command.md
  - groma/systems/groma/containers/cli/components/instructions.md
  - groma/systems/groma/containers/cli/components/observed-curation.md
  - groma/systems/groma/containers/cli/components/plain-text-view.md
  - groma/systems/groma/containers/cli/components/project-initialization.md
  - groma/systems/groma/containers/cli/components/welcome.md
  - groma/systems/groma/containers/core/components/accept.md
  - groma/systems/groma/containers/core/components/architecture-model.md
  - groma/systems/groma/containers/core/components/architecture-reader.md
  - groma/systems/groma/containers/core/components/architecture-writer.md
  - groma/systems/groma/containers/core/components/authoring.md
  - groma/systems/groma/containers/core/components/groma-filesystem.md
  - groma/systems/groma/containers/core/components/project-profile.md
  - groma/systems/groma/containers/core/components/search.md
  - groma/systems/groma/containers/core/components/sheet-composition.md
  - groma/systems/groma/containers/core/components/sheet-routing.md
  - groma/systems/groma/containers/core/components/world-loader.md
  - groma/systems/groma/containers/scanner/components/c-scanner.md
  - groma/systems/groma/containers/scanner/components/large-world-fixture.md
  - groma/systems/groma/containers/scanner/components/relationship-inference.md
  - groma/systems/groma/containers/scanner/components/scan-lifecycle.md
  - groma/systems/groma/containers/scanner/components/scan-observation.md
  - groma/systems/groma/containers/scanner/components/scanner-modules.md
  - groma/systems/groma/containers/scanner/components/source-operations.md
  - groma/systems/groma/containers/scanner/components/source-relationships.md
  - groma/systems/groma/containers/scanner/components/typescript-scanner.md
  - groma/systems/groma/containers/terminal-viewer/components/chrome.md
  - groma/systems/groma/containers/terminal-viewer/components/details.md
  - groma/systems/groma/containers/terminal-viewer/components/flow.md
  - groma/systems/groma/containers/terminal-viewer/components/hierarchy.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/navigation-history.md
  - groma/systems/groma/containers/terminal-viewer/components/navigation.md
  - groma/systems/groma/containers/terminal-viewer/components/projection.md
  - groma/systems/groma/containers/terminal-viewer/components/screen.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/terminal-painting.md
  - groma/systems/groma/containers/terminal-viewer/components/work-focus.md
  - groma/systems/groma/containers/view-host/components/architecture-watch.md
  - groma/systems/groma/containers/view-host/components/backlog-plugin.md
  - groma/systems/groma/containers/view-host/components/read-read.md
  - groma/systems/groma/containers/view-host/components/revisions.md
  - groma/systems/groma/containers/view-host/components/terminal-host.md
  - groma/systems/groma/containers/view-host/components/viewer-semantics.md
  - groma/systems/groma/containers/view-host/components/work-projection.md
  - groma/systems/groma/containers/view-host/components/work-source-contract.md
  - groma/systems/groma/containers/web-viewer/components/component-tasks.md
  - groma/systems/groma/containers/web-viewer/components/control.md
  - groma/systems/groma/containers/web-viewer/components/export.md
  - groma/systems/groma/containers/web-viewer/components/flow-controls.md
  - groma/systems/groma/containers/web-viewer/components/iso-camera.md
  - groma/systems/groma/containers/web-viewer/components/iso-map.md
  - groma/systems/groma/containers/web-viewer/components/iso-projection.md
  - groma/systems/groma/containers/web-viewer/components/layer-modes.md
  - groma/systems/groma/containers/web-viewer/components/motion.md
  - groma/systems/groma/containers/web-viewer/components/page.md
  - groma/systems/groma/containers/web-viewer/components/popover.md
  - groma/systems/groma/containers/web-viewer/components/project-editor.md
  - groma/systems/groma/containers/web-viewer/components/relationship-card.md
  - groma/systems/groma/containers/web-viewer/components/render.md
  - groma/systems/groma/containers/web-viewer/components/revision-history.md
  - groma/systems/groma/containers/web-viewer/components/session.md
  - groma/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/systems/groma/containers/web-viewer/components/stats.md
  - groma/systems/groma/containers/web-viewer/components/task-diff.md
  - groma/systems/groma/containers/web-viewer/components/view.md
  - groma/systems/groma/containers/web-viewer/components/web-server.md
  - groma/systems/groma/containers/web-viewer/components/web-shell.md
  - groma/systems/groma/containers/web-viewer/components/web-viewer-authoring.md
  - groma/systems/groma/containers/web-viewer/components/web-viewer-details.md
  - groma/systems/groma/containers/web-viewer/components/web-viewer-hierarchy.md
  - groma/systems/groma/containers/web-viewer/components/work-overlay.md
  - >-
    test/fixtures/core-view/groma/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/source-view/groma/systems/shop/containers/api/components/orders.md
  - src/core.ts
  - src/viewers/web/organisms/relationship-details.ts
  - docs/component-markdown.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - docs/relationship-inference.md
  - docs/scanners/evidence.md
  - docs/scanners/typescript/index.md
  - docs/agent-instructions/index.md
  - docs/product-model.md
  - src/instructions.ts
  - groma/relationships.md
ordinal: 334000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer scans a project and receives automatically derived, source-supported architecture interactions alongside preserved authored relationships. Scanners report language facts and unresolved targets; core owns interpretation and file ownership. Raw analysis is temporary. Begin with the approved canonical-provider and callback-wiring examples, compare Jelly on the bounded Groma case, and retain findings in the language-neutral scanner manual.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identity-preserving aliases and re-exports resolve to the operation provider before core applies file ownership; active wrapper calls retain their own identity.
- [x] #2 Core emits only interactions supported by an explicitly documented rule, preserves unresolved alternatives, and does not use import counts, component names, or authored membership as selection signals.
- [x] #3 Derived and authored interactions are readable linked Markdown; rescanning refreshes derived rows while preserving authored rows, and raw dependency or call graphs are not persisted.
- [x] #4 The approved Groma example and a bounded Jelly comparison have recorded correctness, limitations, and measured extraction cost; scanner authors can understand the language-neutral facts and current contract.
- [x] #5 Supported scanner, scan/reload, ownership, and authoring behavior passes focused checks and bun run check, followed by the required simplicity and complexity reviews.
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
Trace scanner extraction and relationship persistence. Trial Jelly against the canonical provider and init callback examples with explicit owned files. Implement the smallest shared operation facts and core rules supported by those examples; replace raw dependency persistence with derived Markdown. Preserve authored behavior, document measured findings and current limits, validate the live Groma result and required checks, and complete the required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented temporary operation and binding-scoped invocation evidence, canonical relative alias resolution, and the supplied named callback rule in core. Derived rows have their own Markdown section; current authored text takes precedence for matching file endpoints and drafts remain separate. Removed persisted raw dependency graphs and counts through Groma writers; footprint counts now come from stored interactions. Jelly 0.13.0 identified both init callback implementations on the 219-file snapshot in 1.68 seconds, versus about 0.44 seconds for the compiler path. Kept Jelly offline. The live model preserves all 99 authored pairs and adds 14 visible derived pairs (15 derived file pairs before authored precedence), with 83 elements and no newly created component after the final scan.

Cold simplicity review passed. Applied its two suggestions: carry whole-program operation evidence directly instead of splitting and rejoining per file; name the rule suppliedNamedCallback. Implementer specification review verifies canonical aliases and executable wrappers, same-owner suppression, agreement of known alternative owners, explicit uncertainty, rescan removal, authored takeover, and independent draft acceptance through focused tests. Implementer quality review found and fixed a supplied object being modified before invocation; observed writes now leave the original provider unresolved. The targeted regression and all nine relationship tests pass. The prior full repository check passed 106 Node and 319 Bun tests; two added quality checks are included in the final rerun. Existing startup tests for lazy history and onListening were corrected under TASK-156 without changing their assertions or product behavior. Final browser check and full-context complexity review remain in progress.

Final validation: bun run check passed all 106 Node and 321 Bun tests (427 total). The full-context complexity review passed with no blockers and confirmed scanner/core/Markdown ownership and the bounded coverage claims. Browser verification opened the live architecture and the Architecture watch to Terminal host derived relationship: exact source files, direction, callback description, and Derived interaction provenance were visible. The init-command authored statement retained precedence. The live viewer was restarted with the final checked code on port 4747. All 36 real relative documentation links and anchors resolve; git diff --check passes; changed TypeScript source and test files are at most 500 lines. The first supplied named callback rule is complete for this example. The larger automatic relationship objective remains open: direct service operations, injected class receivers, and protocol calls require a reviewed next example.

Final delivery validation approved by Alex: clean Backlog reset and two scans pass with 275 elements and four derived rows; scan times 616 ms and 572 ms with identical Markdown digests. Clean OpenClaw scan exits 137 before output. Previous .groma state is preserved under /tmp/final-relationship-check/openclaw/before-groma. Reopening to investigate this reproduced supported-repository failure before commit and push.

Final delivery verification after the OpenClaw fix: all 428 tests pass (106 Node, 322 Bun) in /tmp/groma-final-delivery, which contains this thread’s TASK-294/295/156 changes and excludes TASK-296 through its owner’s baseline copies. The resolver caches parameter results by depth, removes identical binding alternatives, queries only value-reference identifiers, and resolves invocations in batches; the repeated-forwarding regression preserves two known providers plus one unresolved binding. Distinct operation facts match the previous implementation on Groma and Backlog. Clean scans have exactly one owner for every supported file and byte-identical refresh output: Backlog 212 files / 275 elements / 4 derived relationships; OpenClaw 3164 files / 3200 elements / 220 derived relationships. OpenClaw first scan 2701.53 ms, refresh 2966.94 ms. Live browser launch-to-paint measurements include the real CLI, scan, full map, all building/route DOM nodes, two frames and a paint event: Groma 591.57 ms, Backlog 723.29 ms, OpenClaw 4591.89 ms. Manual source checks confirm UI/config callbacks in Backlog and message, debounce, access-control and secret-reload callbacks in OpenClaw. These are coverage checks for the current rule, not proof of complete architecture. Alex explicitly accepted leaving the broader relationship gap for now. Cold and full-context reviews previously passed; implementer reviewed this bounded performance fix for unchanged targets, uncertainty, ownership and simpler data handling. OpenClaw sampled peak process-tree RSS 3665968 KiB and settled parent RSS 3196016 KiB; memory reduction remains tracked by TASK-156. Source snapshots: Backlog HEAD 660cb98206660a43dfd6e52a8038fde50693074a, source digest 54fec94f16f6f24f9ba25a53aef1e99f2eb0afeb729300bdace1dc4479b6d010; OpenClaw HEAD 635c78a1778d59fbb125d0afef481bc462d7ebc7, source digest cf4d70ed7621aea91807dd60caefcfc904c2a9a5bd5b04fc4819340d6c6fda08. Backups and measurements are under /tmp/final-relationship-check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the first automatic relationship rule from temporary TypeScript operation evidence. Canonical aliases resolve to providers; concrete supplied callbacks yield readable derived Markdown while authored statements retain precedence. Groma shows 99 authored and 14 additional visible derived relationships. Recorded the bounded Jelly comparison and extraction limits. Verified with 427 passing repository tests, live browser checks, documentation link checks, and both required simplicity/complexity reviews. This task completes the first callback example, not the broader relationship objective.

Final clean-repository checks cover all 212 Backlog and 3164 OpenClaw files. Fixed repeated callback expansion after OpenClaw exposed excessive memory. All 428 tests pass; full browser startup measured 0.59/0.72/4.59 seconds for Groma/Backlog/OpenClaw. Broader relationship coverage is explicitly deferred by Alex.
<!-- SECTION:FINAL_SUMMARY:END -->
