---
id: TASK-487
title: Qualify and improve the JavaScript scanner on public repositories
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-22 21:29'
updated_date: '2026-09-22 21:59'
labels: []
dependencies: []
references:
  - javascript-src-index
  - scanners-typescript-outline
  - scanners-http-routes
  - scanners-projects
modified_files:
  - test-bun/javascript-scanner.test.ts
  - plugins/scanners/javascript/src/declarations.ts
  - plugins/scanners/javascript/src/outline.ts
  - plugins/scanners/typescript-outline.ts
  - plugins/scanners/javascript/src/evidence.ts
  - test-bun/javascript-http.test.ts
  - plugins/scanners/http-routes.ts
  - plugins/scanners/http-clients.ts
  - test-bun/execution-evidence.test.ts
  - plugins/scanners/entry-points/javascript.ts
  - plugins/scanners/javascript/src/sources.ts
  - docs/scanners/javascript/index.md
  - docs/scanners/react/index.md
  - docs/scanners/typescript/index.md
  - docs/scanners/vue/index.md
  - test-bun/vue-http.test.ts
ordinal: 568000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex requested a repository-by-repository JavaScript scanner exercise after the Rust pass. Scan diverse public JavaScript projects for real source, entry-point, HTTP, and lifecycle edge cases; fix verified scanner failures while keeping C4 interpretation in language-neutral Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public JavaScript repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported JavaScript scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [ ] #3 The complete repository check passes after the JavaScript scanner changes.
- [x] #4 Temporary repository clones are removed after JavaScript qualification and the results are reported to Alex before work starts on another scanner.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ask ten read-only agents to clone and pin ten distinct public JavaScript repositories under separate /private/tmp/groma-javascript-487 paths. Each runs the local JavaScript scanner, records source-backed observations, and reports reproducible gaps without editing the shared checkout. 2. Compare each finding with the documented JavaScript evidence contract and existing tests. Fix verified scanner defects in their owning JavaScript domain; keep C4 interpretation in language-neutral core. Record each test rule, wrong result, and coverage gap before adding a regression. 3. Re-scan affected repositories, run focused and full checks, review for minimal design and clear ownership, remove all task-owned temporary clones, report results to Alex, and pause before another scanner.

Regression decisions from pinned scans: Express chain-assigns a declared function to module.exports but its outline marks it private; the existing fixture covers only direct CommonJS assignments, so add one chain case that would fail before the fix. node-fetch and Koa call functions inside accessors, but JavaScript evidence attributes those calls to module work; existing source tests omit accessor calls, so add one ownership assertion while keeping accessors outside duplicate comparison. Axios creates distinct callback-local apps named app, but shared router order gives them the same identity; current fixture uses only distinct names, so add a two-instance case that proves the identity split. ESLint runs multiple literal node commands in one package script and only the first gets an execution entry; existing entry tests cover one command, so add one chained-command case. ESLint and Koa show private Node CommonJS helpers marked public when .js has require but no export, and Koa main directly exports a named class expression omitted from its outline; test these two source-backed visibility gaps. Fastify imports fetch from undici, which is a supported fetch-style API but unrecognized today; add a focused request case if the official import contract confirms it.

Webpack recheck after ignoring banner length still inventories four one-line compact schema validators whose code is 448-486 characters. The 500-character rule misses them, while lowering the global threshold would wrongly omit authored long-literal examples. Narrow the regression to a banner followed by one compact 400-499-character code line, and keep the ordinary threshold for other source.

Axios has a real axios.postForm call in a pinned smoke test with no request fact. Official Axios documentation defines postForm, putForm and patchForm as POST, PUT and PATCH aliases; the current HTTP test covers only ordinary method names. Add one focused form-helper case to detect the missing method/path facts, then extend the shared Axios client reader without C4 policy.

