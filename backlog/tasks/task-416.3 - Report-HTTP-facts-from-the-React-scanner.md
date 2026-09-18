---
id: TASK-416.3
title: Report HTTP facts from the React scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 19:46'
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
  - plugins/scanners/http-bindings.ts
  - plugins/scanners/http-clients.ts
  - plugins/scanners/vue/src/http.ts
  - plugins/scanners/react/src/index.ts
  - plugins/scanners/javascript/src/http-scope.ts
  - plugins/scanners/javascript/src/http-reads.ts
  - plugins/scanners/javascript/src/http.ts
  - test/fixtures/react-http/uncertain.tsx.fixture
  - test/fixtures/react-next-routers/src-router/package.json
  - test/fixtures/react-next-routers/src-router/page.tsx.fixture
  - test/fixtures/react-next-routers/src-router/pages/api/ping.ts.fixture
  - >-
    test/fixtures/react-next-routers/src-router/src/app/api/status/route.ts.fixture
  - test/fixtures/react-next-routers/src-router/src/pages/api/hidden.ts.fixture
  - test/fixtures/react-next-routers/src-router/tsconfig.json
  - test/fixtures/react-next-routers/without-next/app/api/talks/route.ts.fixture
  - test/fixtures/react-next-routers/without-next/package.json
  - test/fixtures/react-next-routers/without-next/page.tsx.fixture
  - test/fixtures/react-next-routers/without-next/tsconfig.json
  - docs/scanners/vue/index.md
  - docs/scanners/javascript/index.md
  - test/fixtures/javascript-http/client/values.mjs
  - test-bun/javascript-http.test.ts
  - test-bun/scanner-source-listing.test.ts
  - test/fixtures/react-http/shared.ts.fixture
  - test/fixtures/react-http/exposed.ts.fixture
  - test/fixtures/react-http/writer.ts.fixture
  - test/fixtures/react-http/options.tsx.fixture
  - test/fixtures/javascript-http/client/globals.js
  - plugins/scanners/http-uses.ts
  - test/fixtures/react-client-defaults/package.json
  - test/fixtures/react-client-defaults/tsconfig.json
  - test/fixtures/react-client-defaults/defaults.tsx.fixture
  - test/fixtures/react-client-defaults/setup.ts.fixture
  - test/fixtures/react-http/cfg.ts.fixture
  - test/fixtures/react-http/barrel.ts.fixture
  - test/fixtures/react-http/lazy.ts.fixture
  - test-bun/vue-http.test.ts
  - test/fixtures/react-http/handed.ts.fixture
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

Review-fix round (external cold reviews at cf8e7975). Fix: (1) React treats every axios export as a client (isAxiosError, mergeConfig, a named post): accept only the default import, resolved through the checker so a shadowing parameter is never the import. (2) Next.js file-location endpoints need the project to declare next. (3) Inactive src routers: Next.js reads app and pages from the project root, or from src only when the root has none, per router. (4) Shared http-url.ts: classify the URL start after joining adjacent literal fragments, so '/' + '//host/...' is a host. (5) Shared http-url.ts: a configured base followed by text that does not start with / is a leading unknown segment. (6) Shared http-values.ts: object properties are no longer folded through the checker's type-directed property symbol; a property path is read structurally from a const object literal (last property with the name wins, a spread or computed key leaves it unknown) and only while no write, escape or non-primitive read in the analyzed sources can change it (new plugins/scanners/http-bindings.ts); an unresolved expression root such as getConfig().x or this.x is computed, never configured. The same rewrite removes the type-directed paths where a parameter typed as an object literal or a reassigned let object folded a literal. (7) React page decision 1 and the stale source comment say React reports no endpoint. Call sites of the shared context (Angular, Vue, http-clients.ts, JavaScript) adapt to the context carrying the bindings; the JavaScript reader gets a real one-file checker for that. Skipped here: axios request-level baseURL, create(config) and named exports in Vue (TASK-416.4), the TypeScript and JavaScript copies (TASK-416.1, TASK-416.11).
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

Review-fix round, implemented (awaiting cold review, not committed): shared http-url.ts joins adjacent literal text before classifying the start, and a configured value must be followed by text starting with / or the path gets a leading unknown segment. Shared http-values.ts reads values structurally: a variable declared once that the analyzed sources never assign again (a const, or a let or var never reassigned, per the owner's base rule) holds its initializer; a property path through it is read from the object literal (last property with the name wins; a spread, computed key, method, accessor or shorthand leaves it unknown) only while plugins/scanners/http-bindings.ts finds no write, escape, non-primitive read or method call through that path elsewhere in the sources; a field read through this is configured (owner's base rule); any other non-name root, such as a call result, is unknown. The checker's type-directed property symbols are no longer used, which also removes the literal folds for a parameter typed as an object literal and a reassigned let object. React accepts only the axios default import (importOrigin through the checker, so a shadowing parameter is never the import); Next.js endpoints need a next dependency; app and pages are each read from the project root, or from src only when the root has none. The context carries the bindings, so Angular, Vue, React and the JavaScript reader build it with urlContext; the JavaScript reader resolves names with a one-file program (noLib, noResolve), where imports and globals resolve to nothing as before, and exported objects are never unchanged because other files can change them. Docs: React page decisions 1, 2, 5, 7, 8 and the base decision on the Angular, Vue and JavaScript pages. Regression fixtures: react-http/uncertain.tsx, react-next-routers (src-router, without-next), javascript-http/client/values.mjs; the Angular latest request is now configured. Verified: each new expectation fails on HEAD code and passes with the change; isolated worktree bun install --frozen-lockfile and bun run check exit 0 (521 pass, 35 skip; lint shows only pre-existing warnings); React, Angular, Vue and JavaScript package builds succeed.

