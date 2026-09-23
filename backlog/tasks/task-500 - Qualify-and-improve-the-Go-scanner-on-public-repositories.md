---
id: TASK-500
title: Qualify and improve the Go scanner on public repositories
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 20:06'
updated_date: '2026-09-23 21:54'
labels: []
dependencies: []
references:
  - go-src-index
  - go-analysis
  - go-http
  - go-outline
modified_files:
  - plugins/scanners/go/worker/outline.go
  - test-bun/go-scanner.test.ts
  - plugins/scanners/go/worker/routes.go
  - plugins/scanners/go/worker/requests.go
  - plugins/scanners/go/worker/http.go
  - test/fixtures/go-http/chi.go
  - plugins/scanners/go/worker/project.go
  - plugins/scanners/go/worker/evidence.go
  - plugins/scanners/go/worker/main.go
  - test/fixtures/go-http/client.go
  - docs/scanners/go/index.md
  - test/fixtures/go-duplicates/forms.go
  - test/fixtures/go-http/echo.go
  - test/fixtures/go-http/gin.go
  - test-bun/execution-evidence-native.test.ts
  - test/fixtures/go-duplicates/generated.go
  - plugins/scanners/go/src/sources.ts
  - plugins/scanners/go/src/index.ts
  - plugins/scanners/go/src/adapter.ts
  - docs/scanners/evidence.md
  - plugins/scanners/go/worker/entries.go
type: task
ordinal: 581000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex asked for a scanner-by-scanner pass over every official scanner not yet qualified on public repositories, starting with Go. Diverse public Go projects expose real module, build-constraint, source, call, HTTP, outline and lifecycle edge cases that the existing fixtures do not. Verified scanner failures are fixed while C4 interpretation stays in language-neutral Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public Go repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported Go scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the Go scanner changes.
- [x] #4 Temporary repository clones are removed after Go qualification and the results are reported to Alex before work starts on another scanner.
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
1. Rebuild the local Go worker (done: 8 Go tests pass). Ten read-only agents each clone one pinned public repository into the session scratchpad (go/<n>-<repo>), run the shared raw runner (observation, listing, outline summary) and an end-to-end groma scan with the local Go scanner, and report classified, source-backed findings with minimal reproductions. Agents never edit the shared checkout. Repositories and the edge cases they target: open-telemetry/opentelemetry-go (many nested modules, tools module, cross-module imports), prometheus/prometheus (large multi-command app, route wrapper, generated protobuf, example modules), opencontainers/runc (Linux-only build constraints on a macOS host, cgo, committed vendor), tailscale/tailscale (many OS build tags and commands, scale against the 120 s and 64 MB worker limits), go-chi/chi (chi route syntax, underscore example directories), gin-gonic/examples (gin groups and parameters across many small programs), bxcodec/go-clean-arch (echo routes on a root router passed as a parameter), portainer/portainer (large gorilla/mux application), kubernetes-sigs/kind (packages under a build directory, tools module), cli/cli (HTTP clients with computed URLs, Windows-only files).
2. Compare findings with docs/scanners/go/index.md, the shared plugin contract and existing tests. For each verified wrong result, record the supported rule, the wrong result and the coverage gap, then fix it in the owning adapter or worker module with the smallest focused test. Practical gaps beyond the documented contract go to Alex before implementation. Core and C4 policy stay language-neutral.
3. Rebuild the worker, rerun affected repositories, run focused checks and bun run check, do the subtraction pass, the cold simplicity review and the full-context complexity review, remove every clone, report to Alex and pause before the next scanner.

Test decisions (rule and authority; wrong result; gap; smallest test). T1 outline, creating-a-plugin Source outline (a link naming a type never marks its members; Go Code links never name interface methods): chi's interface member Routes is marked entry when the link names type Routes; the outline test checks only top-level entries; extend it with a link naming Close, where Store.Close is an entry and Reader.Close is not. T2 chi regular expressions, chi findRoute (a placeholder that ends its segment is matched up to the next slash; only text after it lets the expression cross a slash): /raws/{path:.+}/raw becomes an optional catch-all that drops /raw and blocks rows below it; the fixture expectation encodes that wrong result; correct it to a constrained parameter. T3 chi method patterns, chi Mux.Handle splits METHOD pattern: HandleFunc("POST /items/{id}") becomes a false * endpoint at /POST%20/items; no chi method-pattern case exists; add one fixture route. T4 chi Method with http.MethodPut, Go contract lists Method and MethodFunc and requests already read net/http method constants: the route is dropped; the fixture uses only a literal; switch that call to http.MethodPut (gin Handle keeps the literal form covered).

