---
id: TASK-416.9
title: Report HTTP facts from the Python scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 23:08'
labels: []
dependencies: []
references:
  - runtime
  - build
modified_files:
  - plugins/scanners/python/worker/scan.py
  - plugins/scanners/python/worker/sources.py
  - plugins/scanners/python/worker/routes.py
  - plugins/scanners/python/worker/clients.py
  - plugins/scanners/python/worker/modules.ts
  - plugins/scanners/python/worker/runtime.ts
  - plugins/scanners/python/build.ts
  - test/fixtures/python-http/shop/flaskapp/app.py.fixture
  - test/fixtures/python-http/shop/flaskapp/talks.py.fixture
  - test/fixtures/python-http/shop/flaskapp/reports.py.fixture
  - test/fixtures/python-http/shop/flaskapp/factory.py.fixture
  - test/fixtures/python-http/shop/fastapiapp/main.py.fixture
  - test/fixtures/python-http/shop/fastapiapp/speakers.py.fixture
  - test/fixtures/python-http/shop/djangoapp/urls.py.fixture
  - test/fixtures/python-http/shop/djangoapp/talks_urls.py.fixture
  - test/fixtures/python-http/shop/djangoapp/views.py.fixture
  - test/fixtures/python-http/shop/clients/calls.py.fixture
  - test/fixtures/python-http/shop/clients/api.py.fixture
  - test/fixtures/python-http/shop/clients/proxy.py.fixture
  - test/fixtures/python-http-hidden/site/urls.py.fixture
  - test/fixtures/python-http-hidden/site/talks_urls.py.fixture
  - test/fixtures/python-http-hidden/site/views.py.fixture
  - test-bun/python-scanner.test.ts
  - docs/scanners/python/index.md
  - test/fixtures/python-http/shop/fastapiapp/extra.py.fixture
  - test/fixtures/python-http-blocked/site/urls.py.fixture
  - test/fixtures/python-http-blocked/site/views.py.fixture
  - test/fixtures/python-http-blocked/client/api.py.fixture
  - test/fixtures/python-http/shop/djangoapp/posts_urls.py.fixture
  - test/fixtures/python-http/shop/fastapiapp/sub.py.fixture
  - test/fixtures/python-http-base-store/client/github.py.fixture
  - test/fixtures/python-http-base-store/client/setup.py.fixture
  - test/fixtures/python-http/shop/clients/sessions.py.fixture
  - test/fixtures/python-http/shop/fastapiapp/orphan.py.fixture
  - test/fixtures/python-http/shop/fastapiapp/orphan_routes.py.fixture
parent_task_id: TASK-416
type: feature
ordinal: 480000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The Python scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. Django nests URL patterns through include(), while FastAPI and Flask use decorators.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Python scanner reports endpoints declared with FastAPI, Flask and Django URL patterns, and requests made with requests and httpx.
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
1. New plugins/scanners/python/worker/http.py, loaded into the worker globals before scan.py (runtime.ts and build.ts copy both), so neither file passes 500 lines. Evidence records each def node's operation identity so HTTP facts can name the handler or caller operation.
2. Cross-file resolution: map each scanned file to its dotted module path, read every module's top-level definitions, single assignments and imports, and resolve a name or attribute chain to an operation, a value or another module. Ambiguous or missing targets produce no fact.
3. Endpoints. Flask: app or Blueprint decorators (@x.route with literal methods, defaulting to GET, and @x.get style), Blueprint url_prefix and register_blueprint(url_prefix=). FastAPI and Starlette: app and APIRouter decorators, APIRouter(prefix=) and include_router(prefix=), including a router imported from another module and nested registrations. Django: module-level urlpatterns with path(), re_path() and url(), include() followed across modules, endpoints emitted only from url modules nobody includes so every path carries its prefixes, method '*', view resolved to a def through imports. Converters (<int:pk>, {id}, {rest:path}) are parameters or catch-alls; a segment mixing text with a placeholder, a computed route, an unresolved router, as_view() and route tables produce no fact.
4. Requests, against the simplified shape (configured?: true plus a leading unknown segment for an unresolvable base; re-read packages/scanner/src/http.ts first): requests, httpx (module calls, Client/AsyncClient/Session with base_url), urllib.request.urlopen (GET, POST with data, Request(method=)), aiohttp ClientSession. The URL expression reduces to literal text and computed marks through constants assigned once, f-strings and concatenation: a whole computed segment is dynamic, partly known text is unknown, a scheme or authority or a fully computed URL is an unresolvable base, a computed value followed by literal text is configured. Query and fragment are dropped. Requests outside a function, or through a local helper, produce no fact.
5. Fixture test/fixtures/python-http with one module tree per framework plus a client module, covering each supported API and each unresolved case; test in test-bun/python-scanner.test.ts comparing rendered endpoint and request facts.
6. docs/scanners/python/index.md: HTTP facts section listing supported APIs, limits and the six producer-checklist decisions in the order docs/scanners/evidence.md uses.
7. Isolated bun run check; self spec and quality review.

