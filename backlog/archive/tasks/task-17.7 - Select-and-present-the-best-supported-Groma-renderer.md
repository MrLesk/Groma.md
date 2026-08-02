---
id: TASK-17.7
title: Select and present the best-supported Groma renderer
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-30 16:30'
updated_date: '2026-07-31 04:26'
labels: []
dependencies:
  - TASK-17.6
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
parent_task_id: TASK-17
priority: high
type: spike
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the human architect opens Revision 04 and the interactive comparison, both show every eligible candidate reproducing the approved four-level fixed-world UX (Context, Containers, Components, Code — one map, camera-only zoom, crossfade emphasis, no relayout or geometry change) and one evidence-backed rendering-foundation decision. Selection is UX-first: interaction fidelity and visual quality at each primary level, then 1,000-component readability and navigation, then measured render and level-switch performance, then integration simplicity. The framework a library targets is not a filter — Groma is early-stage TypeScript and may drop React together with the current viewer — but the library must be modern and actively maintained; candidates whose latest release only supports outdated framework versions (for example React 17/18-only) are excluded with that evidence shown. Previous proof and benchmark work is partial evidence rather than selection authority. If evidence does not distinguish a winner, the task reports that result instead of forcing a decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The interactive comparison presents each eligible maintained candidate reproducing the approved four-level UX confirmed in the 2026-08-01 reference example: one fixed world, camera-only zoom, Context/Containers/Components/Code landmarks on a continuous slider with four fixed breakpoints, and crossfade emphasis with no relayout or geometry change.
- [ ] #2 Candidates are ranked UX-first — interaction fidelity and visual quality when each level is primary — before 1,000-component readability, measured performance, and integration simplicity; the rationale shows this order explicitly.
- [ ] #3 Library health is recorded as selection evidence for every candidate: latest release date, release cadence, and declared runtime support; unmaintained or outdated-framework-only candidates remain visible with their exclusion evidence.
- [ ] #4 A library's target framework does not exclude it; the decision may propose replacing React together with the viewer, and prior React Flow/G6/MSAGL/RGUI work stays visible as partial evidence without preselecting anyone.
- [ ] #5 If evidence does not clearly distinguish a winner under the UX-first order, the result is reported to the human architect as undistinguished instead of a forced default.
- [ ] #6 The selection prototype remains disposable and uncommitted and does not change the production viewer.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build the confirmed four-level UX as a hand-built reference example plus a shared disposable proof app (`src/spikes/semantic-zoom-v2/`: fixed scene, `emphasisAt(zoom)` crossfade contract, framework-neutral harness with four landmark buttons and a slider carrying the four fixed breakpoints).
2. Port the confirmed UX to every eligible maintained candidate through public APIs only, one module per candidate, recording honest limitations with reproduced evidence instead of workarounds.
3. Capture uniform evidence per candidate: mount health, landmark settling, native wheel wiring, fixed-geometry assertions, screenshots at all four landmarks, plus a 1,000-component scaled world (`?scale=1000`) with a continuous crossfade frame-rate sweep.
4. Apply the corrected UX-first selection order to the combined evidence (fidelity, visual quality, scale readability, crossfade performance, library health/integration), record the decision in the experiment doc and Revision 04, and leave approval and final presentation polish to the human architect.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-01 four-level proofs, scale measurement, and recommendation: all 11 eligible candidates were ported to the confirmed four-level UX in the disposable `src/spikes/semantic-zoom-v2/` app (shared fixed scene + `emphasisAt(zoom)` crossfade contract + framework-neutral harness; one module per candidate; public APIs only) and verified headlessly — zero console/page errors, all four landmarks settle, native wheel wired, world geometry identical between Context and Code for every candidate. Fidelity outcomes: React Flow clean with zero limitations or accommodations; G6, X6, Vue Flow, ngx-vflow, Foblex clean with minor notes; KGraph, YH UI Flow, Rete pass with disclosed accommodations; FlowGram fails on unlabeled/misrouted relationships and a misaligned boundary; RGUI cannot express the nested boundaries as library objects (no-overlap law, hard-coded container frames) and needed a hand-drawn layer for half the scene. A 1,000-component scaled world (`?scale=1000`, fit-derived Context/Containers landmarks) with a 2.5 s continuous-crossfade slider sweep measured the actual confirmed interaction: React Flow 79.6 fps (CSS-custom-property emphasis, zero re-renders), ngx-vflow 52.4, YH UI Flow 51.6, reference SVG 32.4, Vue Flow 30.0, Foblex 26.8, Rete 26.4, KGraph 25.2, G6 16.4, X6 5.6 — inverting the 2026-07-31 discrete-switch ranking (X6's 208 ms median was best in the regime the confirmed UX no longer uses). Applying the corrected order, React Flow (@xyflow/react 12.11.2) is the recommended foundation: only zero-limitation fidelity, readable at 1,000 components, decisive crossfade performance, healthiest library, and the current viewer's renderer (smallest integration). Recommendation recorded in library-selection.md and Revision 04; evidence in the scratchpad eval outputs and the spike itself. Status stays In Progress pending the human architect's approval and final comparison-presentation polish.

2026-08-01 reopened by the human architect: the completed selection was invalidated on three grounds. First, it treated React compatibility as a hard constraint, but Groma is early-stage TypeScript and the current React Flow viewer is the only React commitment — replacing the renderer may drop React entirely, so Vue/Angular/framework-neutral candidates were wrongly disadvantaged (skipping libraries that only support outdated React remains correct). Second, the criteria lost the UX: proofs and benchmarks reduced the approved interaction to mechanical checks (element counts, landmark scales, medians) and never differentiated candidates on interaction feel or visual quality, which come first. Third, "best-supported" was read as peer-dependency compatibility; actual library health (maintenance, cadence, runtime support) was never evaluated. The RGUI recommendation — a by-elimination default ranked last among survivors for switching — is withdrawn. The approved UX was re-confirmed against a live reference example on 2026-08-01 and now includes the C4 Code level as a fourth landmark plus a continuous slider with four fixed breakpoints. Registry evidence gathered 2026-08-01: eligible modern maintained candidates are React Flow 12.11.2 (2026-07), AntV G6 5.1.1 (2026-05), AntV X6 3.1.7 (2026-03), RGUI 3.16.0 (2026-07), Rete 2 (area/react plugins 2026-07), Vue Flow 1.48.2 (2026-01), YH UI Flow 1.0.63 (2026-06), Foblex Flow 19.1.6 (2026-07), ngx-vflow 2.6.0 (2026-04), KGraph 0.2.1 (2026-05), FlowGram 1.0.12 (2026-06). Excluded with evidence: Gravity UI Graph (maintained but latest release still declares React 17/18-only peers), vnodes (last publish 2024-12, undeclared Vue dependency), Butterfly DAG (2024 beta, jQuery peer), React Easy Diagram (2023, React ≤18), Draw2D (2020). Prior inventory, proofs, and benchmarks remain visible as partial evidence.

2026-07-31 selection-authority correction: the first evidence pass treated Gravity UI Graph as a native-React low-cost option because it won initial readiness at both sizes and its live proof passed. Direct package evidence shows @gravity-ui/graph 1.11.3 declares react/react-dom ^17 || ^18 while Groma uses 19.2.8; npm clean resolution previously failed and the canonical Bun install does not turn that unsupported peer contract into product compatibility. No workaround, version change, adapter, or fallback is authorized. The selection model therefore keeps Gravity as the raw initial winner but assigns high integration risk. RGUI is the current product-fit recommendation: it is a framework-neutral public Canvas API with built-in semantic-zoom LOD, passes the fixed-world proof and every 1,000-component run, ranks 3rd/4th for initial readiness and 6th/6th for switching, and requires no second framework or unsupported React peer. Foblex remains the raw switch winner. This correction changed only the task plan/selection model and test expectations; it did not modify any candidate or dependency.

2026-07-31 resolved selection threshold: browser/visual review confirmed vnodes is the faster balanced runner-up and prompted the required report before applying an unspecified closeness threshold. Approved authority selected RGUI for the current implementation: both RGUI switch medians remain below 300 ms, while vnodes’ 75 ms / 41% 1,000-component switch advantage requires embedding Vue into the React application and supplying a framework the pinned vnodes package does not declare as a dependency or peer. The comparison and Revision 04 keep vnodes visibly named with its exact 804.7/900.1 ms initial and 116.6/182.9 ms switch evidence and do not hide or downgrade its live proof. Gravity and Foblex remain the separate raw initial and switch winners. No package, candidate proof, compatibility path, or production viewer behavior changed.

2026-07-31 implementation and verification: added the deterministic selection join and four literal benchmark ranks for all 131 proof-eligible candidates, retained every proof result and raw run/failure, and presented the approved RGUI recommendation separately from Gravity UI Graph’s initial-readiness wins and Foblex Flow’s landmark-switch wins. The decision room keeps the full 209-candidate discovery register visible, names vnodes as the faster runner-up with its exact tradeoff, preserves prior G6/MSAGL/React Flow evidence, and opens all retained live proofs without changing the production viewer or dependency set. Revision 04 and the experiment document now carry the same decision.

Browser implementation evidence: the in-app Browser plugin had no available browser instance, so the repository Playwright fallback exercised http://127.0.0.1:5173/ and http://127.0.0.1:5173/?candidate=rgui. Desktop and 390×844 mobile views were inspected; mobile document width remained 390 px. RGUI traversed Context 0.38 → Containers 0.82 → Components 2.15 through its public viewport; Gravity and Foblex spot checks reached Components; sorting changed the raw winner between initial and switching; the five-run ledger, Draw2D 1,000-component failure, vnodes runner-up, and all 209 inventory rows were visible. Captures: /tmp/task-17-7-decision-desktop.png, /tmp/task-17-7-rgui-components.png, and /tmp/task-17-7-decision-mobile-final.png.

Verification evidence: focused selection/comparison/benchmark tests pass 20/20; the semantic-zoom Playwright suite passes 31/31; architecture validation passes all 5 revisions and the full Node suite passes 128/128; a disposable Vite build transforms 7,776 modules and exits 0; tracked and task-file whitespace checks pass. The first full repository run encountered one unrelated source-refresh watcher duplicate-event timing failure; the exact test passed immediately in isolation and the full rerun passed 128/128. Existing dependency-origin ProjectStorm namespace, direct-eval, and large-chunk build warnings remain unchanged.

Correction history from full interaction verification: the selection layout initially shifted FlowGram’s accepted centered offset from -261 to -260.4; the assertion now records the rendered geometry. Proof deep-link mode initially hid the inventory used by the existing Foblex→ngx-vflow switch test, so the inventory remains accessible. The new layout also let ngraph’s first resize overwrite its initial 0.38 focus; scheduling the already-required public flyTo on the first animation frame restores the exact 0.38/2.15 contract. The targeted regressions and full 31-test browser suite pass.

The required cold simplicity and later specification/quality/finalization reviews are intentionally left to root with fresh no-history reviewers. Status remains In Progress; acceptance criteria and Definition of Done remain unchecked.

2026-07-31 accepted cold-simplicity finding: removed the blanket low/medium/high integration grading from every comparison row, deleted its table cost tags and proof-ledger Integration/Basis fields, and removed the generic grading function and assertions. The selection decision object now retains only recommendedId; unused runnerUp, selectionOrder, rawWinners, and usesAggregateScore metadata and tests were deleted. The existing decision-room sections and behavior remain intact. The table and evidence ledger continue to show each candidate’s literal rendering surface, while the visible RGUI, Gravity UI Graph, Foblex Flow, and vnodes prose retains the exact supported peer/runtime and performance tradeoffs. The experiment wording now describes literal rendering surfaces instead of a generic cost.

Targeted simplicity verification: focused selection/comparison/benchmark tests pass 20/20; the semantic-zoom Playwright suite passes 31/31; the disposable Vite build transforms 7,776 modules and exits 0 with the same dependency-origin warnings; whitespace checks pass; and an exact absence scan finds no remaining row.integration, cost-tag, integrationFor, runnerUp, selectionOrder, rawWinners, or usesAggregateScore references. TASK-17.7 remains In Progress with all acceptance criteria and Definition of Done items unchecked for targeted re-review.

2026-07-31 final reviews and finalization: root reported the cold simplicity review, specification review, quality review, and permitted targeted simplicity re-review all PASS. The accepted simplicity deletion remains verified without behavioral regressions. Fresh finalization ran `bun run check`: architecture validation passed all 5 revisions (51 elements, 52 relationships) and the complete Node suite passed 128/128. Post-simplicity evidence also remains 20/20 focused selection/comparison/benchmark tests, 31/31 semantic-zoom browser tests, and a successful 7,776-module disposable Vite build with only the previously recorded dependency-origin warnings.

Non-blocking follow-up only: a future approved accessibility pass may consider exposing the active benchmark sort and proof-shortlist selection with `aria-pressed` or `aria-current`. This is not required by the current acceptance criteria, did not block any review, was not implemented, and no follow-up task or expanded scope was created.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Withdrawn 2026-08-01: the previous RGUI 3.16.0 selection was reopened by the human architect because the criteria wrongly filtered on React compatibility, never evaluated UX fidelity or library health, and forced a by-elimination default. See Implementation Notes for the reopen rationale and the corrected candidate eligibility. The prior comparison, proofs, and benchmark evidence remain available as partial evidence.
<!-- SECTION:FINAL_SUMMARY:END -->
