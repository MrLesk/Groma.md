---
id: TASK-416.10
title: Report HTTP facts from the PHP scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 23:11'
labels: []
dependencies: []
references:
  - evidence
  - php-src-index
  - src-syntax
  - src-outline
  - http-url
  - http-endpoints
  - http-clients
  - php-src-http
modified_files:
  - plugins/scanners/php/src/syntax.ts
  - plugins/scanners/php/src/evidence.ts
  - plugins/scanners/php/src/http-url.ts
  - plugins/scanners/php/src/outline.ts
  - plugins/scanners/php/src/http-endpoints.ts
  - plugins/scanners/php/src/http-clients.ts
  - plugins/scanners/php/src/http.ts
  - plugins/scanners/php/src/index.ts
  - test/fixtures/php-http/routes/api.php
  - test/fixtures/php-http/app/TalkController.php
  - test/fixtures/php-http/app/SpeakerController.php
  - test/fixtures/php-http/app/AdminRoutes.php
  - test/fixtures/php-http/app/TalkClient.php
  - test/fixtures/php-http/plugin/rest.php
  - test/fixtures/php-http/plugin/client.php
  - test-bun/php-http.test.ts
  - docs/scanners/php/index.md
  - plugins/scanners/php/src/receivers.ts
  - plugins/scanners/php/src/http-curl.ts
  - plugins/scanners/php/src/http-routes.ts
  - plugins/scanners/php/src/http-laravel.ts
  - test/fixtures/php-http/bootstrap/app.php
  - test/fixtures/php-http/routes/mobile.php
  - test/fixtures/php-http/routes/admin.php
  - test/fixtures/php-http/routes/partners.php
  - test/fixtures/php-http/app/Providers/RouteServiceProvider.php
  - test/fixtures/php-http-patterns/routes.php
  - test/fixtures/php-http/routes/web.php
  - test/fixtures/php-http/routes/mobile-v1.php
  - test/fixtures/php-http/app/helpers.php
  - test/fixtures/php-http-patterns/bootstrap/app.php
  - test/fixtures/php-http-routers/bootstrap/app.php
  - test/fixtures/php-http-routers/web.php
  - test/fixtures/php-http-routers/unloaded.php
  - test/fixtures/php-http-routers/slim.php
  - test/fixtures/php-http/routes/auth.php
  - test/fixtures/php-http/tools/seed.php
  - test/fixtures/php-http-routers/routes/shop.php
  - test/fixtures/php-http-routers/packages/shop/routes/shop.php
  - test/fixtures/php-http-routers/packages/shop/Provider.php
  - test/fixtures/php-http-patterns/provider.php
  - test/fixtures/php-http-projects/slim/public/index.php
  - test/fixtures/php-http-projects/slim/app/routes.php
  - test/fixtures/php-http-projects/package/composer.json
  - test/fixtures/php-http-projects/package/src/ShopServiceProvider.php
  - test/fixtures/php-http-projects/package/routes/shop.php
  - test/fixtures/php-http-routers/loop.php
