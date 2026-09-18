---
id: TASK-416.5
title: Report HTTP facts from the Java scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 20:06'
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
  - test/fixtures/java-http/src/main/java/http/AdminController.java
  - test/fixtures/java-http/src/main/java/http/PatternsController.java
  - test/fixtures/java-http/src/main/java/http/RepliesResource.java
  - test/fixtures/java-http/src/main/java/http/HotelsController.java
  - test/fixtures/java-http/src/main/java/http/TalksApi.java
  - test/fixtures/java-http/src/main/java/http/ApiController.java
  - test/fixtures/java-http/src/main/java/http/LibraryController.java
  - test/fixtures/java-http/src/main/java/http/RestrictedController.java
  - test/fixtures/java-http/src/main/java/http/FeaturedController.java
  - test/fixtures/java-http/src/main/java/http/StatusController.java
  - test/fixtures/java-http/src/main/java/http/ArchiveBase.java
  - test/fixtures/java-http/src/main/java/http/ArchiveController.java
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

Review-fix round (external cold reviews of HEAD cf8e7975, and the core fact format for constrained segments and registration order committed in 3426fe50):
8. Fix: a class-level @RequestMapping method was discarded, so a POST-only class reported * for a method mapping without a method. Spring serves the union of class-level and method-level methods; a side without a method adds no restriction, and an unresolved class-level method reports nothing for the class.
9. Fix: route constraints. A Spring {name:regex} is a constrained parameter; a segment mixing text with a placeholder or a wildcard (v{version}, *.json) is a constrained parameter instead of being dropped or read as a literal; a JAX-RS {name: regex}, whose expression may match a slash, a Spring {*name} or ** before the end, and a segment the format cannot state become a constrained optional catch-all that ends the path. Spring omits order.
10. Fix: bases. A protocol-relative //host/path states a host, so it has a leading unknown segment. Text after a configured base or a relative URL that does not start with a slash continues the base's last segment, so it is unknown. A field or local that nothing assigns after its declaration and whose initializer resolves to literal text has that text, so a host in it means a leading unknown segment; any other field stays configured and any other local unknown.
11. Docs: the Java page answers checklist decisions 7 and 8 and states the new rules; the fixture test/fixtures/java-http and test-bun/java-http.test.ts cover each case.
Skipped: a root-relative URL keeps configured (documented Spring base resolution; reviewers rated it optional with no row effect); the space used internally as the hole marker (optional, no wrong output).

12. Cold review of steps 8-11: Spring's class-level mapping is found on the class, else its interfaces and then its superclass in source, and every class route prefixes each mapping. A route the scanner sees but cannot read is a blocker, its readable prefix followed by a constrained optional catch-all, for every method unless the methods are known: an unresolved prefix or route, a class prefix holding a wildcard, a supertype outside the sources that may hold the class-level mapping, an unresolved method attribute on the mapping or the class, and a JAX-RS sub-resource locator. Spring {*name} and a trailing ** are optional catch-alls. An annotated field, such as one Spring injects with @Value, is never replaced by its initializer. The Java page documents params, headers, consumes and produces conditions as outside the fact.

