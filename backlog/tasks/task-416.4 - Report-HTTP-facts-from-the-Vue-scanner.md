---
id: TASK-416.4
title: Report HTTP facts from the Vue scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 20:20'
labels: []
dependencies: []
references:
  - vue-src-index
modified_files:
  - plugins/scanners/http-clients.ts
  - plugins/scanners/vue/src/http.ts
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/vue/src/evidence.ts
  - plugins/scanners/react/src/http.ts
  - test-bun/vue-http.test.ts
  - docs/scanners/vue/index.md
  - test/fixtures/vue-http/nuxt-imports.d.ts.fixture
  - test/fixtures/vue-http/web/package.json
  - test/fixtures/vue-http/web/tsconfig.json
  - test/fixtures/vue-http/web/Talks.vue
  - test/fixtures/vue-http/web/client.ts.fixture
  - test/fixtures/vue-http/web/drafts.ts.fixture
  - test/fixtures/vue-http/web/composables/useFetch.ts.fixture
  - test/fixtures/vue-http/web/server/api/talks.get.ts.fixture
  - test/fixtures/vue-http/web/server/api/talks.post.ts.fixture
  - 'test/fixtures/vue-http/web/server/api/talks/[id].delete.ts.fixture'
  - 'test/fixtures/vue-http/web/server/api/files/[...path].get.ts.fixture'
  - test/fixtures/vue-http/web/server/api/drafts/index.get.ts.fixture
  - test/fixtures/vue-http/web/server/api/settings.ts.fixture
  - test/fixtures/vue-http/web/server/routes/health.ts.fixture
  - test/fixtures/vue-http/web/server/middleware/auth.ts.fixture
  - test/fixtures/vue-http/web/server/api/talks/named.get.ts.fixture
  - test/fixtures/vue-http/web/server/api/talks/declared.get.ts.fixture
  - 'test/fixtures/vue-http/web/server/api/talks/[id].get.ts.fixture'
  - test/fixtures/vue-http/web/server/api/imported.get.ts.fixture
  - test/fixtures/vue-http/web/server/handlers.ts.fixture
  - 'test/fixtures/vue-http/web/server/api/hello-[name].get.ts.fixture'
  - test-bun/scanner-source-listing.test.ts
  - docs/scanners/react/index.md
  - plugins/scanners/http-url.ts
  - plugins/scanners/vue/src/server-routes.ts
  - test/fixtures/vue-http/web/server/api/(admin)/users.get.ts.fixture
  - test/fixtures/vue-http/web/server/api/speakers.get.prod.ts.fixture
  - 'test/fixtures/vue-http/web/server/api/[resource].get.ts.fixture'
  - 'test/fixtures/vue-http/web/server/api/optional/[[opt]].get.ts.fixture'
  - 'test/fixtures/vue-http/web/server/api/wild/[...].ts.fixture'
  - test/fixtures/vue-http/web/server/routes/feed.tsx.fixture
  - 'test/fixtures/vue-http/web/server/api/docs/[...file-path].get.ts.fixture'
