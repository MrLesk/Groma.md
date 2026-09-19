---
id: TASK-416.1
title: Report HTTP facts from the TypeScript scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-19 00:25'
labels: []
dependencies: []
references:
  - typescript-src-index
  - http-requests
  - http-values
  - src-http-endpoints
modified_files:
  - plugins/scanners/typescript/src/http-paths.ts
  - plugins/scanners/typescript/src/http-values.ts
  - plugins/scanners/typescript/src/http-requests.ts
  - plugins/scanners/typescript/src/http-endpoints.ts
  - plugins/scanners/typescript/src/source-operations.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/typescript/src/graph.ts
  - plugins/scanners/typescript/src/scan.ts
  - test/fixtures/typescript-http/client.ts.fixture
  - test-bun/typescript-http.test.ts
  - docs/scanners/typescript/index.md
  - plugins/scanners/http-paths.ts
  - plugins/scanners/http-order.ts
  - plugins/scanners/typescript/src/http-controllers.ts
  - plugins/scanners/http-uses.ts
  - plugins/scanners/http-bindings.ts
  - plugins/scanners/typescript/src/http-bindings.ts
  - plugins/scanners/http-values.ts
  - test/fixtures/typescript-http/shadow.ts.fixture
  - test/fixtures/typescript-http/values.ts.fixture
  - test/fixtures/typescript-http/ordered-server.ts.fixture
  - test/fixtures/typescript-http/nest-main.ts.fixture
  - test/fixtures/typescript-axios-defaults/client.ts.fixture
  - test/fixtures/typescript-axios-defaults/setup.ts.fixture
  - plugins/scanners/http-syntax.ts
  - plugins/scanners/http-clients.ts
  - test/fixtures/typescript-http/hono-server.ts.fixture
  - test/fixtures/typescript-http/two-apps.ts.fixture
  - test/fixtures/typescript-http/express-server.ts.fixture
  - test/fixtures/react-http/talks.tsx.fixture
  - test-bun/react-http.test.ts
  - plugins/scanners/javascript/src/http-paths.ts
  - test/fixtures/typescript-http/express-extras.ts.fixture
  - test/fixtures/typescript-http/legacy-server.ts.fixture
  - test/fixtures/typescript-http/shared-app.ts.fixture
  - test/fixtures/typescript-http/shared-routes.ts.fixture
  - test/fixtures/typescript-http/hosted-app.ts.fixture
  - test/fixtures/typescript-http/hosted-routes.ts.fixture
  - test/fixtures/typescript-http/unsupported.ts.fixture
  - test/fixtures/typescript-http/nest-controller.ts.fixture
  - test/fixtures/typescript-nest-fastify/main.ts.fixture
  - test/fixtures/typescript-nest-fastify/controller.ts.fixture
parent_task_id: TASK-416
type: feature
ordinal: 472000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The TypeScript scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. The TypeScript scanner reads .ts and .tsx files in plain Node, Bun, browser and framework projects.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The TypeScript scanner reports requests made with fetch and axios, and endpoints declared with Express, Fastify, Hono, NestJS controllers and Bun.serve routes.
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
1. New modules under plugins/scanners/typescript/src: http-paths.ts turns a framework route pattern and a resolved URL into contract segments; http-values.ts resolves string expressions to literal text plus holes classified as configured, dynamic or unknown (string literals, templates, concatenation, const declarations assigned once, env and configuration reads); http-endpoints.ts finds framework instances by their import, their mount prefixes, route calls, NestJS controllers and Bun.serve routes; http-requests.ts covers fetch and axios; http-facts.ts holds the shared context and orchestration.
2. Thread httpEndpoints and httpRequests through source-operations.ts, source-analysis.ts, graph.ts and scan.ts into createScanObservation, reusing the existing operation map so each fact names the handling or sending operation.
3. Abstain instead of guessing: an unsupported route pattern, a router whose mount prefix is unknown, a plugin-parameter registrar, and a receiver whose framework origin is not visible report nothing.
4. Fixture test/fixtures/typescript-http/ with one file per supported API plus the unresolved cases; test-bun/typescript-http.test.ts scans it and asserts the facts.
5. docs/scanners/typescript/index.md lists the supported HTTP APIs and the limits.
6. Run focused tests, then bun run check in an isolated worktree.

