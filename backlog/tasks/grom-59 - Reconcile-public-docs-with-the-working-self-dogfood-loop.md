---
id: GROM-59
title: Reconcile public docs with the working self-dogfood loop
status: Done
assignee:
  - '@codex'
created_date: '2026-07-19 18:12'
updated_date: '2026-07-19 18:35'
labels:
  - documentation
  - self-dogfood
dependencies: []
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
  - DEVELOPMENT.md
  - docs/interface-glossary.md
modified_files:
  - MANIFESTO.md
  - DEVELOPMENT.md
  - docs/interface-glossary.md
priority: high
type: docs
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Incorporate Alex's plain-language documentation rewrite into current main, retire the superseded GROMA.md narrative, and reconcile every edited guide with the implemented init -> scan -> visual loop. Preserve the manifesto's product invariants and the bounded accelerated review policy while removing stale implementation claims and duplicate architectural ledgers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Alex's rewritten MANIFESTO.md, ARCHITECTURE.md, DEVELOPMENT.md, glossary, source guide, benchmark notes, and component examples are preserved in substance on current main rather than overwritten by older prose
- [x] #2 GROMA.md is removed and no live documentation links to or relies on it as a second product truth
- [x] #3 Public documentation accurately states that scan reconciliation and the bounded local visual are implemented, including current commands and supported boundaries
- [x] #4 AGENTS.md and DEVELOPMENT.md retain exactly two Terra xhigh pre-PR reviews, one local Claude review, one awaited first Codex review, and merge-after-green behavior for any review-fix push
- [x] #5 Documentation formatting, links/references, and repository verification pass without unrelated product code changes
- [x] #6 Groma's own documentation evidence is refreshed once and an unchanged repeated self-scan is byte-stable
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve Alex's plain-language rewrite on current main without importing stale implementation breadth. 2. Make MANIFESTO.md a timeless canonical vision by replacing release, implementation-status, and next-step language with enduring product contracts. 3. Keep DEVELOPMENT.md and the glossary accurate about the implemented init -> scan -> interactive visual loop, while leaving implementation status out of the manifesto. 4. Verify formatting, references, the complete repository gate, and repeated byte-stable Groma self-scan. 5. Complete the already-bounded two-Terra-plus-Claude pre-PR review, incorporate justified findings, then open the ready PR and follow the first-online-Codex merge policy.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Supported boundary: documentation and resulting self-scan evidence only; no product contracts or runtime behavior. Alex's main worktree remains untouched and is the source for the rewrite.

Reconciled against current main rather than copying the stale worktree wholesale. Alex's rewritten manifesto, architecture tour, README, source guide, compact benchmark, component examples, and review policy were already preserved in substance on current main; the remaining patch removes stale visual-loop and retired-guide claims. No product code changed.

Verification: `bun run format`; `bun run build`; two consecutive `./dist/groma --format=json scan` runs each completed with 65 records and 2 signals. The complete `groma/` tree digest remained `a1561c518e4c5907148b5769309e0a5cc6e3cffea9fa8b10057585888d75b8fd` before and after both scans. `bun run check` passed with 402 tests and 2642 expectations.

Alex explicitly decided that MANIFESTO.md contains no implementation state (what exists, is missing, or comes next); it is Groma's timeless canonical vision. This authorizes replacing rollout/status language while preserving the manifesto's product and architectural invariants.

Bounded pre-PR review completed with exactly two independent Terra xhigh passes and one local Claude pass. Terra identified and we fixed the interactive-TTY boundary, deferred history wording, and the shipped visual's technical node-count label. Claude identified the manifesto's rollout/status contradiction; Alex then explicitly defined the manifesto as timeless canonical vision, authorizing removal of version, shipped-iteration, future-renderer, interface-freeze, and eventual-canonicalization language.

Final verification after those fixes: Prettier passed; `bun run check` passed with 402 tests and 2642 expectations; two more self-scans completed with 65 records and 2 signals while the complete `groma/` tree digest stayed `a1561c518e4c5907148b5769309e0a5cc6e3cffea9fa8b10057585888d75b8fd` before and after both runs.

Ready PR #47 passed all three CI jobs and the first automatic Codex review completed with 👍 and no findings. PR merged as `936dea91b777b1c2925682a0ff5f8fba05e7e392`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reconciled the public documentation with the working self-dogfood loop and Alex's plain-language rewrite. The manifesto is now timeless canonical vision with release/status/roadmap language removed; implementation guidance accurately bounds the interactive local visual; stale glossary history and node-language claims were corrected; and the retired GROMA.md guide has no live references. Verified with Prettier, `bun run check` (402 tests, 2642 expectations), two repeated 65-record self-scans with an unchanged canonical tree digest, exactly two Terra xhigh reviews, one Claude review, green CI, and the accepted first automatic Codex review on PR #47.
<!-- SECTION:FINAL_SUMMARY:END -->
