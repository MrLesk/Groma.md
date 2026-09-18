---
id: TASK-416
title: Derive certain HTTP relationships from scanner endpoint facts
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-18 14:58'
labels: []
dependencies: []
references:
  - scanner-src-index
  - scan-evidence
  - scanner-registry
documentation:
  - docs/relationship-inference.md
  - docs/scanners/evidence.md
modified_files:
  - packages/scanner/src/http.ts
  - packages/scanner/src/values.ts
  - packages/scanner/src/index.ts
  - src/http-relationships.ts
  - src/relationship-inference.ts
  - src/scanner/registry.ts
  - test-bun/http-relationships.test.ts
  - test-bun/scanner-exclusions.test.ts
  - docs/relationship-inference.md
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - docs/component-markdown.md
  - docs/agent-instructions/relationships.md
type: feature
ordinal: 471000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Client-to-server HTTP calls are among the most important collaborations in an application, and today every one must be written by hand. The inference design already names protocol matching as rule 4 (`docs/relationship-inference.md`): each scanner recognizes its own ecosystem's HTTP clients and routing, and core joins the reported facts. The rule must hold for arbitrary repositories, languages and frameworks, not only the repositories used while building it.

A derived row cannot be deleted, because the next scan restores it, while a missing row can still be written by hand. A wrong row is therefore permanent noise, so the rule must produce no row whenever the match is uncertain.

Routing styles seen in the wild include annotation and attribute routes with class-level prefixes and name tokens, route tables and builder calls, route groups, and routes declared by file location, with literal, parameter, optional and catch-all segments. Requests often use a configured base URL or pass through small local helper functions.

