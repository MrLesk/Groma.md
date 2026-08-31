---
id: TASK-225.3
title: Migrate Groma’s bundle and prove OKF interoperability
status: Done
assignee:
  - '@codex'
created_date: '2026-08-30 21:45'
updated_date: '2026-08-31 00:25'
labels: []
milestone: m-5
dependencies:
  - TASK-225.2
references:
  - coding-agent
  - human-architect
  - git
  - architecture-comparison
  - commands
  - create
  - edit
  - instructions
  - observed-curation
  - plain-text-view
  - welcome
  - cli
  - accept
  - architecture-model
  - architecture-reader
  - architecture-writer
  - project-profile
  - search
  - sheet-composition
  - sheet-routing
  - world-layout
  - world-loader
  - core
  - c-scanner
  - scan-lifecycle
  - scan-observation
  - typescript-scanner
  - scanner
  - chrome
  - details
  - flow
  - hierarchy
  - navigation
  - projection
  - screen
  - terminal-painting
  - work-focus
  - terminal-viewer
  - architecture-watch
  - backlog-plugin
  - terminal-host
  - viewer-semantics
  - work-projection
  - view-host
  - component-tasks
  - control
  - flow-controls
  - iso-camera
  - iso-map
  - iso-projection
  - layer-modes
  - page
  - popover
  - project-editor
  - render
  - revision-history
  - session
  - source-viewer
  - stats
  - task-diff
  - view
  - web-server
  - web-shell
  - web-viewer-details
  - web-viewer-hierarchy
  - work-overlay
  - web-viewer
  - groma
  - architecture-markdown
  - code-reference
  - okf-profile