8. Split the producer into worker/sources.py, worker/routes.py and worker/clients.py so no file passes 500 lines; scan.py builds Sources(modules) and asks for served_endpoints and sent_requests.

Review-fix round (Codex u08 and codex-all #4, #5, #10, #11; Grok u08; approved core format in docs/scanners/evidence.md decisions 7 and 8; owner base classification):
9. Flask: a register_blueprint url_prefix replaces the blueprint's own prefix (Flask's BlueprintSetupState), nested registrations prepend the parent's effective prefix; FastAPI include_router stays additive.
10. Scope: scan.py marks every Name that reads a binding of an enclosing function, lambda or class (reusing local_names); resolve() and imported_chain() never follow such a name to a module import or constant, so a parameter named requests or BASE resolves to nothing. Client sessions come from module constants only for non-local names and from the operation's own single binding for local ones.
11. Base: text_parts marks configuration reads (os.environ[...], os.environ.get, os.getenv, django.conf settings.X, and a base_url attribute such as self.base_url) as configured; any other unresolved head (a parameter, local, call, or rebound name) is a leading unknown. f-string fields without conversion or format resolve like names. request_path no longer crashes on consecutive computed parts.
12. Constraints (decision 7): typed converters (<int:pk>, {id:int}, custom converters) and restricting regex groups are constrained parameters; str/string stay plain; text mixed with a placeholder is a constrained parameter named after the first placeholder instead of no endpoint; a regex part that may span segments or that the format cannot state becomes a constrained optional catch-all replacing the rest; [^/]+ is plain; a re_path without $ ends with a plain optional catch-all; a catch-all before another segment truncates the path to a constrained optional catch-all.
13. Order (decision 8): Django endpoints get order with the root URLconf file and their flattened resolution position; FastAPI and Starlette endpoints get order with the file creating the application (the route's own file when no registration is found) and position 0; Flask omits order.
14. Fixtures and test expectations for each fix (red first), docs/scanners/python/index.md answers decisions 7 and 8 and the base rule. Do not commit until core's format is committed.

15. Blockers (orchestrator spec): an ordered-router entry the scanner sees but cannot report keeps its position as its literal prefix plus a constrained optional catch-all. Django: as_view() and other unresolved views, admin.site.urls, an include() outside the scan or not walkable, an unreadable route or list element, named for the URL module's (module) operation, which scan.py adds to the operations. FastAPI and Starlette: a computed route or methods (the decorated operation), a router with an unknown prefix (bare catch-all, its own file as application), include_router() of an unresolvable router (the registering module's (module) operation). Class-based views are not mapped to their methods: Django routes by path alone, so a view with only get still takes every method, and inherited handlers are unknown. End-to-end test test/fixtures/python-http-blocked: boards/<slug>/ through as_view() before boards/archive/ leaves only the /talks/ row.

16. Cold-review round: a class's own base_url assigned once to text (class body or self.base_url = ...) resolves to that text, otherwise configured; api_route is read like route, add_api_route and add_route calls like route, mount and host on an ordered application or router are blockers; one binding helper (sources.py binding_names: every stored Name, for and unpacking targets included, plus def, class, import, except and match names) counts module constants, operation bindings and scan.py local_names; an include() route not ending in / turns its last segment into a constrained optional catch-all so the included routes keep their positions in blocker form; regex text counts a dot as literal only when escaped, and a character-class range must lie between letters or digits to stay within one segment; fixture for nested blueprint prefix replacement.