Paths may differ by one leading segment, such as an `/api` prefix or a deployment path that only the client or only the server states. Tolerating exactly one such segment is an accepted trade-off that is expected to be right in most repositories.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scanners report the HTTP endpoints they provide and the HTTP requests they make as language-neutral facts (method, path, operation) without referring to any other scanner.
- [x] #2 The fact format expresses literal, parameter, optional and catch-all path segments and endpoints declared by file location.
- [x] #3 A request made through a local helper function counts only when its URL and method provably reach a recognized client unchanged.
- [x] #4 Authored rows for the same file pair keep precedence, and independent fixtures cover matches and every no-row case.
- [x] #5 Relationship inference and scanner evidence documentation describe the rule, the fact format and their limits.
- [x] #6 Once the Angular and Java producers exist, callforpapers is scanned from scratch with its existing Groma folder moved aside, and every difference between derived and authored HTTP rows is recorded.
- [x] #7 Core derives a row from the requesting file to the providing file only when the methods match, the known request path equals the endpoint path either completely or after removing the first path segment from one side, and every endpoint the request can match belongs to that one file.
- [x] #8 Requests whose path is only partly known (beyond whole segments that match path parameters), requests to a literal host, and requests that match endpoints in several files produce no row; a configured base value followed by a literal path counts as a known path, and query strings are ignored.
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
Core slice (ACs 1-5, 7, 8). AC 6 waits for the Angular and Java producers.
1. Contract (packages/scanner): http.ts defines ScanHttpEndpoint {operation, method or '*', path} and ScanHttpRequest {operation, method?, base none|configured|host|unknown, path}. Endpoint segments are literal, parameter and catch-all (both optionally optional). Request segments are literal, dynamic and unknown. A file-location route uses the same shape. Literal text and names are RFC 3986 path characters. The new fields are optional on ScanObservation and require operations; createScanObservation validates them and parseScanObservation passes them through.
2. Core (src/http-relationships.ts): resolve each fact's operation to its file within its observation. A request can produce a row only with a known method, base none or configured, and no unknown segment. It reaches an endpoint when the methods are equal (or the endpoint accepts any method) and the path matches exactly, or after removing one leading literal from one side when both sides then continue with the same literal. Every reached endpoint must be in one file, and the two files must have different owners. The row reads 'Calls HTTP endpoint(s): <METHOD> <endpoint path as :id, :id?, :path+, :path*>'. Its technology lists the contributing scanner IDs, so failed-scanner retention keeps working.
3. src/relationship-inference.ts: merge callback and HTTP statements into one derived row per file pair. Authored precedence stays with sourceRelationships.
4. src/scanner/registry.ts: shared exclusions drop HTTP facts whose operation is excluded.
5. Tests: hand-built observations cover every match and no-row case, plus contract validation; a reconcile test covers authored precedence and a stored row; the exclusion test gets one new assertion.
6. Docs: relationship-inference.md (HTTP rule, rule 4), scanners/evidence.md (fact semantics, local helper rule, limits), scanners/creating-a-plugin.md (fields and example), component-markdown.md (derived rule coverage).
7. Run focused tests, then bun run check in an isolated worktree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core slice implemented. AC #6 waits for the Angular and Java producers (TASK-416.2, TASK-416.5).
Contract: packages/scanner/src/http.ts defines ScanHttpEndpoint {operation, method or *, path} and ScanHttpRequest {operation, method?, base none|configured|host|unknown, path}. Endpoint segments are literal, parameter and catch-all; the last two take optional. Request segments are literal, dynamic and unknown. Literal values and names must be RFC 3986 path characters, so a query, fragment, slash or brace is rejected. HTTP facts require declared operations. createScanObservation validates them and parseScanObservation passes them through.
Core: src/http-relationships.ts resolves facts per observation and ignores requests with an unknown method, base or text. A request reaches an endpoint on a method match (or *) and a path match (literal=literal|parameter; dynamic=parameter|catch-all; optional parameters; catch-all + / *). One leading literal that only one side states may be dropped when both sides then continue with the same literal. All reached endpoints must share one file, and the two files need different owners. src/relationship-inference.ts merges callback and HTTP statements into one derived row per file pair (the Markdown contract allows one derived row per pair). src/scanner/registry.ts drops HTTP facts of excluded operations.
Decisions:
(a) Technology lists the contributing scanner IDs, not HTTP. scan-reconciler retains a derived row whenever its technology names an inactive scanner, so a technology of HTTP would never refresh.
(b) Labels use :id, :id?, :path+, :path*. The Markdown parser (comark) strips {id} as attribute syntax.
(c) The prefix tolerance also requires a shared literal after the removed segment, so /api/:id never matches /talks.
(d) A local helper may prepend a configured base and still count as unchanged.
Evidence: test-bun/http-relationships.test.ts, 32 tests: 11 match cases, 16 no-row cases, owner checks, endpoint listing and scanner order, callback+HTTP merge, contract round-trip and rejections, and a reconcile test (stored row, retention while a contributing scanner is absent, authored precedence). test-bun/scanner-exclusions.test.ts asserts dropped HTTP facts; that assertion failed without the registry change.
Isolated bun run check exited 0 (Bun tests 409 passed, 20 skipped, 0 failed; Node tests 16 passed; Biome findings only in untouched files).
Follow-ups outside this slice:
- plugins/scanners/observations.ts relocate/combine must carry httpEndpoints/httpRequests and re-key their operation IDs (TypeScript-family producers).
- Native contract mirrors (Contract.cs, contract.go, etc.) belong to each producer.
- docs/agent-instructions/relationships.md still says HTTP calls need authoring; update it once producers exist.