modified_files:
  - groma/index.md
  - groma/project.md
  - test/fixtures/containers-view/groma/index.md
  - test/fixtures/containers-view/groma/project.md
  - test/fixtures/core-view/groma/index.md
  - test/fixtures/core-view/groma/project.md
  - test/fixtures/create/groma/index.md
  - test/fixtures/create/groma/project.md
  - test/fixtures/edit/groma/index.md
  - test/fixtures/edit/groma/project.md
  - test/fixtures/openclaw-view/groma/index.md
  - test/fixtures/openclaw-view/groma/project.md
  - test/fixtures/plain-view/groma/index.md
  - test/fixtures/plain-view/groma/project.md
  - test/fixtures/viewer-view/groma/index.md
  - test/fixtures/viewer-view/groma/project.md
  - groma/observed/actors/coding-agent.md
  - groma/observed/actors/human-architect.md
  - groma/observed/systems/git/system.md
  - >-
    groma/observed/systems/groma/containers/cli/components/architecture-comparison.md
  - groma/observed/systems/groma/containers/cli/components/commands.md
  - groma/observed/systems/groma/containers/cli/components/create.md
  - groma/observed/systems/groma/containers/cli/components/edit.md
  - groma/observed/systems/groma/containers/cli/components/instructions.md
  - groma/observed/systems/groma/containers/cli/components/observed-curation.md
  - groma/observed/systems/groma/containers/cli/components/plain-text-view.md
  - groma/observed/systems/groma/containers/cli/components/welcome.md
  - groma/observed/systems/groma/containers/cli/container.md
  - groma/observed/systems/groma/containers/core/components/accept.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-model.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-reader.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-writer.md
  - groma/observed/systems/groma/containers/core/components/project-profile.md
  - groma/observed/systems/groma/containers/core/components/search.md
  - groma/observed/systems/groma/containers/core/components/sheet-composition.md
  - groma/observed/systems/groma/containers/core/components/sheet-routing.md
  - groma/observed/systems/groma/containers/core/components/world-layout.md
  - groma/observed/systems/groma/containers/core/components/world-loader.md
  - groma/observed/systems/groma/containers/core/container.md
  - groma/observed/systems/groma/containers/scanner/components/c-scanner.md
  - groma/observed/systems/groma/containers/scanner/components/scan-lifecycle.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/scan-observation.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/typescript-scanner.md
  - groma/observed/systems/groma/containers/scanner/container.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/chrome.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/details.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/flow.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/hierarchy.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/navigation.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/projection.md
  - groma/observed/systems/groma/containers/terminal-viewer/components/screen.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/terminal-painting.md
  - >-
    groma/observed/systems/groma/containers/terminal-viewer/components/work-focus.md
  - groma/observed/systems/groma/containers/terminal-viewer/container.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/architecture-watch.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/backlog-plugin.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/terminal-host.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/viewer-semantics.md
  - >-
    groma/observed/systems/groma/containers/view-host/components/work-projection.md
  - groma/observed/systems/groma/containers/view-host/container.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/component-tasks.md
  - groma/observed/systems/groma/containers/web-viewer/components/control.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/flow-controls.md
  - groma/observed/systems/groma/containers/web-viewer/components/iso-camera.md
  - groma/observed/systems/groma/containers/web-viewer/components/iso-map.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/iso-projection.md
  - groma/observed/systems/groma/containers/web-viewer/components/layer-modes.md
  - groma/observed/systems/groma/containers/web-viewer/components/page.md
  - groma/observed/systems/groma/containers/web-viewer/components/popover.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/project-editor.md
  - groma/observed/systems/groma/containers/web-viewer/components/render.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/revision-history.md
  - groma/observed/systems/groma/containers/web-viewer/components/session.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/observed/systems/groma/containers/web-viewer/components/stats.md
  - groma/observed/systems/groma/containers/web-viewer/components/task-diff.md
  - groma/observed/systems/groma/containers/web-viewer/components/view.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-server.md
  - groma/observed/systems/groma/containers/web-viewer/components/web-shell.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-details.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/web-viewer-hierarchy.md
  - >-
    groma/observed/systems/groma/containers/web-viewer/components/work-overlay.md
  - groma/observed/systems/groma/containers/web-viewer/container.md
  - groma/observed/systems/groma/system.md
  - >-
    test/fixtures/containers-view/groma/observed/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/containers-view/groma/observed/systems/shop/containers/api/container.md
  - >-
    test/fixtures/containers-view/groma/observed/systems/shop/containers/web/components/page.md
  - >-
    test/fixtures/containers-view/groma/observed/systems/shop/containers/web/container.md
  - test/fixtures/containers-view/groma/observed/systems/shop/system.md
  - >-
    test/fixtures/core-view/groma/missing/systems/shop/containers/api/components/legacy.md
  - test/fixtures/core-view/groma/observed/notes.md
  - test/fixtures/core-view/groma/observed/systems/payments/system.md
  - >-
    test/fixtures/core-view/groma/observed/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/core-view/groma/observed/systems/shop/containers/api/container.md
  - test/fixtures/core-view/groma/observed/systems/shop/system.md
  - >-
    test/fixtures/core-view/groma/plans/checkout/systems/shop/containers/api/components/orders.md
  - test/fixtures/core-view/groma/plans/inventory/notes.md
  - >-
    test/fixtures/core-view/groma/plans/inventory/systems/shop/containers/api/components/inventory.md
  - >-
    test/fixtures/core-view/groma/plans/inventory/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/core-view/groma/plans/inventory/systems/shop/containers/api/container.md
  - test/fixtures/create/groma/observed/systems/shop/containers/api/container.md
  - test/fixtures/create/groma/observed/systems/shop/system.md
  - >-
    test/fixtures/edit/groma/observed/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/edit/groma/observed/systems/shop/containers/api/components/stock.md
  - test/fixtures/edit/groma/observed/systems/shop/containers/api/container.md
  - test/fixtures/edit/groma/observed/systems/shop/system.md
  - test/fixtures/openclaw-view/groma/observed/actors/operator.md
  - test/fixtures/openclaw-view/groma/observed/systems/anthropic/system.md
  - >-
    test/fixtures/openclaw-view/groma/observed/systems/openclaw/containers/agent-runtime/container.md
  - >-
    test/fixtures/openclaw-view/groma/observed/systems/openclaw/containers/channels/container.md
  - >-
    test/fixtures/openclaw-view/groma/observed/systems/openclaw/containers/cli/container.md
  - >-
    test/fixtures/openclaw-view/groma/observed/systems/openclaw/containers/control-ui/container.md
  - >-
    test/fixtures/openclaw-view/groma/observed/systems/openclaw/containers/gateway/container.md
  - >-
    test/fixtures/openclaw-view/groma/observed/systems/openclaw/containers/node/container.md
  - test/fixtures/openclaw-view/groma/observed/systems/openclaw/system.md
  - test/fixtures/openclaw-view/groma/observed/systems/telegram/system.md
  - test/fixtures/openclaw-view/groma/observed/systems/whatsapp/system.md
  - test/fixtures/plain-view/groma/observed/actors/buyer.md
  - test/fixtures/plain-view/groma/observed/systems/git/system.md
  - >-
    test/fixtures/plain-view/groma/observed/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/plain-view/groma/observed/systems/shop/containers/api/components/stock.md
  - >-
    test/fixtures/plain-view/groma/observed/systems/shop/containers/api/container.md
  - >-
    test/fixtures/plain-view/groma/observed/systems/shop/containers/web/container.md
  - test/fixtures/plain-view/groma/observed/systems/shop/system.md
  - >-
    test/fixtures/plain-view/groma/plans/next/systems/shop/containers/api/components/stock.md
  - >-
    test/fixtures/validate/groma/missing/systems/shop/containers/api/components/legacy.md
  - test/fixtures/validate/groma/observed/actors/buyer.md
  - test/fixtures/validate/groma/observed/systems/git/system.md
  - >-
    test/fixtures/validate/groma/observed/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/validate/groma/observed/systems/shop/containers/api/container.md
  - test/fixtures/validate/groma/observed/systems/shop/system.md
  - >-
    test/fixtures/validate/groma/plans/next/systems/shop/containers/api/components/stock.md
  - test/fixtures/viewer-view/groma/observed/actors/shop-architect.md
  - test/fixtures/viewer-view/groma/observed/actors/shop-operator.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/api/components/pricing.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/api/container.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/gateway/components/router.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/gateway/container.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/order-viewer/components/order-page.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/order-viewer/container.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/stock-viewer/components/stock-page.md
  - >-
    test/fixtures/viewer-view/groma/observed/systems/shop/containers/stock-viewer/container.md
  - test/fixtures/viewer-view/groma/observed/systems/shop/system.md
  - test/fixtures/viewer-view/groma/observed/systems/vault/system.md
  - groma/README.md
  - groma/missing/index.md
  - groma/missing/README.md
  - groma/observed/index.md
  - groma/observed/README.md
  - groma/plans/index.md
  - groma/plans/README.md
  - groma/plans/mvp/index.md
  - groma/plans/mvp/README.md
  - test/fixtures/containers-view/groma/missing/index.md
  - test/fixtures/containers-view/groma/missing/README.md
  - test/fixtures/containers-view/groma/observed/index.md
  - test/fixtures/containers-view/groma/observed/README.md
  - test/fixtures/containers-view/groma/plans/index.md
  - test/fixtures/containers-view/groma/plans/README.md
  - test/fixtures/core-view/groma/missing/index.md
  - test/fixtures/core-view/groma/missing/README.md
  - test/fixtures/core-view/groma/observed/index.md
  - test/fixtures/core-view/groma/observed/README.md
  - test/fixtures/core-view/groma/plans/checkout/index.md
  - test/fixtures/core-view/groma/plans/checkout/README.md
  - test/fixtures/core-view/groma/plans/inventory/index.md
  - test/fixtures/core-view/groma/plans/inventory/README.md
  - test/fixtures/create/groma/missing/index.md
  - test/fixtures/create/groma/missing/README.md
  - test/fixtures/create/groma/observed/index.md
  - test/fixtures/create/groma/observed/README.md
  - test/fixtures/create/groma/plans/index.md
  - test/fixtures/create/groma/plans/README.md
  - test/fixtures/edit/groma/missing/index.md
  - test/fixtures/edit/groma/missing/README.md
  - test/fixtures/edit/groma/observed/index.md
  - test/fixtures/edit/groma/observed/README.md
  - test/fixtures/edit/groma/plans/index.md
  - test/fixtures/edit/groma/plans/README.md
  - test/fixtures/openclaw-view/groma/missing/index.md
  - test/fixtures/openclaw-view/groma/missing/README.md
  - test/fixtures/openclaw-view/groma/observed/index.md
  - test/fixtures/openclaw-view/groma/observed/README.md
  - test/fixtures/openclaw-view/groma/plans/index.md
  - test/fixtures/openclaw-view/groma/plans/README.md
  - test/fixtures/plain-view/groma/missing/index.md
  - test/fixtures/plain-view/groma/missing/README.md
  - test/fixtures/plain-view/groma/observed/index.md
  - test/fixtures/plain-view/groma/observed/README.md
  - test/fixtures/plain-view/groma/plans/index.md
  - test/fixtures/plain-view/groma/plans/README.md
  - test/fixtures/plain-view/groma/plans/next/index.md
  - test/fixtures/plain-view/groma/plans/next/README.md
  - test/fixtures/validate/groma/observed/notes.md
  - test/fixtures/validate/groma/observed/README.md
  - test/fixtures/viewer-view/groma/missing/index.md
  - test/fixtures/viewer-view/groma/missing/README.md
  - test/fixtures/viewer-view/groma/observed/index.md
  - test/fixtures/viewer-view/groma/observed/README.md
  - test/fixtures/viewer-view/groma/plans/index.md
  - test/fixtures/viewer-view/groma/plans/README.md
  - test/accept.test.ts
  - test/create.test.ts
  - test/edit.test.ts
  - test/curate.test.ts
  - test/cli-scan.test.ts
  - test/scan-watch.test.ts
  - test/cli-view.test.ts
  - test-bun/scanner-evidence.test.ts
  - test-bun/viewer-live.test.ts
  - test-bun/web-live.test.ts
  - test-bun/web-task-live.test.ts
  - test-bun/git-history.test.ts
  - test-bun/viewer-lifecycle.test.ts
  - README.md
  - MANIFESTO.md
  - CONTRIBUTING.md
  - docs/component-markdown.md
  - docs/product-model.md
  - docs/index.md
  - docs/viewers/web/index.md
  - >-
    groma/observed/systems/groma/containers/core/components/architecture-markdown.md
  - groma/observed/systems/groma/containers/core/components/code-reference.md
  - groma/observed/systems/groma/containers/core/components/okf-profile.md
