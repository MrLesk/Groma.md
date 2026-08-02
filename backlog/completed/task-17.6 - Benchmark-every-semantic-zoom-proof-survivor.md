---
id: TASK-17.6
title: Benchmark every semantic-zoom proof survivor
status: Done
assignee:
  - '@codex'
created_date: '2026-07-30 16:30'
updated_date: '2026-07-31 03:32'
labels: []
dependencies:
  - TASK-17.5
references:
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
modified_files:
  - package.json
  - scripts/run-semantic-zoom-benchmark.mjs
  - src/spikes/semantic-zoom/benchmark-contract.mjs
  - src/spikes/semantic-zoom/main.jsx
  - src/spikes/semantic-zoom/proofs/g6-proof.jsx
  - src/spikes/semantic-zoom/proofs/gravity-proof.jsx
  - src/spikes/semantic-zoom/proofs/yh-ui-flow-proof.jsx
  - test/semantic-zoom-benchmark.test.mjs
  - groma/experiments/04-semantic-zoom-viewer/library-selection.md
  - groma/experiments/04-semantic-zoom-viewer/benchmark-results.json
  - groma/experiments/04-semantic-zoom-viewer/benchmark-results.md
parent_task_id: TASK-17
priority: high
type: spike
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator runs the disposable benchmark, every renderer that passed the common interaction proof is measured with the same deterministic Groma graph at exactly 500 and 1,000 components. Comparable measurements cover the first ready frame and the Context-to-Containers-to-Components level switches. Failed runs remain failures. This task produces evidence only; it does not optimize or harden candidates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every proof survivor receives identical deterministic fixtures at exactly 500 and 1,000 components, with component and relationship counts recorded.
- [x] #2 Each candidate and size uses one warm-up followed by five alternating fresh runs and reports every raw result plus median first-ready-frame and level-switch times.
- [x] #3 The benchmark asserts fixed geometry across each landmark and records browser errors, warnings, and visual evidence at every primary level.
- [x] #4 Failed runs remain visible and are not discarded, retried into success, or hidden from the median interpretation.
- [x] #5 No candidate-specific optimization, fallback, recovery, compatibility behavior, or production performance infrastructure is added.
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
1. Keep the retained deterministic TASK-17.3 benchmark fixture unchanged at 500 components / 490 relationships and 1,000 components / 990 relationships, and enumerate the 16 final live-proof candidates in canonical inventory order.
2. Add one disposable benchmark entry over the existing candidate-native public-API proof mounts; use shared instrumentation for navigation/app-start, native scene count readiness, exact native zoom/level evidence, two painted frames, fixed-geometry assertions, console capture, screenshots, and strict failure timeouts. Candidate-specific changes expose only documented native counts and viewport evidence.
3. Add a single-worker pinned-Chromium runner that gives every candidate/size one unrecorded warm-up and five recorded fresh contexts/pages, alternates canonical/reverse candidate order by round and 500→1,000 / 1,000→500 size order within rounds, never retries or forces garbage collection, and preserves every failure.
4. Record raw A initial-ready, B Context→Containers, C Containers→Components, and D cumulative switch timings, counts, geometry, browser messages, screenshots, and interaction/semantic compatibility for every run; publish medians only when all five recorded runs complete and leave failed candidate-sizes unranked.
5. Verify fixture, invariant, scheduling, failure, median, and presentation behavior with focused tests; run all 32 candidate-size benchmark cases with their required repetitions; publish the raw and median JSON/Markdown evidence; and validate with focused/full checks, browser proofs, a disposable build, task-scoped diff checks, simplicity review, specification review, and quality review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-07-31 readiness audit: TASK-17.3 defines initial render as candidate setup/load through the first native ready-to-display frame and alternated its two candidates. TASK-17.6 and the common-scale-benchmark document do not define whether Context→Containers→Components is one cumulative timing or two transition timings, which native completion signal ends each switch, or how five fresh runs alternate across 16 candidates and two sizes. Reported these material protocol ambiguities to the orchestrator before choosing or implementing. No plan or benchmark code recorded pending clarification.

