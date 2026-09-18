---
id: TASK-416
title: Derive certain HTTP relationships from scanner endpoint facts
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-18 22:44'
labels: []
dependencies: []
references:
  - scanner-src-index
  - scan-evidence
  - scanner-registry
  - src-http-relationships
  - src-http
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

Review-fix round (Codex and Grok cold reviews of cf8e7975), core slice:
8. Fix: a declared path that ends is more specific than one that continues with an unused optional parameter or optional catch-all (moreSpecific padded a missing segment as least specific).
9. Fix: during the ambiguity check a dynamic request segment may stand for the shared literal after a dropped prefix, so a possible literal sibling in another file makes the request ambiguous.
10. Fix: rank the certain matches first; an endpoint that some runtime value could reach at least as specifically is a contender, and every contender must be in the certain match's file. A same-file literal sibling no longer suppresses the row.
11. Fix: docs/scanners/evidence.md states the comparability checks as preconditions, not as the whole rule.
12. Propose, before implementing, the fact format and core rule for constrained parameters and order-based routers.

13. Owner decision (constrained segments): parameter and catch-all segments take constrained: true; a literal reaches a constrained parameter only possibly, a dynamic segment like any parameter, and a constrained catch-all is only ever possibly reached.
14. Owner decision (registration order): endpoints of first-match routers carry order { application, position }. Exactness ranks first; then position when every reachable endpoint shares one application, segment specificity when none is ordered, and nothing else for any other mix. Unless specificity decides, exactly one distinct certain endpoint may remain.

15. Go re-review: routers rank constrained segments by their own rules (chi tries regex routes before parameter routes), so a reachable endpoint whose template declares a constrained segment competes with the chosen endpoint whatever its specificity; under registration order, one registered after the chosen endpoint does not compete.

16. Rust lane finding: a match that reaches the request only through a catch-all (a fallback, a Next.js catch-all page, or a blocker for an unreadable route) speaks only for its own application, keyed by scanner and order application. It is ignored when endpoints of other applications reach the request without a catch-all and none of its own application's do; within one application every rule stays.

17. Java lane evidence: every modeled router prefers a literal segment to any parameter, constrained or not, so under specificity a constrained match that ranks lower competes unless the chosen endpoint has a literal where their segments first differ.

18. JavaScript last check: a blocker's catch-all stands for routes whose handler files the scanner cannot tell, so a competing match whose endpoint ends in a constrained catch-all never shares the chosen endpoint's file and makes core abstain.

19. A configured request under a one-segment blocker: a removed endpoint literal may be followed by a constrained catch-all, but such a match counts only under a deployment another match assumes.
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

Review-fix round, matcher fixes (all reproduced with in-memory probes first):
- moreSpecific padded a missing declared segment as least specific, so /talks/:id? beat /talks and /:rest* beat / (wrong file or label). A path that has ended now ranks most specific. This also restores the C# controller case (GET /api/Talks, GET /api/Talks/:id, POST /api/Talks/:id? beside GET /api/Talks/:slug*), which the packaged csharp-http test expects.
- removablePrefix required a literal request segment even in the ambiguity check, so /talks/<dynamic>/details missed another file's /archive/details. A dynamic request segment may now stand for the endpoint's literal after a dropped prefix when checking what a runtime value could reach.
- provider now ranks certain matches first and treats every endpoint a runtime value could reach at least as specifically as competing; all chosen and competing endpoints must share one file. A same-file literal sibling (/talks/archive beside /talks/:id) no longer suppresses the row.
- docs/scanners/evidence.md states the comparability checks as preconditions; docs/relationship-inference.md rules 4 to 6 describe the new ranking and competition.
Tests: 6 new cases in test-bun/http-relationships.test.ts; all 6 fail on HEAD code and pass with the fix. Isolated bun run check exited 0 (Bun 519 passed, 32 skipped, 0 failed; Node 16 passed; Biome findings only in untouched files).
Constrained parameters and order-based routers: design proposed to the orchestrator, not implemented yet.

Constrained segments (owner-approved): ScanHttpEndpoint parameter and catch-all segments accept constrained: true. Core: a literal request segment reaches a constrained parameter only possibly, a dynamic segment reaches it like any parameter, and a constrained catch-all is only ever possibly reached, so such an endpoint can block another file's row but never provides one for a literal. The matcher's dynamicFillsLiteral flag became possible and covers both cases; literalFilled folded into reaches. Contract validation, evidence.md (segment definition and checklist decision 7), relationship-inference.md rules 3, 5 and 6, and creating-a-plugin.md updated. 5 new tests (3 fail on HEAD) plus contract round-trip and rejection. Isolated bun run check exited 0 (Bun 527 passed, 32 skipped, 0 failed; Node 16 passed).
Registration order: the approved position rule has two flaws (prefix-dropped matches and positions compared across applications); an amended format was sent to the orchestrator before implementing.