parent_task_id: TASK-225
priority: high
type: feature
ordinal: 241000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rewrite the live Groma architecture package, automated fixtures, and public documentation into the final OKF v0.2 profile, then prove both outside-reader interoperability and unchanged Groma behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The complete live groma package and every automated architecture fixture use the final OKF v0.2 Groma profile with no retired kind fields
- [x] #2 README, manifesto, contributing guidance, architecture contract documentation, and observed architecture explain only the final OKF-based system
- [x] #3 Every non-reserved concept passes the pinned Google OKFDocument validation and reserved files satisfy the pinned specification
- [x] #4 Google’s pinned reference visualizer loads the package with nonzero concepts, rendered Markdown bodies, and relationship edges
- [x] #5 Groma’s supported create, scan, edit, accept, history, plain, TUI, and Web flows retain their current observable behavior
- [x] #6 Focused checks and bun run check pass on the final migrated package
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
1. Inventory every live and test groma package plus documentation and CLI assertions that still use reserved README files, retired kind frontmatter, duplicate H1 titles, or description-as-body inputs.
2. Migrate each package root to reserved index.md/project.md files and each revision to index.md, then rewrite every C4 concept to top-level type/title/optional description/status with nested groma metadata and body overview/named sections preserved; record each changed path and live groma.id immediately.
3. Update README.md, MANIFESTO.md, CONTRIBUTING.md, relevant docs and observed architecture to describe only the final OKF v0.2 Groma profile, and update broad create/scan/edit/accept/history/plain/TUI/Web tests to use --overview and the final fixtures.
4. Run focused parser, writer, CLI, history, plain, TUI, and Web checks; fix only supported-flow regressions, confirm no supported architecture Markdown retains kind or retired README reserved files, and check changed source/test file lengths.
5. In a temporary checkout pinned to Google OKF commit ad30107c31c06aec8a7d5636e0d1058118604e6f, validate every live non-reserved concept with OKFDocument.validate, check reserved index/log rules independently, and run the reference visualizer to prove nonzero concepts, rendered Markdown bodies, and relationship edges without adding a dependency or generated artifact.
6. Run bun run check on the exact final worktree, inspect the diff for scope and preserved TASK-225.1/.2 changes, and return objective evidence without committing, finalizing, or changing task status.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented flow:
- Replaced every supported live and fixture package root with the reserved OKF v0.2 index.md plus the explicit groma/project.md profile, replaced every revision README with index.md, and migrated every C4 concept to top-level type/title/optional description/status plus nested groma metadata. Copied H1 titles were removed, leading prose remained the overview, named sections and canonical relationship tables were preserved, and plan concepts are draft while observed/missing/accepted concepts are stable.
- Updated broad create, scan, watch, edit, curate, accept, history, plain, TUI, and Web tests to the final package and --overview vocabulary. A stale Web test now proves the strict package rejection when project overview is absent; the TUI reload test changes standard title frontmatter instead of a removed H1. The Web task flow was split into test-bun/web-task-live.test.ts so every source and test file remains at most 500 lines.
- Updated README.md, MANIFESTO.md, CONTRIBUTING.md, the architecture Markdown contract, product model, docs index, Web viewer guide, plan indexes, and the relevant live reader/model/writer/project/create/edit/accept/scan concepts to describe only the final OKF-based design.
- A real tui-test walkthrough covered the 120x36 root map and details, opened the CLI container, returned with Backspace, and rendered the 200x60 root map. Its normal startup scan added three stable empty-overview concepts for the new architecture-markdown.ts, code-reference.ts, and okf-profile.ts source evidence; those files and exact ids were tracked immediately. The final live package validates as 71 C4 concepts and 69 relationships.

