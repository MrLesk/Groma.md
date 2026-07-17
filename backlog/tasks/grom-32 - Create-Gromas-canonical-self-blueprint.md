---
id: GROM-32
title: Create Groma's canonical self-blueprint
status: In Progress
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-17 13:48'
labels: []
milestone: m-2
dependencies:
  - GROM-22
  - GROM-26
  - GROM-30
  - GROM-51
references:
  - MANIFESTO.md
  - ARCHITECTURE.md
modified_files:
  - ARCHITECTURE.md
  - DEVELOPMENT.md
  - docs/component-model-examples.md
  - package.json
  - groma/groma.yaml
  - groma/transaction-state.json
  - groma/intent/
  - tests/iteration-1b/verify-self-blueprint.ts
priority: high
type: task
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the handmade architecture overview as the detailed source of truth by representing the complete documented Groma architecture in a canonical Groma workspace through supported public operations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The repository contains a canonical Groma workspace with the nine documented root components and one recursively nested component for every architecture card
- [x] #2 Every component preserves its documented type, parent, intent, inputs, outputs, actions, relationships, and seed key migration metadata
- [x] #3 All canonical content is created through supported Groma operations rather than hand-edited canonical Markdown or private APIs
- [x] #4 A coverage audit finds no component card or declared architectural relationship missing from the self-blueprint
- [x] #5 The self-blueprint reloads deterministically and supports bounded detailed export through the public CLI
- [x] #6 ARCHITECTURE.md becomes the navigational entry point and documents the explicit process for resolving disagreements without remaining a second detailed source of truth
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve the verified 43-component and 87-declaration migration baseline while protecting opaque identities, exact declaration text, and the Plugin Package Manager delivery decision.
2. Use only the freshly compiled public CLI with current revisions for the bounded canonical remediation; compare normalized old and new public exports.
3. Keep generic structural integrity separate from normal-mode frozen counts, declaration statuses, and digests; retain a report-only disposable public-CLI count-change regression.
4. Preserve compact navigator context and explicitly noncanonical teaching examples, including the complete Ordering semantics and development source-of-truth pointers.
5. Harden the verifier's export and root pagination loops with runtime page shape, limit, generation, progress, cursor, and cycle checks; compare generations across root reads and projection rebuilds.
6. Document the canonical self-blueprint verifier as the final bun run check gate, matching package.json.
7. Verify formatting, typing, normal and both report argument orders, the complete repository check, all standalone targets, canonical byte stability, and diff hygiene with dist-mutating commands run serially.
8. Record all review-loop evidence through the Backlog CLI and leave the task In Progress for controller review and finalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started from merged GROM-31 mainline 6ddcf0d. Formal dependencies GROM-22, GROM-26, GROM-30, and GROM-51 are Done. Preliminary inventory found 9 roots, 34 cards, 43 canonical components, 129 inputs, 111 outputs, 158 actions, and 87 semicolon-delimited relationship declarations. No production capability gap is apparent; relationship endpoint resolution is the material fail-closed migration risk and must be settled in an explicit audit ledger before canonical mutation.

The exhaustive relationship audit classified all 87 declarations: 53 have exact evidenced endpoints and expand to 85 owner-to-target relates-to edges; 17 are architectural constraints rather than edges; 17 name absent/open/ambiguous endpoints. Existing product direction requires ambiguity and missing coverage to remain visible, while the Manifesto forbids guessed identity. The migration therefore preserves every declaration in structured namespaced metadata and materializes only exact edges. This satisfies coverage without inventing scan-journal, YAML, Groma Check, plan-storage, Backlog, generic capability, or collective proxy components. Identities will not derive from names, paths, or seed keys: one random migration namespace plus ordinal supplies opaque literal IDs, while seed keys remain migration metadata only.

Compiled public-CLI preflight and repository application both passed with the identical frozen migration: 43 components (9 roots and 34 cards), 129 inputs, 111 outputs, 158 actions, all 87 declaration records classified 53 edge / 17 constraint / 17 ambiguous, and 85 exact relates-to edges. A fresh limit-7 export matched the ledger before repository mutation. Added a durable compiled-CLI verifier that copies canonical bytes, pages the complete export, checks exact frozen digests and declaration-to-edge bijection, deletes and rebuilds disposable projection state, and proves canonical bytes remain unchanged. ARCHITECTURE.md is now a concise navigator; temporary relationship/source ledgers and migration entropy were removed.

Verification is green: bun run check passed 796 tests with 5,679 expectations plus the compiled Iteration 1A workflow and self-blueprint audit; bun run check:targets verified all four standalone targets. Two independent reviews approved the component migration, relationship classification and bijection, navigator, and hermetic verifier with no actionable findings.