13. Second cold review: a supertype outside the sources no longer makes the class prefix unknown (a type-level mapping on a dependency's interface is an accepted limit); only a supertype that does not resolve, other than Spring's ErrorController, turns the class's un-annotated @Override methods into blockers at the class's readable prefix for every method. Spring {*name} and trailing ** catch-alls are constrained, because Spring ranks them after every other pattern. A mapping's method is read only from RequestMethod constants, and a RestTemplate or fluent method only from HttpMethod constants. A ${...} configuration placeholder makes a route unreadable from its segment.

14. Last check: an unresolved supertype is also found through a supertype in the sources (a controller extending an in-source base that implements an unresolved interface), and a fluent method(...) reads only HttpMethod constants, pinned by a fixture.
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

Review-fix round (external cold reviews of HEAD cf8e7975 and the core fact format committed in 3426fe50 and bec16796), in three review passes:
- Class-level method restriction: Spring serves the union of class-level and method-level methods, so a POST-only class no longer reports * for a mapping without a method; an unresolved side makes the methods unknown.
- Constraints: Spring {name:regex}, text mixed with a placeholder and wildcards (v{version}, *.json) are constrained parameters instead of being dropped or read as literals; Spring {*name} and trailing ** are constrained optional catch-alls because Spring ranks them after every other pattern; a JAX-RS {name: regex} may match a slash, so it and the rest of the route become a constrained optional catch-all; routes built by concatenating constants are folded instead of dropped. Spring omits order.
- Prefixes: the class-level mapping is found on the class, else its interfaces and then its superclass in the sources, and every class route prefixes each mapping. A supertype outside the sources is taken to declare none (documented limit).
- Blockers: a route the scanner sees but cannot read is its readable prefix followed by a constrained optional catch-all, for every method unless known: an unresolved prefix, route or method (on the mapping or the class), a ${...} configuration placeholder, a class prefix holding a wildcard, a JAX-RS sub-resource locator, and an un-annotated @Override method of a controller that directly or through an in-source supertype extends or implements a type that does not resolve (Spring's ErrorController and resolved JDK types excepted). The route text carries an internal NUL marker from the unreadable point, which endpointSegments turns into the catch-all; client routes carrying it report nothing.
- Requests: a protocol-relative //host/path states a host; text continuing a configured base or a relative URL without a leading slash is unknown; a field or local that nothing assigns after its declaration, carries no annotation and has a literal initializer is resolved (a host then means no row), while an @Value field or a reassigned field stays configured; method constants are read only from RequestMethod (mappings) and HttpMethod (RestTemplate and fluent clients).
- Skipped: a root-relative URL keeps configured (documented; no row effect) and the internal hole marker in request segments (no wrong output).
Verification: test-bun/java-http.test.ts over test/fixtures/java-http pins 35 endpoints, the request list and the 5 derived rows; the new expectations fail on the HEAD worker, and removing each guard added in review (override blocker, supertype walk, ErrorController, resolved JDK types, client marker skip, annotated and reassigned fields, constant types) changes the fixture facts in a scratch build. The worker on callforpapers reports 433 endpoints (431 before, the two added are UserResource's concatenated-regex routes) with no blockers, and a synthetic request per endpoint keeps all 424 endpoint matches. Isolated worktree at HEAD with only this task's changes: bun run check exit 0 (Biome: only warnings in other lanes' files; tsc; node 16 pass; bun 581 pass, 35 env-gated skips, 0 fail).
Follow-ups (not in scope): a method that implements an unresolved interface's method without @Override reports nothing; a mapping a controller method inherits from an interface method in the sources is not read; a functional WebFlux RouterFunction is not read.

Correction to the verification line above: test-bun/java-http.test.ts pins 33 endpoints, not 35.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Java scanner now reports HTTP facts. Endpoints come from classes only: Spring MVC and WebFlux annotated controllers with their class-level @RequestMapping prefix, and JAX-RS resources with their class and method @Path. Requests come from @FeignClient and Spring HTTP interfaces, whose bodyless methods declare their own operations, and from RestTemplate, RestClient, WebClient and java.net.http HttpRequest builder chains, recognized by the receiver's declared type name in the file. Literal routes, URLs and declared constants become facts; a URI template placeholder is one dynamic segment, partly known text and computed URLs are unknown, a literal host becomes a leading unknown segment, and every other client base is configured. The scanner abstains where a wrong row could follow: an inherited prefix, an unresolved mapping method, an unresolved builder method, an unresolved prefix constant, a segment mixing text with a parameter, a receiver name with two declared types, and security matchers, filters and interceptors. Verified by test-bun/java-http.test.ts over test/fixtures/java-http, which pins the 8 endpoints, 15 requests and the 5 rows core derives, and by the worker over the callforpapers clone (431 endpoints, 3 honest requests); bun run check passed in an isolated worktree. The Java scanner page lists the supported APIs, the limits and the six producer checklist answers.

Review-fix round: the Java producer now follows the approved fact format and abstains where Spring or JAX-RS routing is not proved. Class-level methods combine with mapping methods as Spring does; pattern, mixed and wildcard segments are constrained, Spring catch-alls are constrained optional catch-alls, and a JAX-RS regular expression ends the path; class prefixes come from the class or its supertypes in the sources, each class route applies, and routes the scanner sees but cannot read are blockers (readable prefix plus a constrained optional catch-all). Protocol-relative URLs, text continuing a base and literal hosts held in unassigned fields or locals now lead with an unknown segment, while injected or reassigned fields stay configured. Verified by test-bun/java-http.test.ts, whose new expectations fail on the previous worker, by scratch builds removing each guard, by the worker on callforpapers (433 endpoints, all synthetic matches kept), and by bun run check in an isolated worktree.
<!-- SECTION:FINAL_SUMMARY:END -->
