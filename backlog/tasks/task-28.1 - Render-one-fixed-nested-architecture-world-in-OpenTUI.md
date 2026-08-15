---
id: TASK-28.1
title: Render one fixed nested architecture world in OpenTUI
status: Done
assignee:
  - '@codex'
created_date: '2026-08-09 19:07'
updated_date: '2026-08-11 17:25'
labels: []
dependencies:
  - TASK-28.3
references:
  - groma/plans/mvp/README.md
  - docs/viewer.md
  - docs/product-model.md
  - groma/README.md
documentation:
  - docs/viewer.md
  - CONTRIBUTING.md
modified_files:
  - package.json
  - bun.lock
  - tsconfig.json
  - CONTRIBUTING.md
  - docs/viewer.md
  - scripts/validate-architecture.ts
  - src/types.ts
  - src/cli.ts
  - src/core.ts
  - src/architecture-comparison.ts
  - src/architecture-model.ts
  - src/architecture-reader.ts
  - src/markdown-emitter.ts
  - src/scanner-process.ts
  - src/scanner.ts
  - src/typescript-scanner.ts
  - src/world-layout.ts
  - src/viewer/paint.ts
  - src/viewer/projection.ts
  - src/viewer/terminal-viewer.ts
  - test/architecture-comparison.test.ts
  - test/architecture-model.test.ts
  - test/architecture-reader.test.ts
  - test/core.test.ts
  - test/markdown-emitter.test.ts
  - test/scanner.test.ts
  - test/typescript-scanner-contract.test.ts
  - test/typescript-scanner.test.ts
  - test/validate-architecture.test.ts
  - test/world-layout.test.ts
  - test-bun/terminal-viewer.test.ts
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the human architect runs `groma view`, Groma core calculates one deterministic fixed world from its annotated architecture model and returns the ELK data as renderer-independent objects. The latest stable OpenTUI release projects those objects without calculating layout. Use ELK for best-fit nested positioning and directed routing, then tune its layout options against the Groma MVP example until the result is readable. Groma runtime source, scripts, and tests are implemented in TypeScript and pass an explicit strict typecheck.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `groma view` opens the latest stable OpenTUI viewer and obtains the annotated architecture and fixed-world ELK objects through Groma core without reading Markdown paths or calculating layout in viewer code
- [x] #2 Core uses ELK to position every component, enclose components in containers and containers in systems, place context peers, and route every displayed relationship to its target without overlapping unrelated cards
- [x] #3 Repeated unchanged core models produce identical element and route coordinates; semantic level, camera, panel, and terminal-size changes never run layout again
- [x] #4 Core fixed-world calculation contains no OpenTUI rendering state, and the terminal projection consumes the returned ELK objects, IDs, annotations, containment, bounds, and routes without mutation
- [x] #5 Observed, planned, and missing annotations appear as compact chips; observed items use a solid border and theme-derived background tint, while planned and missing items use distinct theme colors and dotted borders
- [x] #6 A concise bordered header shows `System Context`, `Containers`, or `Components` and the current item; the footer shows `- context | containers | components +` with the current level emphasized and applicable key hints
- [x] #7 Directed arrows, labels, nested boundaries, and selected items remain readable in the Groma MVP example at the representative terminal sizes selected during implementation
- [x] #8 Destroying or exiting the viewer restores the original terminal screen and releases its input handler
- [x] #9 The Task 28.1 CLI, fixed-world layout, OpenTUI viewer, and their focused tests are authored in TypeScript and pass an explicit project typecheck
- [x] #10 All Groma runtime modules, repository scripts, and automated tests are TypeScript source; no .mjs application or test files remain
- [x] #11 The project uses the released TypeScript 7.0.2 native compiler for its explicit typecheck
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [x] #5 Automated ELK layout tests assert containment, non-overlap, deterministic coordinates, directed route endpoints, and no mutation of the annotated core model
- [x] #6 Layout options are tuned against the Groma MVP example until the manual review finds the nesting and routes readable; the accepted settings and evidence are recorded in Implementation Notes
- [x] #7 Headless lifecycle coverage starts and destroys `groma view` and verifies renderer resources and input handling are released
- [x] #8 The focused layout/rendering suite and project check command pass
- [x] #9 A real-terminal smoke test confirms theme-compatible output, directed arrows, resize behavior, and terminal restoration
- [x] #10 A cold simplicity review explains the core-model-to-layout-to-OpenTUI path and removes anything not required by these acceptance criteria
- [x] #11 Headless OpenTUI frame tests cover System Context, Containers, and Components at two representative terminal sizes selected during implementation and verify stable geometry, header/footer content, arrows, labels, chips, and lifecycle styling
- [x] #12 The TypeScript source boundary, runtime strategy, and typecheck command are documented and verified without retaining parallel JavaScript copies of Task 28.1 modules
- [x] #13 Node-specific scripts and tests execute TypeScript through the documented Node loader, while the CLI/viewer execute TypeScript through Bun, with both paths covered by the project check
- [x] #14 bun run typecheck reports TypeScript 7.0.2 and passes under its strict current configuration
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace every Groma runtime, repository script, and automated test `.mjs` source with one `.ts` source of truth; update imports, package entrypoints, scanner subprocess paths, and documented commands, leaving no parallel JavaScript copies.
2. Use the released TypeScript 7.0.2 native `tsc` with a strict no-emit configuration and explicit `.ts` imports/type-only imports. Run the CLI/viewer directly with Bun and preserve Node execution for Node-specific validation, scanner lifecycle, and node:test through `node --import=tsx`.
3. Define the minimum shared domain, fixed-world, projection, renderer-lifecycle, scanner, emitter, and validation types needed to remove implicit-any and unsafe boundary assumptions without adding generic architecture or compatibility layers.
4. Preserve the accepted Task 28.1 spike-derived visual and fixed-world behavior, document the TypeScript source/runtime boundary, and make the TypeScript 7 typecheck part of `bun run check`.
5. Run focused and full checks plus the real-terminal smoke, then complete the mandatory cold simplicity, specification, and quality reviews before finalizing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial takeover evidence: TASK-28.3 is Done and the only pre-existing worktree change is AGENTS.md, which will be preserved. The current viewer boundary only aliases the annotated core model; there is no CLI, ELK dependency, OpenTUI dependency, layout module, or terminal lifecycle. The stable packages verified from their registries on 2026-08-09 are elkjs 0.12.0 and @opentui/core 0.5.1. The historical spike confirms framebuffer rendering, headless frame capture, resize repaint, key-input teardown, alternate-screen restoration, and tmux smoke testing, but its world model and interaction are obsolete and will not be merged. The approved actor, entry point, result, and example are the human architect, groma view, one fixed nested terminal world, and the repository groma/plans/mvp example.

