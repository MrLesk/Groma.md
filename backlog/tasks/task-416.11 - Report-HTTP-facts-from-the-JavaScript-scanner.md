---
id: TASK-416.11
title: Report HTTP facts from the JavaScript scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:32'
updated_date: '2026-09-18 22:33'
labels: []
dependencies:
  - TASK-418
references:
  - javascript-src-index
modified_files:
  - plugins/scanners/javascript/src/http-scope.ts
  - plugins/scanners/javascript/src/http-paths.ts
  - plugins/scanners/javascript/src/http-reads.ts
  - plugins/scanners/javascript/src/http-requests.ts
  - plugins/scanners/javascript/src/http-endpoints.ts
  - plugins/scanners/javascript/src/http.ts
  - plugins/scanners/javascript/src/evidence.ts
  - plugins/scanners/javascript/src/index.ts
  - test/fixtures/javascript-http/server/express.mjs
  - test/fixtures/javascript-http/server/router.cjs
  - test/fixtures/javascript-http/server/fastify.js
  - test/fixtures/javascript-http/server/hono.mjs
  - test/fixtures/javascript-http/server/serve.js
  - test/fixtures/javascript-http/client/fetch.mjs
  - test/fixtures/javascript-http/client/axios.mjs
  - test/fixtures/javascript-http/client/settings.mjs
  - test/fixtures/javascript-http/client/legacy.js
  - test-bun/javascript-http.test.ts
  - docs/scanners/javascript/index.md
  - docs/scanners/javascript/validation.md
  - test/fixtures/javascript-http/client/jquery.js
  - test/fixtures/javascript-http/server/koa.js
  - plugins/scanners/http-url.ts
  - plugins/scanners/http-values.ts
  - plugins/scanners/typescript/src/http-values.ts
  - plugins/scanners/http-uses.ts
  - plugins/scanners/http-bindings.ts
  - plugins/scanners/http-routers.ts
  - plugins/scanners/http-routes.ts
  - plugins/scanners/typescript/src/http-endpoints.ts
  - plugins/scanners/typescript/src/http-bindings.ts
  - test/fixtures/javascript-http/client/shadowing.mjs
  - test/fixtures/javascript-http/client/commonjs.js
  - test/fixtures/javascript-http/client/options.mjs
  - test/fixtures/javascript-http/server/shadowing.mjs
  - test/fixtures/javascript-http/server/reassigned.cjs
  - docs/scanners/typescript/index.md
  - test/fixtures/typescript-http/two-apps.ts.fixture
  - test-bun/typescript-http.test.ts
  - docs/scanners/react/index.md
  - docs/scanners/vue/index.md
  - plugins/scanners/http-paths.ts
  - plugins/scanners/http-order.ts
  - plugins/scanners/typescript/src/http-requests.ts
  - plugins/scanners/http-syntax.ts
  - plugins/scanners/typescript/src/source-operations.ts
  - test/fixtures/javascript-http/server/site.js
  - test/fixtures/javascript-http/server/spa.js
  - test/fixtures/javascript-http/server/koa-api.js
  - test/fixtures/typescript-http/fastify-server.ts.fixture
  - test/fixtures/typescript-http/hono-server.ts.fixture
  - test/fixtures/typescript-http/express-server.ts.fixture
  - test/fixtures/typescript-http/middleware.ts.fixture
  - test/fixtures/typescript-http/admin-router.ts.fixture
  - test/fixtures/javascript-http/server/exported.mjs
