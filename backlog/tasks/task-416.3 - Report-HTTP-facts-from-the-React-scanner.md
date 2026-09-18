---
id: TASK-416.3
title: Report HTTP facts from the React scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 15:03'
labels: []
dependencies: []
references:
  - scanners-projects
  - angular-src-index
  - react-src-index
  - src-http-requests
modified_files:
  - plugins/scanners/http-url.ts
  - plugins/scanners/http-values.ts
  - plugins/scanners/angular/src/http.ts
  - test/fixtures/angular-http/talk.service.ts.fixture
  - test-bun/angular-http.test.ts
  - docs/scanners/angular/index.md
  - plugins/scanners/react/src/http.ts
  - plugins/scanners/react/src/scan.ts
  - test/fixtures/react-http/package.json
  - test/fixtures/react-http/tsconfig.json
  - test/fixtures/react-http/env.d.ts.fixture
  - test/fixtures/react-http/talks.tsx.fixture
  - test/fixtures/react-http/drafts.tsx.fixture
  - test/fixtures/react-http/shadow.tsx.fixture
  - test-bun/react-http.test.ts
  - docs/scanners/react/index.md
  - plugins/scanners/react/src/routes.ts
  - test/fixtures/react-http/app/api/talks/route.ts.fixture
  - 'test/fixtures/react-http/app/api/talks/[id]/route.ts.fixture'
  - test/fixtures/react-http/app/api/(admin)/audit/route.ts.fixture
  - 'test/fixtures/react-http/pages/api/speakers/[id].ts.fixture'
  - test/fixtures/react-http/middleware.ts.fixture
  - plugins/scanners/typescript/src/http-paths.ts
  - plugins/scanners/typescript/src/http-values.ts
