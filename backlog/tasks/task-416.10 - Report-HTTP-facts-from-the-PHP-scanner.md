---
id: TASK-416.10
title: Report HTTP facts from the PHP scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 06:19'
labels: []
dependencies: []
references:
  - evidence
  - php-src-index
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The PHP scanner now reports HTTP endpoint and request facts, so core derives HTTP relationships for PHP. Endpoints come from Laravel and route-builder registrations with their group prefixes, Symfony #[Route] attributes with the class-level prefix, and WordPress register_rest_route; requests come from clients whose receiver is proved to hold a Guzzle-style client, the WordPress HTTP API and cURL. Handler symbols resolve to operations after every file is read, so a route file's endpoint names the controller method that serves it. Only literal routes and URLs become facts: a computed prefix or route reports nothing, one whole computed segment is dynamic, and any other computed text is unknown. The PHP page lists the supported APIs, their limits and the six producer-checklist answers. Verified by test-bun/php-http.test.ts (endpoint facts, request facts, and the rows inferRelationships derives from them, with each unresolved case asserted absent) and an isolated bun run check (exit 0).
<!-- SECTION:FINAL_SUMMARY:END -->