Approved protocol correction: pinned Chromium at 1600×1000, one worker, same dev server, and a new browser context/page per run. A starts at navigation/app-start and ends after public/native element and relationship counts satisfy the fixture plus two requestAnimationFrame callbacks. The runner then forces/confirms Context 0.38; B measures the Containers click to native viewport/level evidence exactly 0.82 plus two frames; C measures the Components click to evidence exactly 2.15 plus two frames; D spans the Containers click through Components settled. Initial render and D are presented separately. Each endpoint times out at 15s/5s as applicable. Any recorded failure suppresses that candidate-size median and ranking; no retry or GC forcing is allowed.

Pre-measurement instrumentation correction: the first warm-up-only launch was stopped before any recorded round. Gravity evidence mistakenly called public store getters without their required ID arguments, and the generic DOM geometry probe derived transformed screen positions that were not comparable for YH UI Flow’s nested viewport. Corrected Gravity to its public toJSON collections and made the shared DOM geometry assertion compare each native node template’s stable world-coordinate/dimension evidence. Fresh 1,000-component Gravity and YH UI Flow smoke checks then reported 1,008 native elements, 990 relationships, READY/native mounted state, and all exact landmarks. The discarded launch produced no benchmark result file or timing used in the final evidence.

Second warm-up-only instrumentation correction: YH UI Flow uses documented viewport virtualization, so the visible native node-template set legitimately shrinks as the camera crosses landmarks even though its public scene remains fixed. The run was again stopped before recorded rounds. Exposed the already-created public YH instance plus its native node/edge inputs for benchmark evidence; the shared runner now reads 1,008 nodes, 990 edges, public viewport zoom, and stable native model geometry at 1,000 components without disabling virtualization or changing renderer behavior. No timing from either discarded warm-up launch is retained.

Third warm-up-only runner correction: Draw2D at 1,000 components can saturate the renderer main thread before returning public scene evidence. The first runner loop awaited an in-page evidence call without a host-side deadline, so the protocol timeout could not fire while Chromium was busy. Stopped before recorded rounds and added host-side 15s/5s deadline races plus forced page/context closure. This changes only failure recording: it does not retry, optimize, reduce, or alter Draw2D. A fresh isolated probe confirmed the browser target can be closed by the runner. No timing from the discarded launch is retained.

Measured-campaign correction before publication: validation found that the first complete 160-run output captured the Containers screenshot and geometry between B and C, so cumulative D included evidence-capture overhead instead of only the contiguous Containers→Components sequence. Moved the discarded JSON/Markdown recoverably to /tmp/groma-task-17-6-discarded-0245.{json,md}; none of its medians are retained. Changed only runner sequencing: measure B then C contiguously and end D, then revisit all three landmarks for untimed geometry/screenshots. The candidate renderers, fixture, endpoints, timeouts, and run order are unchanged. A fresh final campaign is required; this correction is not a retry of a candidate failure.

Final benchmark evidence (2026-07-31T02:54:52.906Z): Chromium 151.0.7922.34 through Playwright 1.62.0, 1600×1000 viewport, one worker, one new context/page per run, one unrecorded warm-up and five alternating fresh recorded rounds per candidate-size. All 160 scheduled recorded run IDs appear exactly once and in protocol order. 155 runs completed. Draw2D at 1,000 components failed all five initial native readiness endpoints after 15s and is the sole unranked candidate-size; Draw2D 500 and the other 30 candidate-size sets completed all five. Published 31 initial-ready and cumulative-switch medians, 465 Context/Containers/Components screenshots (67 MB at /tmp/groma-task-17-6-final-evidence), fixed native geometry evidence across all completed landmarks, and zero browser warnings/page errors. Raw A/B/C/D timings, setup/load vs native-render timing, counts, failures, compatibility, screenshots, and medians are in groma/experiments/04-semantic-zoom-viewer/benchmark-results.{json,md}. No terminal candidate was ranked and no candidate behavior was optimized or repaired.

Cold simplicity review after focused checks: the evaluator path is direct—benchmark command builds the approved schedule, a fresh page opens one existing native proof with the retained fixture, the runner reads public/native counts and zoom, measures contiguous B/C/D, then revisits landmarks for geometry/screenshots and writes raw evidence. Keeping fixture/schedule/median logic in one small contract module and the disposable runner in one file is the simplest reviewable shape; splitting candidate evidence or result presentation would add indirection, while deleting the evidence-only G6/Gravity/YH public handles would make native readiness unverifiable. No code, concept, or test was identified for deletion or collapse without losing a criterion-backed assertion. Because sub-agents were explicitly prohibited, this was a local cold reconstruction rather than a delegated review.