Review-fix round (external cold reviews at cf8e7975) and the approved endpoint fact additions. Fix in the native-SDK copy, mirroring the shared framework readers: (1) importOrigin matched imports by spelling, so a shadowing parameter was axios or express: resolve the name's own symbol through the checker. (2) A reassigned let application stayed a registrar: registrars must be const. (3) Options with a computed key claimed GET, and a duplicate key took the first value: a spread, computed key, method or accessor leaves a property unknown, and the last property with a name wins. (4) Object properties folded as constants through the checker's type-directed symbol: read a property path structurally from a const object literal only while no write, escape, non-primitive read or method call in the sources can change it (native port of http-bindings). Owner base rule: a never-reassigned let or var resolves, a field read through this is configured, and a call result or other non-name root is unknown. (5) axios request-level baseURL was ignored and axios.create(unreadable config) had no base: the request config's baseURL overrides the instance's, unreadable config makes the base unknown, and the base joins the path as axios does (one slash; an absolute URL ignores it). Approved spec: (6) one shared compiler-free route-pattern reader for the TypeScript and JavaScript scanners (plugins/scanners/http-paths.ts) that never omits an endpoint: a typed or pattern parameter such as :id(\\d+) or :id{[0-9]+}, and text mixed with a placeholder, are constrained parameters; a pattern that may span segments or cannot be stated becomes a constrained optional catch-all. (7) Express, Hono and NestJS endpoints carry order { application, position }: positions follow the source order of top-level registrations in one file, mounts nest, anything else shares one position; Fastify and Bun.serve omit order; NestJS behind a FastifyAdapter omits it. (8) Blockers: an ordered entry the scanner sees but cannot report (a computed route path, a mount with an unresolved prefix or an unrecognized child) is reported at its position as its literal prefix plus a constrained optional catch-all, method * unless known, named by the registering operation. (9) Docs: fetch options the scanner cannot read omit the method (the page claimed GET), and decisions 5, 7 and 8.

Cold review round of the review fixes. Blocked paths always drop a trailing catch-all for the optional remainder. Registrations chained on a registration, or on an Express settings call (set, enable, disable, engine), are made on the same registrar and ordered by the member name's position; Express route(path) and Hono basePath return other builders. Ranks are cut to the shortest rank of their application they begin with, and routers one call mounts carry their argument position. Hand-offs of a registrar (any reference but a member use, an export, a mount the scan reads, or serving it with Node's createServer, an imported serve or module.exports) are entries in the file that creates it and in every file that registers on it; one outside the top level leaves the order unknown, and each blocks from the registrar's root. Hono on, mount and basePath block their readable prefix. Express 5 trailing {/:name} is an optional parameter; Hono's trailing * is an optional catch-all. Value syntax shared by both compilers moves to plugins/scanners/http-syntax.ts (wrapper, unwrapped, ownProperty, propertyKey, holderOf, urlText) and use syntax to plugins/scanners/http-uses.ts; both copies read ambient declarations by the Ambient flag. The shared path and order modules serve the TypeScript scanner until the JavaScript scanner adopts them.