Registration order (owner-approved amendment): ScanHttpEndpoint.order { application, position } for routers that take the first registered match; the contract validates a nonempty application and a nonnegative integer position. Core ranks exactness first, then position when every reachable endpoint shares one application, segment specificity when none is ordered, and exactness alone for any other mix; the competition and one-file rules are unchanged, and unless specificity decides exactly one distinct certain endpoint may remain. Ranking helpers renamed to Rank, compareRanks, bestRank and matchRank. Tests: Django first match, parameter registered before a literal sibling, route registered before a fallback, exact before an earlier prefixed route, earlier of two routes in one file, and no row for unknown order (across files and within one file), an earlier possible literal in another file, two applications, and a first-match route beside a most-specific route; contract round-trip and rejections. Docs: relationship-inference.md rules 4 and 5, evidence.md order definition and checklist decision 8, creating-a-plugin.md. On HEAD code 16 of the 64 HTTP tests fail; isolated bun run check exited 0 (Bun 541 passed, 35 skipped, 0 failed; Node 16 passed). The packaged C# HTTP test was not run here (needs GROMA_TEST_CSHARP_PACKAGE); its expected rows follow the optional-tail fix, and its lane reruns it.

Cold review and full-context complexity review applied:
1. Matches that removed different leading segments, or none, assume different deployments. Each rank records its removed segment (side and lowercase text); when the remaining matches differ in it, nothing but exactness ranks them. Before, positions and specificity compared /v1/talks/:id with /v2/talks/:id for a configured /talks/<dynamic>, and /talks with /v1/api/talks for /api/talks.
2. Tests pin that a possible match at an equal position competes, and one order test now disagrees with specificity (/users/:id at 0 beats /users/me at 1).
3. An exact path that needs its catch-all to take part of the request no longer hides prefix-dropped matches, so /api/talks with an exact /:rest* in one file and /talks in another derives nothing. When a chosen endpoint needs a dynamic segment to satisfy a constraint (the match fails when constrained parameters accept nothing), every reachable endpoint competes, so /talks/<dynamic> with a constrained /talks/:id and another file's /talks/:rest+ or later /talks/:slug derives nothing, while the constrained route alone keeps its row.
4. Registration positions are compared only within one application as one scanner reports it (scanner plus application).
5. One comparison key per rank once the preference is chosen: [tier, position], [tier, ...segments] or [tier]; compareKeys pads with -1. Names: Preference, possibleRank, certainRank, Reach (possibly, certainly, freely), removedPrefix, rankKey, compareKeys, bestKey. The position default is gone.
6. docs/scanners/evidence.md links to the rule instead of restating it, and decision 8 names the route's own file as application when the application file cannot be identified (also in the contract comment and creating-a-plugin.md). relationship-inference.md rules 4 to 6 document the deployment, catch-all and constraint rules.
Mutation check: each of these rules (strict competition, removed segments, catch-all exactness, constraint competition, scanner-keyed application) turns at least one new test red. Isolated bun run check exited 0 (Bun 554 passed, 35 skipped, 0 failed; Node 16 passed). The callforpapers run behind AC #6 predates this round; the changes only make core abstain in more cases or correct which file wins for unused optional tails, and producers will add constraint and order facts in their own tasks.

