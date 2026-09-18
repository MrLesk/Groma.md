---
id: TASK-416.7
title: Report HTTP facts from the Go scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 06:18'
labels: []
dependencies: []
references:
  - worker-main
  - worker-http
  - routes
  - requests
modified_files:
  - plugins/scanners/go/worker/contract.go
  - plugins/scanners/go/worker/http.go
  - plugins/scanners/go/worker/routes.go
  - plugins/scanners/go/worker/requests.go
  - plugins/scanners/go/worker/evidence.go
  - plugins/scanners/go/worker/main.go
  - test/fixtures/go-http/go.mod
  - test/fixtures/go-http/handlers.go
  - test/fixtures/go-http/server.go
  - test/fixtures/go-http/chi.go
  - test/fixtures/go-http/gin.go
  - test/fixtures/go-http/echo.go
  - test/fixtures/go-http/client.go
  - test-bun/go-scanner.test.ts
  - docs/scanners/go/index.md
parent_task_id: TASK-416
type: feature
ordinal: 478000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The Go scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. Go 1.22 ServeMux patterns can include the HTTP method in the route string.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Go scanner reports endpoints declared with net/http ServeMux, chi, gin and echo, and requests made with the net/http client.
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
1. The Go worker detects frameworks syntactically, because external packages stay unresolved in a source-only scan: each file's imports map a local alias to net/http, chi, gin or echo.
2. Router and client values are tracked per package as go/types objects: constructors (http.NewServeMux, chi.NewRouter/NewMux, gin.New/Default, echo.New), declared types on parameters, struct fields and vars (*http.ServeMux, chi.Router/Mux, *gin.Engine, *echo.Echo, *http.Client), http.DefaultClient, plus group and middleware-chain expressions that carry a literal prefix (gin/echo Group, chi Route/Group/With).
3. Endpoints: one fact per registration call, with the group prefix included, the method from the call name, a literal method argument, or a net/http method pattern, and '*' for Handle, Any or Add without one. The operation is the handler's: a package function, a method value or a function literal, resolved through the existing operation index; an unresolvable handler produces no fact.
4. Routes are parsed per framework: net/http {name}, {name...}, {$} and trailing-slash subtree (bare '/' becomes an optional catch-all so core ranks it last); chi {name} and {name:regex} and *; gin :name and *name; echo :name and *. A host pattern, a segment that mixes literal text with a parameter, or a non-constant route produces no fact.
5. Requests: http.Get/Head/Post/PostForm, the same methods on a tracked client, and http.NewRequest/NewRequestWithContext, reported on the operation containing the call. The URL is read as parts: constant text through go/types constant values (so consts and concatenations fold), fmt.Sprintf verbs, and computed parts. A whole computed segment is dynamic, partly known text is unknown, the query and fragment are dropped, and a computed leading part sets the configured flag. A literal scheme or authority is reported as a leading unknown segment. Written against the simplified request shape (configured?: true) once packages/scanner/src/http.ts has it. No local-helper propagation: the Go scanner does not propagate arguments, so a helper's own partly computed URL stays unknown.
6. Fixture test/fixtures/go-http: one module with a file per framework, handlers in another file, a client file and an unresolved-cases file.
7. Tests in test-bun/go-scanner.test.ts render the facts as method plus path per file and assert each supported API and each unresolved case.
8. docs/scanners/go/index.md gains an HTTP facts section answering the producer checklist's six decisions in order, and listing supported APIs and limits.
9. Verify with go vet, the Go tests and the isolated bun run check with GROMA_TEST_GO.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. The worker recognizes frameworks by import path and written type, since a source-only scan leaves external packages unresolved: http.go tracks routers and clients (constructors, declared parameters, struct fields and vars, the default ServeMux, http.DefaultClient, group and middleware-chain expressions) and walks each file tracking the operation that encloses a call; routes.go holds the per-framework registration table and route syntax; requests.go reads URL expressions into text and computed parts. Endpoints name the handler's operation (function, method value, http.HandlerFunc conversion or function literal), so a row points at the file that serves the route. Constant routes fold through go/types constant values, so a const or a concatenation of consts resolves; a computed route, a net/http host pattern and a segment mixing literal text with a wildcard report nothing.
Judgment calls: (a) a whole computed segment is dynamic, including a %s verb that could contain a slash at runtime, following the contract sentence rather than the TypeScript naming hint; (b) os.Getenv and a name read before the path set configured, while any other computed leading value is a leading unknown segment; (c) no local-helper propagation, because this scanner does not propagate arguments.
Self-review fix: %% in a format string was read as a computed value instead of a literal percent; fixed with a fixture case (/rate/100%) and an unproven-method case.
Verification: GROMA_TEST_GO bun test test-bun/go-scanner.test.ts 8 pass. The two new tests assert every endpoint as file, method and path (chi Route groups, gin and echo Group prefixes, gin middleware before the handler, net/http method patterns, {path...}, {$}, the bare / catch-all, handlers owned by another file) and every request (dynamic segment, configured base from a field and from os.Getenv, literal, dropped query, host and computed values as unknown, client.Do reporting nothing). End to end, inferRelationships over the fixture observation derived 'client.go -> handlers.go Calls HTTP endpoints: GET /health, GET /talks, POST /talks, PUT /:path*' with mechanism go. go vet passes. Isolated worktree GROMA_TEST_GO bun run check passed (Biome 1 pre-existing warning in untouched files; node 16 pass; bun 444 pass, 19 skip, 0 fail); test-bun/http-relationships.test.ts also passes unchanged.
Note: the scan watcher created untracked singleton components worker-http, routes and requests for the new worker files; they are referenced but not curated here.