parent_task_id: TASK-416
type: feature
ordinal: 475000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The Vue scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. Vue single-file components are not read by the TypeScript scanner, and Nuxt declares server endpoints by file location with method suffixes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Vue scanner reports fetch, axios and Nuxt $fetch and useFetch requests in the files it reads, and Nuxt server routes as endpoints.
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
1. plugins/scanners/vue/src/http.ts: report the Vue ecosystem's HTTP facts from the Volar program the scan already builds, so names resolve through its checker while every position maps back to the .vue or .ts source through the existing evidence operation map.
Requests: fetch, Nuxt's $fetch and useFetch, each recognized only when the project declares no such name of its own, with the URL first and the method from a literal method in an options object; an options object the scanner cannot resolve, or a method it cannot read, leaves the method out instead of claiming GET. axios, and an axios.create({ baseURL }) instance, through get, post, put, patch, delete, head, options, request(config) and axios(config), recognized by resolving the callee or receiver so a get on another object is never a request. URLs resolve through the shared plugins/scanners/http-url.ts and http-values.ts with the Vue package's own compiler, as React and Angular do.
Endpoints: Nuxt server routes by file location, server/api/** and server/routes/**, where the path after server/ gives the served path (api keeps its prefix, routes does not), [id] is a parameter, [...slug] a catch-all, index its directory, and a .get, .post, .put, .patch, .delete, .head or .options suffix gives the method, with no suffix meaning any method. The endpoint names the function the file's default export designates, including the one defineEventHandler receives, so the row points at the serving file; server/middleware/** and server/plugins/** are not endpoints.
2. plugins/scanners/vue/src/index.ts: pass the facts to the observation. No file-selection change is needed, because the scan already owns every program source file it reads, so components and outlines stay as they are.
3. Fixture test/fixtures/vue-outline-style project test/fixtures/vue-http: a single-file component whose script block sends requests, a .ts module with the axios forms, server route files for each method form and path shape, and abstentions for a project-declared fetch, a non-client get, a computed method, a host base, a configured base, a dynamic and a partly computed segment, a parameter base, a helper, server middleware and a call outside any function.
4. test-bun/vue-http.test.ts through the built package: the requests, the endpoints, and the rows core derives from the fixture's own facts.
5. docs/scanners/vue/index.md: the supported clients and locations, their limits, and the six producer decisions in order.
6. Isolated bun run check from a worktree at current HEAD, the Vue build, specification and quality self-review.

Review-fix round (external cold reviews at cf8e7975) and the approved endpoint fact additions. Already fixed in the shared readers under TASK-416.3: axios request-level baseURL and unreadable create config, duplicate option keys, mutable options, axios defaults. Fix here: (1) Vue treats every axios import, such as isAxiosError or a named post, as a client: move the default-import recognition into http-clients.ts once, so React and Vue share it. (2) Nuxt baseURL was ignored: $fetch and useFetch read their options' baseURL as ofetch does (a URL that already starts with a literal base is kept, else the base joins it; an absolute URL replaces it), and unreadable options leave the base unknown. (3) Nuxt named handlers were dropped, which let a broader route take their requests: resolve a handler named by a const or function in the file, and a default-exported function declaration; a route file whose handler the scan cannot resolve still reports its endpoint, named by the file's module operation, as the producer checklist says. (4) A route segment that mixes text with a placeholder, such as hello-[name], is a constrained parameter instead of being omitted. (5) Vue page: decisions 7 (constraints) and 8 (Nuxt prefers the most specific route, so no order). Noted for TASK-416.11: the JavaScript scanner's own axios reader ignores defaults until it uses the shared one.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
plugins/scanners/vue/src/http.ts reads the Volar program the scan already builds, so names resolve through its checker while every position maps back through the existing evidence operation map; a fact from a single-file component therefore names an operation in that .vue file at its own line, and no file selection changed, because the scan already owns every program source file it reads.
Requests: fetch, $fetch and useFetch, each only when the project declares no such name of its own, with the URL first and the method from a literal method in an options object; options the scanner cannot read, or a computed method, leave the method out rather than claiming GET. axios and an axios.create({ baseURL }) instance assigned once, through get, post, put, patch, delete, head, options, request(config) and axios(config), recognized by resolving the callee or receiver. URLs resolve through the shared plugins/scanners/http-url.ts and http-values.ts with the Vue package's own compiler.
Endpoints: Nuxt server routes by file location. server/api/** keeps its /api prefix and server/routes/** serves from the root; [id] is a parameter, [...slug] a catch-all, an index file serves its directory, and a .get, .post, .put, .patch, .delete, .head or .options suffix names the method, with no suffix meaning any method. The endpoint names the function the default export designates, including the one defineEventHandler receives. server/middleware/**, server/plugins/** and a route whose default export is not a function report nothing.
The React review's first two findings were checked here as well: the axios options rule and the assigned-once instance rule are the shared ones, and the fixture covers both. Findings three to five do not apply: index is stripped only as a file name, the server route pattern requires the api or routes directory, and Nuxt has no route groups.
Verification: bun test --timeout 120000 test-bun/vue-http.test.ts 3 pass, and the Vue scanner, lint and outline suites stay green. The built package reports 16 requests, 9 from Talks.vue's script block and 7 from client.ts, covering $fetch, useFetch, fetch, the axios shorthands, request(config), an axios.create base, a dropped query, a dynamic and a partly computed segment, a host base, a parameter base, a configured base, an unreadable options object and a helper whose caller is silent; a get on another object, a reassigned instance and a call outside any function report nothing. It reports six endpoints: GET and POST /api/talks, DELETE /api/talks/:id, GET /api/drafts from an index file, GET /api/files/:path+ and * /health, with nothing for server middleware or a non-function route. Core derives five rows from those facts alone, three from Talks.vue and two from client.ts, including Talks.vue to server/routes/health.ts for GET /health.
Isolated worktree from HEAD c671e6ab: bun install --frozen-lockfile and bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 491 pass, 32 skip, 0 fail). bun plugins/scanners/vue/build.ts succeeded there with the reader bundled.

Cold review corrections (coordinator decisions), applied: endpoints are gated on the project declaring nuxt, and the fixture declares it, so a Vue plus Vite app whose server directory holds another server publishes nothing; $fetch and useFetch must resolve to a declaration outside the project source, with .nuxt counted as project source and an installed package not, so a project's own useFetch composable is never read as Nuxt's and an unresolved auto-import claims nothing, which the page states as the cost; objectValue rejects an object whose property names are not identifiers or string literals, so a computed method key no longer reports GET, and the same fix reached React through the shared module; and route locations are matched relative to the project directory, so the fixture is now a Nuxt app in a subdirectory and a nested app keeps both its requests and its endpoints. Accepted items: a method suffix is taken only when it is a known one, so files/[...path].ts keeps its name; a MethodDeclaration is an operation, so an Options API method reports like its siblings and is named after itself; a request in a file's own top-level code, the standard <script setup> useFetch, now names that file's module operation instead of being dropped; the structural half that React and Vue shared moved to plugins/scanners/http-clients.ts, which both use with their own client recognition, cutting React's reader from 145 to 72 lines; createdClient requires the axios import, since an instance has no create; relative and enclosingOperation are reused from project.ts and evidence.ts; and the fixture's declare lines and the redundant negative assertions are gone.
Verification after corrections: bun test test-bun/vue-http.test.ts test-bun/vue-scanner.test.ts test-bun/vue-lint.test.ts test-bun/react-http.test.ts test-bun/angular-http.test.ts test-bun/typescript-http.test.ts 21 pass. The built package reports 17 requests, including web/Talks.vue#(module) for the top-level useFetch and web/client.ts#load for the Options API method, and 6 endpoints from the nested app's server routes; a project useFetch wrapper, a get on another object, a reassigned instance and a helper's caller report nothing. Core derives five rows from those facts alone. Isolated worktree from HEAD df88cbc3: bun install --frozen-lockfile and bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 495 pass, 32 skip, 0 fail); the Vue and React builds succeed there.

Review-fix round, implemented (awaiting cold review, not committed): http-clients.ts now owns one axios recognition, axiosClient (the axios default import, else a variable holding axios.create on it), used by React and Vue, so Vue no longer takes isAxiosError or a named post for a client; axiosRequest resolves clients with it unless a scanner passes its own. $fetch and useFetch read their baseURL option through optionsBase and join it as ofetch does (a URL that already starts with a literal base is kept, an absolute URL replaces it); unreadable options leave the base unknown. Nuxt route handlers: a default-exported function declaration, or a same-file function or variable-held function that the default export names or passes to a wrapper; a route whose handler the scan cannot resolve, or whose default export is not a function, reports its endpoint named by the file's module operation, so a broader route cannot take its requests. A segment mixing text with a placeholder, such as hello-[name], is a constrained parameter, and a segment the scanner cannot state becomes a constrained optional catch-all, so no route file is omitted. Vue page: base option, handler designation, decisions 7 and 8; the React page's base decision is reflowed. Fixtures: vue-http client.ts (named axios exports, three baseURL cases, a request to a named route) and server routes talks/named.get, talks/declared.get, talks/[id].get, imported.get with server/handlers.ts, hello-[name].get; the listing expectation adds them. Verified: every new expectation fails on the HEAD code, including the row that went to talks/[id].get.ts instead of the named route; isolated worktree bun install --frozen-lockfile and bun run check exit 0 (578 pass, 35 skip; lint warnings only in files outside this task); React and Vue builds succeed.

Cold review round 1 applied: a placeholder name the contract cannot spell, as in [[opt]] or [naïve], is * instead of failing the scan; the ofetch base rule moved to http-url.ts as withBase, decided on the joined text of base and URL, keeps a URL only when /, ? or its end follows the base, and starts the path unknown when that boundary falls on a computed part; Nuxt route names follow Nitro in vue/src/server-routes.ts: route group directories are dropped, then an environment suffix (.dev, .prod, .prerender), then a method suffix including connect and trace, then a final index; [...] is an unnamed catch-all; .jsx and .tsx route files count, and the Vue listing now includes .tsx and .jsx sources the scan reads; axiosRequest always resolves clients with the shared axiosClient, defaultClient and axiosClient are module-private, isDefaultFunction renamed. Fixtures: (admin)/users.get with a [resource].get sibling, speakers.get.prod, optional/[[opt]].get, wild/[...], routes/feed.tsx, and client requests for a templated base, a two-part base, a prefix that is not a segment, a computed boundary, users and speakers. Verified: the rows fail on the HEAD code (they went to [resource].get.ts); isolated worktree bun run check exit 0 (581 pass, 35 skip; lint warnings only outside this task); React and Vue builds succeed.

Final review round applied: segments now follow the names Nitro registers ([...] to **, [...name] with a word-character name to **:name, [name] to :name); a segment that then starts with ** is a catch-all, one that starts with : a parameter, and any other text, hello-:name included, is literal, so hello-[name] serves only /hello-:name and [[opt]] is a parameter; [...file-path] is a parameter. The ofetch base branch where the base starts with the URL's text is covered. Fixtures: docs/[...file-path].get and client requests slashed and anyResource. Verified: isolated worktree bun install --frozen-lockfile and bun run check exit 0 (581 pass, 35 skip; lint warnings only outside this task); React and Vue builds succeed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Vue scanner now reports its ecosystem's HTTP facts: requests through fetch, Nuxt's $fetch and useFetch, axios and an axios.create instance, in single-file component scripts as well as modules, and the endpoints a Nuxt project declares by file location under server/api and server/routes, with [id], [...slug], index files and method suffixes. plugins/scanners/vue/src/http.ts reads the Volar program the scan already builds, so names resolve through its checker while positions map back to the .vue or .ts source through the existing evidence operation map, and a file's own top-level code names its module operation. Endpoints need the project to declare nuxt, and $fetch and useFetch must resolve outside the project source, so a project's own composable is never read as Nuxt's. The client forms React and Vue read alike moved to the shared plugins/scanners/http-clients.ts, where the computed-property-name fix now serves both. Verified with test/fixtures/vue-http, a Nuxt app in a subdirectory, and test-bun/vue-http.test.ts: 17 requests covering every supported call and abstention, six endpoints with middleware and a non-function route silent, and five rows core derives from those facts alone. Isolated bun run check exit 0, and the Vue and React package builds pass. Documented in docs/scanners/vue/index.md, which answers the six producer decisions.

Review-fix round after external cold reviews: React and Vue share one axios recognition in http-clients.ts, so named exports such as isAxiosError are never clients. $fetch and useFetch read their baseURL as ofetch does (withBase in http-url.ts). Nuxt server routes follow Nitro's naming (vue/src/server-routes.ts: route groups, environment and method suffixes including connect and trace, [...] catch-alls, literal text before a placeholder, .jsx and .tsx files), and every route file reports its endpoint, naming its resolved handler, a default-exported function or a same-file function the export names or wraps, else the file's module operation, so a broader route never takes its requests. Verified with vue-http fixtures whose rows went to the wrong file on the previous code, and an isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
