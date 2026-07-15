---
id: GROM-26
title: Persist and resolve component aliases
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-15 18:03'
labels: []
milestone: m-2
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - backlog/tasks/grom-26 - Persist-and-resolve-component-aliases.md
  - src/application/README.md
  - src/application/contracts.ts
  - src/application/operations.ts
  - src/application/snapshot-state.ts
  - src/application/tests/operations.test.ts
  - src/cli/README.md
  - src/cli/contracts.ts
  - src/cli/help.ts
  - src/cli/parser.ts
  - src/cli/surface.ts
  - src/cli/tests/parser.test.ts
  - src/cli/tests/program.test.ts
  - src/core/README.md
  - src/core/aliases.ts
  - src/core/graph.ts
  - src/core/index.ts
  - src/core/tests/graph.test.ts
  - src/host/default-bootstrap.ts
  - src/host/lifecycle.ts
  - src/host/tests/application-operations-local.test.ts
  - src/host/tests/lifecycle.test.ts
  - src/persistence/README.md
  - src/persistence/alias-store.ts
  - src/persistence/index.ts
  - src/persistence/local-transaction-journal.ts
  - src/persistence/markdown-intent-store.ts
  - src/persistence/tests/alias-store.test.ts
  - src/persistence/tests/local-transaction-journal.test.ts
  - src/standard-model/invariants.ts
  - src/standard-model/tests/invariants.test.ts
priority: high
type: feature
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Preserve stable architectural references when components merge or observation keys migrate by making supersession a durable, deterministic part of canonical identity resolution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A canonical alias can supersede an obsolete component ID with a surviving component ID without changing the survivor identity
- [x] #2 Reads, relationships, and later bindings resolve valid alias chains deterministically after process restart
- [x] #3 Alias cycles, missing targets, self-aliases, and ambiguous supersession fail closed without canonical changes
- [x] #4 Alias records are human-readable, deterministically serialized, and remain separate from component intent documents
- [x] #5 Moving or renaming a component does not create an alias, while an explicit merge preserves old references through one
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the existing bounded Core alias resolver and thread the configured alias ceiling through every Standard Model final validation pass, with a regression above Core’s default alias ceiling.
2. Give application snapshot and transaction outcome resource validation one explicit auxiliary slot so a two-component merge can confirm aliases.md, obsolete, and survivor resources without weakening component-state bounds.
3. Canonicalize relationship sources and targets at the persistence materialization boundary after applying aliases, ensure source-keyed touched ownership uses the surviving component, and prove upsert plus removal through an obsolete source land only in the survivor document.
4. Run focused invariant/application/persistence suites, inspect all source-keyed removal/upsert paths, obtain independent re-review, then rerun full and target gates.
5. Update exact Backlog evidence, amend and push PR #27, leaving final Codex review and merge to the root agent.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Context Hunter classification: L2. Alias continuity crosses Core identity resolution, canonical persistence, transaction atomicity, application reads/mutations, relationship semantics, restart composition, and the CLI. Implementation will reuse the existing transaction journal and shared application surface; no second semantic write path.

Final design decision: the official alias plane is deterministic Markdown at groma/aliases.md with bounded YAML frontmatter, preserving the manifesto source-of-truth rule. Independent review findings were corrected for combined alias bounds, resolver input isolation, alias-reserved identity retries, codec descriptor/byte isolation, authoritative Host store loading, and linear chain validation. Independent re-review found no remaining actionable issues.

Validation passed: bun run check (604 tests, 4,242 assertions, formatting, typecheck, boundaries, binary smoke, Iteration 1A crash recovery); bun run check:targets (4 standalone targets); independent focused review (75 tests, 661 assertions); git diff --check.

Claude review feedback was evaluated independently. Applied write-time canonicalization for newly/touched documents, one-resolution-per-snapshot child filtering, and an explicit alias-target removal diagnostic. Retained self-relationships because the Standard Model permits them and automatic deletion would introduce an unapproved data-loss policy; retained resolution chains because ARCHITECTURE defines them as an Alias Store output.

Post-Claude validation passed: bun run check (604 tests, 4,245 assertions, formatting, typecheck, boundaries, binary smoke, Iteration 1A crash recovery) and bun run check:targets (4 standalone targets).

Reopened after exact-head Codex review found three actionable boundary issues: configured alias bound propagation, auxiliary snapshot resource capacity, and alias-source relationship materialization. Corrections remain on PR #27.

Exact-head corrections implemented: final Standard validation reuses a resolver built with configured maxComponents; application resource envelopes permit one bounded canonical alias resource while snapshots remain exact to the requested set; persistence canonicalizes post-mutation relationship endpoints and maps touched source ownership to the surviving document. Focused verification passed: 160 tests, 1,236 assertions. Full verification passed: bun run check (607 tests, 4,255 assertions, formatting, typecheck, architecture boundaries, binary smoke, Iteration 1A crash recovery); bun run check:targets (4 standalone targets); backlog doctor; git diff --check.

Final exact-head correction validation passed: focused invariant/application/persistence suites (162 tests, 1,247 assertions); persistence suite (60 tests, 393 assertions); bun run check (609 tests, 4,266 assertions, formatting, typecheck, architecture boundaries, binary smoke, Iteration 1A crash recovery); bun run check:targets (4 standalone targets); backlog doctor; git diff --check. Independent re-review found and verified fixes for the Standard/Core upper-bound contract, configured store-load alias capacity, untouched outgoing relationship ownership migration, affected-event integrity, explicit relationship write/removal ownership, and zero-document store compatibility; final re-review reported no remaining actionable findings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented durable component supersession through explicit merge, deterministic groma/aliases.md records, atomic journal publication, shared alias-aware reads, restart-safe relationship/parent continuity, and CLI support. Exact-head corrections now preserve configured bounds above the Core default, allow one bounded alias resource during two-component merge confirmation, canonicalize old-ID relationship writes into the live owner, re-home untouched outgoing relationships without data loss, and reject under-reported effects before publication. Verified with 609 automated tests and 4,266 assertions, all four executable targets, restart/crash workflows, Backlog doctor, and an independent no-findings re-review.
<!-- SECTION:FINAL_SUMMARY:END -->