Implemented the fixed-world slice. Core now converts the sorted annotated response into one compound ELK graph, uses layered RIGHT layout with INCLUDE_CHILDREN, ORTHOGONAL routing, random seed 1, disconnected-component layout disabled, nested padding, and tuned node/edge spacing, then returns absolute element bounds plus route and label bounds. The accepted MVP world is 773x195 layout units for 20 representations and 21 directed relationships; all route endpoints land on their source and target boundaries.

The OpenTUI projection consumes only the core response, keeps the world unchanged, and derives cell coordinates for System Context, Containers, and Components at 120x36 and 180x50. Context emphasizes relationships touching context peers, Containers emphasizes collaborations within the focused system, and Components emphasizes relationships touching the focused container. Observed cards use solid green palette borders and a tint blended from the detected terminal background; planned and missing use distinct palette colors and dotted borders. The fixed header/footer, labels, arrowheads, nested boundaries, and selection are covered by stable headless frames.

Correction history: elkjs 0.12.0 needed its documented web-worker adapter under Bun, so the worker is created for each core layout and terminated in finally. ELK hierarchical edge sections are relative to their least common compound ancestor even when returned at the root, so core converts them with that ancestor's absolute offset. Minimum terminal card projections required route endpoints to be attached to projected card boundaries. Context density was reduced by semantic relationship emphasis and structure-only rendering for undersized nested nodes. OpenTUI native tests require Bun while the existing nested node:test suite requires Node, so the project check runs the existing suite on Node and only the renderer suite on Bun.

