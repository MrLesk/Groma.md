---
id: TASK-17.5
title: Prove the Groma interaction across every eligible renderer
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 16:30'
updated_date: '2026-07-31 02:24'
labels: []
dependencies:
  - TASK-17.4
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
modified_files:
  - src/spikes/semantic-zoom/comparison-data.mjs
  - src/spikes/semantic-zoom/fixture.mjs
  - src/spikes/semantic-zoom/main.jsx
  - src/spikes/semantic-zoom/styles.css
  - test/semantic-zoom-comparison.test.mjs
parent_task_id: TASK-17
priority: high
type: spike
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator opens the disposable library comparison, all 131 renderers currently marked proof-eligible in groma/experiments/04-semantic-zoom-viewer/candidate-inventory.md are judged against the same approved Revision 04 scene: the Groma software system; Architecture workspace, Viewer, and Scanner containers; four authored Viewer components; three authored Scanner components; two people; two external systems; and the authored relationships, stable IDs, dimensions, containment, and fixed world coordinates. This includes framework-specific renderers such as React Flow as well as independent renderers. A candidate receives a live harness unless its official public API documentation already establishes a decisive limitation; React Flow always receives a live harness. Each candidate either demonstrates the fixed-world Context, Containers, and Components interaction through ordinary public APIs or remains visible with a reproduced browser/runtime failure or a cited public-API limitation. The comparison owns only disposable proof code and evidence; it does not scan source or write architecture Markdown. The proof judges the approved Revision 04 interaction rather than feature lists and adds no custom renderer, patched internals, compatibility layer, fallback, or candidate-specific hardening.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All 131 renderers marked proof-eligible in the approved inventory are judged against one shared approved seven-component scene with the same stable IDs, containment, relationships, dimensions, and fixed world coordinates; a cited decisive public-API limitation may end a candidate before a live harness, but React Flow receives a live harness.
- [x] #2 Every candidate that reaches a live harness uses its native wheel zoom and drag pan plus shared harness plus, minus, and continuous-slider controls calling its public zoom API across the same Context, Containers, and Components landmark thresholds.
- [x] #3 A passing candidate changes global visibility and emphasis at the landmarks without relayout, geometry jumps, or sudden card-size changes, with readable primary-level cards and relationships.
- [x] #4 All 131 candidates remain visible in one comparison index with either browser evidence, a reproduced runtime error, or a cited concise public-API limitation.
- [x] #5 The proofs use only normal zoom callbacks, visibility and style controls, fixed positions, and documented node templates; they add no custom SVG, Canvas, WebGL, geometry, camera, compatibility, fallback, or hardening layer.
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
1. Keep the approved 131-row proof-eligible inventory, the shared 15-element and 18-relationship Revision 04 fixture, and the Context 0.38, Containers 0.82, and Components 2.15 landmarks as the fixed comparison contract.
2. Give each inventory candidate exactly one terminal classification from official public-API evidence or an isolated mounted proof; a decisive cited API limitation may stop before a harness, while React Flow and every candidate without such a limitation retain a live attempt.
3. Retain the 16 passing candidate-specific public-API proofs, five mounted or executable runtime failures, and concise cited evidence for 110 API limitations without a cross-library adapter, custom renderer, custom relationship geometry, replacement camera, compatibility path, fallback, hardening, or production-viewer behavior.
4. Render candidate mounts directly so unexpected failures surface; keep only ProjectStorm React Diagrams inside its candidate-specific boundary for the reproduced older-React runtime failure, and keep Meta2D as a mounted public-API limitation without a generic error fallback.
5. Keep all 131 candidates independently visible in the disposable comparison with the exact 16 live-proof, 110 API-limitation, five runtime-failure, and zero pending totals, and keep the human library-selection evidence synchronized with those outcomes.
6. Use Bun 1.3.14 and bun.lock as the single reproducible package installation contract, with frozen installation and Bun-run repository checks documented in README.
7. Exercise the public interaction proofs and verify the inventory/evidence bijection, frozen Bun installation, comparison contract, full unit and browser suites, architecture validation, disposable production build, diff and authored-source whitespace integrity, then hand the parent to targeted quality re-review followed by specification, quality, and finalization review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Task-readiness correction: the first wording said every eligible renderer “receives” the scene, which could be read as requiring 131 live integrations even when official documentation already proves a required API absent. The final task distinguishes judgment against the shared scene from a live harness: a cited decisive public-API limitation is terminal evidence, while React Flow explicitly requires a live proof.