parent_task_id: TASK-416
type: feature
ordinal: 474000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The React scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. React applications built with Next.js declare server endpoints by file location.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The React scanner reports Next.js route handlers and API routes as endpoints, and fetch and axios requests in the files it reads.
- [x] #2 Only literal routes and URLs become facts, including class-level prefixes, route groups and constants assigned once; anything computed is reported as unresolved.
- [x] #3 Independent fixtures cover each supported API and the unresolved cases.
- [x] #4 The scanner documentation lists the supported HTTP APIs and their limits.
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
1. Extract the producer halves the TypeScript-family scanners share: plugins/scanners/http-url.ts (compiler-free: UrlPart, path text, HOLE as a NUL escape, requestSegment, segmentsOf, afterAuthority, requestUrl) and plugins/scanners/http-values.ts (declarationOf, constantValue, referenceRoot, unseenValue, referenceParts, urlParts, methodName) over a small structural compiler interface, as typescript-outline.ts does, since the repository's own typescript package is the 7.x SDK. Both modules note that the TypeScript scanner keeps its own copy because it uses the native SDK, and both copies carry paired change-both-together comments.
2. Settle the four divergences the review found, following the contract and the stricter side: the hole marker is a NUL escape; a constant is a const variable or an object-literal property, never a class field, so Angular's readonly base becomes a leading unknown segment; a root whose only declaration is ambient, such as a .d.ts declare or process.env, is configured, as the contract's 'cannot see the value' rule says; import.meta.env has no resolvable root and is configured too. Angular's reader keeps only its recognition and uses the shared halves; its fixture, test and page follow the settled rules.
3. React producer plugins/scanners/react/src/http.ts: fetch(url, init) with a literal method or GET, and axios plus an axios.create({ baseURL }) instance through get, post, put, patch, delete, head, options, request(config) and axios(config), each recognized by resolving the callee or receiver, so a same-named method on another object is never a request. Requests are reported at the enclosing operation through the existing evidence operation map, and the observation reports httpRequests.
4. Fixture test/fixtures/react-http with a TSX source per supported call and per abstention (a local fetch, a non-client get, a computed method, a host base, a configured base, a dynamic and a partly computed segment, a parameter base, a helper), and test-bun/react-http.test.ts asserting the built package's facts and one derived row through core.
5. docs/scanners/react/index.md: the supported clients, their limits and the six producer decisions in order.
6. Isolated bun run check, React and Angular builds, specification and quality self-review.
Open question for the coordinator: AC #1 also requires Next.js route handlers and API routes as endpoints, while the current instruction says React is a client only. The React scanner reads only TSX sources of projects that depend on react, so file-location endpoints in route.ts files would first need the scanner to read and own .ts files. Reported before implementing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Extraction: plugins/scanners/http-url.ts holds the compiler-free half (UrlPart, path text, a NUL hole marker, request segments, the query cut, the authority cut and requestUrl) and plugins/scanners/http-values.ts the compiler-dependent half (declarationOf, constantValue, referenceRoot, unseenValue, referenceParts, urlParts, methodName, constantOf) over a small structural UrlCompiler interface, since the repository's own typescript package is the 7.x SDK; each framework scanner passes the classic compiler it bundles. Both modules state that the TypeScript scanner keeps its own copy because it reads the native SDK. The paired comment on that side is not applied: plugins/scanners/typescript/src/http-paths.ts and http-values.ts are another task's uncommitted files.
The four divergences are settled one way for the framework scanners: the hole marker is a NUL escape, so a literal one-space segment stays literal; a constant is a const variable or an object-literal property and never a class field, because a constructor can replace even a readonly one, which is the reference's stricter rule (Angular's readonly base now reports a leading unknown segment, and its fixture, test and page say so); a root whose only declaration is ambient, such as a .d.ts declare or process.env, is configured, as the contract's cannot-see-the-value rule requires; and import.meta.env resolves to nothing, so it is configured too. isStringLiteralLike could not be used in the interface because its parameter is a union the structural node type cannot satisfy; the two concrete guards are.
React producer: plugins/scanners/react/src/http.ts recognizes fetch (only when the project declares no fetch of its own), axios and an axios.create({ baseURL }) instance through get, post, put, patch, delete, head, options, request(config) and axios(config), resolving the callee or receiver first, so a get on another object is never a request. Requests are reported at the enclosing function through the existing evidence operation map. React serves no endpoint.
Verification: bun test test-bun/react-http.test.ts test-bun/react-scanner.test.ts test-bun/angular-http.test.ts test-bun/angular-scanner.test.ts 23 pass. The built React package reports 17 requests on test/fixtures/react-http covering fetch with and without a literal method, a computed method, dynamic and partly computed segments, a dropped query, an ambient configured base, a literal host, a parameter base, a helper with its caller silent, the axios shorthands, request(config), axios(config), a bare axios(url) and an axios.create base; a project-declared fetch and store.get report nothing, and httpEndpoints is undefined. Core derives one row from talks.tsx to the file serving GET /api/talks, POST /api/talks and DELETE /api/talks/:id.
Isolated worktree: bun run check exit 1 with one unrelated failure, test-bun/swift-scanner.test.ts expecting discovery to recommend swift, which needs src/scanner/modules/official-catalog.ts changes still uncommitted in the shared tree at HEAD; everything else passed (472 pass, 30 skip). My lane's tests pass there (4 pass), and bun plugins/scanners/react/build.ts and the Angular build both succeeded with the shared halves bundled. bun install needed no frozen lockfile in that worktree because HEAD's lockfile is already out of sync with its package.json files.
AC #1 is unmet and unchecked: it also requires Next.js route handlers and API routes as endpoints, while the current instruction says React is a client only. The scanner reads only the TSX sources of projects that depend on react, so file-location endpoints would first require it to read and own .ts route files. AC #4 stays unchecked for the same reason, because the page's list would change.

