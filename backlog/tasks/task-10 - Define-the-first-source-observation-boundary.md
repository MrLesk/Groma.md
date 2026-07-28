---
id: TASK-10
title: Define the first source-observation boundary
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 00:59'
labels: []
milestone: m-2
dependencies:
  - TASK-9
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
  - 'https://c4model.com/'
modified_files:
  - README.md
  - e2e/viewer.spec.js
  - fixtures/source-observation/supported.expected.json
  - fixtures/source-observation/supported.expected-markdown-text.json
  - fixtures/source-observation/supported/package.json
  - fixtures/source-observation/supported/src/index.ts
  - fixtures/source-observation/supported/src/components/markdown-emitter.ts
  - fixtures/source-observation/supported/src/components/source-watcher.ts
  - fixtures/source-observation/supported/src/components/typescript-observer.ts
  - fixtures/source-observation/unsupported/package.json
  - fixtures/source-observation/unsupported/src/index.ts
  - fixtures/source-observation/unsupported/src/components/source-watcher.ts
  - groma/README.md
  - groma/observed/README.md
  - groma/observed/systems/groma/containers/scanner/container.md
  - groma/observed/systems/groma/containers/scanner/components/.gitkeep
  - groma/source-observation.md
  - test/architecture-reader.test.mjs
  - test/source-observation-contract.test.mjs
  - test/validate-architecture.test.mjs
priority: high
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 02 proves that Groma can read, compare, and live-reload architecture Markdown without inspecting source code. Revision 03 adds one intentionally narrow producer of component Markdown beneath groma/observed. Define a local specification for exactly one supported TypeScript/Bun repository shape: its entry points, source declarations, component boundaries, directed relationships, and repository-relative source ranges. Each supported component declaration must provide its exact stable C4 ID, and each relationship declaration must provide exact source and target IDs. The observer emits those IDs unchanged, never reads plans, and performs no rename inference.

The specification must designate exactly one generated components directory beneath a named observed container as the scanner/emitter-owned subtree. A refresh may replace only files inside that subtree and must preserve hand-authored people, systems, containers, and every unrelated component. Direct observer invocation on an unsupported input shape returns one specified unsupported-shape error. Filesystem changes outside the supported source scope are ignored before observation and are not observer errors. Observation evidence belongs in a readable canonical Markdown body section, not in frontmatter or a second model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A local specification names the supported TypeScript/Bun repository layout, entry-point declarations, component-boundary convention, relationship syntax, repository-relative source-range format, and exact stable C4 ID syntax for components and relationship targets
- [x] #2 The specification includes one complete supported fixture whose declared IDs can exactly match elements in 03-code-observation and at least one directly invoked input that is explicitly outside the supported shape
- [x] #3 Direct observer invocation on any unsupported input shape returns the one documented unsupported-shape error and never falls back to partial extraction
- [x] #4 The specification names the exact supported filesystem-watch scope; changes outside it are ignored without invoking the observer and are not reported as unsupported-shape errors
- [x] #5 The specification names exactly one scanner/emitter-owned generated components directory beneath groma/observed; refresh replaces only that subtree and preserves hand-authored people, systems, containers, and unrelated components
- [x] #6 The specification defines a readable ## Source evidence section containing repository-relative file and source-range evidence, without adding a claim field, lifecycle frontmatter, or a second canonical model
- [x] #7 Observation is read-only and never executes or imports project code
- [x] #8 The specification introduces no plugin system, framework catalog, confidence score, rename reconciliation, or generalized program analysis
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Tighten groma.typescript-bun/v1 readable string values and specify locale-independent bytewise ordering plus deterministic canonical Markdown escaping.
2. Extend the supported fixture with an exact empty GromaRelationships tuple and boundary text that exercises the escaping contract; update deterministic expected evidence.
3. Strengthen contract tests for empty tuples, accepted/rejected text boundaries, exact escaped Markdown, and bytewise ordering without implementing the observer or emitter.
4. Run fixture syntax, focused/full architecture and browser checks, review the diff, refinalize TASK-10, and commit the focused correction.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Defined groma.typescript-bun/v1 as an exact UTF-8/LF, line-oriented, type-only literal declaration grammar for one Bun entry point and direct component modules. IDs are source-supplied lowercase kebab-case and transient observations retain exact inclusive repository-relative ranges. Direct unsupported roots reject with UnsupportedSourceShapeError / GROMA_UNSUPPORTED_SOURCE_SHAPE and no partial data; the watch filter admits only package.json, src/index.ts, and non-recursive src/components/*.ts events.

Reserved groma/observed/systems/groma/containers/scanner/components/ as the only generated subtree beneath a hand-authored scanner container. Emission resolves relationship targets from the complete observation set plus canonical observed elements outside the owned subtree, fails before writes on missing/duplicate targets, never reads plans, and records evidence only in a readable ## Source evidence body section.

Added supported, unsupported, and deterministic expected-observation fixtures. Contract tests prove exact declaration slices/ranges/schema/order, entry-point resolution, exact plan-03 scanner component IDs, and ownership. Independent review found no Critical or Important issues after grammar and target-resolution clarification. Fresh verification: Bun 1.3.14 bundled all six fixture TypeScript files; npm run check passed architecture validation and 74/74 tests; npm run test:viewer:browser passed 11/11; git diff --check passed.

Quality correction after independent review: source-provided readable values are now version-independent printable ASCII U+0020-U+007E with at least one character and no leading/trailing space. The emitter contract escapes every ASCII punctuation character exactly once before any heading, prose, link-label, or GFM table-cell placement. A checked-in Markdown-text oracle exercises pipe, backslash, brackets, emphasis, code, same-directory link labels, hrefs, and exact three-cell Comark parsing.

The supported markdown-emitter declaration now uses the exact one-line export type GromaRelationships = []; branch; the fixture test proves line placement and a deterministic empty relationship array. All ordering is unsigned UTF-8 bytewise tuple ordering with a non-ASCII boundary example and no localeCompare. Final independent re-review found no Critical, Important, or Minor issues and confirmed no observer/emitter implementation was added. Fresh verification: Bun 1.3.14 bundled all six fixture files, npm run check passed architecture validation plus 76/76 tests, npm run test:viewer:browser passed 11/11, and git diff --check passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined and verified the complete groma.typescript-bun/v1 handoff contract. The quality correction constrains all declaration-supplied readable text to version-independent printable ASCII with no edge spaces, specifies exact once-only Markdown/GFM punctuation escaping, adds a parsed link/table escaping oracle, covers the accepted one-line empty relationships tuple, and makes deterministic ordering unsigned UTF-8 bytewise rather than locale-dependent. No observer or emitter implementation was added. Final evidence: Bun 1.3.14 syntax builds for all six fixture files, architecture validation and 76/76 Node tests, 11/11 Playwright flows, clean diff hygiene, and independent review with no remaining findings. Friction classification: implementation defect.
<!-- SECTION:FINAL_SUMMARY:END -->