parent_task_id: TASK-416
type: feature
ordinal: 481000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The PHP scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. PHP applications often run inside frameworks or WordPress, which have their own routing and HTTP APIs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The PHP scanner reports endpoints declared with Laravel routes, Symfony route attributes and WordPress REST routes, and requests made with Guzzle, cURL and the WordPress HTTP API.
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
1. Parse once per file: index.ts parses with parsePhp and passes the tree to both phpEvidence and the new HTTP pass, so nothing parses twice. syntax.ts owns operationId(file, node) so both passes name operations the same way.
2. plugins/scanners/php/src/http.ts walks a file's tree tracking namespace, class, use imports, single-assignment constants (const, define, class constants in that file), the enclosing operation and route-group prefixes, and dispatches to the endpoint and client recognizers.
3. Endpoints (http-endpoints.ts): route builder calls whose member is an HTTP method and whose handler argument resolves, both static (Laravel Route::get/post/put/patch/delete/options/any/match) and instance (Slim $app->get, $group->delete), with prefixes from Route::prefix(...)->group(...), Route::group(['prefix' => ...], ...) and $app->group('/prefix', ...); Symfony #[Route] attributes on methods with the class-level attribute as prefix; WordPress register_rest_route(namespace, route, args) including WP_REST_Server method constants and several method configs. A handler resolves to a closure in place, [Class::class, 'method'], Class::class (__invoke), [$this, 'method'] or a symbol-name string; index.ts maps those scan symbol names to operation ids and drops facts whose handler has no operation.
4. Paths (http-url.ts): one route parser for {id}, {id?}, {id<regex>}, {id:regex} and (?P<id>regex); a segment that is not a whole literal or a whole parameter makes the endpoint unsupported, so no fact is reported. Only literal route text counts; a computed route reports nothing.
5. Requests (http-clients.ts): Guzzle ($client->get/post/put/patch/delete/head/options and ->request/->requestAsync with a literal method), cURL (curl_init/curl_setopt CURLOPT_URL with the method from CURLOPT_CUSTOMREQUEST or CURLOPT_POST in the same operation) and the WordPress HTTP API (wp_remote_get/post/head/request). URL text comes from literals, concatenation, interpolation and same-file constants; rest_url/home_url/site_url/admin_url supply a configured base. One whole computed segment is dynamic, any other computed text is unknown, and a scheme or authority makes the base unresolvable. Written against the simplified request shape (configured flag, leading unknown segment).
6. Fixtures test/fixtures/php-http cover each supported API and the unresolved cases (computed route, partly literal segment, unknown URL text, absolute URL, missing method).
7. test-bun/php-http.test.ts asserts the reported endpoint and request facts and one derived row through inferRelationships.
8. docs/scanners/php/index.md: HTTP facts section listing supported APIs and limits, answering the producer checklist in docs/scanners/evidence.md in its order.
9. Isolated bun run check; self specification and quality review.

10. Cold review: prove the client by receiver type instead of guessing from the URL argument; treat an unresolved group or class prefix as unknown and report no endpoints under it; accept a missing argument list; report one cURL request per operation; share list, callables, memberOf, symbolName and joinPath.

Review round (external cold reviews at cf8e7975; every item reproduced with a scan-to-inferRelationships probe):
11. Route receivers (Codex, Grok must-fix): a builder call or group counts only when its chain starts at a proved router: the Laravel Route facade (Illuminate\Support\Facades\Route or the global alias Route), a parameter or property typed as a Slim or Laravel router type, or the first parameter of a recognized group's closure. $cache->get('/talks', fn) and Cache::get('talks', fn) report nothing.
12. Receiver scope (Codex must-fix): client and router names are proved per declaration: a type's typed and promoted properties, and a callable's own typed parameters, dropped when the body writes that variable. Names no longer leak across methods. A variable bound to new Client(...) no longer counts, because its base_uri is stated there and is not read (a literal host became a local row).
13. Constants (Codex must-fix): keyed by their declaring namespace or type and resolved as PHP resolves the reference (self::, Type:: through use aliases, namespaced then global); static:: stays unresolved.
14. cURL (Codex must-fix x2): an operation reports a cURL request only when it binds one curl_init result to one handle that every option call names, and every option it sets is readable; an unresolved CURLOPT_CUSTOMREQUEST or CURLOPT_POST value reports nothing.
15. Direct fluent prefixes (Codex must-fix): Route::prefix('/api')->get(...) carries the chain's prefixes.
16. Same-rule drift in this producer: a WordPress site-URL call without a path argument followed by text that does not start with / is a leading unknown (home_url() . 'api/talks' continues the host); a root-relative client path such as $client->get('/api/talks') stays configured, because the client's base_uri still supplies the host.
17. Fold the repeated drop-one-leading-backslash step into one syntax.ts helper.
18. Waiting on the core lane: route constraints and order-based routing; not implemented until the approved fact format is relayed.
19. Regression fixtures in test/fixtures/php-http and assertions in test-bun/php-http.test.ts; docs/scanners/php/index.md updated.

