---
id: TASK-253
title: Author explicit OKF flows for both viewers
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 16:40'
updated_date: '2026-09-05 17:12'
labels: []
dependencies: []
references:
  - architecture-model
  - viewer-semantics
  - flow-controls
  - flow
  - world-loader
  - authoring
  - commands
  - render
  - details
  - navigation
  - screen
  - runtime
  - iso-map
documentation:
  - docs/component-markdown.md
modified_files:
  - features/flows.feature
  - src/types.ts
  - src/okf-profile.ts
  - src/architecture-reader.ts
  - src/architecture-markdown.ts
  - src/flow-model.ts
  - src/core.ts
  - src/architecture-model.ts
  - src/flow-authoring.ts
  - src/add.ts
  - src/edit.ts
  - src/remove.ts
  - src/cli.ts
  - src/viewers/flows.ts
  - src/viewers/relationship-text.ts
  - src/viewers/web/flow/state.ts
  - src/viewers/web/flow/list.ts
  - src/viewers/web/flow/row.ts
  - src/viewers/web/flow/reader.ts
  - src/viewers/web/selection.ts
  - src/removable.ts
  - src/relation.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/render.ts
  - src/viewers/web/url.ts
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/flow-navigation.ts
  - src/viewers/tui/navigation-details.ts
  - src/viewers/tui/navigation-tree.ts
  - src/viewers/tui/flow.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/tui/panes/view.ts
  - src/viewers/tui/paint.ts
  - src/viewers/tui/organisms/world.ts
  - src/viewers/tui/terminal-viewer.ts
  - src/viewers/action-path.ts
  - src/viewers/web/runtime.ts
  - test/fixtures/flows/groma/index.md
  - test/fixtures/flows/groma/project.md
  - test/fixtures/flows/groma/actors/requester.md
  - test/fixtures/flows/groma/systems/service/system.md
  - test/fixtures/flows/groma/systems/service/containers/api/container.md
  - test/fixtures/flows/groma/systems/service/containers/api/components/entry.md
  - >-
    test/fixtures/flows/groma/systems/service/containers/api/components/worker.md
  - test/fixtures/flows/groma/externals/journal.md
  - test/fixtures/flows/groma/flows/process-request.md
  - test-bun/helpers.ts
  - test/core.test.ts
  - test-bun/web-flow-activation.test.ts
  - test-bun/web-url.test.ts
  - test-bun/action-path.test.ts
  - test-bun/flows.test.ts
  - test-bun/inspect-details.test.ts
  - test-bun/navigation.test.ts
  - test-bun/projection.test.ts
  - test-bun/flow-navigation.test.ts
  - test-bun/sheet-scene.test.ts
  - test-bun/sheet-compose.test.ts
  - test/architecture-reader.test.ts
  - docs/component-markdown.md
  - docs/agent-instructions/index.md
  - docs/viewers/index.md
  - docs/viewers/web/index.md
  - docs/viewers/tui/index.md
  - docs/viewers/tui/interaction-spec.md
  - src/viewers/tui/keys.ts
  - groma/systems/groma/containers/scanner/components/flow-model.md
  - groma/systems/groma/containers/core/components/flow-model.md
  - groma/systems/groma/containers/core/components/architecture-model.md
  - groma/systems/groma/containers/scanner/components/flow-authoring.md
  - groma/systems/groma/containers/core/components/flow-authoring.md
  - groma/systems/groma/containers/core/components/authoring.md
  - groma/systems/groma/containers/view-host/components/viewer-semantics.md
  - groma/systems/groma/containers/view-host/components/flows.md
  - groma/systems/groma/containers/view-host/components/action-path.md
  - groma/systems/groma/containers/terminal-viewer/components/flow.md
  - groma/systems/groma/containers/terminal-viewer/components/flow-navigation.md
  - groma/systems/groma/containers/web-viewer/components/flow-controls.md
  - groma/systems/groma/containers/web-viewer/components/reader.md
  - groma/flows/architect-browser-review.md
  - groma/flows/architect-terminal-review.md
  - groma/flows/architect-project-setup.md
  - groma/flows/architect-typescript-scan.md
  - groma/flows/architect-architecture-curation.md
  - groma/flows/architect-static-export.md
  - groma/flows/agent-browser-review.md
  - groma/flows/agent-terminal-review.md
  - groma/flows/agent-project-setup.md
  - groma/flows/agent-typescript-scan.md
  - groma/flows/agent-architecture-curation.md
  - groma/flows/agent-static-export.md
  - src/viewers/web/iso/style.ts