Cold review applied with the owner's decisions.
A. Routing precedence: matching endpoints are ranked, lowest first, as exact path before one needing a leading segment removed, and literal or parameter before catch-all. Only the best rank is considered, so a fallback route no longer blocks a specific one, and pages/talks beside api/talks resolves.
B. Sibling literals: a dynamic segment may equal a literal at runtime, so matching treats a literal endpoint segment as filled by a dynamic request segment when deciding ambiguity. A row needs at least one endpoint reached without that substitution. /talks/<dynamic> with /talks/:id in one file and /talks/archive in another derives nothing.
C. Base resolution (docs/scanners/evidence.md): a base the scanner resolves to literal text with a scheme or authority is unresolved; otherwise its path becomes ordinary literal segments with base none. A value the scanner cannot see (configuration, environment, a constant elsewhere) is configured.
D. A configured base is assumed to address a server in this repository; a third-party base can produce a wrong row, recorded as an accepted limit.
Must-fix 1: a request with a configured base now needs a literal first segment, so a bare base or a base plus a dynamic segment derives nothing (two new no-row tests).
Also applied: host and unknown bases merged into one unresolved base (the unknown segment kind stays); the endpoint definition now excludes client-side router routes, middleware, proxies and security matchers; 'A computed value that fills one whole segment is dynamic; other computed text is unknown'; one word (dynamic) in code and docs; labels escape * and _ so a literal __debug__ survives storage; a comment in src/scanner/registry.ts explains why dropping excluded HTTP facts is intended; a module comment in src/http-relationships.ts states that core abstains because derived rows are permanent; new no-row test for a two-segment prefix; docs/agent-instructions/relationships.md now says HTTP rows are derived when scanners report facts and that authored rows keep precedence.
Deviation from finding 10: the JSON checks moved to a new packages/scanner/src/values.ts, imported by index.ts and http.ts. Importing them from index.ts would have made object/string/array public package exports and created a circular import.
Verification: test-bun/http-relationships.test.ts, 38 tests (14 match cases including the three precedence cases, 18 no-row cases, owner checks, endpoint and scanner aggregation, callback merge, contract round-trip and rejections, reconcile precedence and retention, stored label escaping). Isolated bun run check exited 0 (Bun 428 passed, 24 skipped, 0 failed; Node 16 passed; Biome findings only in untouched files).
DoD #1 stays unchecked because AC #6 needs the Angular and Java producers.

Full-context complexity review applied (behavior identical apart from the fact shape).
1. The three-state base is gone. ScanHttpRequest now carries an optional configured flag, and a base that states a host or that the scanner cannot resolve arrives as a leading unknown segment. knownRequest reads: no unknown segment, and a configured path starts with a literal segment. The bases set, its validation branch and the docs row are deleted; HttpRequestBase is no longer exported.
2. The matches, literalFilled and matchRank parameter is now dynamicFillsLiteral.
3. docs/scanners/evidence.md gained a producer checklist: six numbered decisions with one canonical example each (prefixes in a path, whether a construct is an endpoint, dynamic versus unknown, the local helper, the base, and which operation a file-location route names). Every scanner page answers the same six in that order.
4. docs/relationship-inference.md step 4 now states that exactness is compared first, so a request to /api/talks prefers another file's exact /api/:rest+ over a /talks that needs /api removed.
Verification: focused tests 38 of 38; isolated bun run check exited 0 (Bun 434 passed, 25 skipped, 0 failed; Node 16 passed).

Follow-up: core compares literal path segments without regard to case, including the dropped-prefix comparison, because frameworks such as ASP.NET route case-insensitively and generate paths like /api/Talks from a controller name. A row keeps the endpoint's own spelling. Two endpoints differing only in case either share a file or already fall under the one-file abstention. Tests added for a case-differing match, a dropped prefix before a case-differing segment, and two files differing only in case (no row). Recorded in docs/relationship-inference.md and the evidence.md checklist. Isolated bun run check exited 0 (Bun 439 passed, 25 skipped, 0 failed; Node 16 passed).

Follow-up: checklist decision 3 in docs/scanners/evidence.md now states that the segment a value is written in decides dynamic versus unknown, instead of asking whether a runtime value might contain a slash, which is what every producer implements.

AC #6 verification run (not yet satisfied: one derived row is wrong, see the defect below).

Setup. /Users/alex/projects/callforpapers was cloned to a scratch directory (its own working copy was never written to and Groma was never run there). The clone carries no committed groma/ folder, so the authored tree was copied read-only from the owner's working copy (it is untracked there) and kept aside for comparison. The clone was initialized fresh and given the four scanner packages the authored scanners.json selects (typescript, angular, java, php), built from this repository into the scratch directory. groma scan created 1227 elements.