20. Approved fact format (core 3426fe50): constrained parameters and catch-alls for Symfony {id<re>} and requirements, Slim {id:re}, WordPress (?P<id>re), Laravel where/whereNumber/whereAlpha/whereAlphaNumeric/whereUuid/whereUlid/whereIn on the route, its chain or group options; mixed segments are one constrained parameter; a pattern that may match /, an unreadable pattern or name, and a Slim optional group become a constrained optional catch-all. Every endpoint reports order { application: declaring file, position 0 }. A route entry seen but not reportable (computed route, prefix or group, routes-file group, unreadable methods, unknown handler, view/redirect/resource routes) is a blocker named after the registering operation; the file's top-level code becomes a 'top-level code' operation so top-level registrations have one. Checklist decisions 7 and 8 answered on the PHP page.

21. Laravel cross-file routing (coordinator decision): Route::pattern / Route::patterns in any scanned file constrain Laravel route parameters of that name that state no pattern of their own; an unreadable name constrains every Laravel parameter. A routes file loaded through bootstrap/app.php withRouting (apiPrefix, default api) or a group given base_path(...) or __DIR__ serves its routes under that prefix; under a computed prefix they are blockers, and a load whose file the scan cannot find blocks the loader's prefix (http-laravel.ts). Route paths are therefore finished in resolveEndpoints, after every file is read.

22. Cold-review round: Slim receivers carry their own prefix (AppFactory::create() or new App bound once, or typed Slim\App: root; a proved group's closure parameter: the group's prefix; a RouteCollectorProxy elsewhere: unresolved), a closure passed to group on an unproved receiver runs under an unresolved prefix, and closures import proved receivers by value through use. Laravel string handlers name a Route::controller(...) group method or stay unknown; domain(...) routes are blockers. Loads compose transitively, a require/include inside a Laravel group's closure loads that file under the group, and Laravel routes of a file no load reaches are blockers. The class-level #[Route] of an invokable Symfony controller without method routes routes __invoke. Top-level requests belong to the file's (module) operation, which exists only when a route entry, load or request names it.

23. Re-review round: a top-level require/include of a routes file in a loaded file is a load under that file's bases; every Laravel endpoint and blocker of one project shares one application (its bootstrap/app.php, else its nearest composer.json, else the declaring file); a group with a domain option and a route with ->domain(...) are blockers; Slim writes count only in the variable's own scope, base paths from setBasePath prefix an application's routes, and a Slim group given a callable variable blocks its prefix; unrecognized loaders leave their files unreached.