17. Targeted re-review: base_url bindings count across the class, its scanned ancestors and subclasses (class-body bindings and each method's own self.base_url stores, every binding context counted), plus every other .base_url store such as client.base_url = url; only a single plain assignment gives text, and a class value mixing configuration and text is kept. mount() of a scanned application registers it under the mount path; an unresolved mount stays a blocker through the unknown-registration path; host() blocks the whole application.

18. Simplicity round (cold review): fix the base_url family to include every ancestor of the class's subclasses (mixins), with a red fixture; unknown_registrations reuses route_facts; each Django include() resolves once in url_entries; one assigned-value map built in read_module (with items included) serves base_url_facts and operation_bindings; one scope walker with SCOPES, FUNCTIONS, parameters and statements beside binding_names replaces the separate scope walks; client sessions build module constants once per module and count with Counter; tests for a module session shadowed by a parameter and a subclass rebinding base_url; docs keep the blocker list only in decision 8 and name the route's own file as the fallback application.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Producer lives in three worker modules loaded into the Pyodide globals before scan.py (runtime.ts and build.ts list sources.py, routes.py, clients.py, scan.py), each under 500 lines: sources.py reads a module's declarations, constants, imports and calls and resolves a name or attribute chain across scanned modules by dotted path; routes.py turns Flask, FastAPI, Starlette and Django routing into endpoint facts; clients.py turns requests, httpx, aiohttp and urllib.request calls into request facts. Evidence now records each def node's operation identity so a fact can name its handler or caller.
Endpoints: decorators on a Flask, FastAPI or Starlette application or on a Blueprint or APIRouter, with the router's own prefix, every register_blueprint or include_router prefix (cross-module and nested), and Django urlpatterns with path, re_path and url, followed through include() and emitted only from tables nobody includes so each path carries its prefixes. Django endpoints use method '*'. Requests: method calls and request(method, url) on the client modules, on httpx.Client, httpx.AsyncClient, requests.Session and aiohttp.ClientSession (base_url included), and urlopen with its data and Request(method=) rules.
Fact shape per commit 6bea8c0b: no base field; a computed value followed by literal text sets configured, while a host URL or a URL the scanner cannot resolve leads with an unknown segment. A whole computed segment is dynamic, partly known text is unknown, query and fragment are dropped, and a name assigned once resolves to its literal text.
No fact for: an app or router created inside a function, as_view(), route tables, a computed route or methods list, a segment mixing text with a placeholder, an unresolved view or router, a request outside a function, and a request that only reaches a client through a local helper.
Verification: bun test test-bun/python-scanner.test.ts 7 pass; the new test scans test/fixtures/python-http through the built package and asserts the exact endpoint and request lists, so every unresolved case is proven absent and parseScanObservation validates every fact. Isolated bun run check passed (1 existing Biome warning in plugins/scanners/php/build.ts, tsc clean, node 16 pass, bun 437 pass, 25 skip, 0 fail).

Cold review (six wrong-row risks) fixed, each proven by a fixture whose fact is now absent: a computed methods list no longer falls back to GET (routes.py returns no endpoint); a registrar the scanner cannot resolve now leaves the router's complete prefix unknown, so a factory-registered blueprint reports nothing; Django endpoints need the complete include graph, so a table built by addition, bound more than once, including a computed module, or including a dotted path that matches several scanned files silences every Django endpoint (new fixture test/fixtures/python-http-hidden); a constant must be bound exactly once anywhere in the module, counting AugAssign and bindings inside if or try; a client session must be bound once in its operation, with parameters counted as bindings, so a rebound session reports nothing; and a client chain must start at an import of that library, so a parameter named requests is not the library. Optional items applied: literal text right after a configured base must start with a slash, otherwise that segment is unknown; the four-module load order lives in worker/modules.ts, used by build.ts and runtime.ts; routes.py and clients.py name sources.py as their predecessor. While fixing the import requirement, session calls briefly lost their verb (the receiver is a local name); sent_request now reads the verb from the attribute and uses the imported chain only to recognize the library.
Re-verification: bun test test-bun/python-scanner.test.ts 8 pass, with the endpoint and request lists asserted exactly, so every no-row outcome is proven. Isolated bun run check passed (1 existing Biome warning in plugins/scanners/php/build.ts, tsc clean, node 16 pass, bun 446 pass, 25 skip, 0 fail).

Review-fix round (Codex u08 and codex-all #4, #5, #10, #11; Grok u08; orchestrator spec for constrained segments, order and blockers). Verified each finding with a probe or a failing fixture expectation before changing code.
Fixed in plugins/scanners/python/worker: Flask register_blueprint url_prefix replaces the blueprint's own prefix (Flask's BlueprintSetupState), nested blueprints follow their parent; scan.py local_references() marks names bound by an enclosing function, lambda or class, and resolve() and imported_chain() never follow them (parameter named requests or BASE, route registrations inside functions); one binding helper, sources.py binding_names() (every stored or deleted Name, for and unpacking targets included, plus def, class, import, except and match names), counts module constants, operation bindings and scan.py local_names; a configured base is only os.environ[...], os.environ.get, os.getenv, Django settings.X or a base_url attribute, other unresolved heads (parameter, call, rebound name) are a leading unknown, f-string fields resolve like names, and consecutive computed parts no longer crash; self.base_url resolves to the value of the single plain assignment across the class, its scanned ancestors and subclasses when no other .base_url store exists.
Constraints and order per docs/scanners/evidence.md decisions 7 and 8: typed converters, mixed text and restricting regex groups are constrained parameters, [^/]+ plain, a group that may match a slash or regex text the format cannot state becomes a constrained optional catch-all (ranges only between letters or digits, dots literal only when escaped), a regex without $ ends in a catch-all, a catch-all before more route text ends the path; Django endpoints carry order with the root URLconf and the flattened resolution position, FastAPI and Starlette position 0 with the application file (the router's own file when no registration is found), Flask none.
Blockers: Django as_view() and other unresolved views, an include() outside the scan or not walkable, an unreadable route or list element (named for the URL module's (module) operation, which scan.py adds), an include() route not ending in / (its included routes keep their positions in blocker form); FastAPI and Starlette computed routes or methods, an add_api_route or add_route handler the scanner cannot resolve, a router on an unresolvable application, include_router() or mount() of an unresolvable router or application, and host(). api_route, add_api_route and add_route are read like route; a resolvable mount registers the mounted application under its path. Class-based views are not mapped to methods: Django routes by path alone and inherited handlers are unknown.
Verification: every new expectation in test/fixtures/python-http, python-http-blocked (end-to-end with core: without the blocker core derived a wrong GET /boards/archive row) and python-http-base-store failed before its fix; bun test test-bun/python-scanner.test.ts 10 pass; HTTP extraction over 1,842 CPython 3.14 standard-library modules and tokenization of 66,761 functions raised no errors; isolated bun run check from HEAD fabb8811 passed (Biome, typecheck, node 16 pass, bun 576 pass, 35 skip, 0 fail). Out of scope and reported: the optional cross-scanner syntax-error policy.

Simplicity round (cold junior-maintainer review): fixed the base_url family to cover every class a subclass inherits from, so a mixin that binds a host is counted (red fixture Feed / HostMixin / PartnerFeed). Consolidated without behavior change: SCOPES, FUNCTIONS, statements, parameters and one scope_nodes walker sit beside binding_names in sources.py and replace the separate walks in local_names, the class-body walk, operation bindings and operation calls (calls inside a nested lambda or class now belong to that scope, as for invocation evidence); one assigned-value map built in read_module (with items included) serves base_url_facts and operation sessions, replacing clients.bound_values; module client sessions are built once per module, and both counting loops use Counter; unknown_registrations reuses route_facts; each Django include() resolves once in url_entries. The application fallback is now the file where the route is written for a router nobody registers too (fixture orphan / orphan_routes, red against the committed code), matching the documented rule. Tests added for a module session shadowed by a parameter and a subclass rebinding base_url. Docs keep the blocker list only in decision 8. Verification: bun test test-bun/python-scanner.test.ts 10 pass; standard-library HTTP extraction and tokenization without errors; isolated bun run check at HEAD a9b8dff2 passed (node 16 pass, bun 592 pass, 35 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Python scanner reports HTTP endpoint and request facts: Flask, FastAPI and Starlette route decorators with blueprint and router prefixes and their registrations, Django urlpatterns followed through include(), and requests, httpx, aiohttp and urllib.request calls including sessions with a base_url. Facts follow the simplified contract: a computed value followed by literal path text sets configured, a host or unresolved URL leads with an unknown segment, a whole computed segment is dynamic and partly known text unknown. The producer lives in worker/sources.py, routes.py and clients.py, loaded before scan.py in the order worker/modules.ts declares. Anything the scanner cannot prove reports nothing, including a factory-built application, a computed route or methods list, an unreadable Django table, a constant or session bound more than once, and a client name that is not an import. docs/scanners/python/index.md lists the supported APIs, the limits and the six producer decisions. Verified by test-bun/python-scanner.test.ts (8 pass) asserting the exact fact lists for test/fixtures/python-http and no Django endpoint for test/fixtures/python-http-hidden, plus an isolated bun run check.

Review-fix round: Flask registration prefixes replace a blueprint's own; function-local names no longer resolve to module imports or constants; only configuration reads (and a base_url no class family pins to one plain assignment) are configured bases; constrained segments, Django resolution order and FastAPI or Starlette order are reported in the core format, and route entries the scanner sees but cannot report (as_view, unresolved includes, mounts and handlers, host, glued include prefixes) stay in the order as blockers. Verified by failing-first fixtures in test/fixtures/python-http, python-http-blocked (end-to-end with core) and python-http-base-store, and an isolated bun run check.

Simplicity round: one scope walker, binding counter and assigned-value map serve every Python rule, and a mixin's base_url now counts toward its subclasses.
<!-- SECTION:FINAL_SUMMARY:END -->
