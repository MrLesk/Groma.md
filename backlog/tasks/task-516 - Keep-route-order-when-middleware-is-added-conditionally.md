---
id: TASK-516
title: Keep route order when middleware is added conditionally
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 10:20'
updated_date: '2026-09-24 11:01'
labels: []
dependencies: []
references:
  - scanners-http-routes
documentation:
  - docs/scanners/javascript/index.md
modified_files:
  - test/fixtures/typescript-http/express-server.ts.fixture
  - plugins/scanners/http-routers.ts
  - plugins/scanners/http-routes.ts
  - docs/scanners/javascript/index.md
ordinal: 597000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The route reader shared by the JavaScript and TypeScript scanners proves an app's registration order only when every registration of that app is written at the top level of one file. A `use` call that only adds middleware still counts as a registration. So a common guard such as `if (dev) app.use(morgan('dev'))`, or middleware added from another file, makes the whole app's order unknown: every route then shares one position, and core cannot tell that `/users/me` is tried before `/users/:id`. Middleware takes no place (JavaScript scanner documentation, routing model rule 5), so it should not decide whether the order of the routes around it is known. Found by the end-of-task review of TASK-510.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A `use` call that only adds middleware does not count in its app's registration order, wherever it is written: below `if (dev) app.use(morgan('dev'))`, `/users/me` and `/users/:id` keep distinct positions in registration order.
- [x] #2 A `use` call that mounts a router or blocks a path still counts, so a mount written where the scan cannot order it still leaves its app's order unknown.
- [x] #3 Reading an Express setting, such as `app.get('env')` in an `if` guard or `app.get('port')` in a `listen` callback, is no entry in its app's registration order.
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
1. Order after mounts are read (plugins/scanners/http-routes.ts routerEndpoints): readMount already knows when a `use` call only adds middleware, because it mounts no router and blocks nothing. Compute the registration order from the other registrations, so such a call is no entry in its registrar's order wherever it is written. routerRegistrations in http-routers.ts stops computing indices; orderIndices is exported unchanged and called by routerEndpoints; Routing, not Registrations, carries the indices.
2. Docs: JavaScript routing model rule 5 says middleware is no entry in the order; rule 2 is unchanged.
3. Test decisions. T1, authority AC1 and rules 2 and 5: `if (DEBUG) app.use(requestLogger)` makes every express-server route share position 0; the fixture has middleware only at top level; add that line, expected table unchanged. AC2 is covered by the JavaScript setup fixture, whose mounts inside a function keep one shared position; no new test.
4. Verify with the TypeScript, JavaScript, React and Vue HTTP suites and bun run check on a task-only commit; then the full-context review, Alex decides, Done, commit, push.

Correction (full-context review): AC2 is guarded by the top-level mounts in the JavaScript express.mjs and TypeScript ordered-server fixtures, whose rows would all fall to position 0 if a mount did not count; the JavaScript setup fixture cannot tell, because its app has no other entries.

Scope widened and reshape approved by Alex after the review: a route method called with fewer than two arguments, such as Express's setting read app.get('env'), registers nothing (collectRegistrations), so routeCall drops its argument-count check. The order moves to http-routes.ts: orderIndices(reading, calls) applies the takes-a-place filter itself and entryStart moves beside it, so neither is exported; Reading and Routing are defined directly. Doc rule 1 states which calls are no entry. T1 becomes if (app.get('env') === 'development') app.use(requestLogger), guarding both rules.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned: routerEndpoints reads mounts first and orders only the registrations that are entries (a route, or a mount call with children or a block); orderIndices moved out of routerRegistrations and is exported; Routing carries the indices. The express-server fixture line failed on the old code (every express-server row at position 0) and passes now; a scratch app with if (NODE_ENV) app.use(morgan('dev')) now gives /users/me position 0 and /users/:id position 1. TypeScript, JavaScript, React and Vue HTTP suites: 21 pass, including the JavaScript setup fixture whose mounts inside a function share one position (AC2); tsc and Biome clean.

Full repository check on 50ae52c8 (HEAD f6768c14 plus only TASK-516 changes), separate worktree with bun install --frozen-lockfile: bun run check exit 0, 723 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change.

Full-context review (a general-purpose agent with a written brief): keep the approach, nothing simpler works; AC1 also holds for middleware added from another file (scratch app). The AC2 evidence cited earlier was wrong: the setup fixture gives the same table whether or not a mount counts; express.mjs and ordered-server are the guards, and both pass. Found and reproduced: an Express setting read such as if (app.get('env') === 'development') app.use(morgan('dev')) still puts every route at position 0, because app.get('env') is collected as a route registration and only dropped at output. Optional reshapes proposed: order owned by http-routes.ts with the entry filter inside orderIndices, positive Reading and Routing types, and the entry exception stated in doc rule 1.

Applied: the setting-read rule, the order reshape and doc rule 1. The fixture line failed on the previous change (every express-server row at position 0, from the app.get('env') read) and passes now. Scratch apps keep /users/me at 0 and /users/:id at 1 for a plain if guard, an app.get('env') guard and app.get('port') in a listen callback. HTTP suites: 21 pass; tsc and Biome clean; http-routes.ts 419 lines, http-routers.ts 394.

Full repository check on 102faa08 (HEAD ba8c6d0e plus only TASK-516 changes, after the approved scope and reshape), separate worktree with bun install --frozen-lockfile: bun run check exit 0, 723 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An app's route order no longer becomes unknown because of a call that takes no place. The shared route reader numbers the order after mounts are read, and a use call that mounts no router and blocks nothing is no entry, so middleware added under an if or from another file leaves the other routes ranked. A route method called with fewer than two arguments, such as Express's setting read app.get('env'), registers nothing, so an if (app.get('env') === 'development') guard or app.get('port') in a listen callback keeps the order too. The order now lives beside its only caller in http-routes.ts, with the entry filter inside orderIndices. Verified: the express-server fixture guard failed on the old code (every row at position 0) and passes now, the top-level mounts in express.mjs and ordered-server keep counting, scratch apps rank /users/me before /users/:id for all three guards, and bun run check on a commit of HEAD plus only this task passes (723 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
