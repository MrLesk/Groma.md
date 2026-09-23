---
id: TASK-492
title: Qualify and improve the Java scanner on public repositories
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-22 21:47'
updated_date: '2026-09-23 05:41'
labels: []
dependencies: []
references:
  - java-src-index
modified_files:
  - test-bun/java-scanner.test.ts
  - plugins/scanners/java/java/md/groma/scanner/Uses.java
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - test-bun/java-http.test.ts
  - plugins/scanners/java/java/md/groma/scanner/Http.java
  - plugins/scanners/java/java/md/groma/scanner/RetrofitRequests.java
  - plugins/scanners/java/java/md/groma/scanner/HttpPaths.java
  - plugins/scanners/java/java/md/groma/scanner/OkHttpRequests.java
  - docs/scanners/java/index.md
ordinal: 573000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex requested a repository-by-repository Java scanner exercise after the Rust pass. Scan diverse public Java projects for real build-model, source, call, HTTP, and lifecycle edge cases; fix verified scanner failures while keeping language-neutral Groma core and C4 policy separate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public Java repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported Java scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [ ] #3 The complete repository check passes after the Java scanner changes.
- [x] #4 Temporary repository clones are removed after Java qualification and the results are reported to Alex before work starts on another scanner.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build or verify the local Java scanner worker. Ask ten read-only agents to scan distinct public Java repositories in separate /private/tmp/groma-java-492-* checkouts. Each records the pinned commit, selected project root, exact result, source-backed suspected failures, and documented support boundary. 2. Reproduce verified failures in the smallest relevant Java test, fix the owning Java scanner module only, and rerun affected repositories. Keep Groma core language neutral and C4 policy outside the scanner. Record each test rule, wrong result, and coverage gap before adding assertions. 3. Run focused Java checks and bun run check, perform cold simplicity and final full-context complexity reviews if changes are substantial, remove all task-owned temporary repositories, report findings to Alex, and pause before another scanner.

Test decision for authored private calls: the Java guide promises exact targets for private methods. PetClinic loses four such targets when external Page types make the invocation result an error type; a minimal missing-type helper reproduces it. Existing Java call tests cover unresolved names and overloads, but not an exactly bound private method with an unavailable return or parameter type. Extend the focused Java scanner test to prove those calls resolve while an actual bad argument remains unresolved, then narrow the worker error guard.

Test decision for modular Java: the Java guide promises exact local calls from authored main sources. Helidon with module-info.java reports local calls unresolved and source-path errors because the worker gives javac an empty source path; a two-file module reproduces this. Existing Java tests use nonmodular sources only. Add one focused modular test that would fail on the lost target and source-path warning, then give javac the selected project root as a source path without running the build.

Test decision for two HTTP client gaps: Alex asked Java scans to cover practical real-project edge cases beyond the guide’s current limits. Quarkus declares three outbound GET methods on a @RegisterRestClient interface, but reports no requests; Spring PetClinic microservices calls WebClient.Builder.build().get().uri(...) twice, but reports no requests. Existing Java HTTP fixture covers Feign, Spring HTTP interfaces, and direct WebClient variables, not these shapes. Add two small source tests proving the route/method and typed builder request; keep unknown URL segments uncertain and leave C4 matching in core.

Test decision for Retrofit: the pinned Retrofit sample declares an outbound GET route on an interface method annotated with an imported retrofit2.http.GET, but the scanner emits no request. The Java guide already represents Feign/Spring declarative client methods as requests; this is the same source evidence shape, while a JAX-RS interface must not become a Retrofit request. Existing HTTP coverage has no Retrofit import or annotation. Add one narrow fixture for a nested Retrofit interface and a qualified JAX-RS control method, then keep the extraction in a Java-specific HTTP client owner.

Test decision for OkHttp: the pinned Java guide examples build a Request with a literal URL and GET/POST method, then send it through OkHttpClient.newCall(request).execute(); the scanner reports no requests. This is a practical client support extension under Alex’s stated goal. Existing Java HTTP tests do not cover a Request.Builder value or deferred newCall execution. Add one small test for sent GET/POST requests and an unsent newCall control, then extract only the typed, source-proven builder chain in a separate Java client reader. Keep unknown remote authorities uncertain.

OkHttp safety control: the existing URL rule does not follow a request variable after reassignment; otherwise an earlier builder could create a false outbound fact. Extend the same focused source example with one reassigned request and keep the expected two sent facts unchanged. Existing HTTP tests cover mutable URL values but not an OkHttp Request value passed to newCall.

Quality-review regression for OkHttp: Request.Builder.method("PATCH", body) states a method, while an unreadable method argument leaves it unknown. The new reader would otherwise default both to GET and create a false fact. Extend the focused OkHttp source test with literal and computed method calls; the former must be PATCH and the latter must produce no method claim. No existing test exercises this builder branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PetClinic private-call regression is red-to-green. An exactly authored private method was discarded because its invocation result type was ERROR when a dependency type was absent; the worker now rejects only compiler errors overlapping the call site. Existing invalid-argument coverage remains green. Focused java-scanner suite: 4 pass, 21 assertions.