T5 diagnostics, creating-a-plugin Observation contract (file and line locate an issue without embedding it in the message) and the Go page (missing dependencies produce diagnostics): every type error embeds the absolute checkout path and line:col, one per import per file, plus false follow-on errors such as undefined: echo (all ten repositories); no Go test reads diagnostics; extend the unresolved-calls test to expect one summary at a repository-relative file and no checkout path. T6 modules without active files, Go page (nested modules are scanned independently): a tools module whose only file is //go:build tools fails the whole Go scan (kind); no test covers it; extend the same test with a tools-only module that scans to no files. T7 cgo, Go's build rule (a file importing C is left out when cgo is off) and the Go page (type errors never block inventory): with CGO_ENABLED=0 the cgo file is scanned and its !cgo twin crashes the worker on the redeclaration (runc); no cgo test; one worker run with CGO_ENABLED=0 over a cgo/!cgo pair expects only the !cgo file.

T8 default client, Go page (requests come from the client methods on http.DefaultClient): http.DefaultClient.Head(...) called directly reports nothing (cli repro-4); the fixture only tracks named clients; add one direct default-client request to the fixture.

T9 hosts written in pieces, Go page HTTP facts 5 (a literal scheme and host are one leading unknown segment): fmt.Sprintf("http://%s/v1/catalog/services", address) reports the host as a path segment (prometheus custom-sd); the fixture's formattedHost case encodes that wrong result; correct its expectation to the leading unknown alone.

T10 blank functions, architecture-findings Compared operations (a named operation is declared with its own name; _ names nothing): stringer's func _() checks are compared and reported as duplicate logic (opentelemetry-go attribute/type_string.go:7); the duplicates fixture has no blank function; add one and expect it among the operations without tokens. Position conversion (opentelemetry-go: 162 s on a 2.8 MB generated file, killed at 120 s) is verified by timing and by identical positions against the previous worker on non-ASCII text, not by a timed test.