Verification before final reviews: focused core/layout/viewer coverage passes (4 core/layout tests and 5 OpenTUI tests). bun run check passes architecture validation, 86 Node tests, and 5 Bun/OpenTUI tests. A real tmux smoke started ./src/cli.mjs view at 120x36, confirmed theme-derived truecolor output, origin chips, nested boundaries, directed arrows, and the fixed header/footer, resized to 180x50 with unchanged world geometry, then Esc restored the blank main screen and exited status 0. The cold simplicity review removed a redundant projection sort, identity color map, identity level conditional, and unused theme entry; its single targeted re-review passed with the 5 focused viewer tests.

First specification and quality reviews found the same blocking readability gap: Context and Containers suppressed every relationship label at both selected sizes, and independent minimum card floors overlapped the observed and planned coding-agent cards at 120x36. The correction keeps core coordinates fixed while making the terminal representation level-aware: context relationships are de-duplicated by top-level source/target pair, Context and Containers show compact action labels centered on core-supplied label bounds, level-relevant cards reserve their full names, and two-row context cards preserve chips and borders without vertical overlap. Off-focus elements are no longer clamped into the viewport. The two-size/three-level frame test now requires a readable relationship label in every frame and asserts that visible same-level cards do not overlap. After the correction, bun run check again passes architecture validation, 86 Node tests, and 5 Bun/OpenTUI tests.

Corrected real-terminal smoke: launched fresh OpenTUI sessions at 120x36 and 180x50. Both frames showed full peer names, visible relationship labels, distinct observed/planned cards, nested boundaries, and the required footer. Escape restored the terminal and exited with status 0 at both sizes.

Final readability correction: the targeted specification re-review showed that painting compact labels beneath cards and arrowheads still corrupted Versions, Reads, and Requests at 120x36. Compact Context/Containers labels now use the interior of the nearest projected horizontal route segment that fits the action word without intersecting either endpoint card, and labels paint last over the route. The frame suite requires intact Reads, Authors, Versions, Supplies, Requests, and Returns tokens at both representative sizes. Fresh 120x36 real-terminal Context and Containers captures showed full peer/container names, intact labels, arrows, and distinct boundaries; Escape exited status 0. bun run check and git diff --check pass after the correction.

Final targeted reviews: specification PASS for the original 120x36 label/boundary readability defect and its fix; quality PASS for intact labels, non-intersection with endpoint cards, full names, same-level non-overlap, focused 5/5 viewer tests, and clean diff.

Reopened by human feedback on 2026-08-11: the accepted interaction scope and ACs remain correct, but the delivered visual language diverged too far from the OpenTUI spike. The approved correction is a minimal spike-derived visual treatment over the current MVP model and ELK world; no Task 28.2 interaction, obsolete spike architecture, or old chrome is restored.

Spike-derived visual revision: the accepted fixed world is now 763x311 layout units after increasing ELK compound padding and spacing to preserve titled representations under a 0.5 terminal-cell aspect correction. Projection keeps the core response immutable and applies the minimal representation ladder approved for this revision: current-level elements are 21x5-or-larger titled cards, the active system/container is a titled boundary, and off-level elements are hidden or compact. Observed structure uses the terminal default foreground with a subtle theme-derived tint and solid border; planned and missing remain distinct dotted theme colors. Routes use dim orthogonal line/corner glyphs, compact action labels, final arrowheads, and a green selection frame. The existing Task 28.1 header/footer remains; Task 28.2 interaction and obsolete spike chrome were not restored.