Parent exact-tree verification repeated after handoff: bun run verify:self-blueprint passed the hermetic 43-component/87-declaration/85-edge public export and cache-rebuild proof; bun run check passed formatting, type checking, boundaries, 796 tests with 5,679 expectations, compiled Iteration 1A recovery, and the self-blueprint audit; bun run check:targets passed macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64. git diff --check remained clean.

Review remediation completed without hand-editing canonical state. The freshly compiled public CLI applied 19 current-revision transactions from generation 75 to 94: 10 CLI-minted exact edges, 8 declaration metadata updates to partial, and 1 Plugin Development root intent. A public export reports 43 nonempty intents, 87 declarations at 53 edge / 8 partial / 9 ambiguous / 17 constraint, and 95 edges. Normalizing only those requested changes makes the complete pre-remediation and post-remediation public exports equal, confirming opaque IDs, exact declaration texts, and all other component meaning stayed unchanged. The Plugin Package Manager action and groma.md/first-delivery qualifier remain exact.
The verifier now enforces both edge-bearing states in the global source/description bijection, all 43 intents, fixed reviewed digests, and a read-only report-baseline mode in either executable-option order while retaining projection rebuild and byte-identical canonical proof. ARCHITECTURE.md restores compact cross-component views and deliberate baseline guidance without a second field ledger; docs/component-model-examples.md preserves the noncanonical Shopify and Ordering examples; DEVELOPMENT.md points detailed architecture and seed metadata to canonical public export.
Verification passed: bun run build; bun run verify:self-blueprint; report-baseline in both executable-option orders; bun run check with 796 tests and 5,679 expectations plus compiled Iteration 1A crash recovery; bun run check:targets for all four targets; exact public-export pair audit; git diff --check; canonical diff and scope review.

Second review loop restored the complete Ordering teaching semantics: lifecycle states, idempotency and cancellation behavior, four guarantees, the reversible Intent boundary explanation, concept-to-representation mapping, and concrete TypeScript partial scanner evidence, while retaining the explicit noncanonical warning. The verifier now separates generic integrity from a frozen expectedBaseline summary. Normal mode compares all counts, declaration statuses, and digests; report mode bypasses every expected-baseline equality while retaining allowed-status checks, component identity and acyclic containment, nonempty intents, edge-ID rules, exact declaration/edge source-description bijection, bounded paging, projection rebuild equality, and canonical byte proof. A report-only regression uses the public CLI against a second disposable copy to add one valid root, proves observed component/root counts increase, rebuilds the projection, and confirms the source canonical snapshot remains byte-identical. ARCHITECTURE.md now tells maintainers to deliberately refresh expected summary counts, statuses, and digests together.

Third quality-review loop hardened both complete public-CLI paging helpers. Every export and root page is now runtime-validated as an object with a nonnegative safe-integer generation, boolean hasMore, an intrinsic item array no larger than the requested limit 7, and a consistent cursor contract. A hasMore page must contain items and return a nonempty string cursor that has not appeared before, so repeated and cyclic cursors fail instead of looping. Both collectors return generation with their items; root reads must match the first export generation, the canonical projection rebuild must match the first export generation, and the report-only post-edit rebuild must match its post-edit export generation. DEVELOPMENT.md now documents the canonical self-blueprint verifier as bun run check's final fail-fast gate, matching package.json. No canonical groma state changed. Exact-tree validation passed formatting and type checking, normal verification, report-baseline in both executable-option orders, bun run check with 796 tests and 5,679 expectations plus the final self-blueprint gate, bun run check:targets for all four targets, canonical scope inspection, and git diff --check. Dist-mutating commands were run serially.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-07-17 12:22
---
All six acceptance criteria are objectively verified on the exact tree; independent component and relationship audits approved with no actionable findings. Ready for one ready-for-review PR.
---

author: @codex
created: 2026-07-17 12:46
---
Reopened after external review identified actionable migration gaps: preserve compact cross-component views and teaching examples, add the sole missing root intent, expose partial relationship resolution without guessing endpoints, document neutral edge direction, add a deliberate golden-baseline report workflow, and repair stale development pointers. Two independent audits bounded the fixes before implementation.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed all three GROM-32 review-remediation loops. The canonical public-CLI-authored 43-component, 87-declaration, 95-edge blueprint is unchanged. The verifier now separates generic integrity from frozen normal-mode expectations, exercises a disposable report-only count change, and fail-closes complete export/root pagination on malformed generations, over-limit or non-progressing pages, cursor contract violations, and repeated/cyclic cursors while proving generation continuity across root reads and projection rebuilds. Restored the complete noncanonical Ordering example and aligned DEVELOPMENT.md with the actual final self-blueprint gate. Verified normal and both report modes, full bun run check with 796 tests and 5,679 expectations, all four standalone targets, byte stability, and clean scope/diff checks. Task remains In Progress pending controller review.
<!-- SECTION:FINAL_SUMMARY:END -->