parent_task_id: TASK-416
type: feature
ordinal: 484000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The JavaScript scanner owns this knowledge for plain JavaScript files and must report it without knowing other scanners.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The JavaScript scanner reports requests made with fetch, axios and jQuery ajax helpers, and endpoints declared with Express, Fastify, Hono and Koa routers.
- [x] #2 Only literal routes and URLs become facts, including route prefixes and constants assigned once; anything computed is reported as unresolved.
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
1. Resolve names inside one parsed file (plugins/scanners/javascript/src/http-scope.ts): a lexical declaration lookup, the names the file reassigns, and where a name comes from, covering ESM imports and CommonJS require forms. Expose it as the checker the shared plugins/scanners/http-values.ts expects, so urlParts, methodName and constantOf work without a program: an unresolvable name is a value the scanner cannot see (configured), while a local let, var, parameter or destructured binding is computed.
2. Requests (http-requests.ts) through the shared urlParts and requestUrl: global fetch or a fetch bound to node-fetch, and axios including axios(config), axios.request(config), the method shorthands and a never-reassigned instance from axios.create({ baseURL }). Recognize a client by its receiver's declaration or import, never by member name.
3. Endpoints (http-endpoints.ts): Express applications and routers, Fastify applications including route({ method, url, handler }), Hono applications, their use/route mounts with literal prefixes, and Bun.serve route objects. A router with no known mount in the same file, a non-literal prefix, an unresolved route or method, and a missing handler report nothing.
4. Endpoint route patterns (http-paths.ts): literal text, :name, :name? and a trailing * or *name, mirroring the TypeScript scanner's rules. Anything else reports no endpoint.
5. Attach each fact to a declared operation: the enclosing operation for a request, the resolved handler for an endpoint, else the registering operation. Report both fact arrays from the observation.
6. Fixtures test/fixtures/javascript-http covering each supported client and router, CommonJS and ESM recognition, mounted prefixes, configured and dynamic paths, and every abstention. Document the six producer decisions in docs/scanners/javascript/index.md.
7. Verify with test-bun/javascript-http.test.ts, the existing javascript tests, and bun run check in a detached worktree.

8. Extend the producer with jQuery requests (`$.ajax({ url, type|method })`, `$.get`, `$.post`, `$.getJSON`, `$.getScript` through a `$` or `jQuery` receiver, global or imported) and Koa endpoints (`new Koa()` with `@koa/router` or `koa-router`: verb methods, `router.routes()` mounted through `use`, a `new Router({ prefix })` option, `router.prefix(...)`, and nested router mounts), keeping every existing abstention rule.
9. Map a Koa `(.*)` segment to a catch-all, only when it is last, and read the named-route form `get(name, path, handler)` so a route name never becomes a path segment.
10. Add fixtures for each new API and its abstentions, extend the supported-API table, drop jQuery and Koa from the unsupported list, and state that a name a loop binds is computed rather than configured.

Review-fix round. Replace the per-file scope with the compiler's own resolution over the one parsed file: names resolve through the shared value reader (plugins/scanners/http-values.ts), whose importOrigin also reads CommonJS require forms and whose bindings see reassignment and destructuring, so a shadowing parameter or loop binding is never an import or an outer constant. Requests go through the shared plugins/scanners/http-clients.ts (fetch method rules, axios shorthands, config, instances, request baseURL and defaults); jQuery keeps its own reader with method over type. Routers go through one shared router reader for the TypeScript family (Express, Fastify, Hono and Koa), which the TypeScript scanner also uses: registrations, chains, hand-offs, mounts, blockers and order through plugins/scanners/http-order.ts, with route patterns from plugins/scanners/http-paths.ts (the JavaScript copy is deleted). Bun.serve claims every method only for a value proven to be a function. Docs answer decisions 7 and 8. Red fixtures for each review finding.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation

The scanner parses one file at a time, so the producer resolves names inside that file: plugins/scanners/javascript/src/http-scope.ts reads what each name declares, which names the file reassigns, and where a name comes from, covering ESM imports and the CommonJS `require` forms. It exposes that lookup as the checker the shared plugins/scanners/http-values.ts expects, so urlParts, methodName and requestUrl work with no program and no type checker. A name the file does not declare is a value the scanner cannot see, which the shared reader reports as configured, exactly as the contract describes a constant defined elsewhere. A local `let`, `var`, parameter or destructured binding stays computed, and a name declared in a scope form the lookup does not read resolves to its own identifier, which is also computed, so a miss never becomes a configured base.