Facts reported: angular 205 requests, java 431 endpoints and 3 requests, php 12 requests, typescript none.

Derived HTTP rows: 7, every one angular plus java.
1. webapp/app/callforpaper/admin-exports/admin-export.service.ts -> web/rest/speaker/SpeakerResource.java, GET /api/speakers/download/:proposalState.
2. webapp/app/callforpaper/admin-keyword-cloud/admin-keyword-cloud.service.ts -> web/rest/keyword/KeywordCloudResource.java, POST /api/keyword-cloud/upload.
3. webapp/app/core/auth/account.service.ts -> web/rest/user/AccountResource.java, POST /api/account.
4. webapp/app/entities/user-favourite/user-favourite.service.ts -> web/rest/user/UserFavouriteTalkResource.java, GET /api/favourites/talk/total.
5. webapp/app/shared/auth/internal-account.service.ts -> web/rest/user/AccountResource.java, POST /api/account/reset-password/finish, POST /api/account/reset-password/init, POST /api/register.
6. webapp/app/shared/proposal-state-button/proposal-state-button.component.ts -> web/rest/util/EmailPreviewResource.java, GET /api/email-preview/:action/:proposalId.
7. webapp/app/top-talks/cfp-top-talks-home.component.ts -> web/rest/publicaccess/PublicUserRatingResource.java, GET /api/public/ratings/:token, GET /api/public/ratings/top.

Authored HTTP rows: 69 (48 HTTP JSON, 10 HTTP JSON through getJSON, 4 HTTPS JSON, 2 HTTP JSON through Retrofit, and one each of HTTP, HTTP text, HTTPS PUT, HTTPS through LangChain4j, HTTPS with the Firebase SDK). None of them is derived, and none of the 7 derived rows was authored, so the two sets do not overlap.

Why each authored row is not derived.
- 38 rows: every request the source file reports has an unresolved base or a computed segment, such as GET /<unknown> and PUT /<unknown>/<dynamic>. These Angular services send through a resourceUrl field composed from appConfig, which the producer reports as unknown text rather than a configured base.
- 10 rows: the source is a PHP WordPress shortcode that calls the public API with jQuery getJSON inside the JavaScript it prints, so the PHP producer reports no request.
- 10 rows: the source or the target is an actor, container or external system (Firebase, OpenAI, Google Gemini, Devoxxians, Amazon S3, Devoxx Companion, another CFP instance, the media signing service, semantic search), not a repository file. The rule joins file to file only.
- 8 rows: the Angular entity services for room, location, tenant, comment, compliment, tag, program-user-tracks and proposal-digest report no request at all. Each only sets resourceUrl and extends shared/crud/abstract-entity.service.ts, which owns every call, and that file's own path is unknown text.
- 3 rows have a known request that reaches no endpoint in the authored target file: home-pod.service.ts asks GET /api/public/home-pods while HomePodResource serves /api/home-pods, and the extra public segment is interior, not leading, so the one-segment tolerance correctly abstains; user-favourite.service.ts -> UserFavouriteResource.java names a file that does not serve the only known request, GET /api/favourites/talk/total, which UserFavouriteTalkResource does (derived row 4); wishlist-entry.service.ts -> WishlistEntryResource.java has one known request, GET /api/speakers/<dynamic>, which belongs to SpeakerResource.

Correctness of the derived rows. Rows 1 to 6 were each checked against the client call and the Spring mapping and are correct, including the class-level /api prefix and the configured base in front of a literal path. Row 7 names the right file, but its description is wrong: the component makes exactly one request, GET /api/public/ratings/top, and never calls the :token route.

Defect. Core's preference ranking in src/http-relationships.ts (matchRank and preferredMatches) gives a literal endpoint segment and a parameter segment the same rank, so a sibling route in the same file is reported as reached. docs/relationship-inference.md rule 4 states that only the endpoints a router would prefer remain, and a router prefers the literal route, so the row text claims an endpoint the source does not call, permanently. The same cause also hides real rows when the looser route sits in another file: GET /api/account from account.service.ts matches both AccountResource's /api/account and the SPA fallback GET /:path1/:path2 in web/rest/ClientForwardController.java, so that request produces no row and only the POST label survives. The controller's own comment states that API routes take precedence.