The full suite exposed an existing Vue fixture that explicitly expected a named Undici fetch to be ignored. That expectation now conflicts with the confirmed shared fetch behavior. Update that fixture to expect its GET request and derived row; the concrete wrong result is a missing request/row, and this is the existing coverage gap for Vue.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ten pinned public JavaScript scans completed read-only: Express 9a34acf03cb818ff3f8bc40e44176e277a25cbb9 (141 files; chained CommonJS publication defect; local framework import limit); Fastify 4a3e325483a06d5fb7773c6804407752a4507c1b (263 files; 344 requests; Undici fetch limit; local factory/plugin limit); Koa 824c1cf8de9a91a2941973b25dc8a3d3029b9e4f (82 files; named exported class omitted; accessor ownership and Node module visibility gaps); Axios 5fc40e1c7478d342ec64c4e865ed4cd1a334207c (216 files; 128 requests; distinct same-named apps share order identity); node-fetch 8b3320d2a7c07bce4afc6b2bf6c3bbddda85b01f (23 files; 4 requests; accessor calls attributed to module); jQuery 5f8ed05417525bacc6a597a334a64835e2f9985b (222 files; 60 requests; local-import jQuery identity limit, no confirmed defect); Lodash 2b5e6f7399a7b48005140b5d5c6bc6c0e62919a8 (27 files; UMD/IIFE outline limit, no confirmed defect); ESLint 3d2e7cedb7409d8a2c5f2c2fafb14fa22790e40e (1456 files; CommonJS visibility and chained package command gaps; parse warnings only in invalid fixtures); Webpack 7e6cb673ac280552cf97ecb0b207408c96b9eb30 (15226 files; 22 compact generated schema files included due header-biased average; CommonJS visibility limit); Commander ba6d13ddb4243e5913367734f8c159089ffe7834 (168 files; documented entry and source limits, no confirmed defect). All raw observations and clones remain under /private/tmp/groma-javascript-487* until root cleanup.

Focused JavaScript tests passed (24 tests, 96 assertions). Axios re-scan now reports 130 requests, including two postForm smoke-test facts, up from 128. Full check reached tests but failed on two Vue expectations made obsolete by shared Undici recognition, plus one unrelated in-progress route-spacing test from another task; fix the Vue expectations and recheck.

Cold simplicity review after focused checks: no material deletion or consolidation; source selection, evidence, HTTP readers, outline, and entries remain owned by their existing domains. Implementer specification review: all ten pinned scans are classified; each documented failure has a focused regression, and source-backed re-scans confirm Express, Koa, Axios, ESLint, Fastify, and Webpack improvements. Implementer quality review: changed flow runs from JavaScript source discovery to per-file parse/evidence/HTTP, then shared entry extraction; outline is a separate read path; all C4 interpretation remains in core. The new tests fail for missing facts/ownership/visibility and tolerate harmless wording changes. Remaining inter-file factory, IIFE, raw transport, and dynamic wiring limits are stated in scanner documentation or the scan scope diagnostic; no unapproved cross-file model was added.

All 24 focused JavaScript tests and all three Vue HTTP tests pass; full check after the Vue expectation update passed 693 tests with 43 skipped and failed only in test-bun/route-crossings.test.ts, an unrelated active routing change outside TASK-487 files. Both required review agents completed: cold simplicity and full-context complexity found no material simplification or ownership issue. All /private/tmp/groma-javascript-487* scan clones and artifacts were removed and absence verified. The full repository gate remains pending until the routing task makes the shared checkout green.

Scanner report delivered to Alex after ten pinned repository scans, source-backed fixes, focused verification, and clone cleanup. TASK-487 remains In Progress: the repository check gate has one reproducible failure in unrelated active route-crossing work. No commit or push was made before Done confirmation.

Alex asked to commit and push TASK-487 while the shared route-crossing test still fails. Rechecked task scope against TASK-491, TASK-492 and TASK-482 modified-file lists: no overlap. Final focused tests pass (27 tests, 106 assertions); git diff --check passes. Keeping the task In Progress and AC3 unchecked until bun run check succeeds; commit and push contain only TASK-487 files.
<!-- SECTION:NOTES:END -->