Gemma correctly reconstructed the evaluator-to-comparison flow and non-goals, but remained NOT READY because the isolated prompt did not include the full inventory and scene data. The task now names their source, exact candidate count, and scene contents; the remaining request for the complete inputs is a limitation of the no-context canary rather than unresolved product scope.

Claude independently identified the same forced-integration ambiguity and the need to state shared harness ownership of controls and fixed landmarks. Those scope-preserving corrections were accepted. Claude reported 123 candidates, but direct inventory verification found 131; the task uses the source-backed count.

2026-07-30 implementation checkpoint (uncommitted): mechanically parsed the proof-eligible inventory by canonical candidate identity and reconciled all 131 rows exactly once. Final official-source screening is 1 verified live proof (React Flow), 99 decisive public-API limitations, and 31 candidates for which no decisive limitation exists and a live harness is still required. Research ordinal mistakes after Markdown table headers were corrected by canonical-name gap/duplicate checks. Conflicting screens were resolved against pinned artifacts: RGUI remains a live-proof survivor because geometry/layout snapping is opt-in; Graph Giraffe is terminal because its Camera is not publicly exported and NodeEditor only reads camera state.

Implemented the common seven-component Revision 04 fixture/landmarks, complete comparison index/evidence presentation, and React Flow public-API proof. Browser evidence at http://127.0.0.1:5173/: 131 index entries, 0 missing evidence entries, 15 scene nodes, 18 relationships; Context/Containers/Components reached 0.38/0.82/2.15; plus changed 2.15→2.58, minus returned 2.58→2.15, slider reached 0.82; native wheel and drag pan changed the React Flow viewport; all 15 actual DOM node bounds normalized by each viewport transform were identical across all three landmarks; all seven component cards were visible at 116×65 px and the eight primary component paths had opacity 1; no console or page errors. Screenshot: /tmp/task-17-5-final-components-clean.png (not added to repository).

Verification: `npm run validate:architecture` passed (5 revisions, 51 elements, 52 relationships); `npm test` passed (110/110); `node --test test/semantic-zoom-comparison.test.mjs` passed (3/3); disposable `bunx vite build src/spikes/semantic-zoom --outDir <temporary-directory>` passed (173 modules); `git diff --check` plus no-index whitespace checks for all untracked TASK-17.5 files passed. The cold simplicity review found no blocking simplicity defect; its three simplifications were applied (removed false immutable geometry self-check, removed invariant fallbacks, inlined one-use live helper) and focused checks/browser geometry verification were rerun.

TASK-17.5 remains In Progress and acceptance criteria/DoD remain unchecked: the 31 live-proof survivors still need isolated browser harnesses before the full task can be finalized.