Helidon modular-source regression is red-to-green. A two-file named module lost its exact local call and emitted source-path errors before the fix; focused Java tests now pass 5 tests and 23 assertions. Passing the selected project root as javac source path removes Helidon’s four module source-path warnings and restores 12 local call targets, including Main.java:172 BookService construction; no build or dependency loader was added.

Quarkus MicroProfile REST client extension is red-to-green: the focused interface test reports configured GET/POST path facts, and the pinned rest-client-quickstart now reports three configured GET /extensions requests while keeping its three endpoints. Client facts remain in the Java worker; core relationship policy is unchanged.

Spring PetClinic microservices WebClient.Builder extension is red-to-green. The focused test reports one typed builder request and rejects an unrelated Builder. Pinned gateway scan now reports GET /owners/{id} and GET /pets/visits with unknown remote authority where appropriate; requests rose from four to six, while source coverage stays at 53 files.

Retrofit declarative client extension is red-to-green. A nested interface with imported retrofit2.http.GET now emits a configured request; a qualified JAX-RS annotation in the same file remains excluded. Pinned Retrofit scan still inventories 168 main Java files and now emits 17 request facts, including GitHub#contributors GET /repos/{owner}/{repo}/contributors. New RetrofitRequests.java isolates this framework-specific syntax without adding C4 rules or growing Http.java past 500 lines.

OkHttp sent-request extension is red-to-green. The new Java reader requires an imported OkHttpClient, a visible Request.Builder URL and method, and direct execute/enqueue of newCall; it omits unsent and reassigned request values. The pinned samples/guide scan now reports 33 requests across 32 Java files, including SynchronousGet GET and PostString POST; remote authority remains unknown in facts. The shared assignment check moved to HttpPaths so Java client readers use one rule.

Ten public Java checkouts were pinned and scanned read-only: spring-petclinic 818c4136ea971c21674525f9053de0d9c7ad8cfe (30 files; private call defect fixed); spring-petclinic-microservices d24b248e01f1687d6a4d73d0332f1181591bd652 (53 files; WebClient.Builder gap fixed); quarkus-quickstarts 6346aa60199b1222236558dc16201f43455d940b (two REST modules; MicroProfile client gap fixed); dropwizard fc3a21fff8ade0c4c4c4cbc4f695531744926f49 (23 example files; all 18 annotated routes correct, dependency warning noise and registration limit); javalin 20ba71b211b5efa91f5c10ccb467326b86a1e5dc (14 Java main files; functional routes remain outside contract); micronaut-core 51e2d5966e12e9f2e477d22255f21b5fc348fb06 (39 http-client files; framework-specific HTTP and dependency warning limits); square/retrofit e27d855b7b029e7f907dfc52205fdb3e9c603c16 (168 files; declarative client gap fixed); square/okhttp 40a3b8749deaacf60a04c890aed052cb14ad36ee (49 conventional main files; sent request gap fixed); eclipse-ee4j/jersey 66ffdebcedb697d9b7fcb35e7e99c2301052b3cf (7 bookstore files; JAX-RS sub-resource locator remains a blocker); helidon-io/helidon d6d4b88e7826a441cb80c78364305d25621cd3bf (4 bookstore-se files; named-module binding fixed, functional routes remain outside contract). Selected subroots are recorded in agent reports and temporary observations. No agent edited shared source or clones.

The final Java worker package rebuilt successfully. Focused Java suites pass 20 tests and 93 assertions across scanner, HTTP, Gradle, outline and duplicate behavior. Biome lint on changed TypeScript tests and git diff --check pass. Changed Java source files remain under 500 lines.

Cold simplicity review accepted two ownership cleanups: Main now aggregates request facts and computes the assigned-variable set once for the HTTP readers. Its targeted re-review found no regression. The rebuilt worker and all five focused Java suites pass: 20 tests, 93 assertions; Biome lint on changed test files and git diff --check pass. The first bun run check reached 697 passing, 43 skipped, two failing viewer tests in concurrently modified Vue and route code. Vue HTTP passes alone; route-crossings fails alone. No Java suite failed.

Own specification and quality review traced Main.analyze through Declarations and Uses to the three Java HTTP readers and request output. Each new test targets a reproduced wrong result; tests do not freeze prose. The readers own Java client syntax, HttpPaths owns shared path/value rules, and no C4 or language-specific rule entered core. The full-context complexity reviewer found no material simplification or defect, and the cold review targeted re-review passed. The second bun run check produced 698 pass, 43 skip, 1 fail: route-crossings in concurrently modified map routing; it also fails alone. All Java suites pass. Removed all 23 task-owned /private/tmp/groma-java-492* entries and verified none remain. AC3 and DoD 1-2 remain open until the repository-wide check passes; task remains In Progress and uncommitted pending Alex review.

Alex requested commit and push on 2026-09-23. The isolated route-crossings viewer test still fails in concurrently modified map routing; Java-focused tests pass and this Java task has no overlapping route files. Commit and push the Java-only work now while leaving AC3 and DoD 1-2 open until the repository-wide check is green.
<!-- SECTION:NOTES:END -->
