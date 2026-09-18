---
id: TASK-416.8
title: Report HTTP facts from the Rust scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 20:06'
labels: []
dependencies: []
references:
  - src-main
  - src-requests
  - url
  - patterns
  - endpoints
  - text
modified_files:
  - plugins/scanners/rust/native/src/url.rs
  - plugins/scanners/rust/native/src/patterns.rs
  - plugins/scanners/rust/native/src/endpoints.rs
  - plugins/scanners/rust/native/src/requests.rs
  - plugins/scanners/rust/native/src/scan.rs
  - plugins/scanners/rust/native/src/main.rs
  - plugins/scanners/rust/native/src/text.rs
  - test/fixtures/rust-http/Cargo.toml
  - test/fixtures/rust-http/src/lib.rs
  - test/fixtures/rust-http/src/axum_routes.rs
  - test/fixtures/rust-http/src/actix_routes.rs
  - test/fixtures/rust-http/src/rocket_routes.rs
  - test/fixtures/rust-http/src/client.rs
  - test-bun/rust-scanner.test.ts
  - docs/scanners/rust/index.md
  - plugins/scanners/rust/native/src/client.rs
  - plugins/scanners/rust/native/src/placement.rs
  - plugins/scanners/rust/native/src/handlers.rs
  - test/fixtures/rust-http/src/actix_reports.rs
  - test/fixtures/rust-http/src/rocket_ranked.rs