Cold review fixes: (1) a gin or echo Group whose prefix is not constant no longer falls back to the parent router, so its routes report nothing; only chi's closure form is prefix-free. (2) routerTypes now tracks only *http.ServeMux, because a chi, gin or echo router arriving as a parameter, field or closure parameter may already carry a prefix this scan cannot see; chi closure parameters still come from the group closure and gin/echo groups from assignments. The existing fixture facts stayed identical. (3) A new mount pass reads chi Mount before any route: a constant prefix is carried onto the mounted router (GET /api/talks in the fixture), a router built by a function whose result is mounted has its facts silenced, a router passed to http.StripPrefix reports nothing, and two different mount prefixes silence it. (4) A leading local variable or parameter is now a leading unknown segment rather than configured; a field, a package-level name and os.Getenv stay settings. (5) A route whose catch-all is not last, and a prefix containing one, are dropped, which also prevents the contract validation error that failed the whole scan. Accepted cleanups: the routes struct and newRoutes are gone (two maps on evidence plus the mount maps), ValueSpec has its own case in httpFile, isString is gone, and the Go page corrects the Mount, base and bare-/ sentences and states the mount limit.
Added abstention fixtures: a computed gin group prefix, a chi Mount with a mounted factory, a chi route continuing after a catch-all, and local-variable and parameter bases beside a package-level setting base.
Re-verification: GROMA_TEST_GO bun test test-bun/go-scanner.test.ts 8 pass; go vet passes; isolated worktree GROMA_TEST_GO bun run check passed (Biome 1 pre-existing warning in untouched files; node 16 pass; bun 452 pass, 19 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Go scanner now reports HTTP endpoint and request facts. The worker recognizes net/http, chi, gin and echo by import path and written type, tracks routers and clients as declarations, carries constant group and Mount prefixes, and names each endpoint's handler operation so a derived row points at the serving file. Requests come from the net/http client calls, with constant URLs folded through go/types, a whole computed segment as dynamic, partly known text as unknown, a configuration name as configured, and a host or local value as a leading unknown segment. Anything computed, a host pattern, a mixed segment and a route after a catch-all report nothing. docs/scanners/go/index.md answers the producer checklist and lists the supported APIs and limits. Verified with test/fixtures/go-http covering each API and each abstention case (8 Go tests), an end-to-end inferRelationships row from client.go to handlers.go, go vet, and an isolated GROMA_TEST_GO bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