Interoperability evidence:
- Cloned the official Google open-knowledge-format repository only under /private/tmp, checked out exact commit ad30107c31c06aec8a7d5636e0d1058118604e6f, and installed only temporary PyYAML needed by its implementation. No dependency or generated artifact entered this repository.
- The pinned upstream OKFDocument.validate() accepted all 142 non-reserved concepts across the live package and eight automated fixture packages. Independent pinned-spec checks accepted all 40 reserved indexes; no log.md files are present. Root indexes contain only okf_version 0.2, non-root indexes contain no frontmatter, and no supported architecture Markdown retains kind or README reserved files.
- On the final live package, the pinned reference visualizer wrote a temporary 90,053-byte HTML file, loaded 72 concepts (71 C4 plus the project concept), retained 69 non-empty Markdown bodies for rendering through marked.parse, and built 69 relationship edges. The package contains zero generated, verified, or sources fields invented by this migration.

Verification and correction evidence:
- Focused local validation passes: observed 71 elements / 69 relationships, missing 0 / 0, MVP plan 0 / 0. git diff --check passes. Searches find no retired kind field or README reserved file in groma/ or test/fixtures/. Every source and test file is at most 500 lines.
- Initial sandboxed watcher and Web server runs failed with EMFILE/EADDRINUSE because the sandbox blocks the required watchers/listeners. The same suites outside the sandbox passed; one first full Bun run had a single transient watched-Markdown timeout, which passed alone and in both complete final runs. No fallback, retry, or weakened assertion was added.
- Final bun run check on the exact source/package tree passes: Biome and the scrollbar guard complete with 29 existing complexity warnings, typecheck passes, Node passes 91/91, and Bun passes 207/207.