type: feature
ordinal: 292000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect opens a flow in the web or terminal viewer, Groma explains a named scenario and shows only its explicitly authored connections. Replace derived command reachability with Groma Flow documents under flows/, using standard OKF metadata, a stable groma.id, overview prose, and an ordered Steps table with From and To Markdown links and scenario-specific Action text. Each step resolves an existing directed architecture relationship; it never creates a route. Bring the current Groma flows into this format and remove obsolete derivation. Preserve fixed map geometry and source inspection while making the flow readable in both viewers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Core reads and validates Groma Flow records, resolves inline and reference-style Markdown endpoint links, and preserves table order and contextual actions without duplicating relationships or creating C4 elements.
- [x] #2 Both viewers list authored flows and explain their purpose and ordered steps; selecting a step highlights only its exact authored relationship and endpoints, and inspecting a component does not expand the flow to unrelated connections.
- [x] #3 Flow membership is shared and explicit, unrelated routes stay out of the focused flow, and map geometry does not change when selecting or stepping a flow.
- [x] #4 Current Groma scenarios are written as named flow records through supported Groma authoring; current, historical, and static views consume the same record model without a legacy flow adapter.
- [x] #5 Focused fixture-based tests cover flow resolution, ordering, omitted connections, viewer state and geometry invariants; documentation describes the new OKF profile and web/TUI behavior; bun run check and affected viewer walkthroughs pass.
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
1. Add the Groma Flow profile and shared resolver over ordered Markdown Steps, with exact relationship references and no C4 geometry. Reuse the existing Markdown AST and authoring writes.
2. Replace derived command traversal with shared authored-flow queries. Add CLI add/edit/remove support needed to author and maintain the records.
3. Reuse each viewer's flow list, details pane, selection and map routes for one focused flow with purpose, ordered steps, exact step emphasis and return from element inspection. Suppress unrelated connection emphasis during flow reading.
4. Author the existing Groma scenarios as explicit records with deliberate connection membership, and update fixture worlds, product scenarios and documentation.
5. Run focused model/viewer tests and real web/TUI walkthroughs; run bun run check. Perform one cold simplicity review, own specification and quality reviews, then the full-context complexity review. Finalize with objective evidence and commit/push only task-owned changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Groma Flow OKF records with ordinary linked From/To/Action steps. Core resolves one existing directed relationship per row and preserves repeated steps and contextual actions. Shared viewer membership replaces the derived command traversal. Both viewers focus one flow or step, retain that state through endpoint inspection, and reuse existing map geometry. Twelve current agent/architect scenarios were authored through supported Groma operations. New source responsibilities were curated into existing architecture-model, authoring, viewer-semantics, flow, and flow-controls components rather than adding map boxes.

Verification: fixture tests cover inline/reference links, order, callbacks, repeated relationships, missing/ambiguous endpoints, unrelated-edge omission, authoring edits/removal invariants, shared browser payload, selection state, and immutable sheet/projection geometry. Browser walkthrough selected step 2, observed only its one route, inspected Worker, returned to the same step, and compared all route points unchanged. Current groma export succeeded. TUI walkthrough exercised current Groma root, full flow, step 2, component inspection, return, and 120x36/200x60 sizes. It exposed a long frame title being hidden; the reader now wraps its full title under a concise Flow frame and the affected walkthrough passed again.

Cold simplicity review passed; accepted its removal of redundant TUI flow parameters and leftover local commands naming. Implementer specification and quality reviews found no remaining blocking findings. Full-context complexity review recommends keeping the current responsibility split and found no useful further deletion. Remaining TUI action/command state names are a non-blocking naming follow-up, not additional scope. Existing lint complexity warnings remain outside the changed flow functions. A live Web Markdown watcher test intermittently timed out under concurrent load, then passed in isolation and a full check; final complete check is being repeated after the title fix.

Final verification after the title correction: bun run check passed (104 Node tests, 301 Bun tests, no failed tests); git diff --check passed. The isolated watcher timeout did not recur when the full check ran without the parallel terminal walkthrough. Final reviewer recommends no architecture changes.

Commit preparation isolated the coordinated exact-flow CSS hide rule from TASK-255 animation changes. Removed five blank separators in the Web composition file so the standalone flow revision also stays within the 500-line source limit. No runtime behavior changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced inferred command reachability with 12 authored Groma Flow documents using ordered Markdown links to existing directed relationships. Core validates and resolves the records; both viewers explain, step, and inspect them with explicit membership and unchanged geometry. Removed the obsolete traversal and actor-scope code, updated authoring/docs/fixtures, and verified with 405 passing tests, current static export, browser route/geometry checks, terminal walkthroughs at two sizes, and simplicity/complexity reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