parent_task_id: TASK-416
type: feature
ordinal: 479000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The Rust scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. Rust web frameworks declare routes through builder calls or attribute macros.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Rust scanner reports endpoints declared with axum, actix-web and Rocket, and requests made with reqwest.
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
1. native/src/url.rs: resolve a URL expression to text parts. A string literal, a format! template with its placeholders, string concatenation with +, and pass-through wrappers (&, to_string, to_owned, into, as_str, clone, String::from) are read as text. A path that resolves to a const, a static or a let bound once with a literal value is its text; a format! placeholder named after such a constant is too. Any other value is a part the scanner cannot see, marked named (a path, field or placeholder name) or computed (anything else). request_path() then turns the parts into {configured, path}: a leading named value followed by /literal sets configured; a host, a scheme or a computed base becomes a leading unknown segment; a whole computed segment is dynamic; mixed text in one segment is unknown; the query and fragment are cut; literal text outside RFC 3986 path characters is percent-encoded.
2. native/src/endpoints.rs: one pattern parser for all three frameworks (:name, {name}, <name>, {*rest}, *rest, {name..}, <name..>, {name:.*}); a segment that mixes text with a parameter, or an actix regex, drops the endpoint. Collect route declarations per function: axum route(path, get(handler).post(other)); actix App::route(path, web::get().to(handler)); actix and Rocket attribute macros (#[get("...")] and friends) on the handler; and registrations that carry a prefix: nest, mount, merge, service, configure, web::scope and web::resource. A route's prefix comes from the literal prefixes of enclosing nest/mount arguments and of scope/resource in its receiver chain, plus the prefixes under which its enclosing function is itself registered (memoized, with a cycle guard), so a nested router is reported once with its full path. Rocket's routes![..] names handlers by identifier, resolved among the file's own functions. A non-literal prefix drops the routes under it.
3. native/src/requests.rs: reqwest (reqwest::get, and client.get/post/put/patch/delete/head(url) or request(Method::X, url) whose chain reaches send) and the hyper/http builder (Request::builder().method(..).uri(url)). The method comes from the call name or the Method path; the URL goes through url.rs. The fact is reported on the enclosing named function; URLs are not propagated from callers, so a helper's own unresolved parameter stays unknown.
4. scan.rs calls both after declarations(), so every fact names a declared operation; cfg(test) code has no operation and is skipped. Facts are added to the observation as httpEndpoints and httpRequests.
5. Fixtures under test/fixtures/: one per framework plus the unresolved cases (computed path, computed prefix, host URL, configured base, helper parameter). Tests in test-bun/rust-scanner.test.ts assert the facts and, through a registered scan, one derived HTTP relationship row.
6. docs/scanners/rust/index.md: supported APIs, limits, and the producer checklist's six answers in order.
7. Clippy, the Rust suite, and an isolated bun run check.

Review-fix round (Codex and Grok cold reviews at cf8e7975, plus the approved constrained/order fact format and the base-classification owner decision):
8. Requests need a reqwest client receiver (Codex must-fix requests.rs:56, Grok requests.rs:56-64): the value a get/post/.../request call is made on must be a reqwest Client: a parameter, let, static or struct field typed reqwest::Client (or a Client the file imports from reqwest), or a Client::new()/Client::builder() chain. Anything else reports no request.
9. A router stored in a local keeps its mount prefix (Codex must-fix endpoints.rs:250): the prefix walk follows a let-bound router to its single use; a target that is a let-bound call is registered through it. A local with another number of uses reports nothing.
10. A router nothing serves reports nothing (Grok endpoints.rs:109): an unregistered function's routes no longer default to the root. The root is proved by an App::new(), rocket::build() or rocket::custom() chain, or by axum::serve(listener, router) and into_make_service().
11. Constraints: actix {name:regex} is a constrained parameter, or a constrained optional catch-all replacing the rest when the pattern may match a slash; {name:.*} is a plain optional catch-all and {name:.+} a plain catch-all; text mixed with a placeholder is a constrained parameter named after the first placeholder; a Rocket parameter whose handler argument is not &str or String is constrained.
12. Order: every actix-web endpoint reports order with the file that declares the route as application and position 0 (the scan does not prove registration order); axum and Rocket omit it.
13. Base classification: only a field read or an environment read (std::env::var, env!) sets configured; a parameter, an unresolved local or constant, or a mutable value is a leading unknown segment.
14. docs/scanners/rust/index.md answers checklist decisions 7 and 8; fixtures and tests in test/fixtures/rust-http and test-bun/rust-scanner.test.ts; Clippy, the Rust suite and an isolated bun run check. Not committed until core is committed.

15. Final approach after the cold reviews: placement.rs reads where a router is served (the prefix walk, the shared chain-start reader start(), the application root kind: actix App::new(), axum serve, Rocket build/custom); endpoints.rs resolves registrations to prefixes and roots and emits endpoints, order (actix-web, and Rocket applications with a rank: position 0 in the root's file) and actix blockers; handlers.rs reads method routers, attribute routes, Rocket typed parameters and rank; client.rs reads the reqwest client receiver; text.rs holds the shared call helpers.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Flow: scan.rs collects the crate's constants, then calls endpoints::endpoints and requests::requests after declarations(), so every fact names a declared operation. Facts ride the observation as httpEndpoints and httpRequests; no adapter change was needed because parseScanObservation passes them through.

Endpoints (native/src/endpoints.rs): each function body is read for route declarations and registrations. A route is 'route(path, get(handler).post(other))', actix's 'route(path, web::get().to(handler))' or a resource route that takes its receiver's path, and a handler whose attribute macro states a method and path. Registrations are nest, mount, merge, service and configure. A route's prefix is the literal prefix of the enclosing nest/mount arguments plus web::scope and web::resource in its receiver chain, and then the prefixes under which its own function is registered (memoized, with a cycle guard), so a nested router is reported once with its full path. A registration whose prefix is not literal is recorded with no prefix, which reports nothing for the routes under it rather than reporting them unprefixed. Rocket's routes![..] resolves identifiers among the attributed handlers. patterns.rs parses :name, {name}, <name>, {*rest}, *rest, {name:.*} and <rest..>; an actix regular expression, a segment mixing text with a parameter, and a catch-all that is not last drop the endpoint.

Requests (native/src/requests.rs): reqwest::get, the client methods get/post/put/patch/delete/head/options and request(Method::X, url) when the chain reaches send, plus a hyper or http Request::builder().uri(url) chain, whose method comes from its method call. url.rs resolves literals, format! templates, + concatenation, pass-through conversions, and consts, statics and single-assignment locals; it then decides configured versus a leading unknown segment and splits segments, cutting the query and fragment and percent-encoding text outside RFC 3986.

Verification: cargo clippy --locked -D warnings clean after two findings (manual_map, nonminimal_bool). GROMA_TEST_RUST=... bun test test-bun/rust-scanner.test.ts: 8 pass, 33 expects. One test asserts every endpoint and request fact of test/fixtures/rust-http (axum nesting and merge, actix scope/configure/resource, Rocket mount, and the unresolved cases: non-literal route and prefix, unregistered attribute handler, host URL, partly known segment, helper parameter, and a HashMap get that is not a request). A second test scans the fixture with the registered package and asserts the two derived rows, including the configured base matched after one leading segment. Isolated worktree at HEAD fb4ea929: bun run check exited 0 (Node 16/16; Bun 444 pass, 19 skip, 0 fail); Biome's warning and infos are in files outside this task.

Dependency: the derived-row test needs the HTTP carry-through in plugins/scanners/observations.ts (combineObservations), which another lane has uncommitted in the shared tree. I did not edit that file. Without it the multi-manifest combine drops the facts and that test fails; the isolated check above includes it.

Cold review, must fix: chain() stepped to any ancestor method call, so a URL-shaped argument inside a chain that reaches send, such as tokens.get("talks") in a header value, fabricated a request with a method. The chain now steps to a parent only when the current value is that parent's receiver, seeing through await, ? and parentheses. The fixture's forwarded function pins it: it reports only its own POST /api/talks.

Cold review, accepted: the builder path now requires both Request and builder among the receiver chain's names, the body alternative is gone, and the fixture's built function covers it (PUT /api/talks/42). A one-argument route reports nothing without a receiver prefix, so an actix resource with no path cannot claim the root path. attributes is a Vec in source order, so the fact array is deterministic. The prefix resolution replaced the guard-as-cache with an active set plus a cycled flag, so a result cut short by a cycle is not cached. A format! placeholder or single-identifier argument is read as a crate constant only when the enclosing function does not bind that name, while the crate-wide map still resolves host constants to unknown. owned_nodes moved next to call_nodes in scan.rs, with comments on how the two walkers treat closures and async blocks, and bodies.rs is gone. The token helpers (first_string, literal_string, path_tail, macro_identifiers, macro_arguments, token_string, string_value) moved to text.rs, and url.rs's reader is now literal_path. The unused {name..} catch-all form is gone from patterns.rs.

Also aligned with the newer contract (4e973e1f): the Rust page now explains dynamic versus unknown by the segment a placeholder is written in, not by what the value could contain at runtime. Core compares literal text case-insensitively, which needs no producer change.

Re-verification: cargo clippy --locked -D warnings clean; GROMA_TEST_RUST=... bun test test-bun/rust-scanner.test.ts 8 pass, 33 expects; isolated worktree at HEAD b3d62477: bun run check exited 0 (Node 16/16; Bun 465 pass, 22 skip, 0 fail). The shared combineObservations carry-through landed with the C# commit, so no extra patch was needed.

Review-fix round (Codex and Grok at cf8e7975, the approved constrained/order/blocker fact format, and the base-classification owner decision):
- Fixed (Codex must-fix requests.rs:56, Grok requests.rs:56-64; probe reproduced a GET from outbox.get("/talks").send()): a client method call counts only on a reqwest client. New client.rs reads the receiver's declared type, since external crates stay unresolved: a parameter, let, static or struct field typed reqwest::Client or reqwest::blocking::Client, a Client the file imports from reqwest (use tree, also renamed), or a Client::new()/builder()/default() chain; clone() and builder calls keep the client. Fixture: notify on an Outbox is absent.
- Fixed (Codex must-fix endpoints.rs:250; probe reproduced /items for a router nested as a local): prefix walking moved to new placement.rs. It follows a router bound to an immutable local to its single use (any other number of uses is incomplete). A registration target that is a local bound to a call, or x.into_make_service(), resolves through it. Fixture: versioned() reports /v2/items.
- Fixed (Grok endpoints.rs:109; probe reproduced /admin from an unused helper): a function nothing registers no longer defaults to the root. The root is proved by a chain on App::new(), rocket::build() or rocket::custom(..), and by an axum router passed to serve (axum::serve(listener, app) or .serve(..)), which registers its function at the root. Fixture: run() serves app through a local; unused() is absent; mounted() and dynamic() are now merged into app so their non-literal prefix and path are still exercised.
- Base classification: Part::Named became Part::Setting, set only by a field read (self.base, settings.base, also as a format! positional argument) and by std::env::var / env!; unwrap, expect and unwrap_or_default pass the value through. A parameter, a mutable or unresolved name, a format! placeholder naming a local or an unknown constant are computed, so a leading one is unknown. Fixture: based(base) reports /unknown/talks, from_environment reports /talks configured.
- Constraints (patterns.rs): a brace-aware split; {name:regex} is a constrained parameter, or a constrained optional catch-all when the regex may match a slash; {name:.*} a plain optional catch-all, {name:.+} a plain catch-all; a catch-all before other segments stands for the rest as a constrained optional catch-all; text mixed with placeholders is a constrained parameter named after the first. Rocket parameters whose handler argument is not &str or String are constrained. Fixture: tags {id:\\d+}, v{version}, files {tail:.*}, Rocket detail/upload constrained and bio(slug: &str) plain.
- Order: every endpoint declared in a file that uses actix_web reports order {application: that file, position: 0}; the scan does not prove actix registration order. axum and Rocket omit it.
- Blockers (actix only): a route whose path, method router or handler cannot be read, a route or service/configure under an unreadable scope, and a service/configure target that is not a function, routes!, or a web::scope/web::resource chain without to/default_service report the readable prefix plus a constrained optional catch-all, method * unless known, on the registering function. Fixture: /admin/assets (actix_files::Files) and /health/ping (closure handler).
- docs/scanners/rust/index.md answers the eight producer decisions, including 7 and 8, the client receiver rule and the settings rule.
Verification: cargo clippy --locked -D warnings clean; focused Rust suite 9 pass, 34 expects; with only the new tests and fixtures at HEAD, the endpoint expectation fails on every changed endpoint (orders, constraints, blockers, /items instead of /v2/items, /unused present); isolated worktree at HEAD 58015031 plus this diff with GROMA_TEST_RUST: bun run check exit 0 (Node 16/16; Bun 566 pass, 26 skip, 0 fail); Biome's one warning is outside this task.

Coordinator follow-up, applied: an actix-web endpoint's order.application is now the file whose App::new() chain serves it (the function whose chain proves the root travels with each resolved prefix as Base.root); the declaring file is only the fallback. Fixture actix_reports.rs is configured into the App in actix_routes.rs and reports /reports with application actix_routes.rs. Handler-form helpers (method_handlers, attribute_routes, typed_parameters) moved to handlers.rs to keep endpoints.rs under 500 lines.
Follow-up (recorded, not in this task): compute real actix-web registration order from the App::new() chain (service, route, configure and scope order), so a blocker registered after a route no longer hides it; while every position is 0, an actix blocker removes that application's own rows.
Re-verification: cargo clippy --locked -D warnings clean; focused Rust suite 9 pass, 34 expects; isolated worktree at HEAD ed695d75 plus this diff with GROMA_TEST_RUST: bun run check exit 0 (Node 16/16; Bun 573 pass, 26 skip, 0 fail); Biome's one warning is outside this task.

Cold review of the fix, applied (each fixture case fails when its fix is reverted; checked with one variant build per fix):
- Indirection (must): placement's walk now leaves only through nest, mount, serve, service, configure and merge; a router passed to any other call, such as a helper that nests it, makes the rest unreadable. chain() follows a receiver bound by let to its value, and a parameter receiver is readable only as a router with no prefix of its own (ServiceConfig, Router, Rocket), so an actix Scope parameter is unreadable. Fixtures: with_prefix(..) inline and through a local report nothing; add(web::scope("/v1")) under /legacy/api gives blockers instead of /legacy/api/detail; a let-bound web::scope("/local") receiver reports /local/summary.
- handled (must): a scope or resource's to, to_async or default_service is a blocker at that chain's own placement; a called registration target counts as handled only when the called function's tail expression is; handled and the to check follow receivers and let-bound locals (chain_root). Fixture: legacy() returning web::resource("/archive/{id}").to(old) is a /archive/:id blocker before latest.
- Order now comes from the proved root: placement reports Root::Actix, Root::Axum or Root::Rocket, each resolved prefix carries the root function and kind, and the application is that function's file; the file-text actix_web test and the declaring-file fallback are gone. Blockers are reported only under an actix-web root; Rocket parameter constraints only under a Rocket root.
- client.rs: only clone() and a Client::builder() chain's build() keep a client; imported_client reads use items of the module that contains the type path (an inline mod or the file). Fixtures: client.cache().get(..).send() and a mod with its own Client are not requests.
- first_argument and callee() moved to text.rs and are shared by placement, handlers, url and endpoints.
- Rocket: an application in which any route attribute states rank reports order with one position (rocket_ranked.rs fixture); <rest..> is an optional catch-all.
Re-verification: cargo clippy --locked -D warnings clean; focused Rust suite 9 pass, 34 expects; isolated worktree at HEAD 9574e0a1 plus this diff with GROMA_TEST_RUST: bun run check exit 0 (Node 16/16; Bun 579 pass, 26 skip, 0 fail); Biome's one warning is outside this task.

Targeted re-review, applied (each case fails with its fix reverted; one variant build per fix):
- Shared chain reader (must): placement::start() reads where a method chain starts, through receivers and immutable let bindings: App::new(), rocket::build()/custom() (the root), Router::new() or a parameter typed ServiceConfig, Router or Rocket (no prefix), web::scope(..)/web::resource(..) (its path), or anything else, which leaves the placement unreadable. Walk::chain, Reader::scoped and Reader::handled all use it, replacing chain_root and bound. Fixtures: web::scope("/internal").service(internal_api().service(status)) is an /internal blocker instead of GET /internal/status; the earlier add(Scope) and let-bound scope cases still hold.
- Reassignment (must): a mut binding is unreadable as a receiver, and a router that is the right side of an assignment makes the placement unreadable. Fixtures: with_extra(mut router) and reassigned() report nothing; a mut scope reassigned from /before to /after is a /relocation blocker instead of /relocation/before/relocated.
- Method argument (must): nest_service("/assets", Router::new().route("/logo", ..)) reports nothing, which pins the method-call half of the ROUTER_ARGUMENTS rule.
- Client: build().unwrap() and build().expect(..) of a Client::builder() chain keep the client (fixture built_client).
- requests.rs client_function and chain_method, and url.rs call_parts, use the shared callee() and first_argument().
Re-verification: cargo clippy --locked -D warnings clean; focused Rust suite 9 pass, 34 expects; isolated worktree at HEAD 91b1e2b9 plus this diff with GROMA_TEST_RUST: bun run check exit 0 (Node 16/16; Bun 588 pass, 26 skip, 0 fail); Biome's two warnings are in files outside this task.

Last check, applied: single_use no longer rejects a mut pattern, since an assignment to the local is a second use; the long comment in the endpoints test is rewrapped.
Follow-ups (recorded, not in this task):
- An actix-web scope may capture later sibling routes under its prefix without falling through (unverified, pre-existing).
- Compute real actix-web registration order from the App::new() chain (service, route, configure and scope order), so a blocker registered after a route no longer hides it; while every position is 0, an actix blocker removes that application's own rows.
Final verification: cargo clippy --locked -D warnings clean; focused Rust suite 9 pass, 34 expects; isolated worktree at HEAD 206c2f26 plus this diff with GROMA_TEST_RUST: bun run check exit 0 (Node 16/16; Bun 590 pass, 26 skip, 0 fail); Biome's two warnings are in files outside this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Rust scanner now reports HTTP facts, so groma lint and the map can derive client-to-server rows for Rust. The native worker reads endpoints from axum (route with method routers, nest, merge), actix-web (route attribute macros with service, configure, web::scope and web::resource) and Rocket (route attribute macros with mount and routes!), and requests from reqwest (reqwest::get, the client methods and request(Method::X, url) whose value flows into send) and a hyper or http Request::builder().uri(url) chain.

A route's path carries every literal prefix the source declares, including the prefixes under which its own router function is registered, and a route is reported only when the source proves where it is served: an App::new(), rocket::build() or rocket::custom() chain, or a router passed to serve. A prefix or path the scan cannot read reports nothing for the routes under it rather than reporting them unprefixed. URLs resolve literals, format! templates, concatenation, pass-through conversions and constants assigned once; a whole computed segment is dynamic, partly known text is unknown, a host, a parameter or an unresolvable base is a leading unknown segment, and a field or environment setting sets configured.

docs/scanners/rust/index.md lists the supported APIs, the limits and the producer checklist's eight answers in order.

Verified by two tests on test/fixtures/rust-http, which covers each supported API and the unresolved cases (non-literal route and prefix, unregistered attribute handler, host URL, partly known segment, helper parameter, an argument that only looks like a request, and a map lookup): one asserts every endpoint and request fact, the other scans the fixture with the registered package and asserts the two derived rows, including a configured base matched after one leading segment. Clippy with warnings denied and an isolated bun run check also pass.

Review round (Codex and Grok, then two cold reviews): requests count only on a reqwest client read from its declaration; a router stored in a local keeps its prefix, and a router nothing serves, one passed to a helper, one on an unrecognized chain start or one behind a mut binding reports nothing; actix regex, mixed-text and Rocket typed parameters are constrained, Rocket <rest..> is optional; actix-web endpoints, and Rocket applications with a rank, report order with position 0 in the file that creates the application; actix entries the scan cannot read are blockers; only a field or environment read sets configured. Each fix is pinned by a fixture case that fails with the fix reverted; verified with Clippy, the Rust suite and an isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