2026-07-31 parent synthesis and reconciliation checkpoint:
- Read TASK-17.5 and children TASK-17.5.1 through TASK-17.5.8 through the Backlog CLI. All eight direct children are Done with checked acceptance criteria and Definition of Done. TASK-17.5.3 historical Vue outcomes are intentionally superseded by corrective TASK-17.5.3.1 for vnodes and TASK-17.5.7 for Vue Network Graph; the current comparison, tests, and selection evidence use the corrective outcomes. TASK-17.5.6 final evidence records the later corrected Draw2D live proof.
- Recomputed the canonical inventory/evidence join from source: 131 inventory rows, 131 unique inventory IDs, 131 evidence rows, 131 unique evidence IDs, identical order, and exactly 16 live-proof, 110 api-limitation, five runtime-failure, and zero live-proof-required. The 16 live proofs are React Flow, AntV G6, AntV X6, Rete, Gravity UI Graph, Butterfly DAG, Vue Flow, Foblex Flow, RGUI, KGraph, React Easy Diagram, YH UI Flow, ngx-vflow, Draw2D, FlowGram, and vnodes. The five runtime failures are ProjectStorm React Diagrams, Swimlane ngx-graph, Grafloria, Vue Network Graph, and AntV F6.
- Objective reconciliation correction: `groma/experiments/04-semantic-zoom-viewer/library-selection.md` already described the corrected Vue Network Graph native-wheel runtime failure but omitted the final aggregate and Draw2D corrected outcome. Added one terminal inventory section naming all 16 live proofs, all five runtime failures, the 110 API limitations, and zero pending. No renderer, fixture, comparison data, test behavior, benchmark, or production behavior changed.
- Current UI/data/tests agree: the comparison header derives 16/110/0/5 from the evidence array; Draw2D is live proof in data, unit coverage, selectable public built-in proof, and browser coverage; Vue Network Graph is runtime-failure in data, unit coverage, mounted visible terminal evidence, real native-wheel browser coverage, and human documentation. Remaining `live-proof-required` symbols are dormant schema/presentation/test guard branches with zero evidence rows, not stale candidate outcomes.
- Fresh verification: canonical reconciliation script passed the 131-row uniqueness/order and exact-total assertions; `node --test test/semantic-zoom-comparison.test.mjs` passed 12/12; `npm test` passed 120/120; `npm run test:semantic-zoom:browser` passed 31/31, including Draw2D, Vue Network Graph, vnodes, and the expected terminal F6 and ngx-graph errors; `npm run validate:architecture` validated five revisions / 51 elements / 52 relationships; `bunx vite build src/spikes/semantic-zoom --outDir /tmp/groma-task-17-5-build.8xhssm` transformed 6,223 modules and exited 0 with only the already recorded dependency-origin ProjectStorm namespace, direct-eval, and chunk-size warnings; `git diff --check` passed; no-index whitespace checks passed for all 79 authored untracked files. The pre-existing untracked generated `src/spikes/semantic-zoom/dist/` bundles were deliberately excluded from authored-source whitespace because embedded third-party sources contain trailing spaces; they predate this synthesis, are not a task source correction, and were not modified.
- Parent remains In Progress with all acceptance criteria and Definition of Done unchecked for root cold-simplicity, specification, quality, and finalization reviews. No commit or benchmark was created.

2026-07-31 generated-output cleanup correction requested by root review: moved the disposable untracked `src/spikes/semantic-zoom/dist/` directory recoverably to `/tmp/groma-task-17-5-dist.MCRTj5/dist`; the repository path is now absent. Reran the no-index whitespace check across all 79 remaining untracked files with no exclusion and it passed. Reran the production build only to `/tmp/groma-task-17-5-final-build.53r85k`; 6,223 modules built successfully with the same recorded dependency-origin warnings, and the repository `dist` path remained absent. No ignore rule, source behavior, or committed artifact was added.

2026-07-31 final rendered comparison audit: a fresh headless Chromium visit reported `One authored scene · 7 components · 18 relationships · 131 candidates` and `16 live · 110 API limitations · 0 live proofs required · 5 runtime failure`; all 131 visible index rows counted exactly 16 live proof, 110 API limitation, five runtime failure, and zero live proof required. Selecting Draw2D showed its live-proof badge. Selecting Vue Network Graph showed its runtime-failure badge, and a real native wheel action emitted exactly `Unable to preventDefault inside passive event listener invocation.` The first audit script compared CSS-transformed uppercase text to lowercase literals; normalizing rendered text fixed the audit itself and required no repository change.

