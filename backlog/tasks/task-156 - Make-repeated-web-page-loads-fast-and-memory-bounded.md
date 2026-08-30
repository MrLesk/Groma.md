---
id: TASK-156
title: Make web startup and page loads fast and memory-bounded
status: To Do
assignee: []
created_date: '2026-08-23 19:07'
updated_date: '2026-08-30 21:07'
labels: []
dependencies:
  - TASK-157
  - TASK-158
references:
  - web-viewer
  - sheet-router
  - world-layout
modified_files:
  - src/sheet/route.ts
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs `bun run cli web --port 4848` and opens or refreshes the root page, Groma becomes reachable promptly and returns the current web map. Initial sheet composition and repeated page loads must use bounded computation and memory, while watched architecture and work changes still publish the latest payload.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On the current 51-element, 55-relationship repository world, the median complete architecture-load plus sheet-composition time across five isolated runs is under 500 ms
- [ ] #2 A deterministic larger-world benchmark records complete composition time and peak RSS; doubling both elements and relationships does not exceed four times the current-world composition time or memory
- [ ] #3 After the server reports ready, the first and repeated root-page requests complete in under one second and do not trigger another architecture or work reload
- [ ] #4 Twenty sequential root-page requests do not increase server RSS by more than 20 MiB from the post-first-request baseline
- [ ] #5 Watched architecture changes publish the latest map, watched work changes publish only the latest overlay, and focused concurrent regression tests, relevant checks, and browser QA pass
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
1. Treat completed TASK-157 and TASK-158 as the stable production baseline: Backlog updates are independent and the web path has no ELK.
2. Use TASK-159 and TASK-167 evidence to choose the production router with Alex; do not inherit the isolated experiment until its visual result and dependency cost are approved.
3. Integrate only the selected minimum routing path, delete the superseded dense-grid A* implementation, and preserve semantic placement, fixed ports, containment, route clarity, and deterministic output.
4. Verify five cold complete load-plus-sheet runs under 500 ms, a deterministic doubled-world scaling benchmark, ready-server request latency and RSS, watched updates, focused and full checks, and browser QA.
5. Run the cold simplicity review and full-context architecture review, decide contextual findings with Alex, then finalize, commit, and push only TASK-156 files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research baseline (2026-08-23): base/diff audit against local main found a heavily shared dirty tree. TASK-156 starts with no recorded modified files; `src/viewers/web/server.ts` and `test-bun/web-live.test.ts` contain unrelated uncommitted work-model edits that must be preserved. Root cause 1: the fallback root branch calls `loadSheet` on every request even though startup and all three watchers already publish into `payload`; `/world.json` already reads that payload directly. Root cause 2: current-world sheet composition spends nearly all time in route A*: 51 elements, 55 relationships, 99x95-cell sheet; architecture load 478.34 ms, placement 7.77 ms, route 6477.40 ms, total 6963.53 ms, max RSS 227,983,360 bytes. The router uses a weak target-rectangle estimate even though it has enumerated concrete goal nodes; this expands avoidable lattice states in both TASK-152 passes.

Routing experiments were removed completely. An exact nearest-goal heuristic and a parallel-array heap both regressed the current-world benchmark. Pure geometry port seeding caused accepted route fixtures to time out. Temporary accepted-router instrumentation measured 129 solve calls, 19 failed concrete-pair attempts, 8,482,297 heap pushes, and 8,029,137 expansions; under concurrent host load, planning took 6.739s wall and the final pass 5.053s wall. No router implementation remains in the TASK-156 diff. Work is paused at the requested architecture decision rather than weakening TASK-152.

Architecture decision: Alex chose to preserve both weighted A* passes and optimize A* internals. The bounded obstacle-feasibility planner remains rejected and removed. The next implementation must be justified by CPU/allocation profiling and must not change TASK-152 port or route behavior.

Accepted-router CPU profile (250µs sampling, 7.24s profiled duration): `Heap.pop` is the largest single hot function at 13.9% self / 1.00s; heap push totals 11.2% including comparisons; native `Map.get` is 7.5% / 545ms; the expansion loop and its guard/cost lines dominate the remaining samples; `measure` is 8.8% across its loop lines. The router made ~8.5M heap pushes and ~8.0M expansions in the earlier counters. Source inspection ties the allocation-heavy heap cost to destructuring swaps that create a two-item array on every sift step, and the Map cost to resolving the same departure guard inside every neighbour iteration. Candidate A/B 1 is manual object swapping in the existing heap, preserving the identical `before` ordering and objects. Candidate A/B 2, only after measuring candidate 1, is hoisting the departure lookup and derived coordinates outside the four-neighbour loop. Both are local equivalent-operation changes; neither changes passes, costs, ports, or search order.

