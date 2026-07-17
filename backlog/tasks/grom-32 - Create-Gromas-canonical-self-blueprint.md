---
id: GROM-32
title: Create Groma's canonical self-blueprint
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 19:57'
updated_date: '2026-07-17 12:22'
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
1. Freeze the merged detailed architecture as a migration ledger for all 9 roots, 34 cards, documented fields, and all 87 semicolon-delimited relationship declarations; assign one-time opaque supplied identities derived only from random migration entropy plus ordinal, and preserve each component seed key under groma.md/seed-key.
2. Preserve every relationship declaration as structured groma.md/relationship-declarations metadata with its exact text, stable declaration key, and edge, constraint, or ambiguous status. Materialize only the 53 endpoint-defensible declarations as 85 neutral relates-to edges; reference their edge IDs from the declaration metadata, and create no guessed or synthetic endpoints.
3. Preflight the complete ledger in a temporary workspace using only the compiled public CLI, creating parents before children and adding relationships only after all endpoints exist; audit the bounded export before touching the repository workspace.
4. Apply the validated public CLI sequence to this repository so canonical Markdown is generated only by supported Groma operations, then independently audit the committed groma/ tree against the frozen ledger.
5. Add a durable self-blueprint regression that copies the canonical workspace, exercises fresh-process paged export/reload/cache rebuild, verifies exact component/root/field/declaration/edge coverage, and proves read-only use leaves canonical bytes unchanged.
6. Replace ARCHITECTURE.md with a concise navigator and explicit disagreement-resolution process, run focused/full/cross-target verification, obtain independent review, and finalize the Backlog evidence before one ready PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started from merged GROM-31 mainline 6ddcf0d. Formal dependencies GROM-22, GROM-26, GROM-30, and GROM-51 are Done. Preliminary inventory found 9 roots, 34 cards, 43 canonical components, 129 inputs, 111 outputs, 158 actions, and 87 semicolon-delimited relationship declarations. No production capability gap is apparent; relationship endpoint resolution is the material fail-closed migration risk and must be settled in an explicit audit ledger before canonical mutation.

The exhaustive relationship audit classified all 87 declarations: 53 have exact evidenced endpoints and expand to 85 owner-to-target relates-to edges; 17 are architectural constraints rather than edges; 17 name absent/open/ambiguous endpoints. Existing product direction requires ambiguity and missing coverage to remain visible, while the Manifesto forbids guessed identity. The migration therefore preserves every declaration in structured namespaced metadata and materializes only exact edges. This satisfies coverage without inventing scan-journal, YAML, Groma Check, plan-storage, Backlog, generic capability, or collective proxy components. Identities will not derive from names, paths, or seed keys: one random migration namespace plus ordinal supplies opaque literal IDs, while seed keys remain migration metadata only.

Compiled public-CLI preflight and repository application both passed with the identical frozen migration: 43 components (9 roots and 34 cards), 129 inputs, 111 outputs, 158 actions, all 87 declaration records classified 53 edge / 17 constraint / 17 ambiguous, and 85 exact relates-to edges. A fresh limit-7 export matched the ledger before repository mutation. Added a durable compiled-CLI verifier that copies canonical bytes, pages the complete export, checks exact frozen digests and declaration-to-edge bijection, deletes and rebuilds disposable projection state, and proves canonical bytes remain unchanged. ARCHITECTURE.md is now a concise navigator; temporary relationship/source ledgers and migration entropy were removed.

Verification is green: bun run check passed 796 tests with 5,679 expectations plus the compiled Iteration 1A workflow and self-blueprint audit; bun run check:targets verified all four standalone targets. Two independent reviews approved the component migration, relationship classification and bijection, navigator, and hermetic verifier with no actionable findings.

Parent exact-tree verification repeated after handoff: bun run verify:self-blueprint passed the hermetic 43-component/87-declaration/85-edge public export and cache-rebuild proof; bun run check passed formatting, type checking, boundaries, 796 tests with 5,679 expectations, compiled Iteration 1A recovery, and the self-blueprint audit; bun run check:targets passed macOS arm64, Linux x64 baseline, Windows x64 baseline, and Windows arm64. git diff --check remained clean.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-07-17 12:22
---
All six acceptance criteria are objectively verified on the exact tree; independent component and relationship audits approved with no actionable findings. Ready for one ready-for-review PR.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created Groma’s canonical self-blueprint through a preflighted compiled-public-CLI migration: 9 roots, 34 architecture cards, 398 embedded items, all 87 source declarations preserved with explicit edge/constraint/ambiguous resolution, and 85 defensible ordinary edges without guessed endpoints. Replaced the handmade detailed architecture document with a concise navigator and disagreement procedure. Added a hermetic fresh-process verifier that checks frozen semantic coverage, paged export, declaration-to-edge bijection, disposable projection rebuild, and byte-identical canonical state. Verified by 796 tests and 5,679 expectations, compiled Iteration 1A and self-blueprint workflows, all four target builds, and two independent source-to-canonical audits.
<!-- SECTION:FINAL_SUMMARY:END -->
