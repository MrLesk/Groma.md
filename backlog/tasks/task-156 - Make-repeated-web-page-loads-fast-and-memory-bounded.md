---
id: TASK-156
title: Make web startup and page loads fast and memory-bounded
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-23 19:07'
updated_date: '2026-09-06 13:03'
labels: []
dependencies:
  - TASK-157
  - TASK-158
references:
  - web-viewer
  - sheet-router
  - world-layout
  - scan-lifecycle
  - typescript-scanner
  - architecture-reader
  - draft
  - navigation-history
  - sheet-composition
  - sheet-routing
  - web-server
  - revision-history
  - revisions
  - architecture-model
  - render
  - commands
modified_files:
  - src/sheet/route.ts
  - src/scan-reconciler.ts
  - plugins/scanners/typescript/src/files.ts
  - test-bun/scan-refresh.test.ts
  - plugins/scanners/typescript/src/graph.ts
  - src/architecture-reader.ts
  - groma/systems/groma/containers/cli/components/draft.md
  - >-
    groma/systems/groma/containers/terminal-viewer/components/navigation-history.md
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/typescript/src/source-worker.ts
  - src/sheet/route-grid.ts
  - src/sheet/route-search.ts
  - src/sheet/route-finish.ts
  - src/sheet/route-geometry.ts
  - test-bun/sheet-route.test.ts
  - test-bun/sheet-shared-transition.test.ts
  - src/sheet/route-lanes.ts
  - test-bun/building-port-attachment.test.ts
  - package.json
  - bun.lock
  - src/sheet/route-spacing.ts
  - groma/systems/groma/containers/core/components/sheet-routing.md
  - groma/systems/groma/containers/scanner/components/typescript-scanner.md
  - src/viewers/web/map-session.ts
  - test-bun/web-live.test.ts
  - src/history/revisions.ts
  - src/core.ts
  - src/sheet/pack-paths.ts
  - src/sheet/pack.ts
  - groma/systems/groma/containers/scanner/components/pack-paths.md
  - groma/systems/groma/containers/core/components/pack-paths.md
  - groma/systems/groma/containers/core/components/sheet-composition.md
  - src/viewers/web/data.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/revision/control.ts
  - src/viewers/web/server.ts
  - src/cli.ts
  - src/viewers/web/startup/page.ts
  - test-bun/web-first-run.test.ts
  - test-bun/okf-profile-view.test.ts
  - test-bun/web-port.test.ts
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer can open the complete Groma web map in under one second. The complete OpenClaw map may show a loading spinner and must become ready within five seconds. Preserve all supported files, relationships, curated ownership, and route behavior while keeping peak memory suitable for ordinary developer computers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Complete scans preserve every supported source file and relationship; record first-scan and refresh timings for Groma, Backlog.md, and OpenClaw.
- [x] #2 The complete Groma web map is visibly ready in under 1000 ms, including startup scan, model loading, placement, routing, and browser rendering. Verify the raw Backlog.md map and record its full startup timing.
- [x] #3 First and repeated root requests finish under one second without reloading architecture or work; twenty root requests increase RSS by no more than 20 MiB.
- [x] #4 Watched updates, route safety, deterministic output, architecture ownership and Markdown meaning remain correct; focused tests and bun run check pass.
- [x] #5 The complete OpenClaw web map shows a loading spinner while preparing and is visibly ready within 5000 ms, including startup scan, model loading, placement, routing, and browser rendering, without dropping supported files or relationships.
- [ ] #6 The complete OpenClaw map uses a routing representation suitable for ordinary developer computers, without allocating the global Cartesian grid. Record peak and settled process memory, verify that completed routing retains no search workspace, and verify that repeated recomputation does not accumulate that workspace.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Measure the current Groma startup phases and remove repeated or unnecessarily sequential startup work. 2. Expose the existing preparing state immediately with a loading spinner and preserve readiness, errors, and shutdown behavior. 3. Replace the Cartesian routing representation after a bounded prototype proves complete routes, clearance, separate paths, and supported port behavior; incorporate the parallel Pro investigation when available. 4. Measure complete Groma readiness below 1000 ms and OpenClaw readiness within 5000 ms, including browser drawing, plus peak, settled, and repeated-recalculation memory. 5. Run focused checks, required reviews, the full repository check, and browser verification before finalization.