24. Simplicity round (cold junior-maintainer review): one load rule (a load serves its target under each base of its loading file; with no base, a group or withRouting serves from the root and a require serves nothing; a file left with no base serves under an unknown prefix), removing a spurious root blocker for a require in an unloaded file; red fixture lines for the load rule, a unique base_path candidate, conflicting global patterns, the composer.json application, a loading group's patterns and by-reference or assigned closure imports, plus the other uncaught rule mutations; write counting reads closure uses in one loop over a body's own nodes; one receiverOf in syntax.ts and one nearest-ancestor helper; unresolvedRoute next to noRoute; PendingEndpoint.order deleted (served computes the application); load naming throughout (Load, rootBase, one segment-check name); Receiver as a union where only Slim receivers carry a prefix, and globalPatterns proves its receiver directly; the PHP page states the receiver rule once and no longer says includes are not executed; tokens.ts reuses Fields from syntax.ts; a typed Slim App serves under the project's single literal setBasePath, at the root when none is called, and otherwise its routes are blockers.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: index.ts parses each file once and passes the tree to phpEvidence and the new phpHttpFacts. http.ts walks a file tracking namespace, type, use aliases, single-declaration constants, the enclosing operation and group prefixes; http-endpoints.ts recognizes route builders (Laravel Route:: and $app/$group members, match and map), Symfony #[Route] attributes with the class-level prefix, and register_rest_route with WP_REST_Server constants; http-clients.ts recognizes Guzzle-style members and ->request, the WordPress HTTP API and cURL; http-url.ts turns literals, concatenation, interpolation, same-file constants and WordPress site-URL calls into request segments and route text into endpoint segments. resolveEndpoints maps handler symbol names to operation ids after every file is read, so a Laravel route file's endpoint names the controller method that serves it.
Decisions: a client member name is also an ordinary method name, so a client call needs a URL-looking first argument and an options-map second argument. That rule also keeps route registrations (whose second argument is a handler) from being read as requests, which the first fixture run exposed. PHP cannot prove whether a computed value holds a slash, so one whole computed segment is dynamic, including a trailing one, matching the checklist's first example. Local helper propagation is not implemented: a wrapper reports its own request. Catch-all segments are never reported. A route segment that mixes literal and parameter text reports no endpoint.
Correction history: php-parser writes absent fields as null, which the shared field() helper now reads as undefined; before that, a callable array counted as an options map and every Laravel route was also reported as a request. A positional attribute argument is the value itself, while only a named argument wraps it in 'value'; reading both the same way had silently dropped every Symfony endpoint.
Verification: bun test test-bun/php-http.test.ts 3 pass (endpoint facts, request facts, and two derived rows through inferRelationships: app/TalkClient.php to app/TalkController.php and plugin/client.php to plugin/rest.php). Unresolved cases assert as absent: a computed Laravel route, a partly literal Symfony segment, a partly literal REST regular expression, a partly known request segment, a literal host, an unreadable URL and a cURL request with no method option. Isolated bun run check with only this task's changes: exit 0 (tsc clean, node 16 pass, bun 439 pass 25 skip 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).

Cold review applied (coordinator decisions):
1. A Guzzle-style member call now counts only when its receiver is proved to hold a client: a parameter or property typed GuzzleHttp\Client, GuzzleHttp\ClientInterface, Psr\Http\Client\ClientInterface or Symfony's HttpClientInterface (resolved through the file's use aliases), including a constructor-promoted property, or a variable bound to new Client(...). The statesUrl and passesOptions guesses are gone, so Storage::get('/talks/'.$id), $this->disk->delete(...), $this->store->get(...) and a legacy Route::get('/talks', ['as' => ..., 'uses' => ...]) report nothing. The fixture client property is now typed GuzzleHttp\Client and a non-client $this->cache->get('/api/cached') row proves the rule.
2. A prefix is string | undefined: a group or class attribute whose prefix is present but not literal leaves it unresolved and reports no endpoints under it, while a group that states no prefix still reports its routes. Fixtures add Route::prefix(config('api.prefix'))->group(...), $app->group($base . '/beta', ...) and #[Route(Paths::DRAFTS)], and the legacy array route.
3. list() accepts Syntax | undefined like field(), so register_rest_route('shop/v1', '/health') with two arguments no longer throws and fails the scan; that case is in the fixture.
4. The PHP page's client-recognition and cURL claims now match the code.
5. cURL reports one request per operation: an operation stating several URLs or several methods proves neither and reports nothing.
6. memberOf, callables and list moved to syntax.ts; one joinPath in http-url.ts replaced both joined helpers; joinedName now reuses symbolName. One walk feeding both passes was not done: the HTTP pass skips a group call to visit its closure under a prefix, while the evidence pass must visit that call to record its invocation, so merging them would change evidence traversal and carry HTTP-only scope through it.
Re-verification: bun test test-bun/php-http.test.ts test-bun/php-scanner.test.ts 8 pass; isolated bun run check exit 0 (tsc clean, node 16 pass, bun 447 pass 25 skip 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).