Traceability records 225 repository paths and every live groma.id touched or created. No commit, push, task finalization, acceptance checkbox, status change, or PR was performed.

Cold simplicity review correction: used groma edit architecture-model --combine architecture-markdown code-reference to delete the two empty scanner-created live concepts while retaining both source modules as code evidence on architecture-model. Used groma edit to update project-editor to project title, optional concise description, and Markdown overview vocabulary. Used the supported relationship authoring path for render, then removed the superseded duplicate row because relate appends rather than replaces; the final single edge says Edits the project profile. A normal groma scan reported created 0 and left both collapsed concept paths absent, with their source evidence still combined. Final local validation is 69 C4 elements and 69 relationships. Focused reader/plain tests pass 18/18 and focused Web tests pass 9/9. The first unchanged full check had one known transient watched-Markdown timeout; its isolated rerun passed in 274 ms and the next complete bun run check passed Node 91/91 and Bun 207/207 without behavior, retry, fallback, or test changes. Exact-head pinned Google proof at ad30107c31c06aec8a7d5636e0d1058118604e6f now passes 140 non-reserved concepts across nine packages and 40 reserved indexes; live proof passes 70 OKF concepts, 69 C4 concepts, 69 non-empty Markdown bodies, 69 edges, zero invented trust/provenance fields, and an 89,211-byte temporary visualizer. Traceability remains 225 paths with architecture-model, architecture-markdown, and code-reference references recorded. No commit, push, finalization, checkbox, status change, or PR was performed.

Final reviews: the cold simplicity re-review passed after collapsing the two empty scanner records into architecture-model and correcting project-profile wording. The full-context hot review passed and would choose the architecture again: one OKF profile authority, one semantic graph, domain-owned mutations, no compatibility path, and no remaining in-scope deletion. Exact-head evidence remains upstream validation 140 concepts and 40 indexes, visualizer 70 concepts/69 bodies/69 edges, Groma 69 elements/69 relationships, final scan created 0, and bun run check Node 91/91 plus Bun 207/207.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated the live bundle, eight fixture packages, tests, and public documentation to the final profile. Pinned Google validation passes 140 concepts and 40 indexes; the visualizer loads 70 concepts, 69 Markdown bodies, and 69 edges; Groma, TUI, and bun run check all pass.
<!-- SECTION:FINAL_SUMMARY:END -->
