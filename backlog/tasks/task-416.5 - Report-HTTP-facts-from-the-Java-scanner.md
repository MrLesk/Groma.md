---
id: TASK-416.5
title: Report HTTP facts from the Java scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 06:41'
labels: []
dependencies: []
references:
  - java-src-index
modified_files:
  - plugins/scanners/java/java/md/groma/scanner/Http.java
  - plugins/scanners/java/java/md/groma/scanner/HttpPaths.java
  - plugins/scanners/java/java/md/groma/scanner/Declarations.java
  - plugins/scanners/java/java/md/groma/scanner/Main.java
  - test/fixtures/java-http/src/main/java/http/BaseController.java
  - test/fixtures/java-http/src/main/java/http/ChildController.java
  - test/fixtures/java-http/src/main/java/http/Clients.java
  - test/fixtures/java-http/src/main/java/http/ImportedMethodController.java
  - test/fixtures/java-http/src/main/java/http/PrefixController.java
  - test/fixtures/java-http/src/main/java/http/ReviewsClient.java
  - test/fixtures/java-http/src/main/java/http/ReviewsResource.java
  - test/fixtures/java-http/src/main/java/http/SecurityConfig.java
  - test/fixtures/java-http/src/main/java/http/Shadowed.java
  - test/fixtures/java-http/src/main/java/http/StreamController.java
  - test/fixtures/java-http/src/main/java/http/TalksClient.java
  - test/fixtures/java-http/src/main/java/http/TalksController.java
  - test-bun/java-http.test.ts
  - docs/scanners/java/index.md
parent_task_id: TASK-416
type: feature
ordinal: 476000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The Java scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. Declarative Java clients use the same mapping annotations as server controllers, so client interfaces must never be reported as endpoints.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Java scanner reports endpoints declared with Spring MVC, Spring WebFlux and JAX-RS, and requests made with java.net.http.HttpClient, RestTemplate, RestClient, WebClient, OpenFeign and Spring HTTP interfaces.
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
1. Java worker: new Http.java (a TreePathScanner over the analyzed units) and HttpPaths.java (annotation values, endpoint patterns, request URLs). Main.java runs it after Declarations and Uses and adds httpEndpoints and httpRequests to the observation; a declarative client method has no body, so its request declares its own operation through Declarations.
2. Endpoints, classes only, so a client interface can never be one: Spring MVC and WebFlux annotated controllers (@RestController or @Controller, class-level @RequestMapping prefix, @GetMapping/@PostMapping/@PutMapping/@DeleteMapping/@PatchMapping and @RequestMapping with method=), and JAX-RS resources (@Path class with @GET/@POST/@PUT/@DELETE/@PATCH/@HEAD/@OPTIONS and an optional method @Path). Security matchers, filters and interceptors report nothing.
3. Requests: declarative clients (@FeignClient and @HttpExchange interfaces, including @GetExchange and the same Spring mapping annotations) with their class-level prefix and a configured base, and imperative clients recognized by the receiver's declared type name in the file: RestTemplate (method per call name, exchange and execute read HttpMethod), RestClient and WebClient fluent chains (method call then .uri), and java.net.http HttpRequest.newBuilder chains (.uri, .GET, .POST, .PUT, .DELETE, .method).
4. Values: string literals and compile-time constants are literal text; a field the scanner cannot resolve to a constant, such as a @Value-injected base, sets configured; any other computed expression is a hole. A whole computed segment is dynamic, partly known text is unknown, a literal scheme and host produce a leading unknown segment, and a pattern segment mixing text with a brace parameter reports nothing. Local helpers are not supported: the request is reported where the client call is.
5. Fixture test/fixtures/java-http (Maven project) with a Spring controller, a WebFlux controller, a JAX-RS resource, a security matcher, a Feign client, an HTTP interface, imperative client calls and the unresolved cases; test-bun/java-http.test.ts asserts the worker facts and feeds them to core's httpRelationships for the derived rows.
6. docs/scanners/java/index.md: HTTP endpoints and requests section answering the six producer checklist questions in order.
7. Rebuild the package, run the tests and bun run check in an isolated worktree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. Http.java walks the analyzed units: a class annotated @RestController, @Controller or @Path reports endpoints from its mapping or JAX-RS method annotations under the class prefix, while an interface never serves, so @FeignClient and @HttpExchange interfaces report requests and declare their own operations through Declarations.declareOperation (a declarative method has no body). Imperative clients are recognized by the receiver's declared type name in the file: RestTemplate call names plus exchange and execute reading an HttpMethod argument, RestClient and WebClient fluent chains, and HttpRequest.newBuilder chains with uri, GET, POST, PUT, DELETE, HEAD or method(...), defaulting to GET. HttpPaths.java turns patterns into endpoint segments (literal, {name}, {name:regex}, {*name}, * and a trailing **, rejecting a segment that mixes text with a parameter) and URL expressions into request segments, resolving string literals and compile-time constants, treating an unresolved field as a configured base, and marking a whole computed segment dynamic and partly known text unknown.