callforpapers verification fix: src/http-relationships.ts now ranks matching endpoints by segment specificity instead of one catch-all flag. A match carries its exactness and one score per declared segment (literal 0, parameter 1, catch-all 2); the first position that differs decides, exactness first. Only the most specific matches survive, then the existing rules apply (one providing file, at least one certain match, different owners).
This removes the wrong label the verification found: a request to /ratings/top no longer also claims a sibling /ratings/:token in the same file. It also restores real rows that an SPA fallback hid: GET /api/account now beats another file's /:first/:second, so the row is derived instead of discarded by the one-file rule. One earlier abstention test became a match case for the same reason, which is the intended change.
Tests: a literal sibling of a parameter route in one file (single label), a specific path before another file's fallback, and a literal path before another file's any-method parameter route. docs/relationship-inference.md rule 4 states the full ordering.
Isolated bun run check from current HEAD exited 0 (Bun 479 passed, 32 skipped, 0 failed; Node 16 passed).

AC #6 rerun after the specificity ranking (0b4c137e): clean, nothing derived is wrong.

Setup. A fresh clone of /Users/alex/projects/callforpapers (at 1cb6783f3) was scanned in a scratch directory; the owner's working copy was never written to and Groma was never run there. The baseline for authored rows is that working copy's groma/ folder, which is untracked there, copied read-only at verification time; its 69 HTTP rows are identical to the copy taken during the first run. The clone carries no groma/ folder of its own, so it was initialized fresh. Everything ran from a detached worktree pinned at 0b4c137e, including the four scanner packages the authored scanners.json selects (typescript, angular, java, php), built from that commit. groma scan created 1229 elements. Facts: angular 205 requests, java 431 endpoints and 3 requests, php 12 requests, typescript none. The first run's packages came from the shared working tree while the HTTP producers were still in flight, which is why two requests that were unresolved then resolve now; this rerun used committed code only.

Derived HTTP rows: 14, every one angular plus java. Each was checked against the client call and the Spring mapping, and each is correct.
1. admin-exports/admin-export.service.ts -> speaker/SpeakerResource.java, GET /api/speakers/download/:proposalState.
2. admin-exports/admin-export.service.ts -> proposal/ProposalRatingResource.java, GET /api/proposals/ratings.
3. admin-keyword-cloud/admin-keyword-cloud.service.ts -> keyword/KeywordCloudResource.java, POST /api/keyword-cloud/upload.
4. admin-schedule/admin-schedule-copy.service.ts -> schedule/ScheduleCopyResource.java, POST /api/admin/schedule-copy/apply and POST /api/admin/schedule-copy/preflight.
5. admin-schedule/admin-schedule.service.ts -> proposal/ProposalResource.java, GET /api/proposals/unscheduled-by-type and GET /api/proposals/unscheduled-count.
6. admin-ticket-allocation/admin-ticket-allocation.service.ts -> speaker/SpeakerResource.java, GET /api/speakers/ticket-allocation.
7. core/auth/account.service.ts -> user/AccountResource.java, GET /api/account and POST /api/account.
8. dev/dev-auth-callback.component.ts -> user/AccountResource.java, GET /api/account.
9. entities/event/event.service.ts -> publicaccess/PublicResource.java, GET /api/public/event.
10. entities/home-pod/home-pod.service.ts -> publicaccess/PublicResource.java, GET /api/public/home-pods.
11. entities/user-favourite/user-favourite.service.ts -> user/UserFavouriteTalkResource.java, GET /api/favourites/talk/total.
12. shared/auth/internal-account.service.ts -> user/AccountResource.java, GET /api/activate, POST /api/account/reset-password/finish, POST /api/account/reset-password/init and POST /api/register.
13. shared/proposal-state-button/proposal-state-button.component.ts -> util/EmailPreviewResource.java, GET /api/email-preview/:action/:proposalId.
14. top-talks/cfp-top-talks-home.component.ts -> publicaccess/PublicUserRatingResource.java, GET /api/public/ratings/top.

