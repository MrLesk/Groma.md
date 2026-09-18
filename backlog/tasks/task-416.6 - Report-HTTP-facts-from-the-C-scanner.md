---
id: TASK-416.6
title: Report HTTP facts from the C# scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:15'
updated_date: '2026-09-18 19:35'
labels: []
dependencies: []
references:
  - dotnet-scanner
  - program
  - scanners-projects
  - httproutes
  - httpendpoints
  - httpsyntax
  - httprequests
  - httpevidence
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
  - test/fixtures/csharp-http/Partials.cs
  - test/fixtures/csharp-http/Partials.Parts.cs
  - test/fixtures/csharp-http/SettingsClient.cs
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
2. HttpRoutes: route templates and request URLs become contract segments. Template parsing covers literal, {name}, {name?}, {name=default}, {name:constraint} (constrained), {*name} and {**name} (catch-alls are optional in ASP.NET Core); a segment mixing text and placeholders is one constrained parameter, and an unknown [token] drops the endpoint. Literal text is percent-encoded to RFC 3986 path characters.
3. Endpoints: attribute-routed controllers (class-level [Route] prefix times [HttpGet]/[HttpPost]/.../[Route] on actions, with [controller] and [action] token replacement and ~/ and / overrides, one route per ASP.NET Core selector as in item 9) and minimal APIs (MapGet/MapPost/MapPut/MapDelete/MapPatch and MapMethods with literal methods, on the application from Build() or WebApplication.Create() or on a MapGroup chain). A route group prefix comes from a MapGroup chain through locals; a receiver that cannot be proven to be the application root or a group drops the endpoint. The handler operation is the lambda or the resolved method declaration.
4. Requests: HttpClient calls (Get/Post/Put/Patch/Delete family and SendAsync with a new HttpRequestMessage) recognized by the receiver's type, and Refit-style declarative interfaces ([Get]/[Post]/... on interface methods), which also declare their own operations because the methods have no body. Literals, constants and interpolation or concatenation parts become literal, dynamic or unknown segments under the new request shape (configured flag; an unresolvable base is a leading unknown segment).
5. Contract and wiring: ScanHttpSegment/ScanHttpEndpoint/ScanHttpRequest records, validation against declared operations and deterministic ordering in ScanObservation.Create; Scanner passes the facts; combineObservations maps fact operation ids like invocations.
6. Fixture test/fixtures/csharp-http with a controller, minimal APIs with a group, an HttpClient client, a Refit interface and the unresolved cases; dotnet HttpEvidenceTests.
7. docs/scanners/dotnet-csharp/index.md: supported HTTP APIs, limits, and the producer checklist's answers in order.
8. Verify: bun run test:csharp and the isolated bun run check.