Post-reopen correction evidence: all current-level cards are constrained two cells inside their displayed ancestor boundary so their selection frames cannot merge with containment. Arrowheads paint last and the six-frame test now asserts every projected relationship endpoint plus parent-boundary clearance, intact representative labels, full card names, and same-level non-overlap at 120x36 and 180x50. The current cold simplicity review removed the unused Gherkin duplicate and private-scoped the cell-aspect constant, then passed its targeted re-review. bun run check passes architecture validation, 86/86 Node tests, and 5/5 Bun/OpenTUI tests; git diff --check passes. A fresh real OpenTUI Components session rendered readable nested boundaries, labels, selection, and incoming arrows at 120x36, resized cleanly to 180x50 from the same world, and Escape ended the terminal session.

Post-reopen targeted reviews: specification PASS for all endpoint arrows, labels, ancestor-boundary clearance, selection readability, current implementation notes, clean-host checks, and real-terminal evidence; quality PASS for the selected-arrow and containment fixes with no regression. No Task 28.2 behavior or viewer-side ELK layout was introduced.

Human approved whole-repository TypeScript scope on 2026-08-11. Runtime strategy follows current official guidance: Bun executes `.ts` CLI/viewer source directly; Node 20 uses `node --import=tsx` for Node-specific scripts and node:test; TypeScript runs strict no-emit checking with explicit `.ts` imports. This replaces the `.mjs` source rather than preserving compatibility copies.

Toolchain correction: the initial 5.9.3 choice was made before reading the TypeScript 7-specific release material and was rejected by the human. After reading the official TypeScript 7.0 announcement and native compiler guidance, the project now installs released TypeScript 7.0.2 from the standard `typescript` package; `bunx tsc --version` reports 7.0.2. The project does not use the absent 7.0 compiler API, only its `tsc` CLI.

Final TypeScript migration: replaced all Groma runtime, repository script, and automated test .mjs sources with strict .ts sources; added the minimum shared domain/world/projection/scanner types; pinned the released native TypeScript 7.0.2 compiler; and documented Bun execution for the CLI/viewer plus node --import=tsx for Node scripts and node:test. The cold simplicity review removed the rename-only viewer model-request alias and duplicate test, unused ELK type import, unused Bun global types, and inert compiler flags; its one targeted re-review passed. Final unrestricted bun run check reports TypeScript 7.0.2, validates both architecture revisions, passes 85/85 Node tests and 5/5 Bun/OpenTUI tests. A fresh tmux smoke ran bun src/cli.ts view at 120x36, resized to 180x50 with intact spike-derived cards, labels, arrows, and boundaries, then Escape restored the terminal and exited cleanly. Repository searches find no application, script, or test .mjs files or stale runtime imports; git diff --check passes. Final specification review passes all 11 ACs and 14 DoD items; final quality review passes with no findings.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-08-11 16:59
---
Reopened by human decision: Task 28.1 is not acceptable as an .mjs implementation. TypeScript source plus an explicit typecheck is now required before the task can be Done.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the accepted spike-derived fixed-world OpenTUI viewer and converted the complete Groma runtime, repository scripts, and automated tests from .mjs to strict TypeScript. The project now pins the released native TypeScript 7.0.2 compiler, runs the CLI/viewer with Bun, runs Node-specific paths through node --import=tsx, and documents that boundary without parallel JavaScript copies. Verified by unrestricted bun run check (TypeScript 7.0.2, architecture validation, 85/85 Node tests, 5/5 OpenTUI tests), clean no-.mjs and diff checks, a real 120x36 to 180x50 terminal resize/teardown smoke, mandatory simplicity PASS after cleanup, specification PASS for all 11 ACs/14 DoD items, and quality PASS with no findings.
<!-- SECTION:FINAL_SUMMARY:END -->