Approved-gap tests (authority: Alex's decision of 2026-09-23). T11 root routers: routes on *echo.Echo and *gin.Engine parameters are dropped (go-clean-arch 0 of 4); the fixture has no root-router parameter; add one per framework plus group parameters that stay unreported. T12 one build context: GOOS, GOARCH and CGO_ENABLED change the scanned files (runc loses a third on macOS); replace the cgo-off test with one worker run per environment expecting the same linux cgo file set; the cgo-off rule becomes dead code and is removed. T13 generated code: generated files are compared as duplicate logic (prometheus 55 of 409 lint groups); the duplicates fixture has no generated file; add one and expect its operation without tokens. T14 entries: a main package's entry excludes the module packages it imports (portainer 816 unplaced components); the existing native entry test asserts that exclusion; change it to expect direct and indirect module imports.

T15 one file selection, creating-a-plugin Source file listing (never leave out a file the scan reads), go help packages (. and _ paths and testdata are ignored) and the scanner rule of tracked and unignored files: files under build/, dist/ and generated/ are scanned but not listed, and gitignored files and _examples are scanned (kind, portainer, tailscale, cli, chi); the listing test covers only a plain module; add one module with those paths and a nested module, expecting the listing and the combined scan to name the same files.

Cold simplicity review (no conversation history): one blocking finding, blank imports shared one alias key, so an entry kept only the last blank-imported module package (tailscale cmd/tailscale); entries now follow go/types package imports, and T16 extends the native entry test with two blank imports. Accepted clean-ups: early return and a nil-safe client lookup in http.go, importPaths renamed importAliases, the router comment and the outline rule in the Go page, the redundant default-environment run deleted. Kept: the dependency list in the summary, which matches the Java scanner's JAVA_MISSING_EXTERNAL_TYPES summary; the redeclaration guard, which implements the Go page rule that type errors never block inventory, now covered by T17 (a redeclared function scans).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex's decision (2026-09-23): close the four recommended gaps beyond the Go contract, with the explicit requirement that every platform produces the same scan result: (1) *gin.Engine and *echo.Echo parameters and fields are root routers, like *http.ServeMux; (2) a main package's entry covers the module packages it imports, directly or indirectly; (3) operations in files marked as generated carry no tokens, so they stay out of duplicate review; (4) one fixed build context, linux/amd64 with cgo, replaces the host platform and the GOOS, GOARCH and CGO_ENABLED environment. gorilla/mux and other router libraries stay out of this task.

Ten pinned public repositories were scanned read-only by ten agents with the shared runner and an end-to-end groma scan (baseline, then the final worker). opentelemetry-go 9a39658ecc0ff8dc2ab6cd148c71b7de6d40a3bb: whole scan failed on a test-only module; the root module took 232 to 499 s because position conversion reread each file (2.8 MB generated file 162 s, killed at 120 s); final 4.3 s, 38.6 MB, 27 modules. prometheus ae12f1afea9837adad6fd6ee750b83b0b17541e6: failed on test-only and tools modules; final 1.3 s; custom-sd host no longer a path segment. runc 41b74772b651b3b42a1f04a43a803db16f0e7e9b: macOS scanned 95 files, Linux 127, and cgo off crashed on a !cgo redeclaration; final one linux/amd64 cgo context, 127 files. tailscale 8d43ba67374c7c055c28cd55bf65ddc015d18248: 13 files scanned but not listed, host-dependent entries; final 2.3 s, 0 unlisted, 1,393 files, 80 entries, 68 endpoints, 162 requests. go-chi/chi 3d1777a1ef8881f7d1da0b02c76ca8f0a29cd2bc: _examples produced 12 demo entries; regex, method-pattern and outline defects; final 35 files, no demo entries. gin-gonic/examples c2f7a0b158e7c8a60336f9ca5e97a517740234dc: all 62 endpoints correct; diagnostics now one summary per module. go-clean-arch e06c6d0cb37069b0ef56e3df67f80ca130a1ab82: 0 of 4 echo routes; final 4 of 4, and a rescan places 11 of 14 components in container app (the 3 test mocks stay). portainer d661cbc0bbe2fb67dcc320ac8600b127c7f8cb9b: 1 unlisted file, now 0; 297 gorilla/mux routes stay outside the contract. kubernetes-sigs/kind aa74c7f3e55dbadccd61199b75c01a591a6c2267: failed on tools modules and 28 build/ files were unlisted; final ok, 0 unlisted. cli/cli 6f7893163bb67716e27ab38261d06dc1fc47057b: 14 unlisted files, now 0; the .github CodeQL fixture module is no longer scanned; direct http.DefaultClient requests are recognized. Every final listing equals its scan (0 scanned-but-unlisted files in all ten). Positions match the previous worker on non-ASCII text.

Specification review: AC1 and AC2 are met by the evidence above and T1 to T15, each failing on the committed scanner and passing now. AC3: in a clean worktree with only this task's changes, Biome, typecheck and Node tests passed and the Bun suite had 716 pass, 34 skip and 2 timeouts in Angular and Python tests at load average 40+; both pass alone. AC4 pending clone removal and the report. Quality review: sources.ts is the one owner of Go file and module selection for listing and scan; project.go owns the build context and the diagnostic summary; main.go owns entries; evidence.go owns positions and compared operations; http.go, routes.go and requests.go own HTTP rules. Tests fail on the concrete wrong results and do not freeze prose.

AC3 evidence: after the cold-review fixes, the complete repository check ran in a clean worktree at HEAD with only this task's changes and GROMA_TEST_GO set: Biome clean apart from 4 existing warnings in files this task does not touch, scrollbar lint, typecheck, Node tests (16 pass) and the Bun suite (718 pass, 34 skip, 0 fail); exit 0.

Full-context complexity review (run as a general agent with a written brief of the conversation, because the fork agent type is unavailable): keep the design; six same-behavior clean-ups proposed: read and parse each file once in loadSources and build its source there; move packageEntry and declaresMain to entries.go; move rootRouters next to routerConstructors; collapse the build-context test onto the adapter's run; rename the unresolved-calls test after what it covers; name sources.ts in the worker's scan comment. Follow-ups outside scope: one record per router library, and separating HTTP state from operation state in the worker. Awaiting Alex's decision before applying any of them.

Alex approved the six review clean-ups and closing the task. Applied: loadSources reads and parses each file once (with comments) and builds its source; entries moved to worker/entries.go; rootRouters sits beside routerConstructors; the build-context test uses the adapter's run; the unresolved-calls test is renamed after what it covers; the worker's scan comment names sources.ts. Focused Go and entry tests pass (14). Reruns of the ten repositories match the previous results except entries now holding blank-imported packages (prometheus, tailscale); positions match the earlier worker on non-ASCII and large generated files. All ten clones and the scratch worktree were removed. Final verification on the exact commit content in a clean worktree with GROMA_TEST_GO set: Biome (4 existing warnings in other files), typecheck, Node tests 16 pass, Bun suite 720 pass, 34 skip, 0 fail; exit 0.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Qualified the Go scanner on ten pinned public repositories and fixed what they exposed: modules without active files no longer fail the scan; positions convert in logarithmic time (2.8 MB generated file 162 s to 0.4 s); one file selection (sources.ts) serves listing and scan like the go command; type errors fold into one located summary per module; chi regex and method patterns, http.MethodPut, direct http.DefaultClient requests, hosts written in pieces and interface outline entries are correct; blank and generated operations are not compared. With Alex's approval: one linux/amd64 cgo build context makes every machine scan the same files, *gin.Engine and *echo.Echo parameters are root routers, and entries include the module packages they import. Verified with 17 focused test decisions (each fails on the previous scanner), ten repository reruns, and the complete repository check on the commit (720 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