Go re-review fix (reopened): routers rank constrained segments by their own rules (chi tries regex routes before parameter routes; ASP.NET ranks constrained parameters above plain ones), so a possible match through a constrained segment ranked lower by specificity could not be discarded. Each match now records whether it goes through a constrained segment (it fails when constrained segments accept nothing, reach 'unconstrained', which replaces 'freely'). Unless registration position decides, such a match competes whatever its specificity, keeping only its exactness tier; under position preference a later-registered constrained match cannot take the request and does not compete. Tests: the chi case (/files/a/report.json with /files/:dir/:name and another file's constrained catch-all) derives nothing; the same pair in one file keeps the parameter label; a later-registered constrained route does not block; an earlier unreadable-route blocker makes a later certain match abstain; a literal route beside another file's constrained parameter now abstains (was a match case). Mutation check: dropping the rule or applying it under position turns tests red. Rule 6 in docs/relationship-inference.md documents the rule and the blocker convention. Isolated bun run check exited 0 (Bun 559 passed, 35 skipped, 0 failed; Node 16 passed).

Accepted consequence (orchestrator): a literal route beside another file's constrained parameter now derives nothing, for example /talks/archive against a constrained /talks/:id; routers such as ASP.NET and chi would send it to the literal route, so the row is lost, not wrong. docs/scanners/evidence.md decision 8 now tells ordered producers to report a route they see but cannot read at its position as its readable literal prefix plus a constrained optional catch-all with method *.

Targeted re-review applied: the constrained flag now comes from the endpoint template (any constrained parameter or catch-all), because the retry with constraints disabled missed a skippable optional constrained parameter: /blog/:year?!/:slug? against another file's /blog/:slug gave a wrong row for /blog/<dynamic> and /blog/2024. The unconstrained reach mode is gone. Accepted cost: a row is lost when an optional constrained segment goes unused, such as /talks against another file's /talks/:id?!. Constrained competition applies under specificity preference only (under no preference every match already competes, under position a later registration does not). Rule 6 states the effect of blockers and the constrained example /files/:path*; the producer instruction stays in evidence.md decision 8. Plan step 15 corrected. Tests: two /blog no-row cases (79 focused tests). Isolated bun run check exited 0 (Bun 563 passed, 35 skipped, 0 failed; Node 16 passed).

Rust lane finding (reopened): every actix endpoint shares position 0, so one root blocker competed with every request in the repository, and under the mixed-application rule a Next.js catch-all page blocked another application's exact API route. A match only through a catch-all (the match needs its catch-all to take part of the request; now computed for removed-prefix matches too) now speaks for its own application, keyed by scanner and order application: it drops out when endpoints of other applications reach the request without a catch-all and none of its own application's do. Within one application nothing changed; a root blocker registered earlier still blocks. Tests: a rust root blocker and a react catch-all page beside a typescript ordered exact route, and a rust blocker beside a java exact route, keep the row; a root blocker before a route of its own application derives nothing; an exact route beside another application's fallback now keeps its row (was a no-row case); the two-application, first-match-beside-most-specific and different-scanner tests now use /api/:section so they still pin those rules.
Java lane evidence: JHipster's constrained SPA forwards /{path1:[^.]*}/{path2:[^.]*} competed with every one-to-three-segment request and dropped callforpapers rows from 72 to 63, although Spring sends /api/account to the literal route. Every modeled router prefers a literal segment to any parameter, constrained or not, so under specificity a constrained match that ranks lower competes unless the best key has a literal where the keys first differ (constraintMayWin; compareKeys now uses firstDifference). /talks/archive beside another file's constrained /talks/:id is a match case again, /api/account beside a constrained /:path1/:path2 is a new one, and the chi case still derives nothing.
Mutation checks: removing the application scoping, dropping every catch-all once a direct match exists, letting constrained matches always compete, or never letting them compete each turn at least one test red. Rules 4 to 6 in docs/relationship-inference.md and evidence.md decision 8 updated. Isolated bun run check exited 0 (Bun 568 passed, 35 skipped, 0 failed; Node 16 passed).

Targeted re-review applied: (1) only a catch-all at the start of the endpoint path drops out across applications (rootCatchAll), because a more specific catch-all such as a /api/:rest*! blocker or a /api/:rest+ proxy dropped beside another scanner's /:category/:slug and gave /api/talks a wrong row; (2) a constrained match also competes when its first constrained segment comes before the first differing key position, because constrained and plain parameters share one score: /api/v/talks with /api/:x/talks in one file and a constrained /api/:y/:z in another gave a wrong row where ASP.NET picks the constrained route; (3) scope renamed applicationKey with a comment on how it differs from application(). Two no-row tests added; mutation check turns each red when its fix is reverted. Rules 4 and 6 reworded. Isolated bun run check exited 0 (Bun 570 passed, 35 skipped, 0 failed; Node 16 passed).

JavaScript last check (reopened): a blocker stands for routes whose handler files the scanner cannot tell, yet core counted it in the file of its registering operation, so app.use('/api', require('./routes/api')) plus app.get('*', spa) in app.js derived a row from the client to app.js for GET /api/talks. A competing match whose endpoint ends in a constrained catch-all (unattributed) now always makes core abstain; it never shares the chosen file. Accepted cost: a real constrained catch-all in the winner's own handler file costs that row (the same-file /files/:dir/:name case moved to the no-row list). Tests: the Express layout derives nothing; a blocker registered after the route in the same file and a blocker beaten by a literal at the first difference still leave the row. Mutation: removing the rule, or applying it to every reachable match, turns tests red. Rule 6 and evidence.md decision 8 say a blocker blocks later routes of its prefix in its application. Isolated bun run check exited 0 (Bun 586 passed, 35 skipped, 0 failed; Node 16 passed).

Targeted review of the unattributed rule applied. Accepted cost: a real constrained catch-all beside the winner in its own handler file, such as a Spring /** beside /api/{id} in one controller, now costs that row. Rule 6 moves the blocker sentence after the sentence that makes it true; evidence.md decision 8 says no request under a blocker's prefix derives a row to a route registered at or after it in that application.
Configured requests under a one-segment blocker: removedPrefix now also accepts a constrained catch-all after the removed endpoint literal (only as a possible match), so /api/:rest*! at position 0 blocks configured GET /talks reaching /api/talks at position 1 (new no-row test). As first specified this made every one-literal blocker fit every request by removing its own literal, which at HEAD 868da30d dropped PHP rows GET /api/talks/:id and POST /shop/v1/orders/:id (blockers /beta/:path* and others, combined with the rule that a constrained chosen endpoint lets every reachable endpoint compete) and the JavaScript row POST /talks (the express.static blocker /static/:** under the deployment 'endpoint static'). Such a match shows no deployment of its own, so it now counts only under a deployment another match assumes (assumedDeployments). With that, the isolated bun run check at HEAD 868da30d exits 0 (Bun 589 passed, 35 skipped, 0 failed; Node 16 passed) with no producer expectation changed; the new test for the JavaScript layout fails without it. Awaiting orchestrator approval of that narrowing before commit.

Orchestrator approved the narrowing (assumedDeployments). Follow-up, not done: when a chosen endpoint has a constrained segment, the rule that every reachable endpoint competes also reaches matches that exactness hides; limiting it to the chosen endpoint's exactness tier would follow rule 4. It loses rows, never produces wrong ones, and no producer expectation needs it now. Final check: isolated bun run check at HEAD 868da30d exited 0 (Bun 589 passed, 35 skipped, 0 failed; Node 16 passed), with the PHP and JavaScript core-rows expectations unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scanners report HTTP endpoints and requests as language-neutral facts, and core joins them into a derived relationship only when the match is certain: equal methods, a fully known request path that equals the endpoint path or differs by one leading segment, the most specific matching endpoints, and every match in one file with a different owner. Verified on callforpapers, scanned from scratch in a fresh clone at 0b4c137e with its authored groma folder kept aside as the baseline: 14 derived rows, each checked against the client call and the Spring mapping and each correct, against 69 authored HTTP rows of which one is now also derived. Every authored row that stays hand-written has a recorded reason: 36 have only unresolved or computed paths, 10 are PHP shortcodes calling through jQuery getJSON, 10 join an actor or external system rather than two files, 8 inherit their calls from a shared CRUD base service (a stated limit of the rule), and 4 name a different file than the one that serves the proven request. The first verification found a derived row claiming an endpoint the source never calls and rows hidden by an SPA fallback route; both came from ranking a literal segment like a parameter, were fixed in core by segment specificity, and are confirmed gone.

Review-fix round: two external reviews found paths to wrong permanent rows, all fixed in core with regression tests. Unused optional tails no longer outrank a route that ends, a dropped-prefix literal sibling in another file now blocks the row, and a same-file literal sibling no longer suppresses it. The fact format gained constrained parameter and catch-all segments (a literal only possibly reaches them) and a registration order { application, position } for routers that take the first registered match; core ranks exactness first, then position within one application, segment specificity when no endpoint is ordered, and nothing across deployments, applications or router kinds, and abstains unless exactly one certain endpoint remains. An exact catch-all no longer hides prefix-dropped matches, and a match that relies on a constraint competes with every reachable endpoint. Verified by 73 focused tests with a mutation check and an isolated bun run check (Bun 554 passed, 0 failed; Node 16 passed).

Go re-review round: routers rank constrained segments by their own rules, so a reachable endpoint whose template declares a constraint now competes with the chosen endpoint whatever its specificity, unless registration order puts it after the chosen one; unreadable routes reported as constrained catch-alls at their position block later routes of their prefix. Verified by 79 focused tests and an isolated bun run check (Bun 563 passed, 0 failed; Node 16 passed).

Rust and Java lane rounds: a catch-all at the start of a path (a fallback or a root blocker) speaks only for its own application, so it no longer removes other applications' rows, and a literal segment beats a constrained one under specificity unless a constrained segment comes earlier, which restored callforpapers rows such as /api/account beside JHipster's constrained SPA forwards. Verified by 85 focused tests with mutation checks and an isolated bun run check (Bun 570 passed, 0 failed; Node 16 passed).

Last core round: a competing constrained catch-all never shares the row's file, because it may stand for routes a scanner could not attribute, so the common Express layout with an unresolved mount and a later SPA fallback derives nothing instead of a wrong row; a configured request under a one-segment blocker is blocked when another match removes the same segment. Verified by 90 focused tests with mutation checks and an isolated bun run check at 868da30d (Bun 589 passed, 0 failed; Node 16 passed).
<!-- SECTION:FINAL_SUMMARY:END -->
