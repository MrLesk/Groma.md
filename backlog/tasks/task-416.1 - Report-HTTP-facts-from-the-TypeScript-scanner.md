---
id: TASK-416.1
title: Report HTTP facts from the TypeScript scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 06:21'
labels: []
dependencies: []
references:
  - typescript-src-index
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TypeScript scanner now reports HTTP facts for the shared contract: requests from fetch and axios (shorthands, config forms and axios.create instances), and endpoints from Express apps and routers, Fastify, Hono, NestJS controllers and Bun.serve routes. Frameworks are recognized by the module a name is imported from, so no installed packages are needed. New modules under plugins/scanners/typescript/src resolve route patterns and URLs into contract segments (http-paths.ts), resolve string values, imports and declarations (http-values.ts), and extract endpoints (http-endpoints.ts) and requests (http-requests.ts); source-operations.ts builds their context from the existing operation map and resolver, and the facts travel through source-analysis.ts, graph.ts and scan.ts into the observation. Only proven literals become facts: computed routes and prefixes, unsupported patterns, unrecognized hosts, reassignable clients and unreadable route values report nothing, while computed URLs stay in the fact as dynamic or unknown text, and process.env or an out-of-project constant sets configured. Verified by test-bun/typescript-http.test.ts against test/fixtures/typescript-http, which asserts the complete endpoint and request sets for every supported API and every abstention, and by an isolated bun run check (exit 0, Bun 457 passed, Node 16 passed). docs/scanners/typescript/index.md lists the supported APIs and answers the six producer-checklist decisions in order.
<!-- SECTION:FINAL_SUMMARY:END -->
