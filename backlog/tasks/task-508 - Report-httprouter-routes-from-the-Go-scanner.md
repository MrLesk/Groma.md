---
id: TASK-508
title: Report httprouter routes from the Go scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 06:06'
updated_date: '2026-09-24 17:26'
labels: []
dependencies:
  - TASK-506
references:
  - go-http
documentation:
  - docs/scanners/go/index.md
modified_files:
  - plugins/scanners/go/worker/httprouter.go
  - plugins/scanners/go/worker/prometheus.go
  - plugins/scanners/go/worker/libraries.go
  - test/fixtures/go-http/httprouter.go
  - test/fixtures/go-http/prometheus.go
  - test-bun/go-scanner.test.ts
  - docs/scanners/go/index.md
  - groma/systems/groma-md/containers/go-worker/components/go-http.md
  - plugins/scanners/go/worker/nethttp.go
  - plugins/scanners/go/worker/chi.go
  - plugins/scanners/go/worker/gin.go
  - plugins/scanners/go/worker/echo.go
  - plugins/scanners/go/worker/library_nethttp.go
  - plugins/scanners/go/worker/library_chi.go
  - plugins/scanners/go/worker/library_gin.go
  - plugins/scanners/go/worker/library_echo.go
  - plugins/scanners/go/worker/library_httprouter.go
  - plugins/scanners/go/worker/library_prometheus.go
  - plugins/scanners/go/worker/routes.go
  - plugins/scanners/go/worker/routers.go
type: feature
ordinal: 589000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
julienschmidt/httprouter is a widely used Go router, and prometheus/common/route wraps it for the Prometheus projects. The Go scanner reports neither. In the TASK-500 qualification, prometheus (github.com/prometheus/prometheus at ae12f1afea9837adad6fd6ee750b83b0b17541e6) registered 81 routes through prometheus/common/route (web/web.go and web/api/v1/api.go), with prefixes from WithPrefix, and got 0 endpoints. 54 of those routes pass handlers returned by local wrapper calls, which stay unresolved unless that is supported separately.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Routes registered with GET, POST and the other method functions, Handle and HandlerFunc on a router built by httprouter.New are reported as HTTP endpoints naming their handler operation.
- [x] #2 prometheus/common/route routers, including WithPrefix prefixes, are reported with the same path rules.
- [x] #3 The :name and *name path segments follow httprouter's matching rules.
- [x] #4 A route whose prefix, method or handler the source does not prove reports nothing, as for the other Go routers.
- [x] #5 A pinned public httprouter application is scanned and each reported endpoint is checked against its source.
- [x] #6 The Go scanner guide states the supported httprouter forms and their limits.
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
1. Add plugins/scanners/go/worker/library_httprouter.go with the julienschmidt/httprouter record: httprouter.New builds a root router, and *httprouter.Router is its rootOnlyType, because httprouter has no groups; GET, HEAD, OPTIONS, POST, PUT, PATCH and DELETE take the path and then the handler; Handle, Handler and HandlerFunc take the method first. The file also holds colonSegment, httprouter's syntax, which gin, echo and prometheus route share: :name is one segment, *name the rest, and text before :name constrains the segment.

2. Add plugins/scanners/go/worker/library_prometheus.go with the prometheus/common/route record: route.New builds a router; Get, Post, Put, Options, Head and Query register GET to QUERY and Del registers DELETE; WithPrefix is a group with a prefix and WithInstrumentation a group without one; it has no rootOnlyType, because WithPrefix returns the same *route.Router type, so a router that arrives as a parameter may already carry a prefix and reports nothing. List both in libraries.go.

3. Extend the go-http fixture with httprouter.go and prometheus.go, each explaining its library's rules in its header, and the existing go-http endpoint test with their expected endpoints; rename that test after every supported router. Test rationale: the rule is AC1 to AC4; the wrong results it catches are missing httprouter or prometheus routes, Del reported as DEL, a WithPrefix prefix dropped, a prometheus router parameter reported without its possible prefix, and an unresolved wrapper handler reported; no fixture covers these libraries today, and adding their routes to the fixture the existing endpoint test already pins is the smallest check.

4. Document both libraries in the HTTP facts section of docs/scanners/go/index.md: recognized forms, prefixes, syntax, registration order (httprouter matches one route per request) and limits (wrapper handlers, prometheus router parameters, ServeFiles).

5. Verify: Go scanner tests with GROMA_TEST_GO, bun run check, and scans of pinned public repositories: syncthing for httprouter and prometheus at ae12f1afea9837adad6fd6ee750b83b0b17541e6 for prometheus/common/route, checking each reported endpoint against its source.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned: httprouter.go and prometheus.go hold the two records, libraries.go lists them, the go-http fixture gained httprouter.go and prometheus.go, and the go-http endpoint test (renamed after every supported router) pins their endpoints. Only records and fixtures changed; no reader changed.