Clients and routers are recognized through the receiver's declaration or its import, never by member name: `cache.get('/talks')`, a reassigned instance and a local function named `fetch` report nothing. A client or router instance counts when the file declares it and never assigns that name again.

Requests: global fetch, a `node-fetch` default import, axios with its method shorthands, `axios(config)`, `axios.request(config)` and instances from `axios.create({ baseURL })`. Endpoints: Express applications and routers with their `use` mounts, Fastify applications including `route({ method, url, handler })` with a method array, Hono applications with `route` mounts, and `Bun.serve` route objects. Route patterns follow the TypeScript scanner's rules in http-paths.ts.

Each fact names a declared operation: the enclosing operation for a request, the handler the route states for an endpoint, else the operation that registers the route.

Verification

- test-bun/javascript-http.test.ts: four tests over test/fixtures/javascript-http covering all five router styles, both client families, ESM and CommonJS recognition, mounted and computed prefixes, configured, dynamic, host and unknown paths, every construct that reports nothing, the operation each endpoint names, and the five rows core derives from the facts.
- bun run check passes in a detached worktree holding HEAD plus only this task's changes: 16 Node tests, 492 Bun tests, 0 failures. Biome reports nothing for the new files.
- Local qualification: the packaged scanner reported all three `fetch` calls in the authored JavaScript of the wifi-densepose checkout, as unknown, literal and configured paths, and no endpoint, because that project serves its API from Python.

Scope difference to confirm

AC #1 names jQuery ajax helpers and Koa, while the lane instruction named axios instances and `Bun.serve` route objects instead. This slice implements fetch, axios including `axios.create` instances, Express, Fastify, Hono and `Bun.serve`, mirroring the TypeScript producer, and the scanner page lists jQuery, Koa, `http.createServer` and Fastify `register` prefixes as not read yet. Whether to extend this task or follow up separately is an owner decision.

Correction from the quality review

The name lookup read source files, blocks and parameters, so a name declared in another scope form, such as a `for (const base of bases)` variable, resolved to nothing and the shared reader treated it as a configuration value. That would have published a configured base a loop computes, which core compares and could turn into a wrong row. The scope now also collects every name the file binds, in any scope form, and reports such a name through its own identifier, which resolves to no constant and therefore stays computed. test/fixtures/javascript-http/client/fetch.mjs covers the loop base, whose request is reported with a leading unknown segment.

Final verification after the correction: Biome reports nothing for the plugin, the ten JavaScript tests pass, and bun run check exits 0 in a detached worktree holding HEAD plus only this task's changes (16 Node tests, 492 Bun tests, 32 skips, 0 failures).

Extension for AC #1

jQuery requests: `$.get`, `$.post`, `$.getJSON` and `$.getScript` state their own method; `$.ajax(settings)` and `$.ajax(url, settings)` read `type` first, then `method`, and default to GET. A `$` or `jQuery` receiver counts when the file imports jquery or leaves the name to the page, and not when the file declares it. Settings the scanner cannot read report nothing, an unresolved method omits the method, and an unproven URL keeps its unknown segments.

Koa endpoints: `new Koa()` is an application, and a `@koa/router` or `koa-router` router carries its own path from `new Router({ prefix })` or `router.prefix(...)`. A router serves once `use` mounts its `routes()`, at the root or under a literal prefix, and nested routers add their mount. Registrars now carry that own path, so a second prefix statement, an unreadable options object, an unresolved prefix, a router this file never mounts and a reassigned router name all report nothing. A `(.*)` segment is a catch-all, only when it is last, and the `get(name, path, handler)` form is read so a route name never becomes a path segment.

The page's supported-API table now lists both, neither appears in the unsupported list, and decision 5 states the loop-binding rule: every name the file binds, including a `for (const base of bases)` variable, is computed, because a name the scanner merely failed to resolve must never pass for a configuration value.