Measured A/B results: manual heap swaps plus hoisted departure invariants reduced the isolated run to 6439.71ms total / 5843.37ms sheet and retired instructions from 154.67B to 133.22B. A four-way heap reduced sheet time to 5603.06ms but was still far short. Cached node coordinates reduced sheet time to 4837.04ms. The decisive measured change precomputes the four neighbour node IDs once, preserving direction order and the same sentinel bounds result; using those IDs in both field measurement and A* reduced a clean isolated run to 2837.20ms total (497.71ms load, 2339.48ms sheet), 2.45x faster than the 6950ms baseline, with 224,395,264-byte max RSS and 48.44B retired instructions. Three further cold processes measured 2363.65ms, 2771.90ms, and 2424.11ms total (median 2424.11ms; 2.87x baseline). A rejected flat numeric heap was removed after measuring 5886.73ms total / 4759.62ms sheet, no meaningful gain over object storage. The retained heap keeps its object shape and exact f/g/state comparator; only allocation-free swaps and four-way sift geometry change its internal representation. Focused sheet/route/port/growth/isometric suites pass 59/59; the router keeps both weighted passes, the same neighbour order, costs, total priority order, ports, guards, and route points.

Verification: exact `bun run cli web --port 4848` reported ready in 3949.88ms during a loaded run. On the ready server, first `/` was 0.977ms TTFB / 1.204ms total; repeated `/` was 0.561ms / 0.645ms; `/world.json` was 0.660ms / 0.702ms. RSS was 260,336KiB after the first root and 264,336KiB after 20 more sequential roots, a 4,000KiB (3.91MiB) increase. The root HTML was 329,696 bytes and world JSON 182,977 bytes. Focused web/lifecycle tests pass 9/9; focused sheet tests pass 59/59; typecheck passes; full tests pass 93 Node + 176 viewer. `src/sheet/route.ts` is 498 lines and `git diff --check` passes. Browser QA is the only unavailable check: the installed Browser runtime returned no available browser connections after its required troubleshooting/list check, so no unrelated browser surface was substituted.

Target correction: Alex rejected 2.42 seconds as too slow for 51 elements and 55 relationships. TASK-156 now requires a sub-500 ms complete load+sheet median and explicit larger-world scaling evidence; a local loop-speed improvement alone is insufficient.

Final simplicity correction: the measured four-way heap was removed because the precomputed-neighbour change already exceeds AC1 and the binary heap is the accepted, simpler search structure. The final binary-heap build measured 2305.53ms total: 497.00ms architecture load and 1808.53ms sheet composition, 3.01x faster than the 6950ms baseline. `/usr/bin/time -l` reported 226,983,936-byte max RSS, 35.90B retired instructions, and 10.08B cycles. The final heap keeps the original comparator, binary parent/child structure, and pop order; only its destructuring swaps became direct assignments. The final focused route/port/scene rerun passes 39/39.

Revised-target baseline (2026-08-23): five isolated Bun processes on the accepted shared worktree measured complete load+sheet totals of 2277.93, 2299.16, 2283.01, 2260.49, and 2317.32 ms (median 2283.01 ms; range 2260.49–2317.32). Loader medians were 494.34 ms and sheet medians 1789.81 ms. Peak RSS range from /usr/bin/time was 212,959,232–230,391,808 bytes. The world is 51 elements, 55 relationships, and a 99x95-cell sheet. Base/diff audit confirmed a heavily shared dirty authoritative tree; TASK-156 owns only src/viewers/web/server.ts, test-bun/web-live.test.ts, and src/sheet/route.ts so far. The router currently has precomputed neighbours but binary heap indices, conflicting with the task note that the accepted retained heap was four-way; the revised plan will restore and measure the recorded accepted state before broader changes.

Ownership correction (2026-08-23): Alex disposed the previous TASK-156 agent and assigned the task to this thread. The previous plan to preserve both dense-grid A* passes and optimize their internals is abandoned. Its measurements remain historical evidence, not implementation authority. TASK-157 and TASK-158 are now required stable checkpoints before the layout-engine comparison; uncommitted router micro-optimizations will be removed rather than inherited.

Checkpoint status audit (2026-08-25): TASK-157 and TASK-158 are Done and present on origin/main. Five isolated runs on the current 51-element, 56-relationship world measured total load-plus-sheet times of 2288.86, 2248.28, 2260.14, 2220.13, and 2274.56 ms (median 2260.14 ms). Median architecture load was 45.56 ms and median sheet composition was 2211.86 ms; peak RSS ranged from 177,209,344 to 204,685,312 bytes. AC1 remains unmet. A live server on port 4861 measured first root 6.17 ms, repeated root 2.49 ms, and 5,408 KiB RSS growth across 20 sequential roots, so AC3 and AC4 performance bounds pass; TASK-157 supplies the no-reload and watched-work boundary evidence. TASK-159 and TASK-167 show that an isolated libavoid/refinement candidate can route in tens of milliseconds with deterministic output and strong clarity metrics, but it is not integrated into production and TASK-167 still awaits human visual approval. TASK-156 cannot be finalized until Alex selects the production route and the complete under-500 ms and scaling criteria pass.

Wrap-up audit (2026-08-30): no TASK-156 implementation remains uncommitted. The task is returned to To Do because the measured composition target is still unmet and the next production routing direction needs an explicit product decision; keeping it In Progress would misstate current work.
<!-- SECTION:NOTES:END -->