Simplicity round, routing (TypeScript parts): the endpoint tests become one table with positions, NestJS behind a FastifyAdapter and computed controller paths get tests, the readable prefix, remainder and spanning patterns get fixtures, and decision 8 lists only the TypeScript scanner's differences from the shared routing model.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in plugins/scanners/typescript/src: http-paths.ts (route patterns and resolved URLs into contract segments), http-values.ts (import origins, declaration lookup, URL and string resolution, shared context), http-endpoints.ts (registrars, mounts, route calls, NestJS controllers, Bun.serve routes), http-requests.ts (fetch and axios). source-operations.ts builds the context from the existing operation map and resolver, so every fact names a declared operation; source-analysis.ts, graph.ts and scan.ts carry the facts into the observation.
Recognition uses the module a name is imported from in its own file, never types: express (app and Router), fastify, hono, @nestjs/common decorators, Bun.serve or serve from bun, axios, and the global fetch. A wrapper that re-exports a framework, a factory returning an app, and a registrar received as a parameter (a Fastify plugin's fastify) are not recognized, so they report nothing.
Abstentions: a computed route or prefix, an unsupported pattern (regular expression, optional group, mid-path wildcard), a router never seen mounted, a one-argument app.get (a settings read), and a spread in an options object. Computed URLs stay in the fact: a whole interpolated segment is dynamic, partial text and an unresolved value are unknown, a literal host becomes a leading unknown segment, and process.env or an unresolvable imported constant sets configured.
Removed during the quality review: Fastify register-with-prefix mounting, which no supported construct reaches because plugin routes register on a parameter. The limit is documented instead.
Evidence: test-bun/typescript-http.test.ts scans test/fixtures/typescript-http (files ship as .ts.fixture, following the existing framework-fixture convention) and asserts the complete endpoint set for all five frameworks with mount and controller prefixes, and the complete request set for fetch and axios including every unresolved case; unsupported.ts contributes nothing. Isolated bun run check exited 0 (Bun 438 passed, 25 skipped, 0 failed; Node 16 passed; Biome findings only in untouched files).
docs/scanners/typescript/index.md lists the supported APIs and answers the six producer-checklist decisions in order.

Cold review: five must-fix problems and three optional items applied, each with a fixture line.
1. A mount on a host the scan does not recognize is dropped, so createApp().use('/api', router) reports nothing instead of publishing /api/talks; Mount.parent is now required.
2. axios(url, config) reuses initMethod, so a present but unresolved method omits the method instead of claiming GET.
3. axios.create instances must be const, so a reassignable client reports no request.
4. A Bun route value claims * only when it resolves to something other than an object literal; a spread of handlers reports nothing. Route object keys must be known HTTP methods.
5. process.env.X and import.meta.env.X are configuration whatever declares them, and a root declared outside project source (a .d.ts) is configuration too. The fixture now declares an ambient process, which reproduces a typed repository: with the rule removed the base degrades to an unknown segment.
6. mountPrefixes copies its visited set per branch, so a router mounted twice reports one endpoint per prefix (/v1 and /v2 in the fixture).
7. Only the axios default import is a client, so isAxiosError(error) reports nothing.
8. Documented the controller limit (endpoints are reported without module registration, so a global prefix is missing and relies on core's single leading segment), deduped HTTP facts as well as operations when a file belongs to two projects, and explained the NUL hole sentinel (the raw byte is now written as an escape).
Verification: test-bun/typescript-http.test.ts asserts the complete endpoint and request sets, including every abstention above. Isolated bun run check exited 0 (Bun 457 passed, 27 skipped, 0 failed; Node 16 passed; no Biome findings in these files).

Review-fix round, implemented (awaiting cold review, not committed): the native copy now applies the shared rules. Imports: importOrigin keeps its spelling filter but asks the checker which declaration the name is, so a shadowing parameter or local is not the import. Registrars must be const. Values: typescript/src/http-values.ts reads held values structurally (last duplicate wins; spread, computed key, accessor, method or shorthand leave a property unknown), through typescript/src/http-bindings.ts, the native asynchronous port of the shared bindings, which reuses the syntactic index and use classification now in plugins/scanners/http-uses.ts; owner base rule: never-reassigned let or var resolve, this fields and declare statements are configured, call results and other roots are unknown. Clients: typescript/src/http-requests.ts mirrors http-clients.ts (request and shorthand baseURL, unreadable create config, instance default method, defaults assignments on axios and instances, fetch inputs that are not URLs). Routes: the shared compiler-free plugins/scanners/http-paths.ts replaces typescript/src/http-paths.ts and never omits a route: pattern parameters (:id(\\d+), :id{...}) and mixed text are constrained, a spanning or unreadable pattern becomes a constrained optional catch-all, (.*) and :name(.*) are catch-alls needing a segment. Order: the shared plugins/scanners/http-order.ts ranks placements; Express and Hono number top-level registrations of one file in source order (a chain included) with mounts nesting, anything else shares a position; NestJS gets one position, its application the file with NestFactory.create (none when a FastifyAdapter is passed), else the controller file; Fastify and Bun.serve carry no order. Blockers: a computed route path, a mount under a computed prefix, a path mounted to something other than a recognized router, and an Express route builder report their readable prefix plus a constrained optional catch-all at their position. The classic http-values.ts gains the same two value rules (declare statement unseen, a declared function is its name's held value). Docs: TypeScript page table, value paragraph, decisions 1, 2, 5, 7, 8. Fixtures: typescript-http shadow, values, ordered-server, nest-main; typescript-axios-defaults. Verified: all four TypeScript HTTP tests fail on HEAD code; isolated worktree bun install --frozen-lockfile and bun run check exit 0 (583 pass, 35 skip; lint warnings only outside this task); React, Angular, Vue and JavaScript builds succeed.

Follow-ups (non-blocking): (1) two ordered applications created in one file share one application key, because the fact identifies an application by its file, so their positions interleave; (2) an Express 4 bare `*` route also matches `/`, but it is reported as a catch-all that needs at least one segment.

Cold review round, applied: (1) blockedPath kept a plain catch-all from a prefix such as '*'; it now always drops it for the constrained optional remainder (Hono use('*'), on('PURGE', '/cache/*')). (2) Chained registrations were skipped; chainedDeclaration follows calls that return their registrar, and entries sort by member-name position. (3) compare was not transitive; withOrder cuts ranks first (two-apps fixture), and mount ranks carry the child's argument position (ordered-server admin before audit). (4) Both copies read the Ambient flag (declare global fixtures in typescript-http values and react-http talks). (5) Hand-offs block, per the coordinator's decisions: counted in the creating file and every registering file, in any statement (outside the top level the order is unknown), never for serving uses or exports (legacy-server, shared-app/shared-routes, hosted-app/hosted-routes, express-extras, hono serve, ordered-server createServer, express-server http.createServer, two-apps module.exports and export specifier). Counting the creating file goes beyond 'files that register': it runs before any importer's registrations, so its hand-offs can capture them. (6) Shared syntax helpers and wrapper deduped. (7) Express 5 optional group and Hono optional wildcard. (8) Header comments, the JavaScript path comment and decisions 7 and 8 corrected; the middleware rule covers a handler next to a recognized router in one use call. Verification: each rule mutation-checked (cut, mount position, own-file, registering files, creating file, top-level filter, export assignment, export specifier, basePath chain, createServer member, settings chain, serving) fails the TypeScript HTTP tests; isolated bun install --frozen-lockfile and bun run check exit 0 (583 pass, 35 skip, 0 fail; the two complexity warnings are in untouched tests).

Simplicity round, committed under TASK-416.3: the TypeScript scanner's native copies of the value, binding and request readers are deleted; it now runs the shared asynchronous readers through its native checker adapter (typescript/src/http-checker.ts), and its endpoints build a RouterContext from the shared UrlContext. With the shared readers it now recognizes CommonJS require for axios, node-fetch and Express registrars (values.ts viaRequire fixture), counts a node-fetch default import as fetch, and no longer counts a fetch imported from any other module; its HTTP test also runs React's value and client-defaults fixtures.

Simplicity round, routing (TypeScript parts): the endpoint tests are one table with application@position per line, now file#variable, sorted numerically; new cases cover a readable prefix cut at the last whole segment (`/versions/v-${...}`), a :name(.*) catch-all, a pattern that may span segments, computed @Controller and @Get paths, and NestJS behind a FastifyAdapter (typescript-nest-fastify fixture, no order); decision 8 now lists only the differences from the JavaScript page's routing model. Verified with the routing round's isolated check (595 pass, 35 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TypeScript scanner now reports HTTP facts for the shared contract: requests from fetch and axios (shorthands, config forms and axios.create instances), and endpoints from Express apps and routers, Fastify, Hono, NestJS controllers and Bun.serve routes. Frameworks are recognized by the module a name is imported from, so no installed packages are needed. New modules under plugins/scanners/typescript/src resolve route patterns and URLs into contract segments (http-paths.ts), resolve string values, imports and declarations (http-values.ts), and extract endpoints (http-endpoints.ts) and requests (http-requests.ts); source-operations.ts builds their context from the existing operation map and resolver, and the facts travel through source-analysis.ts, graph.ts and scan.ts into the observation. Only proven literals become facts: computed routes and prefixes, unsupported patterns, unrecognized hosts, reassignable clients and unreadable route values report nothing, while computed URLs stay in the fact as dynamic or unknown text, and process.env or an out-of-project constant sets configured. Verified by test-bun/typescript-http.test.ts against test/fixtures/typescript-http, which asserts the complete endpoint and request sets for every supported API and every abstention, and by an isolated bun run check (exit 0, Bun 457 passed, Node 16 passed). docs/scanners/typescript/index.md lists the supported APIs and answers the six producer-checklist decisions in order.

The cold review round tightened ordering: chained registrations and Express settings chains register on their registrar in written order, ranks are cut so positions compare consistently, routers one call mounts keep their listed order, and a registrar handed to other code blocks from its root in the creating file and every registering file, with no blocker for serving it or for files that only import it. Blocked prefixes always end in the constrained optional remainder, Express 5 {/:name} and Hono's trailing * are read, both compiler copies share the value and use syntax through plugins/scanners/http-syntax.ts and http-uses.ts, and a declare global value is configuration. Verified by red fixtures in test/fixtures/typescript-http and react-http and an isolated bun run check (583 pass, 35 skip, 0 fail).

The routing simplicity round moved the TypeScript page to the shared routing model's differences and added tests for the rules that no test guarded.
<!-- SECTION:FINAL_SUMMARY:END -->