Review round (external cold reviews at cf8e7975, each reproduced with a scan-to-inferRelationships probe): (1) route receivers: builder routes and groups count only on a proved router (Route facade or its global alias; parameters or properties typed Slim App/RouteCollectorProxy(Interface) or Laravel Router/Registrar; a proved group's closure's first parameter), so $cache->get('/talks', fn) and Cache::get(...) report nothing (receivers.ts). (2) client receivers are proved per declaration: typed and promoted properties of the type, and a callable's own typed parameters unless its body writes them (assignment, destructuring, foreach, by-reference use); new Client(...) no longer counts because its base_uri is not read (a literal host produced a local row). (3) constants are keyed by namespace or declaring type and resolved as PHP does (self::, Type:: through use aliases, namespaced before global; static:: unresolved). (4)+(6) cURL: one operation reports a request only for one curl_init result bound to one handle that every option names, with every URL and method option readable (http-curl.ts); CURLOPT_POST accepts true or 1. (5) Route::prefix('/api')->get(...) carries chain prefixes. Same-rule drift fixed: home_url() . 'api/talks' continues the site root's segment, so it is a leading unknown. Folded the leading-backslash step into syntax.ts qualifiedName/calledFunction; typeName moved to syntax.ts. Constraints, order and blockers per the approved format (http-routes.ts). Skipped: grok-all's optional root-relative-Guzzle-configured alignment (the core leading-segment drop matches with or without configured; not a wrong output here); Laravel global Route::pattern set in another file and Laravel's bootstrap api prefix are not read (documented limit / not reported). Verification: bun test test-bun/php-http.test.ts test-bun/php-scanner.test.ts 8 pass; the new expectations fail on HEAD scanner code (leaked/replaced/constructed clients, two-handle and unreadable-method cURL, foreign constants, cache endpoints, dropped constraints, specificity-picked /reports/daily, a blocked /api/archive/latest row); isolated bun run check at 58015031 exit 0 (tsc clean; node 16 pass; bun 557 pass, 35 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).

Laravel cross-file routing: pending endpoints now carry their route text, patterns and a Laravel flag; resolveEndpoints joins the loading file's prefix, merges global patterns under group and route patterns, and turns unresolved paths or handlers into blockers. Receiver roles distinguish Laravel and Slim routers so global patterns and mounts apply only to Laravel routes. Red tests: without mounts and global patterns the fixture reports /sessions instead of /api/sessions, /talks/:id instead of /admin/talks/:id, a plain /deals instead of a /partners blocker and /api/sessions/:talk unconstrained, and the php-http-patterns fixture reports /talks/:id unconstrained. Isolated bun run check at ed695d75 exit 0 (tsc clean; node 16 pass; bun 565 pass, 35 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).

