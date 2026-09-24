---
id: TASK-506
title: Keep each Go router library's rules in one record
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 06:06'
updated_date: '2026-09-24 17:01'
labels: []
dependencies: []
references:
  - go-http
documentation:
  - docs/scanners/go/index.md
modified_files:
  - plugins/scanners/go/worker/libraries.go
  - plugins/scanners/go/worker/http.go
  - plugins/scanners/go/worker/routes.go
  - plugins/scanners/go/worker/mounts.go
  - groma/systems/groma-md/containers/go-worker/components/go-http.md
  - plugins/scanners/go/worker/nethttp.go
  - plugins/scanners/go/worker/chi.go
  - plugins/scanners/go/worker/gin.go
  - plugins/scanners/go/worker/echo.go
  - plugins/scanners/go/worker/routers.go
  - plugins/scanners/go/worker/requests.go
  - plugins/scanners/go/worker/evidence.go
type: task
ordinal: 587000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Go worker's knowledge of each router library is spread over six places in two files: the import-path match (framework), constructors (routerConstructors), root router types (rootRouters), registration methods (registrationOf), the method-pattern rule in routePattern and the path syntax in pathSegment (plugins/scanners/go/worker/http.go and routes.go). Adding a library means editing all six, and missing one silently drops its routes. The TASK-500 full-context review recommended one record per library before another library is added; gorilla/mux and httprouter are the next ones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 net/http, chi, gin and echo are each described by one record holding the library's import match, router constructors, root router type, route registration methods, method-pattern rule and path syntax.
- [x] #2 Every Go HTTP endpoint and request fact stays the same for the existing Go fixtures and tests.
- [x] #3 The route readers take framework-specific behavior only from the library records, so adding a library means adding its record and tests.
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
1. One record per router library, one file per library: nethttp.go, chi.go, gin.go and echo.go each hold their routerLibrary record and their own path syntax; libraries.go holds the record type, registration and group, the library list, libraryOf and packageLibrary. A record holds the import match, router constructors, root router type, route methods (each with its HTTP method written out and its handler position), groups (prefix argument or noPrefix, and whether the group hands its router to a closure; middleware chains are groups without a prefix), the mount method, the prefix-stripping package function, the default router for package route functions, and the pattern rules (method in the pattern and its case, host patterns, trailing-slash subtree, path segment syntax).

2. The readers take every library-specific rule from the records: routers.go tracks router values (declared names, group closures, routerOf, groups), mounts.go records which library's mount made each mount and keeps only routers of that library below it, routes.go keeps the shared pattern reading and gin's and echo's colon syntax, http.go keeps the file walk and the endpoint facts, and requests.go holds net/http client detection. A route's path is the first argument, or the second when an empty method says the first argument states it.

3. Verify AC2 by building the worker from main and from the change and comparing the complete observation JSON of every Go fixture byte for byte; run the Go scanner tests with GROMA_TEST_GO and bun run check.

4. Tests: none added. The change preserves behavior, and the go-http fixture test already pins every endpoint and request fact; a reader driven by records adds no rule of its own to test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned. plugins/scanners/go/worker/libraries.go holds the library record type and the net/http, chi, gin and echo records; http.go, routes.go and mounts.go read every library-specific rule from them, and framework(), routerConstructors, rootRouters, registrationOf and pathSegment are gone. The net/http record is still compared directly for client detection and the http.Method* constants: that is the standard library's client side, not a router rule.

Deliberate narrowings, none reachable by code that compiles: method-named routes are the library's own names (chi Title case, gin DELETE to PUT without CONNECT and TRACE, which gin lacks, echo CONNECT to TRACE) instead of any spelling of an HTTP method; With is a chi pass-through and Use a gin one, since chi's and echo's Use return nothing. One generalization: chi's Group adds no prefix whatever function it receives; the old literal check only told chi's Group from gin's and echo's Group(prefix).

AC2 evidence: a worker built from main (b30b74f2) and one built from this change produce byte-identical observation JSON for all four Go fixtures (go-http: 33 endpoints, 29 requests, 78 operations; go-module, go-duplicates, go-outline), with the same file list from main's sources.ts. GROMA_TEST_GO=$(which go) bun test test-bun/go-scanner.test.ts on main 16ff0735 plus only this task's four worker files: 10 pass, 0 fail. go vet clean; gofmt clean for the changed files. The watcher's singleton component for libraries.go was folded into go-http with groma edit go-http --combine libraries.

bun run check on main 16ff0735 plus only this task's four worker files, in a separate worktree with bun install --frozen-lockfile: exit 0; Biome 3 warnings in TypeScript this task does not touch; Node 16 pass; Bun 734 pass, 45 skip, 0 fail.

End-of-task complexity review (a general-purpose agent with a written brief of the conversation, because the fork agent type is unavailable): keep the design; six recommendations, all approved by Alex and applied. (1) Route methods are written out one per entry with their HTTP method, removing methodRoutes, methodHandler and route(), and registration lost path: an entry that forgot path: 1 would have read the method as its path, and an uppercased name such as prometheus's Del would have become method DEL. (2) One file per library with its path syntax. (3) The record type is routerLibrary so library values are called library and known always means a router; the segment field is pathSegment; evidence.go no longer says frameworks. The Go guide's framework wording stays because another session is editing that page. (4) groupRouter checks noPrefix before the argument count. (5) routesBelowMount merged into mount: a mount keeps only routers of the library whose mount method made it. (6) Router tracking moved from http.go to routers.go and isClient to requests.go.

While applying (1), endpointFact first read the method argument before the argument count check; restored the original order, so a call is indexed only after its length is checked. Go HTTP analysis's overview now states that each router library is one record in its own file. The watcher's singleton components for the five new files were folded into go-http with groma edit go-http --combine.

Re-verified after the six changes: byte-identical observation JSON for all four Go fixtures against the original main baseline; GROMA_TEST_GO=$(which go) bun test test-bun/go-scanner.test.ts on main 16ff0735 plus only this task's worker files: 10 pass, 0 fail; go vet clean; gofmt clean for every changed file.

bun run check on main 16ff0735 plus only this task's worker files after the six review changes, in a separate worktree: exit 0; Biome 3 warnings in TypeScript this task does not touch; Node 16 pass; Bun 734 pass, 45 skip, 0 fail. A search of the readers (http.go, routers.go, routes.go, mounts.go, requests.go) finds no library-specific branch left; the only direct uses of the net/http record are client detection and the http.Method* constants.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Each Go router library is now one record in its own file: nethttp.go, chi.go, gin.go and echo.go hold the import match, constructors, root router type, route methods with their HTTP method and handler position, groups, mount, prefix stripping, default router, pattern rules and path syntax. The readers take every library-specific rule from those records: routers.go tracks router values, mounts.go keeps only routers of the mounting library below a mount, routes.go reads patterns, http.go walks files and builds endpoint facts, and requests.go holds net/http client detection. Adding a library is now one file plus its tests. Verified: a worker built from main and one built from this change produce byte-identical observations for all four Go fixtures; the Go scanner tests pass (10) with GROMA_TEST_GO; bun run check passes. The end-of-task review's six recommendations were approved by Alex and applied.
<!-- SECTION:FINAL_SUMMARY:END -->
