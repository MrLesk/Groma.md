---
id: GROM-54
title: Persist the Groma brand and blueprint visual direction
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 21:44'
updated_date: '2026-07-15 00:08'
labels:
  - brand
  - visualization
  - design-system
milestone: m-3
dependencies: []
references:
  - brand/README.md
  - brand/STYLE.md
  - ARCHITECTURE.md
  - AGENTS.md
modified_files:
  - AGENTS.md
  - ARCHITECTURE.md
  - backlog/tasks/grom-52 - Render-a-bounded-local-visual-blueprint.md
  - >-
    backlog/tasks/grom-54 -
    Persist-the-Groma-brand-and-blueprint-visual-direction.md
  - brand/README.md
  - brand/STYLE.md
  - brand/lockup.svg
  - brand/lockup-dark.svg
  - brand/mark-frontal.svg
  - brand/mark-frontal-dark.svg
  - brand/mark-sightline.svg
  - brand/mark-sightline-dark.svg
  - brand/mark-topdown.svg
  - brand/mark-topdown-dark.svg
  - brand/references/blueprint-ui-direction.png
priority: high
type: docs
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the approved Groma identity and blueprint UI direction durable inside the repository so future agents and renderer work use the same official assets, color rules, technical-drawing mood, and selected white-first product surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The repository contains the complete official Groma light and dark SVG asset set and its canonical brand README without changing the source asset bytes
- [x] #2 A durable visual-direction guide records the selected white architectural-sheet surface, graphite structure, exact #1D9E75 accent, technical-sheet content density, recursive containment, and restrained neutral shadows
- [x] #3 The guide makes prohibited directions explicit, including blue as the product accent, title-case Groma, theme switching in the first renderer, dashboard chrome, cartoon styling, and shadows or gradients on brand marks
- [x] #4 AGENTS.md and ARCHITECTURE.md direct future visual work to the brand guide and align the first renderer with the approved single-theme direction
- [x] #5 The selected combined blueprint mockup is stored as a clearly labeled non-normative visual reference and linked from the guide
- [x] #6 Brand SVGs, Markdown formatting, internal references, and the final asset manifest are validated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify the clean GROM-50 base and the canonical brand/reference sources.
2. Import the nine canonical brand files byte-for-byte, add the selected reference PNG, and author the durable product style guide.
3. Add brand guardrails to AGENTS.md and ARCHITECTURE.md while preserving bounded shared reads, disposable renderer state, and offline iconDomain behavior.
4. Update GROM-52 through Backlog with the GROM-54 dependency, brand references, brand-aware description, and one additive brand acceptance criterion while preserving its existing criteria and ownership.
5. Validate asset identity, SVG/XML and PNG integrity, local links, brand assertions, formatting, Backlog metadata/dependencies, the exact 15-file manifest, and the full repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reopened on the clean merged GROM-50 base at 02f5078 for an isolated, evidence-backed reconstruction.

Imported all nine official brand source files with byte-for-byte cmp and SHA-256 verification; all eight SVGs passed xmllint. The selected reference PNG matched source hash b390df9d59f671510903c0f74b82f88501bcdab2fd8fd97ffcf1aeb2f772374f and validated as 1487 x 1058 RGB PNG. The authored STYLE.md matched its approved source. Validated 12 local Markdown links, 14 brand/style assertions, authored Markdown with Prettier, git diff --check, and the exact 15-file manifest. Verified GROM-52 preserved all seven merged acceptance criteria and task ownership, added one brand criterion, and depends on GROM-54 without introducing a cycle; backlog doctor found no duplicate IDs. Full bun run check passed formatting, typecheck, architecture boundaries, 458 tests, build, binary smoke, and Iteration 1A verification.

Final self-review kept the Visual Blueprint Renderer runtime Inputs block byte-identical to merged GROM-50 and verified the bounded Shared Application Operations read, deterministic offline iconDomain fallback, no-network rule, and future icon-resolution boundary remain explicit. Brand assets and mood remain implementation/action constraints, not application data.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Persisted the official Groma brand assets and single white architectural-sheet direction, aligned agent and architecture guidance, and made the bounded local renderer depend on the approved brand constraints without changing its finalized data, identity, or offline icon behavior. Verified exact assets, reference integrity, links, formatting, Backlog metadata and graph, the exact 15-file scope, and the complete repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
