---
id: TASK-416.6
title: Report HTTP facts from the C# scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 06:23'
labels: []
dependencies: []
references:
  - dotnet-scanner
  - program
  - scanners-projects
modified_files:
  - plugins/scanners/csharp/dotnet/OperationId.cs
  - plugins/scanners/csharp/dotnet/OperationEvidence.cs
  - plugins/scanners/csharp/dotnet/Contract.cs
  - plugins/scanners/csharp/dotnet/HttpRoutes.cs
  - plugins/scanners/csharp/dotnet/HttpSyntax.cs
  - plugins/scanners/csharp/dotnet/HttpEndpoints.cs
  - plugins/scanners/csharp/dotnet/HttpRequests.cs
  - plugins/scanners/csharp/dotnet/HttpEvidence.cs
  - plugins/scanners/csharp/dotnet/Scanner.cs
  - plugins/scanners/observations.ts
  - test/fixtures/csharp-http/Http.csproj
  - test/fixtures/csharp-http/TalksController.cs
  - test/fixtures/csharp-http/Program.cs
  - test/fixtures/csharp-http/TalkClient.cs
  - test/fixtures/csharp-http/TalksApi.cs
  - plugins/scanners/csharp/dotnet/test/HttpEvidenceTests.cs
  - test-bun/csharp-http.test.ts
  - docs/scanners/dotnet-csharp/index.md
  - test-bun/scan-source-units.test.ts
parent_task_id: TASK-416
type: feature
ordinal: 477000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Certain HTTP relationships need endpoint and request facts from every ecosystem. The C# scanner owns its ecosystem's HTTP clients and routing knowledge and must report them without knowing other scanners. ASP.NET Core replaces [controller] and [action] route tokens with class and method names.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The C# scanner reports endpoints declared by ASP.NET Core controllers and minimal APIs, including route groups, and requests made with HttpClient and Refit interfaces.
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
1. Shared OperationId helper: the operation id of a node and of a resolved method symbol, used by OperationEvidence and the new HTTP evidence. HTTP facts are filtered to operations the observation declares, so a fact never names an unknown operation.
2. HttpRoutes: route templates and request URLs become contract segments. Template parsing covers literal, {name}, {name?}, {name=default}, {name:constraint}, {*name} and {**name} (catch-alls are optional in ASP.NET Core); a segment mixing text and a parameter, or an unknown [token], drops the endpoint. Literal text is percent-encoded to RFC 3986 path characters.
3. Endpoints: attribute-routed controllers (class-level [Route] prefix times [HttpGet]/[HttpPost]/.../[Route] on actions, with [controller] and [action] token replacement, ~/ and / overrides, one endpoint per attribute pair) and minimal APIs (MapGet/MapPost/MapPut/MapDelete/MapPatch/MapHead/MapOptions, MapMethods with literal methods, Map for any method). A route group prefix comes from a MapGroup chain through locals; a receiver that cannot be proven to be the application root or a group drops the endpoint. The handler operation is the lambda or the resolved method declaration.
4. Requests: HttpClient calls (Get/Post/Put/Patch/Delete family and SendAsync with a new HttpRequestMessage) recognized by the receiver's type, and Refit-style declarative interfaces ([Get]/[Post]/... on interface methods), which also declare their own operations because the methods have no body. Literals, constants and interpolation or concatenation parts become literal, dynamic or unknown segments under the new request shape (configured flag; an unresolvable base is a leading unknown segment).
5. Contract and wiring: ScanHttpSegment/ScanHttpEndpoint/ScanHttpRequest records, validation against declared operations and deterministic ordering in ScanObservation.Create; Scanner passes the facts; combineObservations maps fact operation ids like invocations.
6. Fixture test/fixtures/csharp-http with a controller, minimal APIs with a group, an HttpClient client, a Refit interface and the unresolved cases; dotnet HttpEvidenceTests.
7. docs/scanners/dotnet-csharp/index.md: supported HTTP APIs, limits, and the producer checklist's six answers in order.
8. Verify: bun run test:csharp and the isolated bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in the Roslyn worker, from syntax rather than resolved framework types, because ASP.NET Core and client packages are never restored. New files: HttpRoutes (route templates and URL expressions to contract segments, with RFC 3986 percent-encoding), HttpSyntax (attribute names, proven constants including const and readonly-assigned-once fields, URL parts from literals, interpolation, concatenation and new Uri), HttpEndpoints (controllers and minimal APIs), HttpRequests (HttpClient calls and declarative interfaces), HttpEvidence (aggregate, keeping only facts whose operation the observation declares), OperationId (shared node and method ids, extracted from OperationEvidence). OperationEvidence.Extract now returns its node-to-operation map, which requests use to find the calling operation.
Decisions: an endpoint's builder must be provably the application (a Build() result or a WebApplication-typed name) or a MapGroup chain; a builder arriving as a parameter reports nothing. IApplicationBuilder.Map is not supported because a middleware branch is written the same way. Declarative interface methods have no body, so the scanner declares them as operations without tokens. Their templates and relative HttpClient paths set configured, matching HttpClient base-address resolution, while a leading / is no base.
Correction: a route group's prefix was dropped when the mapped pattern began with a slash. HttpRoutes.Under now joins a group prefix, while Join keeps the controller rule where ~/ or / replaces the prefix.
Also changed the shared plugins/scanners/observations.ts: combineObservations now remaps HTTP fact operation ids like invocation ids, because the C# scanner combines one observation per project or solution and the contract rejects a fact naming an unknown operation.
Verification: bun run test:csharp 15/15, including HttpEvidenceTests, which asserts the complete endpoint and request fact sets of test/fixtures/csharp-http and the scan's determinism. With the scanner packaged in an isolated worktree, test-bun/csharp-http.test.ts passes: the facts survive contract validation and combining, and core derives 'Calls HTTP endpoints: HEAD /ping, POST /talks' from TalkClient.cs and 'Calls HTTP endpoint: POST /talks' from TalksApi.cs, both to Program.cs. The other three packaged C# tests still pass (4/4). Isolated bun run check: exit 0, Biome clean, typecheck clean, node 16/16, bun 436 pass, 26 skipped, 0 failed.