Review-fix round (external reviews of cf8e7975; fact format for constraints approved in the core lane):
9. Fix (Codex must-fix, HttpEndpoints.cs:93): follow ASP.NET Core's selector rule instead of pairing every verb with every template. Each attribute that defines a route (a template, Name or Order) is one selector; a verb attribute's selector allows only its own method, a [Route] selector takes the methods of the template-less verb attributes (every method when there are none), and template-less verb attributes form one more selector on the class prefix unless a [Route] took them. [HttpGet("a")] [HttpPost("b")] serves GET a and POST b; [HttpPost] [HttpPut("{id?}")] serves PUT {id?} and POST on the prefix. An action with [AcceptVerbs] reports nothing, because ignoring it widened a [Route] action to every method.
10. Fix (Codex must-fix, HttpEndpoints.cs:51): only an eligible controller action serves: a public, top-level, non-generic, non-abstract class named *Controller, marked [Controller] or deriving from ControllerBase or Controller, and not [NonController]; a public, non-static, non-generic method with a body and without [NonAction].
11. Fix (Grok, HttpEndpoints.cs:180): WebApplication.Create() is the application root, like Build().
12. Fix (codex-all #5, HttpRoutes.cs:43): route constraints set constrained: true (for example {id:int}); a segment mixing text with placeholders is one constrained parameter named after the first placeholder instead of dropping the endpoint. Templates are split at slashes outside placeholders, escaped braces are literal text, and a default or trailing ? makes a parameter optional only outside a constraint's parentheses. ASP.NET Core ranks by specificity, so no order is reported.
13. Base classification (owner rule): a local or readonly field whose single literal initializer is never written again in its file resolves to its text; a parameter or other value stays a leading unknown segment.
14. Docs: C# page lists the selector and eligibility rules and answers checklist decisions 7 and 8. Tests: HttpEvidenceTests fixture cases for each fix; the packaged csharp-http test once the core change lands.
15. Cold-review fixes: a controller declared in several partial parts reports nothing; [action] is the literal [ActionName] or the method name without a trailing Async; a controller whose base between it and ControllerBase declares a public method or a [Route], or is not declared in source, reports nothing, and an inherited [NonController] counts; a named template: argument is the template; a class [Route] starting with ~/ starts at the root; the minimal-API builder follows the same single-value rule as URLs (HttpSyntax.SingleValue).
16. Configuration reads (orchestrator decision): an IConfiguration indexer, GetValue, GetConnectionString, a section's Value, or Environment.GetEnvironmentVariable followed by a path starting with / is a configured base; a read continued without / and any other computed start stay a leading unknown.

17. Re-review: pin the base [Route], undeclared-base, lowercase-suffix, System.Environment and DefinesRoute checks in the fixture; when any source file may set SuppressAsyncSuffixInActionNames to anything but true, an [action] path of a method ending in Async reports nothing.
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

Review-fix round (external reviews of cf8e7975, a cold review and a targeted re-review): controller routes follow ASP.NET Core's selector rule (checked against DefaultApplicationModelProvider.CreateSelectors), so each verb attribute with a template serves only its own method and template-less verb attributes serve the class prefix unless a [Route] took them; [AcceptVerbs] actions report nothing. Only eligible controllers and actions serve: public, top-level, non-generic, non-abstract classes declared in one place, named *Controller, marked [Controller] or deriving from ControllerBase/Controller, not [NonController] (inherited attributes count), and with no project base that declares a public method or a [Route] or is not declared in source; public, non-static, non-generic actions without [NonAction]. [action] is a literal [ActionName] or the method name without Async, and unknown for an Async method when any source file may set SuppressAsyncSuffixInActionNames to anything but true. A named template: argument is the template, a class [Route] starting with ~/ starts at the root, and WebApplication.Create() is an application root. Route constraints set constrained, and a mixed segment is one constrained parameter (http-spec.md; ASP.NET Core reports no order). Requests: a local or readonly field that holds one value resolves to its initializer (HttpSyntax.SingleValue, shared with the minimal-API builder), and an IConfiguration read (indexer, GetValue, GetConnectionString, section Value) or System.Environment.GetEnvironmentVariable followed by a path starting with / is a configured base (orchestrator decision); other computed starts stay a leading unknown.
Verification: on the pre-round code the extended csharp-http fixture showed every wrong endpoint and request base listed above; removing the base [Route], undeclared-base, case-insensitive suffix, System.Environment, DefinesRoute, Async-suffix and partial-type checks each fails a dotnet test. In an isolated worktree at 9574e0a1: bun run test:csharp 18/18; packaged csharp-http, csharp-outline, csharp-lint, csharp-source-units and csharp-process pass (7/7), with core deriving GET /api/Talks, GET /api/Talks/:id, GET /api/Talks/Feed, GET /api/Talks/latest and POST /api/Talks from TalkClient.cs and GET /api/Talks, GET /api/Talks/:id and POST /api/Talks from TalksApi.cs; bun run check passed (Biome with only existing diagnostics in other files, typecheck, node 16/16, bun 570 pass, 35 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The C# scanner now reports HTTP facts from Roslyn syntax, without restoring ASP.NET Core or client packages. Endpoints come from attribute-routed controllers (class [Route] prefixes, verb and route attributes, [controller] and [action] tokens, ~/ and / overrides) and from minimal API MapGet/MapPost/MapPut/MapDelete/MapPatch and MapMethods on the application or a MapGroup chain. Requests come from HttpClient calls recognized by the receiver's type, including SendAsync with a request message, and from Refit-style interfaces, whose bodiless methods the scanner declares as operations. Only literal routes and URLs, compiler constants, and locals or readonly fields that hold one value become facts: computed patterns, inherited or token routes, middleware branches and untraceable builders report nothing, and a computed URL or host becomes a leading unknown segment. combineObservations now remaps fact operation ids for every worker scanner. Verified by dotnet HttpEvidenceTests, which asserts the complete fact sets of test/fixtures/csharp-http (test:csharp 15/15), by the packaged test-bun/csharp-http.test.ts, where core derives rows to Program.cs and TalksController.cs, by test-bun/scan-source-units.test.ts for the remap, and by the isolated bun run check.

Review-fix round: controller routes now follow ASP.NET Core's selector and eligibility rules (per-attribute verbs, public actions of real, single-declaration controllers whose bases add no routes or actions, [ActionName] and the Async suffix), route constraints and mixed segments are reported as constrained, and request bases resolve single-valued locals and readonly fields and treat configuration reads followed by / as configured. Verified by the extended csharp-http fixture in HttpEvidenceTests (test:csharp 18/18), the packaged csharp-http test against the committed core, and the isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
