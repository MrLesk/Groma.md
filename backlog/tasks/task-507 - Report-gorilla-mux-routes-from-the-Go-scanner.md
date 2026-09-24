---
id: TASK-507
title: Report gorilla/mux routes from the Go scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 06:06'
updated_date: '2026-09-24 18:11'
labels: []
dependencies:
  - TASK-506
references:
  - go-http
  - scanners-projects
documentation:
  - docs/scanners/go/index.md
modified_files:
  - plugins/scanners/go/worker/contract.go
  - plugins/scanners/observations.ts
  - plugins/scanners/go/worker/libraries.go
  - plugins/scanners/go/worker/library_chi.go
  - plugins/scanners/go/worker/routes.go
  - plugins/scanners/go/worker/library_gorilla.go
  - plugins/scanners/go/worker/routers.go
  - plugins/scanners/go/worker/mounts.go
  - plugins/scanners/go/worker/evidence.go
  - plugins/scanners/go/worker/http.go
  - test/fixtures/go-http/gorilla.go
  - test-bun/go-scanner.test.ts
  - docs/scanners/go/index.md
  - groma/systems/groma-md/containers/go-worker/components/go-http.md
  - test-bun/scan-source-units.test.ts
  - plugins/scanners/go/worker/project.go
  - plugins/scanners/go/worker/endpoints.go
type: feature
ordinal: 588000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
gorilla/mux is among the most used Go routers, and the Go scanner reports none of its routes as HTTP endpoint evidence. In the TASK-500 qualification, portainer (github.com/portainer/portainer at d661cbc0bbe2fb67dcc320ac8600b127c7f8cb9b) registered 297 routes this way and got 0 endpoints. Its wiring also shows what syntax support alone does not reach: handler structs embed *mux.Router and register through promoted methods, the served prefix comes from http.StripPrefix in a hand-written switch, and most handlers are wrapped in in-module conversions such as httperror.LoggerHandler(h.method). The scanner reports endpoint facts only; interpreting them stays in Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Routes registered with HandleFunc or Handle on a router built by mux.NewRouter are reported as HTTP endpoints naming their handler operation, with the method from Methods(...) or every method when none is given.
- [x] #2 PathPrefix(...).Subrouter() prefixes and the {name} and {name:regex} path variables follow gorilla/mux's own matching rules.
- [x] #3 A route whose prefix, method or handler the source does not prove, or that another chained call narrows, is reported as a blocker: its readable prefix followed by a constrained optional catch-all for every method, so no request under that prefix derives a relationship to another route of the same router.
- [x] #4 A pinned public gorilla/mux application is scanned and each reported endpoint is checked against its source.
- [x] #5 The Go scanner guide states the supported gorilla/mux forms and their limits.
- [x] #6 Every gorilla/mux endpoint reports its registration order, because gorilla takes the first registered match: one shared position per router tree, so equal positions leave the order unknown.
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
1. Contract: the Go worker's httpEndpoint gains the optional order {application, position} the scanner contract defines. plugins/scanners/observations.ts relocateObservation also moves an endpoint's order.application into repository coordinates, since the Go worker reports module-relative paths.

