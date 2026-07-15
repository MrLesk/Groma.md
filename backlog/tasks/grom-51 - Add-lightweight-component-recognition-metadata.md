---
id: GROM-51
title: Add lightweight component recognition metadata
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 20:37'
updated_date: '2026-07-15 01:18'
labels:
  - model
  - visualization
  - simplicity
milestone: m-2
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - backlog/tasks/grom-51 - Add-lightweight-component-recognition-metadata.md
  - src/application/README.md
  - src/application/index.ts
  - src/application/snapshot-state.ts
  - src/application/tests/conformance.ts
  - src/application/tests/operations.test.ts
  - src/cli/README.md
  - src/cli/contracts.ts
  - src/cli/render.ts
  - src/cli/surface.ts
  - src/cli/tests/program.test.ts
  - src/cli/tests/render.test.ts
  - src/persistence/README.md
  - src/persistence/markdown-intent-store.ts
  - src/persistence/tests/markdown-intent-store.test.ts
  - src/standard-model/README.md
  - src/standard-model/model.ts
  - src/standard-model/tests/model.test.ts
priority: high
type: feature
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let components carry the small optional canonical recognition metadata needed for legible overview cards without expanding architectural meaning or coupling the canonical model to a renderer. This task stores and validates iconDomain but introduces no favicon fetcher or icon-resolution capability; any future resolution is separate and requires explicit user action and a privacy policy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Components support an optional short label, optional one-sentence summary, and optional iconDomain favicon-domain recognition hint in addition to their existing name, type, and parent metadata
- [x] #2 A node projecting one component uses label when supplied, otherwise name when supplied, and otherwise the stable canonical component ID; external remains a documented conventional open type rather than a closed enum or special entity kind
- [x] #3 Normalization, application operations, Markdown persistence, reload, and deterministic serialization preserve omitted and supplied recognition metadata
- [x] #4 iconDomain is validated and persisted as optional canonical favicon-domain recognition metadata but never participates in identity, evidence matching, network access, or trust decisions; GROM-51 adds no favicon fetcher or icon-resolution capability
- [x] #5 No layout coordinate, color, theme, folded group, zoom, or other renderer state is admitted to the standard model
- [x] #6 Tests cover create, update, clear, reload, malformed metadata, label-to-name-to-canonical-ID display fallback, and byte-stable unchanged reads
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the Standard Model component contracts with optional label, summary, and iconDomain recognition metadata, including strict bounded validation and deterministic serialization while preserving the groma/v0.1 schema and open type token.
2. Expose a presentation-neutral one-component display-text helper with the label -> name -> canonical ID fallback, and thread the metadata through the bounded application snapshot decoder/projection and sparse null-clearing operations.
3. Persist the fields in canonical Markdown frontmatter with deterministic key ordering and backward-compatible omission, then document the field constraints and the external type convention.
4. Add focused Standard Model, application/conformance, persistence/reload/byte-stability, and CLI workflow coverage for create, update, clear, malformed input, and fallback behavior.
5. Reject URL/host-parser IPv4-number spellings with a pure bounded iconDomain rule and regression coverage, without adding URL parsing, network behavior, or dependencies.
6. Run focused checks, git diff --check, backlog doctor, and the full bun run check suite; inspect the cumulative diff, record exact modified files and verification evidence, then finalize GROM-51.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation decisions: label and summary will be canonical input strings, not silently trimmed or rewritten. label is a non-empty single line capped at 80 Unicode code points; summary is a non-empty single line capped at 280 Unicode code points, representing the semantic one-sentence authoring constraint without language-specific punctuation parsing. iconDomain is a lowercase ASCII DNS hostname with at least one dot, capped at 253 characters and 63 per label; schemes, credentials, ports, paths, query/fragment, whitespace, trailing dots, IP literals, and non-canonical uppercase are rejected. Punycode labels are accepted only when they satisfy the same DNS label grammar. These fields remain recognition metadata and do not affect identity, evidence, trust, or network access.

Implemented the three optional fields through Standard Model normalization, parsing, serialization, sparse null-clearing, the exact application decoder and semantic conformance trace, deterministic groma/v0.1 Markdown frontmatter, and the one-shot CLI/restart path. Added application-exported display text derivation and the disposable CLI overview node displayText without adding canonical node or renderer state. Validation includes true Unicode-code-point bounds and rejects unpaired surrogates; iconDomain remains inert canonical text and no resolver or network code was added. Verification: focused Standard Model, application, persistence, and CLI tests passed; the final full `bun run check` passed formatting, TypeScript, architecture boundaries, all 462 tests / 3051 assertions, native build and smoke checks, and the Iteration 1A compiled-binary/crash-recovery workflow. `git diff --check` and `backlog doctor` passed.

Spec review correction: the initial four-decimal-label check admitted shortened and numeric-base IPv4 spellings accepted by URL/host parsers (for example 127.1, 127.0.1, 0x7f.1, 0177.1, and mixed decimal/hex forms). Reopened AC4 to replace it with a narrow pure validation rule and regression tests.

Corrected iconDomain IP-literal validation after spec review. The pure validator now rejects any two-to-four-label hostname whose every label is an IPv4-number spelling (decimal digits, including octal-looking forms, or a valid 0x-prefixed hexadecimal value). Regression cases cover 127.1, 127.0.1, 0x7f.1, 0177.1, 123.456, 127.0x1, and mixed four-label forms at the model boundary, plus application mutation and Markdown decode coverage. Ordinary domains such as 123.example, 0x7f.example, 127.0xzz, and five-label numeric DNS names remain accepted. Local URL parsing confirmed the rejected inputs normalize to IPv4 addresses, including 123.456 -> 123.0.1.200. Final verification: focused suites passed 121 tests / 974 assertions; `bun run check` passed formatting, TypeScript, architecture boundaries, all 462 tests / 3065 assertions, native build/smoke, and Iteration 1A compiled-binary/crash recovery. `git diff --check` and `backlog doctor` passed.

Quality review correction: WHATWG treats a bare 0x label as the IPv4 number zero, so the first pure numeric-shape predicate still admitted 0x.1, 0x.0x1, and 1.0x. Reopened AC4 to cover this last spelling without changing the bounded validation approach.

Quality review follow-up completed. The pure IPv4-number predicate now recognizes a bare 0x label as hexadecimal zero, matching WHATWG host parsing without introducing a URL parser, network behavior, or dependency. Model-boundary regressions reject 0x.1, 0x.0x1, and 1.0x; ordinary domains 0x.example and 0x.0xzz remain accepted. Local URL verification resolved the rejected forms to 0.0.0.1, 0.0.0.1, and 1.0.0.0 respectively. The focused Standard Model suite passed 13 tests / 87 assertions. The full bun run check passed formatting, TypeScript, architecture boundaries, all tests, native build and smoke checks, and the Iteration 1A compiled-binary/crash-recovery workflow. git diff --check and backlog doctor passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added bounded optional component recognition metadata across the Standard Model, application projection and operations, deterministic Markdown persistence, and CLI workflows. Components support label, summary, and inert iconDomain metadata; display text follows label to name to stable canonical ID. The final iconDomain rule rejects IPv4 literals and WHATWG IPv4-number spellings, including bare-0x forms, while accepting ordinary DNS hostnames. No renderer state, identity semantics, favicon resolver, network access, trust behavior, URL parser, or new dependency was introduced. Focused and full repository checks, native and compiled-binary workflows, diff hygiene, and Backlog validation all pass.
<!-- SECTION:FINAL_SUMMARY:END -->