Verification:
- bun test test-bun/java-http.test.ts (1 pass) over test/fixtures/java-http asserts the exact endpoint list (Spring MVC controller with a constant prefix and a catch-all, WebFlux controller, JAX-RS resource with a method @Path; nothing from the security matcher, the mixed v{version} segment or the controller whose prefix constant the sources do not declare), the exact request list (RestTemplate get, put and exchange, RestClient and WebClient fluent calls, an HttpRequest chain with a literal host reported as a leading unknown segment, a chain with an injected base set configured, a computed helper URL and a partly known segment reported unknown, and the Feign and HTTP interface methods as dynamic template segments), and the five rows core derives from those facts, including the two declarative clients.
- Real sample: the worker over the callforpapers clone's 665 main sources reports 431 endpoints and 3 requests, all requests honest (two computed URLs unknown, one configured base with an empty path), and no endpoint from its security configuration.
- Isolated worktree at b3d62477 with only this task's changes: bun run check passed (Biome: only the existing iso-map warning; tsc; node 16 pass; bun 458 pass, 0 fail).
Open: the shared plugins/scanners/observations.ts needs the HTTP fact operation remapping that another session has uncommitted; without it the facts are dropped when the Java scanner combines its per-pom observations, so the end-to-end flow depends on that change landing. Functional WebFlux RouterFunction routes are not read, and a client a method returns is not recognized; both are documented limits.

Cold review fixes, each reproduced with the built worker before and after: a controller or resource class that declares no prefix of its own and extends another class now reports nothing, because a base class can hold the prefix; a mapping whose 'method' attribute is present but unresolved, such as a statically imported RequestMethod, reports nothing instead of accepting every method; a java.net.http chain that names no method still sends GET, while one whose method(...) value is not literal reports nothing; 'url' is read alongside 'value' and 'path', so @GetExchange(url = ...) keeps its path; a receiver name the file declares with two types is dropped, so a repository call named like a RestTemplate variable is no longer a request. Accepted optional items: an imperative URI template such as getForObject(TALKS + "/{id}", ...) or uri("/reviews/{id}", id) now fills one whole segment, as the declarative form does; the unused fixture pom.xml is gone; checklist answer 1 and the JAX-RS interface limit are documented; simpleName folded into typeName and the three attribute overloads into one routes/text lookup.

Fixtures added for the five abstentions: BaseController with ChildController, ImportedMethodController, Clients#anyMethod, ReviewsClient#featured and Shadowed. Re-verification: bun test test-bun/java-http.test.ts 1 pass, now asserting 8 endpoints, 15 requests and 5 derived rows; the worker over the callforpapers clone still reports 431 endpoints and 3 requests; isolated worktree at fdaf2570 with only this task's changes: bun run check passed (Biome: only the existing iso-map warning; tsc; node 16 pass; bun 458 pass, 0 fail). The shared observations remap this task depended on is committed, so the facts survive per-pom combining.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Java scanner now reports HTTP facts. Endpoints come from classes only: Spring MVC and WebFlux annotated controllers with their class-level @RequestMapping prefix, and JAX-RS resources with their class and method @Path. Requests come from @FeignClient and Spring HTTP interfaces, whose bodyless methods declare their own operations, and from RestTemplate, RestClient, WebClient and java.net.http HttpRequest builder chains, recognized by the receiver's declared type name in the file. Literal routes, URLs and declared constants become facts; a URI template placeholder is one dynamic segment, partly known text and computed URLs are unknown, a literal host becomes a leading unknown segment, and every other client base is configured. The scanner abstains where a wrong row could follow: an inherited prefix, an unresolved mapping method, an unresolved builder method, an unresolved prefix constant, a segment mixing text with a parameter, a receiver name with two declared types, and security matchers, filters and interceptors. Verified by test-bun/java-http.test.ts over test/fixtures/java-http, which pins the 8 endpoints, 15 requests and the 5 rows core derives, and by the worker over the callforpapers clone (431 endpoints, 3 honest requests); bun run check passed in an isolated worktree. The Java scanner page lists the supported APIs, the limits and the six producer checklist answers.
<!-- SECTION:FINAL_SUMMARY:END -->
