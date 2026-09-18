---
id: TASK-416.8
title: Report HTTP facts from the Rust scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 06:26'
labels: []
dependencies: []
references:
  - src-main
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
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Rust scanner now reports HTTP facts, so groma lint and the map can derive client-to-server rows for Rust. The native worker reads endpoints from axum (route with method routers, nest, merge), actix-web (route attribute macros with service, configure, web::scope and web::resource) and Rocket (route attribute macros with mount and routes!), and requests from reqwest (reqwest::get, the client methods and request(Method::X, url) whose value flows into send) and a hyper or http Request::builder().uri(url) chain.

A route's path carries every literal prefix the source declares, including the prefixes under which its own router function is registered. A prefix or path that is not literal reports nothing for the routes under it rather than reporting them unprefixed. URLs resolve literals, format! templates, concatenation, pass-through conversions and constants assigned once; a whole computed segment is dynamic, partly known text is unknown, a host or an unresolvable base is a leading unknown segment, and a setting sets configured.

docs/scanners/rust/index.md lists the supported APIs, the limits and the producer checklist's six answers in order.

Verified by two tests on test/fixtures/rust-http, which covers each supported API and the unresolved cases (non-literal route and prefix, unregistered attribute handler, host URL, partly known segment, helper parameter, an argument that only looks like a request, and a map lookup): one asserts every endpoint and request fact, the other scans the fixture with the registered package and asserts the two derived rows, including a configured base matched after one leading segment. Clippy with warnings denied and an isolated bun run check also pass.
<!-- SECTION:FINAL_SUMMARY:END -->