For the Groma startup slice, load and validate the revision list on the first history-menu request and cache it for the session; historical URL requests still validate before loading. Reuse the existing revision loading indicator. Notify the CLI when the HTTP listener opens so its URL is available before preparation finishes, while retaining the existing ready-map promise and shutdown lifecycle. Add the requested spinner to the existing preparing page.
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

New performance goal authorized by Alex on 2026-09-06: Groma, Backlog.md, and ../openclaw scans under 1s, plus severe web startup delay. Historical 51-element benchmarks and abandoned router experiments are superseded by this current workload. Initial isolated-copy scans including reconciliation: Groma 109/67ms, Backlog 130/93ms, OpenClaw first creation 501ms and refresh 813ms. No performance production edits yet; complete map routing remains the measured blocker.

Comparison after Alex asked to investigate the regression: current Groma contains 83 elements and 99 authored relationships; automatic dependency projection adds 262 links, total 361. Using the same measured current elements (including code line heights) and only the original 99 authored pairs routes in 364ms, placement 4ms. Babel AST inspection for diagnosis only classifies 78 of the new 262 pairs as type-only imports/exports; remaining 184 include real imports of helpers and validation scripts. Example: architecture-model -> draft comes from src/naming.ts owned by draft; architecture-model -> world-loader comes from scripts/validate-architecture.ts. Therefore source dependency evidence and C4 collaboration meaning differ. Requested user direction on keeping curated relationships authoritative versus all-dependency map. No production router edits; temporary experiments do not satisfy route checks and are not integrated.

Implemented scan-only optimizations while the map semantics question is pending: skip upsertCode when the complete Code reference array is unchanged (summary counts preserved); compile each include/exclude glob once per inventory and filter before stat; read source files concurrently while preserving sorted Map insertion and observation order. Focused scanner/evidence/refresh tests pass, including a new test proving unchanged records are not rewritten and changed symbols persist. Fresh OpenClaw scan remains close to 1s; profile architecture record loading next for reliable margin.

Verified scan target on 2026-09-06. Five fresh Bun processes for first creation and five for refresh per repository, including scanner registry, complete source collection, reconciliation writes and measured process startup, against real source trees and isolated Groma state. Full-process ranges: Groma initial 90.5–97.6ms / refresh 89.5–98.4ms; Backlog.md initial 99.8–107.7ms / refresh 100.5–110.0ms; OpenClaw initial 474.5–490.1ms / refresh 384.7–449.7ms. Benchmark data: /tmp/groma-perf-complete-results.json; driver /tmp/groma-perf-measure.py and /tmp/groma-perf-complete-process.ts. Before/after complete observation deep equality passed for Groma (210 files), Backlog.md (212), OpenClaw (3164), including scopes, placements, symbols, dependencies and diagnostics. Full bun run check passes: 106 Node tests, 316 Bun tests; existing seven complexity warnings unchanged, none in changed functions. git diff --check passes. Own specification/quality review of scan optimizations: same ordered inventory and observations, same summary counts and ownership, unchanged Markdown avoids writes, changed evidence still persists. These are behavior-preserving performance changes; no domain architecture redesign or separate review agents used. AC1 complete; overall task and persistent goal remain active because web routing and the curated-versus-raw relationship decision are unresolved. No production routing changes or semantic filtering applied.

Live-state diagnosis after checks: six stale bun src/cli.ts view processes were still watching /Users/alex/projects/groma3 (PIDs 1183,18147,54896,89737,96826,97571; ages 10h to over 1 day). lsof confirmed every cwd. They were stopped with SIGTERM. During source edits, live architecture dependencyFiles metadata disappeared and two relationship bodies gained trailing duplicate fragments, consistent with old scanners and concurrent direct writes; causation of the body damage is not proven. Removed only the exact duplicated suffixes in cli/components/draft.md and terminal-viewer/components/navigation-history.md through Groma writeDocument, after validating the combined repaired graph. No general recovery, compatibility, locking or filesystem-hardening code added. Final graph validation succeeds. The stale writers removed generated-edge metadata, so the current live graph now has 99 authored links until another current-version scan repopulates evidence; this does not itself fix automatic-map semantics. Do not claim groma web startup fixed. Remaining raw Backlog routing trials are temporary only; no renderer implementation has changed.