2. Records: libraries.go gains methodsCall and nameCall (calls that may follow a registration: gorilla's .Methods states the methods, .Name only names the route; any other following call narrows the route) and firstMatch (the library takes the first registered match); registration.pathArgument() owns the path position. library_gorilla.go holds mux.NewRouter, HandleFunc and Handle, the PathPrefix, Subrouter and StrictSlash groups, no rootOnlyType, and gorillaSegment. routes.go owns the brace placeholder grammar in braceSegment, which chi and gorilla call with their own rule for when a regular expression spans segments.

3. Readers: a router carries its application (the file whose constructor builds it) and a blocked flag; a group of a first-match library whose prefix this scan cannot read, or that stands below one, keeps the readable prefix and blocks. Each source carries, from loading, the call made on each call's result and the calls whose result an expression statement drops. endpoints.go reads registrations: one fact per method from the following calls, a blocker (the leading literal segments of the router's and the route's path, a constrained optional catch-all, method *, named after the registering operation) when the route is unreadable, narrowed, kept in a variable or on a blocked router, and order {application, 0} on every first-match fact. http.go keeps the file walk and call dispatch.

4. Tests: test/fixtures/go-http/gorilla.go with its facts in the go-http endpoint test, whose lines now show a fact's order, and a relocation assertion in test-bun/scan-source-units.test.ts. 5. Document gorilla in docs/scanners/go/index.md and verify with the Go tests, bun run check and pinned public applications.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned. Go contract: httpEndpoint.Order {application, position}. plugins/scanners/observations.ts relocateObservation now moves order.application with the other paths; the new order test fails without that change and passes with it. Records: libraries.go gained methodsCall, nameCall and firstMatch, registration.pathArgument() owns the path position rule, and library_gorilla.go holds the gorilla record and gorillaSegment. The brace placeholder parsing and matchesSlash moved from library_chi.go to routes.go, shared by chi and gorilla. Readers: a router carries its application and a blocked flag (routers.go); a group of a first-match library with a prefix this scan cannot read keeps its receiver's prefix and blocks; http.go notes each call's following call and the calls an expression statement drops (chainCalls), reads .Methods and .Name after a gorilla registration, reports one fact per method, and reports a blocker for an unreadable route; every gorilla fact carries order {file of mux.NewRouter(), 0}.

Scope decisions with Alex (2026-09-24): an unreadable gorilla route becomes a blocker, per checklist item 8 of the scanner evidence contract, instead of being omitted, and AC3 was reworded to say so; every endpoint of one gorilla router shares position 0 (order unknown among them), and AC6 was added for it. Documented limits: routers that arrive as parameters or fields or are embedded in a struct, Route chains such as r.Path(...).HandlerFunc(...), r.Methods(...).Subrouter() and r.PathPrefix(...).Handler(...), and routers behind http.StripPrefix report nothing.

Fixture (go-http/gorilla.go): GET /reviews, POST and PUT /reviews (Methods("POST", "PUT").Name), * /reviews/:id! (Handle with an http.HandlerFunc conversion, {id:[0-9]+}), GET /reviews/:id! ({id}.json), * /archive/:rest*! ({rest:.*} spans), GET /api/scores/:id (PathPrefix("/api").Subrouter()); blockers * /speakers/:path*! (wrapped handler), * /search/:path*! (Queries), * /kept/:path*! (route kept in a variable), and * /:path*! twice (computed path, route below a computed PathPrefix); nothing for a *mux.Router parameter. Every gorilla fact carries order {gorilla.go, 0}, no other fact does, and the other 45 endpoints, 29 requests and the go-module, go-duplicates and go-outline observations are unchanged.

AC4, Shopify/toxiproxy at 40f7fd31bee529d824116bd2a11a9e3425e904ec: all 13 registrations in ApiServer.Routes (api.go) match their source as 15 facts (ProxyUpdate and ToxicUpdate each POST and PATCH), each naming its method value handler; r.Handle("/metrics", server.Metrics.handler()) is a blocker * /metrics/:path*!, since the handler comes from a call; every fact carries order {api.go, 0}. Two more routes in test/e2e/endpoint.go are a separate application. portainer at d661cbc0bbe2fb67dcc320ac8600b127c7f8cb9b: 3 correct endpoints from its OAuth test server; its API handlers embed *mux.Router, a documented limit, so its 297 API routes stay unreported and no blockers appear for them.

GROMA_TEST_GO=$(which go) bun test test-bun/go-scanner.test.ts on main 6d59cb5e plus exactly this task's content: 11 pass, 0 fail.

bun run check on main 6d59cb5e plus exactly this task's content, in a separate worktree with fresh dependencies: exit 0; Biome 3 warnings in code this task does not touch; Node 16 pass; Bun 736 pass, 46 skip (the new Go test skips without GROMA_TEST_GO), 0 fail.

Cold simplicity review (fresh agent, task plus commit, no history): simplest implementation apart from one defect and unused assignments. Applied: (1) defect: a constant PathPrefix below a blocked router was added to the blocker's prefix, so the blocker claimed /reviews where the route serves /<version>/reviews and core could derive a wrong row; groupRouter now keeps a blocked router blocked, and the fixture's computed-prefix route sits under a constant PathPrefix, which the old worker reports as * /health/:path*! and the fixed one as * /:path*!; (2) the unused application assignments in declaredNames and mountedRouter are gone; (3) the separate order test is replaced by an order suffix in the go-http endpoint test and a relocation assertion in test-bun/scan-source-units.test.ts, each failing without its fix; (4) the guide's limits sentence says a gorilla route blocks and no longer repeats the StripPrefix bullet; (5) blocker builds its path with joinSegments, and endpointFacts is now registrationFacts.

After those changes: GROMA_TEST_GO=$(which go) bun test test-bun/go-scanner.test.ts test-bun/scan-source-units.test.ts on main 6d59cb5e plus exactly this task's content: 17 pass, 0 fail. The go-http endpoint test fails with the old groupRouter, and the relocation assertion fails with the old observations.ts.

bun run check on main 6d59cb5e plus exactly this task's content after the cold review changes, in a separate worktree: exit 0; Biome 3 warnings in code this task does not touch; Node 16 pass; Bun suite as reported by the check with 0 fail.

That check's Bun suite: 736 pass, 45 skip, 0 fail.

End-of-task complexity review (a general-purpose agent with a written brief, because the fork agent type is unavailable): keep the design; four behavior-neutral recommendations, all approved by Alex and applied: chi and gorilla share braceSegment in routes.go (each passes its spanning rule; a dead guard dropped), blocker reads the route with routePattern and literalSegments is gone, the endpoint readers moved from http.go to endpoints.go, and the call index is built when a source is loaded (project.go), so no reader depends on walk order. After them the observations of all four Go fixtures and of toxiproxy, syncthing and portainer are byte-identical to before; GROMA_TEST_GO=$(which go) bun test test-bun/go-scanner.test.ts test-bun/scan-source-units.test.ts: 17 pass; bun run check on main 6d59cb5e plus exactly this task's content: exit 0, Node 16 pass, Bun 736 pass, 45 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Go scanner now reports gorilla/mux routes. HandleFunc and Handle on mux.NewRouter become one endpoint per method a following .Methods states, or every method; PathPrefix(...).Subrouter() adds its prefix; {name} and {name:regex} follow gorilla's whole-path matching, so a variable that may match / spans the rest. Because gorilla takes the first registered match, every gorilla endpoint reports its order (one shared position under the file that builds its router), and, as Alex decided, a route the scan cannot read becomes a blocker under its readable prefix instead of being omitted, so Groma draws fewer relationships but no wrong one. Relocation now moves an endpoint's order into repository coordinates for nested modules. Verified with the extended go-http fixture, a relocation assertion, the Go scanner tests, bun run check, Shopify/toxiproxy (all 13 API registrations exact, one blocker for a factory handler) and portainer (only its test server; its API routers are embedded in structs, a documented limit).
<!-- SECTION:FINAL_SUMMARY:END -->