Verification: benchmark result invariant audit passed 160 ordered unique runs, exact 500/490 and 1000/990 counts, five runs per candidate-size, 155 complete/five visible failures, 31 ranked/one unranked summaries, every completed geometry pair true, all 465 screenshot paths present, and zero browser warnings/page errors. bun run check passed architecture validation for five revisions / 51 elements / 52 relationships and 124/124 tests. bun run test:semantic-zoom:browser passed 31/31. Disposable Vite build to /tmp/groma-task-17-6-build.EMmQGm transformed 6,224 modules and exited 0 with the already-recorded dependency-origin ProjectStorm namespace, direct-eval, and chunk-size warnings. Runner syntax, focused 4/4 benchmark tests, git diff --check, no-index whitespace checks for all five new authored/evidence files, and absent repository dist all passed. TASK-17.6 intentionally remains In Progress with all acceptance criteria and Definition of Done items unchecked; no finalization or commit was performed.

Targeted simplicity re-review (accepted findings only): deleted the 16-entry stageTestIds lookup and now resolves the sole mounted proof with the shared [data-testid$="-stage"] locator; deleted the benchmarkGeometry export/import/assertion because full deterministic fixture equality and per-run native geometry assertions already cover the invariant. No protocol, renderer evidence, result, fixture, schedule, timing, screenshot, failure, or presentation changed. Verification after deletion: runner syntax passed; focused benchmark contract tests passed 4/4; the preserved-result audit passed all 160 ordered runs, 155 completions/five Draw2D-1000 failures, 31 ranked/one unranked summaries, and 465 screenshot paths; bun run check passed architecture validation and 124/124 tests; git diff --check and new-file whitespace checks passed; removed-symbol scans were empty. A fresh Chromium audit opened every one of the 16 benchmark candidates at 500 components and confirmed the shared locator resolved exactly one visible stage on every page. TASK-17.6 remains In Progress with AC/DoD unchecked and no commit.

Finalization evidence (2026-07-31): all benchmark specification, quality, simplicity, and targeted re-reviews passed with no authority-backed blocking finding. The published exact median table remains in groma/experiments/04-semantic-zoom-viewer/benchmark-results.md and machine-readable raw evidence remains in benchmark-results.json. Across 160 scheduled recorded runs, 155 completed and all five Draw2D 1,000-component runs remained visible failures; that candidate-size is the sole unranked set. Initial-ready winners were gravity-ui-graph at both 500 (796.3 ms) and 1,000 (805.6 ms). Cumulative-switch winners were foblex-flow at both 500 (107.6 ms) and 1,000 (167 ms). Fresh final checks passed: result audit (160 unique protocol-ordered runs, 155 complete/five failed, 31 ranked/one unranked, fixed geometry for every completed landmark, zero captured benchmark browser warnings/errors, and all 465 screenshot files present), bun run check (architecture validation and 124/124 tests), semantic-zoom browser proofs (31/31), runner syntax and focused benchmark tests (4/4), disposable Vite build (6,224 modules, exit 0 with recorded dependency-origin warnings), and git diff --check. Non-blocking portability note: the 465 PNG paths under /tmp/groma-task-17-6-final-evidence are machine-local and are not portable repository artifacts; the committed-scope JSON/Markdown measurements, failure records, and paths remain the durable published benchmark record. No candidate behavior was optimized, repaired, or generalized, and no code or commit was added during finalization.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Benchmarked all 16 TASK-17.5 survivors with identical 500/490 and 1,000/990 fixtures under the approved pinned-Chromium protocol and published every raw run plus the exact median table. Of 160 recorded runs, 155 completed; all five Draw2D 1,000-component runs remained visible failures, leaving that candidate-size unranked. gravity-ui-graph won initial readiness at both sizes (796.3 ms, 805.6 ms), while foblex-flow won cumulative switching (107.6 ms, 167 ms). Verified by the result invariant audit, 124/124 repository tests, 31/31 browser proofs, 4/4 focused benchmark tests, successful 6,224-module disposable build, clean task diff checks, and passing specification, quality, simplicity, and targeted re-reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