Additional command-level verification: ran bun /Users/alex/projects/groma3/src/cli.ts scan in isolated source copies, five fresh processes for initial creation and five for refresh. Deep equality confirms each copy produces the same complete observation as the real source repository (210 / 212 / 3164 files). Maximum command times across both modes: Groma 105.1ms, Backlog.md 115.2ms, OpenClaw 461.6ms. These copies contain the complete supported source inventory and root package.json; the earlier API benchmark additionally measured collection from the original repositories and their full Git inventories. Evidence: /tmp/groma-perf-cli-results.json, /tmp/groma-perf-cli-initial-results.json, /tmp/groma-perf-cli-evidence.ts. Further temporary routing experiments did not produce an acceptable complete graph: fixed-port Libavoid paths still shared long segments; an independent grid search exhausted available tracks before routing all 774 Backlog connections. No experimental router was integrated, no relationship was hidden, and route safety was not weakened. Web criteria remain open.

Final bounded routing checks: correct Libavoid enum objects, zero crossing/fixed-shared/port-direction/reverse penalties, unifying nudging enabled and hate-crossings disabled still exceeded 30 seconds on the unchanged 774-link Backlog graph. A second run with reusable ports and shape-connected nudging also exceeded 30 seconds. Both subprocesses terminated at their time limit; no background trial remains. No production renderer edits were made. The same material relationship-policy decision has remained unanswered across three goal turns. Scan verification is complete; the next proposed product change (curated relationships authoritative, automatic relationships for fresh scans) needs explicit direction because it conflicts with the earlier scanner-authoritative request. TASK-156 and TASK-294 remain In Progress with web delivery criteria open.

The AST usage and JavaScript-specifier correction in TASK-294 changes scanner work and graph evidence. Prior under-one-second measurements are obsolete. Current OpenClaw complete refresh takes about 1.4 seconds (1.1 seconds evidence, 0.3 seconds reconciliation). A read-only four-worker AST probe processes the same 12,798 used module specifiers in about 607 ms; two workers take about 708 ms. Continue with bounded parallel AST analysis and verify exact observation equality, then repeat full first/refresh measurements.

Bounded parallel AST analysis preserves exact complete scanner observations for Backlog.md and OpenClaw. Five fresh processes for both initial creation and refresh now pass the subsecond goal: Groma initial 184–188 ms / refresh 184–191 ms; Backlog initial 245–255 ms / refresh 249–258 ms; OpenClaw initial 946–984 ms / refresh 914–967 ms. These include process startup, complete source collection and Markdown reconciliation. Full measurements: /tmp/groma-ast-complete-results.json. Web-map routing and browser verification remain open.

Cold simplicity review found no blocking defect. Applied both recommendations: removed unused crowding/multiple-gap calculation and reduced wall attachment to fixed-guard alignment. Implementer specification review: every visible request produces one route, reciprocal aliases and evidence remain intact, grid and finishing steps leave world inputs unchanged, and live Groma ownership remains 83 elements with 218 files and 99 authored claims. Quality review: routing stays within existing sheet ownership, all changed functions pass the complexity limit, obsolete Libavoid/refinement code and dependency are removed, and local page caching invalidates on both world and work publication. The separate-process HTTP test reproduces the old 37.625 MiB root-request RSS growth and the cache reduces it to 0.015625 MiB for Groma; raw Backlog is 0 MiB with work loaded. First and repeated requests are milliseconds and generations do not change. Full check passes 106 Node and 317 Bun tests; focused cache tests verify live architecture and work updates. Browser visual verification remains blocked by the locked Mac; AC2 stays open.

Final fresh-process scan measurement found an OpenClaw initial-scan outlier at 1228 ms; its other initial runs were about 951-984 ms and refresh runs 912-986 ms. AC1 is reopened rather than treating the prior near-limit measurements as completion evidence. Investigate the measured phase before finalizing.