Fixture result (worker built from the change): the 12 expected new endpoints (httprouter GET, POST, DELETE through Handle, PUT through HandlerFunc with http.MethodPut, GET through Handler with an http.HandlerFunc conversion, the /assets/:filepath+ catch-all, the constrained /rooms/:number!, a root router parameter; prometheus GET /-/healthy, GET, DELETE through Del and POST under WithPrefix("/api/v1")); nothing for either local wrapper handler or the prometheus router parameter; the other 33 endpoints and 29 requests unchanged.

AC5, syncthing at 94c3c1cdef718d568686620cbff268eeaaf2c87d (lib/api registers its REST API on httprouter.New): 52 new endpoints, none lost. All 50 restMux.HandlerFunc(http.MethodX, path, s.handler) registrations match method, path and handler, and both restMux.Handler(POST, /rest/noauth/auth/..., http.HandlerFunc(authMW.x)) registrations match too. Correctly unreported: /rest/system/pause and /resume (handler from s.makeDevicePauseHandler(...)), /rest/debug/*method (a mux value), and the config routes, which register through an embedded *httprouter.Router with a path parameter.

prometheus at ae12f1afea9837adad6fd6ee750b83b0b17541e6 still reports no endpoints, correctly: web.go reassigns its route router with WithPrefix(o.RoutePrefix), a runtime option, and web/api/v1 registers on a *route.Router parameter, whose prefix this scan cannot see.

Shared files: test-bun/go-scanner.test.ts and docs/scanners/go/index.md also hold other sessions' uncommitted hunks (TASK-519.3, which was told). This task's content was verified and will be committed as main plus only its own hunks. GROMA_TEST_GO=$(which go) bun test test-bun/go-scanner.test.ts on main a5e7de2b plus exactly this task's content: 10 pass, 0 fail.

bun run check on main a5e7de2b plus exactly this task's content, in a separate worktree with fresh dependencies: exit 0; Biome 3 warnings in TypeScript this task does not touch; Node 16 pass; Bun 736 pass, 45 skip, 0 fail. (A first Go test run in that worktree failed only because its node_modules predated TASK-522's lockfile; after bun install --frozen-lockfile every commit from 16ff0735 to a5e7de2b passes.)

End-of-task complexity review (a general-purpose agent with a written brief of the conversation, because the fork agent type is unavailable): keep the approach; both records match the upstream source. Alex approved and I applied: the record field root is now rootOnlyType, because a group returning the root type (gorilla's Subrouter next) makes root: "Router" look right while dropping prefixes; the six record files are named library_<name>.go so they sort beside libraries.go; colonSegment moved from routes.go into library_httprouter.go, so routes.go holds no path syntax, and the gin, echo and prometheus headers no longer point at gin; reader comments no longer list libraries (routers.go's declared now speaks of a library's root-only type); the shared test comment keeps only cross-library rules and says that each fixture file explains its library. Not applied, by decision: one guide entry per library, because docs/scanners/evidence.md asks every scanner page to answer the eight checklist questions in order. Also fixed three lines my guide edits had left badly wrapped.

Re-verified after those changes: the go-http fixture observation is byte-identical to the pre-cleanup TASK-508 output, go-module, go-duplicates and go-outline are byte-identical to the original main baseline, and syncthing's endpoints are identical; GROMA_TEST_GO=$(which go) bun test test-bun/go-scanner.test.ts on main d061106a plus exactly this task's content: 10 pass, 0 fail. The scan dropped the renamed files' old Code references, and the six library_* components the watcher created were folded into go-http.

bun run check on main d061106a plus exactly this task's content, in a separate worktree with fresh dependencies: exit 0; Biome 3 warnings in TypeScript this task does not touch; Node 16 pass; Bun 736 pass, 45 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Go scanner now reports routes from julienschmidt/httprouter and prometheus/common/route. Each library is one record file (library_httprouter.go, library_prometheus.go) with no reader change: httprouter's method functions, Handle, Handler and HandlerFunc on httprouter.New or a *httprouter.Router, and prometheus route's Get, Post, Put, Del (DELETE), Options, Head and Query under WithPrefix and WithInstrumentation groups. Both use httprouter's colon syntax, which now lives in library_httprouter.go and which gin and echo share. Unproven routes report nothing: wrapper handlers, handler factories, prometheus router parameters. After the end-of-task review, the record field root became rootOnlyType and the record files became library_<name>.go. Verified with the extended go-http fixture test, the Go scanner tests (10 pass), bun run check, syncthing (52 new endpoints, each matched to its registration) and prometheus at the pinned commit (no provable routes).
<!-- SECTION:FINAL_SUMMARY:END -->
