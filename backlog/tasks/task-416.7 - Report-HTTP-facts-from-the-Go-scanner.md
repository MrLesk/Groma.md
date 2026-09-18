---
id: TASK-416.7
title: Report HTTP facts from the Go scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 18:16'
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
  - plugins/scanners/go/worker/mounts.go
  - test/fixtures/go-http/config/config.go
  - test/fixtures/go-http/admin.go
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

Review-fix round (external reviews of cf8e7975), each verified with a probe module at HEAD:
10. Codex http.go:164: a mount ignored its receiving router, so nested mounts and mounts inside a chi Route kept only the child's prefix, and a mount on an unknown router claimed its prefix. A mount now records its receiver and is resolved when the mounted router's routes are read: the receiver's full prefix plus the mount path; an unresolved receiver, or a router mounted twice, reports nothing.
11. Codex http.go:344: a reassigned router kept its earlier value, including conditional reassignment. A name assigned more than once is not a router, and an assignment whose value is not a readable router clears the name.
12. Grok routes.go:131-134, 214-217: every catch-all was optional. Request paths do not keep a trailing slash, so only a catch-all that is the whole served path (a root catch-all such as the bare / subtree) is optional; every other catch-all requires a remainder.
13. grok-all 7.1: a configured base followed by text that does not start with / became a literal path. It is now a leading unknown segment.
14. Found while verifying 13: fmt.Sprintf("%s/talks", base) reported the base as a dynamic first path segment. Empty text parts are dropped before the base is read, so a leading computed value is a base as for concatenation.
15. Waiting on the core fact format: route constraints (codex-all #5, chi {id:regex}) and order-based routing. Not committed until the orchestrator relays it.
16. Fixture cases in test/fixtures/go-http, assertions in test-bun/go-scanner.test.ts, Go page updated; verify with GROMA_TEST_GO and the isolated bun run check.
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

Review-fix round (external reviews of cf8e7975), everything except route constraints and order-based routing, which wait on the core fact format:
- Mounts: a chi Mount now records its receiving router and is resolved when the mounted router's routes are read, as the receiver's full served path plus the mount path. Nested mounts and mounts inside a Route group keep every prefix; a mount on a router this scan cannot read (a chi.Router parameter), and a router mounted twice, report nothing. The receiver is marked unknown while it resolves, so a router mounted inside itself ends. sameSegments is gone.
- Reassignment: a pre-pass counts the values assigned to each name; a router name assigned more than once is not a router, and an assignment whose value is not a readable router clears the name, so unresolved and conditional group reassignments report nothing.
- Catch-alls: request paths drop the trailing slash that an empty remainder needs, so every catch-all now requires a remainder except one that is the whole served path (a root catch-all such as the bare / subtree), which stays optional.
- Bases: a setting followed by text that does not start with / is a leading unknown segment; empty text parts are dropped before the base is read, so fmt.Sprintf("%s/talks", base) is a leading unknown segment rather than a dynamic first segment (found while verifying).
Fixture: chi.go nestedRoutes and mountOn, gin.go ginReassigned, client.go joinedBase and formattedBase; the test renderer now tells required (+) from optional (*) catch-alls. Against HEAD code every new expectation failed (9 endpoint lines, 2 request lines).
Verification: GROMA_TEST_GO bun test test-bun/go-scanner.test.ts 8 pass; go vet passes; isolated worktree GROMA_TEST_GO bun run check passed (Biome 1 warning and 2 infos in untouched files; node 16 pass; bun 526 pass, 26 skip, 0 fail); http-relationships tests pass.

Coordinator decision on request bases (all producers): a field holding the base URL setting stays configured; a value the scanner can resolve to a literal is resolved. Applied: readAssignments now also keeps each package-level variable's initializer, and a package variable that is never reassigned and whose initializer is literal text (directly, through consts, or through other such variables) is that text, so var outsideBase = "https://api.example.com" is a host and a leading unknown segment; one reassigned elsewhere, or initialized from os.Getenv, stays configured. The variable is left out while its initializer is read, so an initialization cycle (a type error the scan tolerates) ends. Fixture client.go outsideBase and mirrorBase; each expectation fails with its rule removed. Isolated worktree GROMA_TEST_GO bun run check passed (Biome 1 warning and 2 infos in untouched files; node 16 pass; bun 528 pass, 27 skip, 0 fail); go vet passes.

Cold review of the partial change, applied with the approved core spec for constrained segments and order:
- Package-variable bases: nameParts reads an identifier or a package selector; packageParts reads a package-level variable as the one value the source assigns it (declaration or its only assignment, in any package of the module), so config.APIBase with a literal host is a leading unknown segment, config.PathBase = "/api/v1" keeps its path, a host assigned in init or built by fmt.Sprintf is unknown, and mirrorBase (assigned twice) is unknown. A variable nothing in the source assigns (set by a flag or the linker) stays configured. readAssignments records each written-out assigned value (assignedValues); op-assignments and multi-value calls record none.
- Mounts: only a chi router routes below its Mount; a ServeMux, gin or echo router mounted with chi still reads the full URL, so it reports nothing. The mount block moved to plugins/scanners/go/worker/mounts.go (http.go was over 500 lines).
- A parameter counts as one assignment, so a chi Route closure parameter reassigned in its body is not a router; declared *http.ServeMux names assigned more than once are not routers either. readAssignments now runs over every file before declared types, mounts and routes.
- Constraints: endpointSegment gains constrained. A chi {name:regex} parameter, and a chi, gin or echo segment mixing text with a parameter ({id}.json, v:version), is a constrained parameter named after the parameter (chi placeholders may hold braced regular expressions). chi applies its regular expression within one segment, so none becomes a catch-all. net/http panics on a mixed segment, so it still reports nothing. No Go router takes the first registered match, so no endpoint reports order.
- Go page: checklist items 7 and 8, the base rule, mounts (non-chi, a receiver not yet read), mixed segments.
Red evidence in an isolated worktree with the uncommitted core change: reverting each rule makes its expectations fail (non-chi mounts add GET /v1/gintalks and * /api/muxtalks; without parameter counting GET /legacytalks appears; without packageParts six bases turn configured; without constrained three endpoints lose !). GROMA_TEST_GO bun run check passed there (Biome 1 warning and 2 infos in untouched files; node 16 pass; bun 549 pass, 27 skip, 0 fail); go vet passes. End to end, httpRelationships over the fixture derives one row client.go -> handlers.go.
Note: fmt.Sprintf("https://%s", host) + "/hosttalks" reports [unknown, dynamic, hosttalks]: the formatted host becomes a dynamic segment after the leading unknown. Core derives nothing either way.
Follow-up (pre-existing, not fixed): a *http.ServeMux parameter that its caller serves behind http.StripPrefix reports its own paths, such as /striptalks, because the StripPrefix call names the caller's value, not the parameter.

Targeted re-review, applied: (1) withText joins adjacent text parts, so a URL written in pieces from resolved package variables (scheme + "://" + host + "/talks", "http://" + host + "/talks") reads as the text it spells and its host is a leading unknown segment; before, the first read /http:/localhost:8080/talks and core derived a row to a two-parameter route. (2) chi hands a regular expression the text up to the character after its placeholder, which can cross a slash (chi v5.3.2 serves /files/a/report.json with /files/{path:.+}.json), so a chi regular expression that may match / (checked on its parsed syntax; one that does not parse may) is a constrained optional catch-all that replaces the rest of the route; one that cannot stays a constrained parameter. (3) Red test for reading assignment counts over every file first: admin.go declares adminMux and registers /admintalks, server.go assigns it twice. (4) By the approved rule, a package variable declared without a value and assigned once, even conditionally, resolves to that one value. Red evidence in an isolated worktree on HEAD 996fb4e9 (core committed as 3426fe50): reverting the join gives /http:/localhost:8080/schemetalks and /?/localhost:8080/porttalks; reverting the spanning check gives /api/reports/:path!; interleaving counts with declared types adds * /admintalks. GROMA_TEST_GO bun run check passed there (Biome 1 warning and 2 infos in untouched files; node 16 pass; bun 565 pass, 27 skip, 0 fail); go vet passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Go scanner now reports HTTP endpoint and request facts. The worker recognizes net/http, chi, gin and echo by import path and written type, tracks routers and clients as declarations, carries constant group and Mount prefixes, and names each endpoint's handler operation so a derived row points at the serving file. Requests come from the net/http client calls, with constant URLs folded through go/types, a whole computed segment as dynamic, partly known text as unknown, a configuration name as configured, and a host or local value as a leading unknown segment. Anything computed, a host pattern, a mixed segment and a route after a catch-all report nothing. docs/scanners/go/index.md answers the producer checklist and lists the supported APIs and limits. Verified with test/fixtures/go-http covering each API and each abstention case (8 Go tests), an end-to-end inferRelationships row from client.go to handlers.go, go vet, and an isolated GROMA_TEST_GO bun run check.

Review round: fixed paths to wrong derived rows found by external and cold reviews. chi mounts now carry every prefix of their receiving router, and a mount on an unreadable or non-chi router, a router mounted twice and any router or group-closure name assigned more than once report nothing. Catch-alls require a remainder except at the root. Request bases: a package variable is the one value the source assigns it (literal hosts become a leading unknown segment, a variable nothing assigns stays configured), text continuing a setting's last segment and a leading fmt.Sprintf value are unknown, and URL text written in pieces is joined. Under the approved fact format, chi regular expressions and mixed chi, gin and echo segments are constrained parameters, a chi regular expression that may match / is a constrained optional catch-all, and no Go router reports order. The mount code moved to mounts.go. Verified with red fixture cases for each rule and an isolated GROMA_TEST_GO bun run check on HEAD with the committed core change.
<!-- SECTION:FINAL_SUMMARY:END -->
