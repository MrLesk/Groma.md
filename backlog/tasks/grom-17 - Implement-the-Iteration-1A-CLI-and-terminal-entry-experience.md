---
id: GROM-17
title: Implement the Iteration 1A CLI and terminal entry experience
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-11 17:35'
updated_date: '2026-07-13 12:47'
labels:
  - cli
  - terminal
milestone: m-1
dependencies:
  - GROM-16
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose the complete 1A workflow through the compiled groma executable. Automation commands and the bare interactive terminal experience must call shared application operations, return bounded results, preserve deterministic machine behavior, and never access canonical files directly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The executable provides initialization plus root or nested component create, get, bounded list and child traversal, update, reparent, and explicit remove commands covering every 1A application operation
- [x] #2 Noninteractive create and update commands accept complete or sparse structured requests, including component type and parent, from a file or standard input so agents never need private APIs or direct Markdown edits
- [x] #3 Plain and JSON modes report stable identities, content revisions, graph generation, continuation, and typed diagnostics with documented exit-status classes
- [x] #4 Plain mode emits no ANSI styling or prompts, and every ordinary command returns one complete bounded result page without streaming
- [x] #5 When run in an initialized workspace on a PTY, bare groma opens a bounded aggregate terminal overview of root and nested components built from shared query operations and exits cleanly
- [x] #6 When no workspace exists, bare groma clearly offers the initialization path without silently creating files
- [x] #7 CLI and terminal tests prove that no command imports or calls Markdown-store or local-resource implementation APIs
- [x] #8 The exact long-term plaintext grammar remains explicitly unfrozen until the Iteration 2 evidence point recorded in ARCHITECTURE.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the host surface context with one captured initialization-only view of shared ApplicationOperations so init uses the application seam while all workspace-dependent commands remain gated by workspace.requireWorkspace().
2. Define a provisional Iteration 1A invocation grammar for init; component create/get/list/roots/children/update/reparent/remove; global plain or JSON format; explicit page limits and cursors; and stable exit-status classes.
3. Implement a bounded single-document UTF-8 JSON input boundary selected explicitly from a file or standard input, mapping create and update documents to their complete application request envelopes without reading canonical workspace files.
4. Implement a one-shot CLI host surface/controller that dispatches each ordinary command exactly once to its matching shared operation, captures the bounded result through host cleanup, and never imports persistence, Markdown-store, or local-resource APIs.
5. Implement deterministic canonical JSON and provisional plain renderers that expose stable IDs, revisions, generations, continuations, mutation phases, and typed diagnostics with no ANSI, prompts, or streaming.
6. Implement bare-groma behavior: missing workspaces only offer groma init; initialized stdin/stdout PTYs receive one buffered bounded recursive hierarchy built from listRoots/listChildren; initialized non-PTY invocation renders help.
7. Make the executable entry asynchronous, compose the default registry and process-signal source, read Bun stdin/file input through injected bounded adapters, and map host cancellation/startup/surface outcomes into documented exits.
8. Add boundary-local parser, input, renderer, surface, program, default-host, TTY, pagination, diagnostic, single-write, restart, and forbidden-dependency tests, including recursive same- and mixed-type children.
9. Document the provisional 1A command/request/output contracts, exit classes, PTY budgets, one-page rule, and the explicit Iteration 2 plaintext-grammar deferral.
10. Run focused and full checks, all four standalone targets, direct CLI/host compilation, independent specification and quality reviews, then publish a ready task-linked PR with exact title and complete Claude, Codex, and CI gates before finalization and merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context-hunter classification: L2 surface and host integration. Research will freeze only the Iteration 1A command/request envelopes, exit-status classes, one bounded page contract, and a bounded bare-PTY hierarchy; the long-term plaintext grammar and default page size remain explicitly unfrozen at their architecture evidence points.

Implementation complete: the async one-shot CLI uses the default host and shared application operations for init and every Iteration 1A component command; bounded JSON file/stdin input, canonical JSON and provisional plain rendering, explicit paging, stable exits, and bounded bare-PTY traversal are documented in src/cli/README.md. Objective coverage exercises the complete nested/relationship workflow across fresh host composition on every invocation, file and stdin requests, cursors, revisions, generations, deterministic reads, missing and initialized bare modes, invalid UTF-8, typed exit classes, signal cancellation, single buffered writes, no ANSI, and forbidden persistence imports. Validation: focused CLI/host 68 tests / 446 assertions; full bun run check 438 tests / 2,882 assertions; native direct-binary init/create/roots workflow; all four packaged targets; direct CLI and host compilation 8/8; git diff --check.

Correction: the focused CLI plus changed host suites contain 67 tests and 448 assertions at this head; the earlier 68-test count was a transcription error.

Exact-worktree specification pass corrected failure classification and bare-command rendering: workspace configuration provider failures now remain infrastructure exits while proven conflicts remain workspace exits, and overview failures use the ordinary diagnostic renderer instead of hierarchy framing. A real conflicting-marker regression proves bounded path-free plain output.

Exact-worktree quality pass corrected output containment: canonical rendering now fails closed instead of substituting or omitting values after structural failure; output traversal has a separate bounded value budget; oversized results become typed cli-output-bound-exceeded responses and never partial output. Surface regressions cover provider versus conflict exit routing.

Superseding final validation: focused CLI and changed host suites pass 70 tests / 457 assertions; bun run check passes 441 tests / 2,899 assertions plus formatting, strict types, architecture boundaries, native build and smoke; all four standalone targets pass; direct CLI plus host compilation passes 8/8 across Darwin arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64; the native compiled executable completed init/create/roots using stdin and JSON; git diff --check passes.

Claude review on PR #15: the default Fable invocation hit the monthly spend cap, so the same review was completed with Claude Sonnet. No blocking findings. Removed the dead host-level no-workspace branch and made host workspace-conflict routing exact. Documented the intentional cancellation tradeoff: signal handling stops result publication and host cleanup promptly, while already-started bounded application operations settle because 1A exposes no safe mid-commit cancellation seam. The broader diagnostic substring note remains non-actionable until application diagnostics gain a typed union.
<!-- SECTION:NOTES:END -->