Both defects the first run exposed are gone. Row 14 no longer claims GET /api/public/ratings/:token, which the component never calls; the literal route now wins over its sibling parameter route in the same file. GET /api/account is a label again, because ClientForwardController's SPA fallback GET /:path1/:path2 now loses to the literal route in another file, exactly as that controller's own comment describes. Seven rows and two labels that the earlier ranking hid are now reported: the ratings export, the schedule copy pair, the two unscheduled counts, the ticket allocation, the dev auth callback, the public event and the public home pods.

Authored HTTP rows: 69 (48 HTTP JSON, 10 HTTP JSON through getJSON, 4 HTTPS JSON, 2 HTTP JSON through Retrofit, and one each of HTTP, HTTP text, HTTPS PUT, HTTPS through LangChain4j, HTTPS with the Firebase SDK). One of them, admin-schedule-copy.service.ts -> ScheduleCopyResource.java, is now also derived. The other 68 are not derived, for these reasons.
- 36 rows: every request the source file reports has an unresolved base or a computed segment, such as GET /<unknown> or PUT /<unknown>/<dynamic>. These Angular services send through a resourceUrl field composed from appConfig, which the producer reports as unknown text.
- 10 rows: the source is a PHP WordPress shortcode that calls the public API with jQuery getJSON inside the JavaScript it prints, so the PHP producer reports no request.
- 10 rows: the source or target is an actor, container or external system (Firebase, OpenAI, Google Gemini, Devoxxians, Amazon S3, Devoxx Companion, another CFP instance, the media signing service, semantic search), not a repository file. The rule joins file to file.
- 8 rows: the entity services for room, location, tenant, comment, compliment, tag, program-user-tracks and proposal-digest report no request at all. Each only sets resourceUrl and inherits every call from shared/crud/abstract-entity.service.ts. This is a real limit of the rule rather than a miss: the request is written once in the shared base file, whose own path is an unknown field read, so no file-level client exists to attribute the call to. Naming the calling file would require resolving an inherited field per subclass, which the fact format does not express.
- 4 rows: the source file's own proven request is served by a file other than the authored target, and the scan derived a row to that file instead: entities/event/event.service.ts and entities/home-pod/home-pod.service.ts read the public API from PublicResource (rows 9 and 10), and entities/user-favourite/user-favourite.service.ts reads from UserFavouriteTalkResource (row 11). Their authored rows name the CRUD resource they also use through AbstractDateEntityService or AbstractEntityService, which is the inherited-call limit above. The fourth, entities/wishlist-entry/wishlist-entry.service.ts -> WishlistEntryResource.java, has one proven request, GET /api/speakers/<dynamic>, which belongs to SpeakerResource, while its three other requests have unresolved bases.

Nothing derived is wrong, no authored row is contradicted, and every authored row that stays hand-written has a stated reason.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scanners report HTTP endpoints and requests as language-neutral facts, and core joins them into a derived relationship only when the match is certain: equal methods, a fully known request path that equals the endpoint path or differs by one leading segment, the most specific matching endpoints, and every match in one file with a different owner. Verified on callforpapers, scanned from scratch in a fresh clone at 0b4c137e with its authored groma folder kept aside as the baseline: 14 derived rows, each checked against the client call and the Spring mapping and each correct, against 69 authored HTTP rows of which one is now also derived. Every authored row that stays hand-written has a recorded reason: 36 have only unresolved or computed paths, 10 are PHP shortcodes calling through jQuery getJSON, 10 join an actor or external system rather than two files, 8 inherit their calls from a shared CRUD base service (a stated limit of the rule), and 4 name a different file than the one that serves the proven request. The first verification found a derived row claiming an endpoint the source never calls and rows hidden by an SPA fallback route; both came from ranking a literal segment like a parameter, were fixed in core by segment specificity, and are confirmed gone.
<!-- SECTION:FINAL_SUMMARY:END -->
