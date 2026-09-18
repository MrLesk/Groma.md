---
id: TASK-416.2
title: Report HTTP facts from the Angular scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 14:30'
labels: []
dependencies: []
references:
  - angular-src-index
modified_files:
  - plugins/scanners/angular/src/components.ts
  - plugins/scanners/angular/src/http.ts
  - plugins/scanners/angular/src/scan.ts
  - test/fixtures/angular-http/package.json
  - test/fixtures/angular-http/tsconfig.json
  - test/fixtures/angular-http/environment.ts.fixture
  - test/fixtures/angular-http/talk.service.ts.fixture
  - test/fixtures/angular-http/routes.ts.fixture
  - test-bun/angular-http.test.ts
  - docs/scanners/angular/index.md
parent_task_id: TASK-416
type: feature
ordinal: 473000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The Angular scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. Angular applications usually call servers through HttpClient services.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Angular scanner reports requests made with Angular HttpClient.
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
1. plugins/scanners/angular/src/http.ts (new): recognize Angular HttpClient requests. The receiver must resolve to a declaration whose type reference or inject(...) token is HttpClient imported from @angular/common/http, so a same-named method on another object is never a request. Supported calls: get, post, put, patch, delete, head and options with the URL as the first argument, and request(method, url) with a literal method; a non-literal method omits the method, and request(HttpRequest) reports nothing. The module resolves a URL expression into literal text and holes (string literals, templates, string concatenation, const and readonly-property constants assigned a value once, and object-literal properties), and turns it into a fact: a root-relative literal path becomes literal segments, a value the scanner cannot see sets configured, and a host, a parameter or any other computed value becomes a leading unknown segment. One whole computed segment is dynamic; partly computed text is unknown. The URL composition follows the reference plugins/scanners/typescript/src/http-paths.ts; it stays in the Angular package until React and Vue need it, when one shared module can replace three copies.
2. plugins/scanners/angular/src/components.ts: angularImport also takes the module, so @angular/common/http names are recognized the same way as @angular/core names, from source and without the packages installed.
3. plugins/scanners/angular/src/scan.ts: the request's operation is the enclosing function, declared through the existing evidence operation map so binding and HTTP facts share one operation per function, and the observation reports httpRequests. No endpoints: Angular serves none, and router routes, interceptors and guards are not endpoints.
4. Fixture test/fixtures/angular-http (renamed .ts.fixture sources, as the other Angular fixtures do): a service covering every supported method and the inject form, a literal /api base, an environment base stating a host, a base the scanner cannot see, a dynamic segment, a partly computed segment, a parameter base, a helper whose path is a parameter, a same-named method on another object, and a Routes array with an interceptor.
5. test-bun/angular-http.test.ts: the built package's requests for each supported API, each unresolved case, no endpoints, and one end-to-end derived row through core with a matching endpoint fixture observation.
6. docs/scanners/angular/index.md: the supported clients, their limits and the six producer decisions in order.
7. Isolated bun run check, Angular build, specification and quality self-review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
plugins/scanners/angular/src/http.ts recognizes Angular's HttpClient by resolving the receiver: a constructor parameter property, a field or a local whose declared type is HttpClient, or one that inject(HttpClient) supplies, with both names read from source through the generalized angularImport (now taking the module), so the packages need not be installed and a get on any other object is never a request. Supported calls: get, post, put, patch, delete, head, options with the URL first, and request(method, url); a computed method omits the method, and request(HttpRequest) reports nothing. URL resolution follows the reference plugins/scanners/typescript/src/http-paths.ts: literals, templates, concatenation, const and readonly-property constants and object-literal properties become text; a parameter or any other computed value becomes a hole; a root-relative literal path is literal segments; a host or a computed base is a leading unknown segment; a value the scanner cannot see at all sets configured; one whole computed segment is dynamic and partly computed text is unknown; the query and fragment are dropped. Angular reports no endpoint: router routes, interceptors and guards answer no HTTP request. scan.ts declares each request's operation through the existing evidence map, so binding and HTTP facts share one operation per function, and the per-project facts reach the observation through the shared combineObservations.
The URL composition duplicates the reference's request side. One shared module could replace three copies once React (TASK-416.3) and Vue (TASK-416.4) need it; it stays in the Angular package for now.
Verification: bun test --timeout 120000 test-bun/angular-http.test.ts test-bun/angular-scanner.test.ts 10 pass. Through the built package, test/fixtures/angular-http reports exactly 17 requests: all seven methods plus request('DELETE', ...) with paths /api/talks and /api/talks/<dynamic>; byMethod without a method; latest as /api/talks/latest from a readonly base; search with its query dropped; external and fromBase with a leading unknown segment (host base, parameter base); configured with configured and /talks; partial with an unknown segment; send with /<unknown> while its caller viaHelper reports nothing; and the inject form as /api/speakers/<dynamic>. DraftService's storage.get('/api/talks') is not reported, the Routes array and the interceptor produce nothing, and httpEndpoints is undefined. Core then derives exactly one row, talk.service.ts to the file serving GET /api/talks, POST /api/talks and DELETE /api/talks/:id, with angular among the technologies.
Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 459 pass, 30 skip, 0 fail). bun plugins/scanners/angular/build.ts succeeded there. A first isolated run failed because the worktree predated the C# lane's commit that carries HTTP facts through combineObservations; rerunning from the current HEAD passed with no change to this work.

Cold review corrections (coordinator decisions), applied: the hole marker is now a NUL escape, so a literal segment that is exactly one space is literal text instead of dynamic; a readonly field counts as assigned once only when its class never assigns this.<name> again, because TypeScript lets a constructor replace it, and the page's decision 5 states that and notes that an Angular build's fileReplacements can swap environment.ts, so a literal environment base is the development value. Also: the fixture's service classes are one file, since cross-file resolution is not the rule under test; two abstentions were added, a mutable field base and request(new HttpRequest(...)); and the reader's names are now isHttpClient and callerOperation, matching the reference.
Verification after corrections: bun test --timeout 120000 test-bun/angular-http.test.ts 2 pass, with 19 requests now listed, including mutable and reassigned as /<unknown>/talks and no fact for packaged. Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 460 pass, 30 skip, 0 fail). bun plugins/scanners/angular/build.ts succeeded there.
The shared extraction the review asked for (plugins/scanners/http-url.ts and http-values.ts, settling the four divergences) belongs to TASK-416.3.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Angular scanner now reports the HTTP requests an application sends with HttpClient, so core can derive client-to-server rows for Angular front ends. plugins/scanners/angular/src/http.ts recognizes get, post, put, patch, delete, head, options and request(method, url) only after resolving the receiver to an injected HttpClient, read from source through the generalized angularImport, and resolves each URL into literal, dynamic, unknown or configured parts following the reference's rules: constants assigned once are literal text, a host or computed base is a leading unknown segment, a value the scanner cannot see sets configured, and the query is dropped. Angular reports no endpoint, because its router routes, interceptors and guards answer no request. Verified with test/fixtures/angular-http and test-bun/angular-http.test.ts: the built package reports 19 requests covering every supported call and every abstention, no endpoints, and core derives exactly one row to the file serving GET /api/talks, POST /api/talks and DELETE /api/talks/:id. Isolated bun run check exit 0 and the Angular package build both passed. Documented in docs/scanners/angular/index.md, which answers the six producer decisions.
<!-- SECTION:FINAL_SUMMARY:END -->