After the final OpenClaw timing outlier, compiler bulk requests, alternate batch distributions, more workers and Go thread limits were measured and rejected because they did not provide a useful consistent gain. A bounded batch of sixteen independent new-record writes reduces the measured OpenClaw creation phase from 303 ms to 252 ms. IDs are reserved synchronously in original scan order; all writes finish before returning. Exact full Markdown equality passes for all 3200 generated records, and 15 focused scanner/refresh/relationship tests pass. Supplemental implementer specification and quality review confirms unchanged owner selection, deterministic collision naming, draft matching, summary counts and stored evidence. Root-page cache and bounded history reads also preserve existing live/history behavior under the supported tests. No new architecture abstraction or storage contract is introduced.

Final complete scan measurements pass in five fresh processes for both initial creation and refresh. Groma initial 176.6-182.4 ms, refresh 182.5-214.9 ms; Backlog initial 241.5-247.3 ms, refresh 245.8-250.8 ms; OpenClaw initial 895.4-916.5 ms, refresh 903.5-979.2 ms. Includes process startup, complete real-source collection and Markdown reconciliation. Data: /tmp/groma-ast-complete-results.json and /tmp/groma-scan-batch-final-timings.log. Full final check passes 106 Node and 317 Bun tests; no new complexity warnings; git diff --check passes. Root-request time/memory and watched-update/route-safety criteria have objective evidence. Browser inspection is the remaining AC2 gate.

Final full-context complexity review passes with no blocking defects or material architecture recommendations. Final separate-process Groma server measurement: ready 1881 ms (including all 106 history checks), architecture load 30.9 ms, placement 5.5 ms, routing 522.1 ms; first root 1.95 ms, repeated max 0.50 ms, twenty-request RSS growth 0.219 MiB with work loaded. Raw Backlog: ready 5494 ms, load 54.6 ms, placement 121.9 ms, routing 5178.8 ms; first root 4.35 ms, repeated max 0.61 ms, zero measured RSS growth. Architecture and work generations remain unchanged across requests. Live review servers are http://localhost:4761 (Groma) and http://localhost:4762 (raw Backlog). Task remains In Progress only because the locked Mac prevents required browser verification.

Final user-requested raw Backlog reset completed: deleted only /Users/alex/projects/Backlog.md/.groma, recreated its two initialization records through Groma writers, and ran the current CLI scanner twice. First scan including process startup: 265.8 ms, created 275. Second: 269.8 ms, created 0. All 277 generated files are byte-identical to the prior raw world; AGENTS.md unchanged. Evidence: /tmp/groma-final-backlog-reset.json. Browser access was rechecked and remains blocked by the locked Mac. Fresh-map server restarted on port 4762.

Final browser verification after the Mac was unlocked: both maps opened and reloaded successfully, navigation worked, and both browser error logs were empty. Rendered SVG contains every expected route: Groma 348 (including the documented reciprocal aliases), raw Backlog 774; neither has invalid path coordinates. Browser relationship details show both supporting file-pair counts and retained authored connections. The complete current CLI command groma web --port 0, including its startup scan and watchers, reaches /ready 204 in 2356.6 ms for Groma and 6161.8 ms for Backlog; first root requests take 3.40 and 3.23 ms. Evidence: /tmp/groma-final-cli-startup.json. Rechecked the final measurement artifact: five initial and five refresh processes per repository, 218/212/3164 supported files, all scans below 1000 ms. Full check remains 106 Node plus 317 Bun tests passed; no code changed during browser verification. All required review gates and criteria now pass.

Reopened after explicit user correction: full OpenClaw web readiness under one second is required. Prior results prove subsecond scans only; the earlier completion did not meet this clarified end-to-end target.

OpenClaw baseline: 3200 elements and 12737 relationships; initial scan 1209.8 ms, full model load 1398.3 ms, placement did not finish during the multi-minute diagnostic. Its Cartesian router would allocate 576131588 nodes (estimated 24.7 GiB); that allocation was measured without creating it. Applied exact-result optimizations: prefilter authored relations for move eligibility (full world load 552.8 ms, deep equality); index cached obstacle polygons for port selection (80-120 ms versus 8578 ms, exact equality for all ports); cache and spatially index clear placement paths (OpenClaw 181-221 ms, matching the intermediate cached baseline; Groma and Backlog placements match original output exactly). Changed core.ts, route-geometry.ts, pack.ts and new pack-paths.ts with immediate file/reference tracking. All 28 focused model, authoring, port, placement and routing tests pass; four changed files pass Biome lint. Full check, final end-to-end timing and the new routing representation remain unfinished.

