---
id: TASK-510
title: Stop path-scoped middleware from blocking later routes
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 06:16'
updated_date: '2026-09-24 08:40'
labels: []
dependencies: []
references:
  - scanners-http-routes
documentation:
  - docs/scanners/javascript/index.md
  - docs/scanners/typescript/index.md
modified_files:
  - test/fixtures/typescript-http/express-server.ts.fixture
  - test-bun/typescript-http.test.ts
  - plugins/scanners/http-routes.ts
  - docs/scanners/javascript/index.md
  - test/fixtures/typescript-http/hono-routes.ts.fixture
  - test/fixtures/typescript-http/hono-server.ts.fixture
  - plugins/scanners/http-routers.ts
  - docs/scanners/typescript/index.md
ordinal: 591000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Qualifying the TypeScript scanner (TASK-504) showed that every `use` call with a path blocks that path in the shared JavaScript and TypeScript route reader. Hono `app.use('*', cors())` becomes a `*` catch-all ahead of every later route, and Express `app.use('/api', requireUser)` does the same below `/api`. Core then cannot tell which endpoint answers a request there, so 5 of the 12 Hono apps scanned during qualification gave no request-to-endpoint match. The same middleware without a path already takes no place (JavaScript scanner documentation, routing model rule 5). Hono mounts sub-apps only with `route` and `mount`, never with `use`. Express mounts routers with `use`, so a value under a path that the scan cannot see may still be a router or a static file server that answers requests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every Hono `use`, with or without a path, such as `app.use('*', cors())`, `app.use('/api/*', requireKey)` or `app.use(guard)` with a value from Hono's middleware factory, takes no place: routes registered after it keep their own endpoints and order, and no catch-all is reported for it.
- [x] #2 An Express `use` with a path takes no place when every handler after the path is a function the scan sees, such as `app.use('/api', requireUser)` with `requireUser` declared in the application's own source.
- [x] #3 An Express `use` with a path still blocks that path when a handler is a value the scan cannot see, such as `express.static('public')` or a router from a package.
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
1. Rule, in the shared JavaScript and TypeScript route reader (plugins/scanners/http-routes.ts, readMount): a `use` with a path whose handlers are all middleware takes no place, as middleware without a path already does. Hono never mounts a router with `use`, so every Hono `use` qualifies. For Express, and Koa routers whose `use` has the same shape, every handler after the path must be a function the scan sees; a value it cannot see, such as `express.static(...)` or a package router, keeps blocking its path.
2. One helper answers whether an argument is a function the scan sees, used by `middleware`, `foreignRouter` and the new rule instead of three inline checks.
3. Docs: the JavaScript routing model rules 4 and 5, which state the shared reader contract, and any TypeScript doc line about middleware under `*`.
4. Test decisions. T1 Hono, authority AC1 and the updated rule 5: `site.use('*', forward)` reports a `*` catch-all ahead of every later route; the hono-server expectation encodes the old rule, so that row goes and later positions shift. T2 Express, authority AC2: `app.use('/api', requireAuth)` blocks `/api` ahead of the talks routes; express-server covers a function alone or beside a router but not alone under a path; add that call, expected table unchanged. T3, AC3: already covered by `app.use('/static', express.static(...))` in ordered-server and the JavaScript express fixture; no new test.
5. Verify with the TypeScript, JavaScript, React and Vue HTTP suites and bun run check on a task-only commit; then the full-context review, Alex decides, Done, commit, push.

Correction after the full-context review, approved by Alex: Hono's `use` registers nothing (registers() and returnsRegistrar() in http-routers.ts), so it takes no place with or without a path and no longer counts in route order; onlyMiddleware keeps only the Express and Koa rule. MountCall states one `blocks` answer computed in readMount, replacing pathless, foreign and the decision split into mountCall, whose argument-count check had become dead. serveRoute reuses seenFunction. T1 now uses `site.use(guard)` without a path, with guard from createMiddleware in hono-routes, because a seen function could not prove the Hono rule. The TypeScript doc's blocking sentence is limited to Express.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned and approved by Alex: seenFunction (a function the scan sees) now serves foreignRouter, middleware and the new onlyMiddleware; readMount reads a path use that only adds middleware as mounting nothing (Hono always, Express and Koa when every handler is a seen function). Both test changes failed on the old code (an /api blocker ahead of the Express talks routes, a * blocker at Hono site@5) and pass now; the express.static blocker stays at ordered-server @3. A scratch app confirms: Hono app.use('*', cors()) and app.use('/api/*', requireKey) report no blocker, Express app.use('/api', requireUser) none, app.use('/static', express.static(...)) still blocks. TypeScript, JavaScript, React and Vue HTTP suites: 21 pass.

Full repository check on 5d476c40 (HEAD bc7c30e5 plus only TASK-510 changes), separate worktree with bun install --frozen-lockfile: bun run check exit 0, 723 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change.

Full-context review (a general-purpose agent with a written brief; the fork type is unavailable) found: a Hono use without a path of a local non-function value such as createMiddleware(...) still blocked the whole app (reproduced: app.use(guard) put * /:* ahead of GET /items); the Hono test could not fail, because its handler was a seen function; the TypeScript doc still said a local non-function value blocks. Alex approved the reshape. The guard fixture failed on the previous commit (site@5 * /:**!) and passes now; both scratch apps give the intended tables; TypeScript, JavaScript, React and Vue HTTP suites 21 pass; tsc and Biome clean.

Full repository check on 0834e0aa (HEAD 4a308989 plus only TASK-510 changes, after the approved reshape), separate worktree with bun install --frozen-lockfile: bun run check exit 0, 723 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A use call that only adds middleware no longer blocks the routes after it. Hono's use registers nothing, with or without a path, because Hono mounts sub-applications only with route and mount; it still returns the app for chained calls. An Express or Koa use under a path takes no place when the scan sees that every handler is a function, while a value it cannot see, such as express.static or a package router, still blocks its path. The shared route reader decides blocking once, as MountCall.blocks in readMount, and one seenFunction check serves every reader that asks whether a value is a function. Verified: the Hono guard fixture (createMiddleware value without a path) and the Express /api middleware fixture failed on the old code and pass now, the express.static blocker stays, scratch apps give the intended tables, and bun run check on a commit of HEAD plus only this task passes (723 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