Cold-review round applied (all reproduced with the reviewer's probes in rev41610 and fixed): (1) Slim prefixes per receiver; proxies outside a proved group, and closures of unproved group calls, give blockers. (2) Laravel plain string handlers resolve only as controller-group methods. (3) Transitive loads, require inside a Laravel group, blockers for unloaded Laravel route files; the main fixture's routes file is now routes/web.php, loaded through bootstrap/app.php withRouting(web:). (4) Plan item 16 reworded: root-relative client paths stay configured. (5) Top-level requests are named after the (module) operation. (6) (module) is declared only when a fact names it; evidence.ts is back to its HEAD form, so other top-level calls create no operation or invocation. (7) Invokable Symfony class routes and Laravel domain() blockers. Each fix was red-checked by disabling it: the endpoint, request or router test fails. Isolated bun run check at fabb8811 exit 0 (tsc clean; node 16 pass; bun 576 pass, 35 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).

Re-review round applied (probes rr41610b p4 to p7 reproduced and fixed): Breeze layout (routes/web.php requiring routes/auth.php) now serves /login and, with the shared Laravel application, abstains instead of deriving a row to a root parameter route; Route::group(['domain' => ...]) and ->domain(...) give blockers; the Slim every-write rule, closure use imports, per-scope writes and setBasePath are covered in php-http-routers/slim.php. Each fix was red-checked by disabling it (the endpoint, row or router test fails). Isolated bun run check at 91b1e2b9 exit 0 (tsc clean; node 16 pass; bun 581 pass, 35 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts, python-scanner.test.ts).

Simplicity round (cold junior-maintainer review): one load rule in http-laravel.ts (a load serves its target under each base of its loading file; with no base a group or withRouting serves from the root and a require serves nothing; a file left with no base serves under an unknown prefix), which removes the spurious root blocker a require in an unloaded file such as tools/seed.php caused. Naming is load throughout (Load, loadOf, routingLoads, loadedFile, rootBase) and staysInSegment is the one segment check; receiverOf lives in syntax.ts, unresolvedRoute next to noRoute, one inAncestor helper serves base_path candidates and the application lookup, and loadOf builds every load. PendingEndpoint.order and the laravel flag became one project marker; served computes the application. Receiver is a union where only Slim receivers carry a prefix; globalPatterns proves its receiver directly; write counting reads closure uses in the same loop over a body's own nodes, and the redundant by-reference-variable, by-reference-import and controller-string checks are gone. A typed Slim App now serves under the project's single literal setBasePath, at the root when none is called, and otherwise its routes are blockers. The (module) operation is reported only when a final endpoint or request names it (index.ts). New fixture lines (tools/seed.php, a group where option and a loading group's where, a promoted-only constructor client, an invokable controller with method routes, the routers fixture's load cycle, ambiguous base_path, alias Route, conflicting and unreadable-name patterns, Slim destructuring, foreach, two base paths, new App, closure visibility, by-reference and reassigned imports, and the php-http-projects fixture for the Slim project base and the composer.json application) catch all 34 rule mutations the review listed or that remained (each disabled rule makes test-bun/php-http.test.ts fail). The PHP page states the receiver rule once and no longer says includes are not read. Isolated bun run check at a5c0f2cc exit 0 (tsc clean; node 16 pass; bun 594 pass, 35 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The PHP scanner now reports HTTP endpoint and request facts, so core derives HTTP relationships for PHP. Endpoints come from Laravel and route-builder registrations with their group prefixes, Symfony #[Route] attributes with the class-level prefix, and WordPress register_rest_route; requests come from clients whose receiver is proved to hold a Guzzle-style client, the WordPress HTTP API and cURL. Handler symbols resolve to operations after every file is read, so a route file's endpoint names the controller method that serves it. Only literal routes and URLs become facts: a computed prefix or route reports nothing, one whole computed segment is dynamic, and any other computed text is unknown. The PHP page lists the supported APIs, their limits and the six producer-checklist answers. Verified by test-bun/php-http.test.ts (endpoint facts, request facts, and the rows inferRelationships derives from them, with each unresolved case asserted absent) and an isolated bun run check (exit 0).

Review round: every reviewer finding is fixed with a red test. Only proved receivers register routes or send requests, scoped per declaration; constants resolve as PHP resolves them; cURL requests need one readable handle; fluent and composed Laravel prefixes apply, including files loaded through withRouting, group files and requires; route constraints are reported as constrained segments; every PHP endpoint states an unknown registration order, with one application per Laravel project; route entries the scanner cannot resolve (computed paths, unknown handlers, host-bound or conventional routes, unloaded Laravel files, unproved Slim prefixes) are blockers; and a file's top-level code is a (module) operation only when its routes or requests name it. Verified by test-bun/php-http.test.ts (main, patterns and routers fixtures) and an isolated bun run check (exit 0).

Simplicity round: one load rule, load naming and shared helpers replace the copied load and receiver logic, a typed Slim App follows the project's base path, and every PHP HTTP rule the review mutated is now pinned by a fixture line.
<!-- SECTION:FINAL_SUMMARY:END -->