Verification after the extension: test/fixtures/javascript-http holds 11 files, the four tests assert 18 endpoints, 21 requests and 8 derived rows, Biome reports nothing for the plugin, and bun run check exits 0 in a detached worktree holding HEAD plus only this task's changes (16 Node tests, 492 Bun tests, 0 failures).

Review-fix round. The external reviews found that uncertainty became certain facts: a parameter, local or loop binding that shadowed an import was taken for it, a reassigned or destructured CommonJS binding stayed a client or registrar, an unresolved Bun.serve route value claimed every method, jQuery's type beat method, a computed option key claimed GET, a request's own baseURL and an unreadable axios.create config were ignored, a reassigned property kept its literal, and axios defaults were never read. The per-file scope, reads and path copies are deleted: names resolve through the classic compiler over the one file and the shared value reader, whose importOrigin now reads require forms and whose index records required axios defaults; requests go through the shared plugins/scanners/http-clients.ts; routers go through a new shared reader for the TypeScript family, plugins/scanners/http-routers.ts and http-routes.ts, which the TypeScript scanner now uses too (its http-endpoints.ts is an adapter plus NestJS), with shared route patterns and order. Decided in cold review and applied: pathless mounts of routers the scan cannot follow block from their place (package middleware, a function the scan sees, and any handler beside a recognized router stay middleware); Hono route and a Koa router's use copy the child's routes when they run; in this one-file scan exports hand the registrar on, placed last (a circular require is the accepted exception); Fastify register blocks its prefix without order; Koa del and redirect are read; Bun.serve is one shared rule. Side effects accepted: TypeScript registrars include a never-reassigned let or var, React and Vue recognize a required axios, and a fetch input that is not URL text states no method. Verification: red fixtures in test/fixtures/javascript-http and typescript-http, each rule mutation-checked; isolated bun install --frozen-lockfile and bun run check exit 0 (584 pass, 35 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The JavaScript scanner now reports HTTP facts. Requests come from fetch, including a node-fetch default import, axios with its method shorthands, `axios(config)`, `axios.request(config)` and `axios.create({ baseURL })` instances, and the jQuery ajax helpers `$.get`, `$.post`, `$.getJSON`, `$.getScript` and `$.ajax`. Endpoints come from Express applications and routers, Fastify including `route({ method, url, handler })`, Hono, Koa with `@koa/router` or `koa-router`, and `Bun.serve` route objects, each carrying every prefix its file states.

Because the scanner parses one file alone, a new file scope resolves names inside that file and serves as the checker the shared plugins/scanners/http-url.ts and http-values.ts expect, so no program or type checker is involved. A client, application or router is recognized through its receiver's declaration or its import and must never be reassigned. Only literal routes, prefixes, methods and URLs become facts: a computed route, prefix or method reports nothing, a router this file never mounts reports nothing, and every name the file binds, including a loop variable, is computed rather than configured, so core never compares a path the application may not serve.

Verified with test-bun/javascript-http.test.ts over test/fixtures/javascript-http, whose four tests assert the 18 endpoints, 21 requests and 8 derived rows the 11 fixture files produce, including each unsupported construct that reports nothing and the operation each endpoint names. The packaged scanner also reported all three fetch calls in the authored JavaScript of a wifi-densepose checkout. bun run check exits 0 in a detached worktree holding HEAD plus only this task's changes: 16 Node tests and 492 Bun tests pass, and Biome reports nothing for the plugin.

The review-fix round replaced the JavaScript scanner's own name resolution and value readers with the compiler over the one file and the shared readers, so shadowing names, reassigned or destructured bindings, computed or duplicated options, request-level bases, reassigned properties and axios defaults are read as the other TypeScript-family scanners read them. Routers now go through one shared reader for Express, Fastify, Hono and Koa, used by the TypeScript scanner too, which reports constrained route patterns, registration order and blockers for entries the scan cannot read, including routers from other files, exports, copying mounts and Fastify plugins. The JavaScript page answers producer decisions 7 and 8.
<!-- SECTION:FINAL_SUMMARY:END -->