Next.js endpoints (coordinator correction, in scope): plugins/scanners/react/src/routes.ts reports endpoints declared by file location. An App Router route file, app/**/route.ts or .tsx under the project root or src, reports one endpoint per exported GET, POST, PUT, PATCH, DELETE, HEAD or OPTIONS handler, written as a function declaration or a const function value, at its directory path. A Pages Router route, pages/api/**, reports one endpoint for the function its default export designates, with method * because it answers every method; a default export that is not a function in that file reports nothing. Path segments map [id] to a parameter, [...rest] to a catch-all, [[...rest]] to an optional catch-all and an index file to its directory; a route group such as (admin), a parallel route @modal, an intercepted route and a partly dynamic segment report nothing for that route, since those segments are not served. Pages, layouts, middleware.ts and components are not endpoints.
File selection grew by exactly those locations: reactProject now keeps the project's owned sources, still requires TSX components for the callback evidence, and adds the route files to the observation's files so core can own them as a relationship target. The TSX component and outline behavior is unchanged, which test-bun/react-scanner.test.ts confirms.
Verification: bun test --timeout 120000 test-bun/react-http.test.ts test-bun/react-scanner.test.ts test-bun/angular-http.test.ts 16 pass. The built React package reports the fixture's four endpoints, app/api/talks/route.ts GET and POST /api/talks, app/api/talks/[id]/route.ts DELETE /api/talks/:id and pages/api/speakers/[id].ts * /api/speakers/:id, nothing for the (admin) route group or middleware.ts, and app/api/talks/route.ts among its files. From React's own facts alone, core derives two rows, talks.tsx to app/api/talks/route.ts listing GET and POST /api/talks, and talks.tsx to app/api/talks/[id]/route.ts.
The paired change-both-together comments are now in plugins/scanners/typescript/src/http-paths.ts and http-values.ts, since TASK-416.1 is committed.
Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 480 pass, 32 skip, 0 fail); the earlier swift-scanner failure is gone now that the catalog change is committed. bun plugins/scanners/react/build.ts and the Angular build both succeeded there with the shared halves and the route reader bundled. HEAD's lockfile is out of sync with its package.json files, so that worktree installed without --frozen-lockfile; neither is this task's work.

Rechecked at HEAD 6806c41f, which carries the Swift and JavaScript scanners: bun install --frozen-lockfile exits 0 in both the main tree and the isolated worktree, and bun run check in that worktree exits 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 480 pass, 32 skip, 0 fail). The React and Angular package builds succeed there. The earlier swift-scanner failure and lockfile drift are gone and were never part of this work.

Cold review corrections (coordinator decisions), applied: one options rule for every client form, so an unresolved config or a computed method leaves the method out instead of claiming GET; an axios instance must be assigned once, resolved through the shared constantOf, so a reassigned let instance is not a client; PAGES_API requires pages/api/, so a page such as pages/api.tsx is never a route; index is stripped only as the last part of a Pages Router match, so app/api/index/route.ts serves /api/index and pages/api/index/list.ts serves /api/index/list; and a route group such as (admin) is skipped as an organizing segment rather than abstained, so app/api/(admin)/audit/route.ts serves /api/audit, while an intercepted (.)talks and a parallel @modal route still report nothing. Accepted items: plugins/scanners/typescript/src/http-paths.ts now imports the shared request rules and keeps only its route patterns; that scanner's http-values.ts treats an ambient declaration as configuration, agreeing with the shared half; declarationOf is exported from the shared half and returns the caller's own declaration type, which restored Angular's alias resolution and removed the casts in React and Vue; React's outline comment is corrected; Operation and executable moved to plugins/scanners/react/src/functions.ts and are shared by the scan and the route reader; and the React page states the softened method rules.
Fixture and test additions: an unresolved axios options object, a reassigned let instance, a Pages route whose default export is not a function, a page at pages/api.tsx, [...path] and [[...slug]] catch-alls, a src/app router root, an App Router index directory, a Pages index file and an index directory. The stale test title and the vacuous middleware assertion are replaced by the exact endpoint list plus a check that the page, the non-function route and middleware report nothing.
Verification after corrections: bun test test-bun/react-http.test.ts test-bun/vue-http.test.ts test-bun/angular-http.test.ts test-bun/typescript-http.test.ts 10 pass. Isolated worktree from HEAD 4d34ec90: bun install --frozen-lockfile and bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 488 pass, 32 skip, 0 fail); the React and Angular builds succeed there.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The React scanner now reports the HTTP facts of its ecosystem: requests through fetch, axios and axios.create instances in the TSX files it reads, and the endpoints a Next.js project declares by file location, from app/**/route.ts method handlers and pages/api/** default exports, so core can derive client-to-server rows inside one React project. The producer halves both frameworks share were extracted to plugins/scanners/http-url.ts and http-values.ts, over a small structural compiler interface, and four rules that had drifted between producers were settled: a NUL hole marker, a constant being a const or object-literal property and never a class field, an ambient-only root being configured, and import.meta.env being configured; Angular moved onto those halves and the TypeScript scanner's own copies now agree and reuse the compiler-free half. Verified with test/fixtures/react-http and test-bun/react-http.test.ts: the built package reports every supported call and abstention, the twelve endpoints of the fixture's route tree including route groups, catch-alls, index rules and a src/app root, and core derives rows from talks.tsx to the route files that serve it. Isolated bun run check exit 0, and the React and Angular package builds pass. Documented in docs/scanners/react/index.md, which answers the six producer decisions.
<!-- SECTION:FINAL_SUMMARY:END -->