Cold review round 1 applied: (1) http-clients.ts no longer has its own object reader; every option (method, url, baseURL) is read through http-values heldAt, so a changed or duplicated option is never the literal it once held (fetch init, axios(config), axios.request(config), axios.create(config)). (2) In file-alone mode a script (no import, export, require or exports) has global top-level names: they are never unchanged and always count as reassigned. (3) An object literal with a get or set accessor states no property. (4) A namespace import used other than to read one export by name escapes every exported variable; export statements now count as uses that leave the program only then. (5) A request's own baseURL (config form, or the shorthand's configuration argument, third for post, put and patch) replaces the client's; an unreadable request or create config makes the base unknown; joinBase in http-url.ts joins a base and a relative path with one slash and lets an absolute URL replace it; an instance also carries its config's default method. (6) The bindings header no longer claims the TypeScript scanner applies these rules (TASK-416.1 ports them). (8) New fixture lines: alias write, function-argument escape, method call, accessor, write in another file, namespace escape, changed fetch init, changed axios url, request, and create config, duplicate url, request and shorthand baseURL, unreadable create config, instance join and default method, absolute URL over a base; javascript-http/client/globals.js for script globals. The JavaScript page's base decision still needs the script sentence: that file carries another lane's uncommitted change, so it is left untouched. Verified: isolated worktree bun run check exit 0 (564 pass, 35 skip); removing the accessor, namespace, script or request-base rule each fails its test line.

Cold review round 2 applied: (1) axios defaults: http-bindings settings() reads what the sources set below a variable's defaults; exactly one assignment to defaults.baseURL or defaults.method on the default import (every file's axios default import) or on an instance's variable sets it, more than one or any other change to defaults (Object.assign, reassignment, compound writes) hides base and method; an instance without its own base copies axios.defaults when created, which the scan cannot order, so an assigned default base leaves it unknown; the axios client recognition moved into the shared createdClient and defaultClient; interceptors and code a client is handed to are an accepted residual risk stated on the React and Vue pages. (2) Module objects are recognized by resolution: an imported name whose alias resolves to a module (namespace import, export * as re-export) or a dynamic import's result by its type, used other than as x.name, makes that module's exports, through getExportsOfModule, never unchanged; decision 5 on the React, Vue and Angular pages says module object. (3) fetchMethod: a fetch-style input that is not URL text (a Request, a parameter) leaves the method out; applies to React fetch and Vue fetch, $fetch and useFetch. (4) JavaScript page states the script globals rule; the bindings header names the four scanners. The syntactic use classification moved to plugins/scanners/http-uses.ts. Fixtures: test/fixtures/react-client-defaults (default import in another file, instance defaults in another file, Object.assign on defaults, a defaults method, an inheriting instance, a control), react-http cfg, barrel, lazy and writer lines, and a Request input. Verified: isolated bun run check exit 0 (572 pass, 35 skip); disabling the defaults, Request-input or module-object rule each fails its test lines.

Final review round applied: a dynamic import whose module object is not bound by const x = await import() or a .then(function literal) parameter (handed to a call, .then(fn), a promise held in a variable) escapes its module directly, through the module symbol of its specifier; bound ones are tracked by the binding's symbol. import { default as http } from 'axios' counts as a default import for defaults. Docs: the JavaScript script rule names top-level let and var; the React and Vue defaults sentence says any other change to defaults itself or to baseURL and method hides both, and the accepted risks now list the single-assignment ordering assumption, interceptors, code a client is handed to, a re-exported default client, an alias and a destructured defaults. Follow-ups recorded for their tasks: the React isAxios move into http-clients.ts for Vue (TASK-416.4); the JavaScript scanner's own axios reader ignores defaults until TASK-416.11 replaces it with the shared one. Verified: isolated worktree at fabb8811, bun install --frozen-lockfile and bun run check exit 0 (576 pass, 35 skip; only the existing php build lint warning); disabling the unbound dynamic import or the named default import rule fails its test line; React, Angular, Vue and JavaScript builds succeed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The React scanner now reports the HTTP facts of its ecosystem: requests through fetch, axios and axios.create instances in the TSX files it reads, and the endpoints a Next.js project declares by file location, from app/**/route.ts method handlers and pages/api/** default exports, so core can derive client-to-server rows inside one React project. The producer halves both frameworks share were extracted to plugins/scanners/http-url.ts and http-values.ts, over a small structural compiler interface, and four rules that had drifted between producers were settled: a NUL hole marker, a constant being a const or object-literal property and never a class field, an ambient-only root being configured, and import.meta.env being configured; Angular moved onto those halves and the TypeScript scanner's own copies now agree and reuse the compiler-free half. Verified with test/fixtures/react-http and test-bun/react-http.test.ts: the built package reports every supported call and abstention, the twelve endpoints of the fixture's route tree including route groups, catch-alls, index rules and a src/app root, and core derives rows from talks.tsx to the route files that serve it. Isolated bun run check exit 0, and the React and Angular package builds pass. Documented in docs/scanners/react/index.md, which answers the six producer decisions.

Review-fix round after external cold reviews: the React scanner accepts only the axios default import, gates Next.js endpoints on a next dependency and reads app and pages from the root or from src only when the root has none. The shared readers no longer fold values the source does not prove: URL text is classified after joining literal pieces, a configured base must be followed by a slash, a property path is read structurally from an object literal only while plugins/scanners/http-bindings.ts finds no write, escape, accessor, method call, module-object escape or script global that could change it, a never-reassigned let or var and a this field follow the owner's base rule, and every fetch and axios option, a request's own baseURL and a client's defaults are read the same way. Verified with react-http, react-next-routers, react-client-defaults and javascript-http regression fixtures that fail on the previous code, and an isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
