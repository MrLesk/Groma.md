---
id: TASK-416
title: Derive certain HTTP relationships from scanner endpoint facts
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-17 18:38'
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
- [ ] #6 Once the Angular and Java producers exist, callforpapers is scanned from scratch with its existing Groma folder moved aside, and every difference between derived and authored HTTP rows is recorded.
- [x] #7 Core derives a row from the requesting file to the providing file only when the methods match, the known request path equals the endpoint path either completely or after removing the first path segment from one side, and every endpoint the request can match belongs to that one file.
- [x] #8 Requests whose path is only partly known (beyond whole segments that match path parameters), requests to a literal host, and requests that match endpoints in several files produce no row; a configured base value followed by a literal path counts as a known path, and query strings are ignored.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
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
<!-- SECTION:NOTES:END -->