2026-07-31 targeted simplicity cleanup and authority evaluation:
- Rejected the proposal to delete syntheticComponent, componentCount, the benchmark fixture option, or benchmark relationship filtering. The triggering evidence is the completed TASK-17.3 500/1000-component benchmark contract and the user-approved upcoming TASK-17.6 benchmark work. Those tasks, not TASK-17.5, authorize this cross-task behavior. The smallest in-scope action is to preserve the existing fixture paths unchanged; deleting them would break the approved benchmark inputs and force their reintroduction. This rejection is recorded only in notes and introduces no new behavior.
- Cleanup A removed the dormant liveProofRequired helper and every live-proof-required validation, panel, badge-style, and test branch after reconciliation established all 131 rows are terminal. The visible comparison summary retains the required zero as the literal 0 live proofs required. A retained-import audit found no source import or use of @msagl/core or @msagl/renderer-webgl, so both direct dependencies and their lock entries were removed. Focused comparison tests passed 12/12; the zero-total browser check passed; pre-removal and post-removal disposable Vite builds both transformed 6,223 modules successfully.
- Cleanup B removed the broad candidate boundary from all mounts. ProjectStorm React Diagrams now has the only candidate-specific ProjectstormProofBoundary because its older-React CanvasWidget failure is the reproduced supported outcome. Meta2D no longer catches an unexpected async import or mount error and no longer converts it to runtime evidence; its normal mounted public-API scaling limitation remains visible. Focused Meta2D browser coverage passed 1/1, and a direct headless ProjectStorm audit reproduced the exact older-React console error and candidate-only runtime-failure panel.
- Fresh verification after both cleanups: exact inventory/evidence reconciliation passed with 131 unique ordered rows and 16 live-proof, 110 api-limitation, five runtime-failure, zero pending; npm test passed 120/120; the full Playwright comparison suite passed 31/31; architecture validation passed five revisions / 51 elements / 52 relationships; a fresh disposable build at /tmp/groma-task-17-5-simplicity-build.KJ6udJ transformed 6,223 modules and exited 0 with only the previously recorded dependency-origin warnings; repository dist remained absent; git diff --check and no-index whitespace checks for all 79 untracked files passed; removed-branch and removed-dependency scans were empty; retained benchmark fixture paths remained present and unchanged.
- TASK-17.5 deliberately remains In Progress with all acceptance criteria and Definition of Done items unchecked pending targeted simplicity re-review and the normal specification, quality, and finalization reviews. No commit or benchmark was created.

2026-07-31 canonical Bun package-manager quality correction:
- Authority and reason: the parent quality review reproduced a fresh-install blocker because the tracked package-lock.json described only the earlier small npm dependency set while the exact renderer proof dependencies are owned by bun.lock, and README directed evaluators through npm ci. TASK-17.5 Definition of Done requires relevant checks and a reproducible evaluator path, and the user explicitly authorized the smallest correction: make the already-required Bun 1.3.14 runtime and existing bun.lock the sole install contract. Added packageManager bun@1.3.14, changed the check script to run its existing validation and node --test commands through Bun, documented bun install --frozen-lockfile and bun run check with plural dependencies wording, and deleted stale package-lock.json. No npm legacy-peer fallback, .npmrc, dependency version change, or alternate installation path was added.
- Red/green contract evidence: before the patch, a repository assertion failed because packageManager was absent. After the patch, the same assertion confirmed packageManager bun@1.3.14, the Bun-only check script, both README commands, plural wording, bun.lock presence, and package-lock.json absence.
- Frozen install evidence: Bun 1.3.14 ran bun install --frozen-lockfile, checked 597 installs across 595 packages with no changes, and left bun.lock SHA-256 73503c14960947eb62453729ad459b1d07d473705a987d2b6fa95ac56416d1a1 unchanged. bun list resolved all exact direct dependencies recorded in package.json. A root-lock audit found exactly one lockfile, bun.lock; package-lock.json and .npmrc are absent.
- Fresh verification: bun run check passed architecture validation for five revisions / 51 elements / 52 relationships and node --test passed 120/120; an explicit bun run validate:architecture passed the same totals; bun run test:semantic-zoom:browser passed 31/31; the isolated Vite build at /tmp/groma-task-17-5-bun-quality-build.qg3yM7 transformed 6,223 modules and exited 0 with only the previously recorded dependency-origin warnings; repository dist remained absent; git diff --check passed; no-index whitespace checks passed all 79 untracked files; canonical-manager scans found no npm ci, legacy-peer, package-lock reference, or second root lockfile.
- TASK-17.5 remains In Progress with every acceptance criterion and Definition of Done item unchecked for targeted quality re-review and the remaining normal review/finalization gates. No commit or benchmark was created.

2026-07-31 final review gate: the parent reported that all required reviews pass. Cold and targeted simplicity review, specification review, and initial and targeted quality review found no remaining authority-backed blocking issue. The previously suggested checked-in React Flow browser test remains non-blocking review commentary only; it was not added as task scope and no follow-up task was created.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the 131-renderer Groma interaction comparison against the shared Revision 04 scene: 16 live proofs, 110 cited API limitations, five reproduced runtime failures, and zero pending. Verified the exact ordered inventory/evidence bijection, frozen Bun 1.3.14 install with unchanged bun.lock, 120/120 checks, 31/31 browser proofs, architecture validation, a 6,223-module disposable build, clean diff/79-file whitespace checks, absent repository dist, and passing simplicity, specification, and quality reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