Current revision verification: bun run check passes outside the filesystem sandbox (106 Node tests and 317 Bun tests, typecheck and lint; no new complexity warnings). The sandboxed run could not start a macOS FSEvents stream; the unchanged complete suite passes with normal watcher access. git diff --check passes. Implementer review confirms the four retained performance changes preserve the existing calculations: authored-only eligibility filtering, exact polygon port tests after spatial candidate selection, the same placement candidates and tie order, and cached clear paths invalidated only when a newly placed rectangle intersects them. No new routing prototype is integrated. A temporary vertical free-space decomposition creates 8314 cells and 22954 directed links in 11 ms for OpenClaw, and a landmark-guided search finds corridors for all 12737 requests in about 458 ms. However, its polyline reconstruction shares segments and does not satisfy the routing contract, so these are diagnostic timings only. The production Cartesian router remains the unresolved blocker; full OpenClaw browser readiness under 1000 ms is NOT achieved. AC1, AC2, AC4, AC5 and overall task completion remain open pending complete end-to-end evidence.

Alex explicitly requires the map to run on ordinary computers and rejects the estimated 25 GiB routing workspace. Source inspection: RouteSearch and its grid/search arrays are local to routeAll; the returned Route objects contain copied coordinates and do not reference the search workspace. That workspace is eligible for garbage collection after routeAll returns, but collection timing and return of memory to the operating system are not guaranteed. Each map recomputation currently allocates a new workspace, so peak memory remains a blocker even if settled memory falls. The 24.7 GiB figure is an allocation-size estimate, not an observed allocation or a measured retained-memory leak. Memory verification is now an explicit acceptance criterion alongside full startup latency.

Alex revised the latency target: a loading spinner for 3–5 seconds is acceptable on OpenClaw; Groma must open in under one second. This replaces the prior subsecond OpenClaw requirement. All supported data and the ordinary-computer memory requirement remain in scope. Pro is independently investigating routing; this agent is working on startup and loading behavior while that investigation runs.

User-requested committed baseline: created detached worktree /private/tmp/groma-before-c1b9b4b at c1b9b4b43f33d8a12f6d7fecb267d4640aeac3dd and installed its frozen lockfile offline. Three fresh exact CLI web --port 0 processes per version, measured through /ready 204. Committed: 4304.29, 3000.42, 2956.02 ms (median 3000.42), 82 elements, 209 code files, 99 relationships/routes. Current before the new startup slice: 2754.81, 2629.13, 3965.71 ms (median 2754.81), 83 elements, 219 code files, 363 relationships and 348 rendered reciprocal-aware routes. Peak child-process RSS: committed 436.72–437.91 MiB; current 426.17–438.78 MiB. Browser painting is excluded. Current third run had routing 1649 ms versus 522–524 ms in the first two; retained as observed variability, not discarded. Data and driver: /tmp/groma-before-after-startup.json and /tmp/groma-before-after-startup.py. The comparison is not equal graph size; no claim that it isolates the router alone. Startup-slice changes have not yet been applied.

While completing TASK-295, the full check exposed stale startup tests from this task: history is now requested through /revisions.json and successful CLI startup reports through onListening. Updated web-first-run, okf-profile-view, web-live and web-port tests to use those existing interfaces, preserving their assertions. All 20 affected tests pass with local server and file-watch access. These changes do not alter the current product behavior; TASK-156 remains open for its outstanding end-to-end performance objective.

Final isolated delivery passes all 428 tests. CLI launch through complete browser paint: Groma 591.57 ms, Backlog 723.29 ms, OpenClaw 4591.89 ms. All 3200 OpenClaw elements and 220 current-rule relationships render. Twenty warm Groma root requests take 0.42–0.92 ms with zero sampled RSS growth (426928 KiB before and after). User-requested loading spinner and heading are centered and visually verified using the actual setup renderer. OpenClaw peak process-tree RSS is 3.50 GiB and settled parent RSS 3.05 GiB. The Cartesian grid remains; AC6 and broader memory-reduction work stay open. These results use the callback-only relationship set accepted by Alex, not a dense full call graph.
<!-- SECTION:NOTES:END -->