Cold review fixes: (1) an action's methods are the union of its verb attributes and apply to every template it declares, so [HttpPost] [HttpPut("{id?}")] serves POST and PUT on {id?} only and no phantom prefix endpoint; an action with only template-less verb attributes serves the class prefix, and one with no verb attribute serves every method. (2) MVC inherits a class [Route], so a controller without its own [Route] is skipped unless every base names ControllerBase or Controller, and abstract controllers are skipped. (3) the readonly-field constant branch is gone, because a constructor may reassign such a field; only compiler constants count. (4) a builder name assigned again, or passed by ref or out anywhere in the file, no longer carries a prefix. (5) Prefix no longer recurses into an initializer from another syntax tree, which made Roslyn throw and failed the whole scan. (6) only a bodiless declarative method declares an operation, so a default interface implementation cannot duplicate an id. (7) test-bun/scan-source-units.test.ts now carries HTTP facts through combineObservations, so bun run check covers the shared remap for every worker scanner. (8) HttpEvidence exposes one Facts call and HttpRoutes owns declarative template parsing. (9) the fixture adds a computed method list, a computed group prefix, a reassigned group, an endpoint-form Map branch, a readonly-field URL, an abstract controller and a derived controller; the leftover Api/Api.csproj is deleted and the test renders a catch-all's optional flag as :name* . (10) core now compares literals case-insensitively, so the packaged test expects rows to TalksController.cs and the page no longer claims exact comparison.
Re-verification: bun run test:csharp 15/15. Packaged C# tests 4/4; core now derives 'Calls HTTP endpoint: HEAD /ping' (TalkClient.cs to Program.cs) and 'Calls HTTP endpoints: GET /api/Talks, GET /api/Talks/:id, POST /api/Talks/:id?' from both TalkClient.cs and TalksApi.cs to TalksController.cs. Isolated bun run check: exit 0, Biome clean, typecheck clean, node 16/16, bun 455 pass, 28 skipped, 0 failed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The C# scanner now reports HTTP facts from Roslyn syntax, without restoring ASP.NET Core or client packages. Endpoints come from attribute-routed controllers (class [Route] prefixes, verb and route attributes, [controller] and [action] tokens, ~/ and / overrides) and from minimal API MapGet/MapPost/MapPut/MapDelete/MapPatch and MapMethods on the application or a MapGroup chain. Requests come from HttpClient calls recognized by the receiver's type, including SendAsync with a request message, and from Refit-style interfaces, whose bodiless methods the scanner declares as operations. Only literal routes, URLs and compiler constants become facts: computed patterns, inherited or token routes, mixed segments, middleware branches, untraceable builders and readonly fields report nothing, and a computed URL or host becomes a leading unknown segment. combineObservations now remaps fact operation ids for every worker scanner. Verified by dotnet HttpEvidenceTests, which asserts the complete fact sets of test/fixtures/csharp-http (test:csharp 15/15), by the packaged test-bun/csharp-http.test.ts, where core derives rows to Program.cs and TalksController.cs, by test-bun/scan-source-units.test.ts for the remap, and by the isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
