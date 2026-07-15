---
id: GROM-54
title: Persist the Groma brand and blueprint visual direction
status: Done
assignee:
  - '@codex'
created_date: '2026-07-14 21:44'
updated_date: '2026-07-15 00:39'
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
- [x] #7 The local guide restricts #1D9E75 to contrast-appropriate uses with adequate weight and non-color support and labels sub-64-pixel auxiliary motif use as an approved local product-surface override of the canonical identity rule
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Preserve every canonical README/SVG byte while verifying the reported #1D9E75-on-white contrast and the current small-motif wording.
2. Add explicit contrast-safe green usage, adequate weight/non-color requirements, and honest approved-local-override language to brand/STYLE.md.
3. Keep automated formatting scope within the agreed 15-file task boundary, record why selective authored-file Prettier validation is sufficient here, and document the amber and upstream-source judgments without creating follow-up tasks.
4. Revalidate accessibility and override assertions, canonical bytes, SVG/XML, PNG, links, GROM-52 ownership, formatting, Backlog health/dependencies, and the exact cumulative manifest; run full bun run check.
5. Self-review, record evidence, check the affected and new acceptance criteria, finalize, and commit without pushing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reopened on the clean merged GROM-50 base at 02f5078 for an isolated, evidence-backed reconstruction.

Imported all nine official brand source files with byte-for-byte cmp and SHA-256 verification; all eight SVGs passed xmllint. The selected reference PNG matched source hash b390df9d59f671510903c0f74b82f88501bcdab2fd8fd97ffcf1aeb2f772374f and validated as 1487 x 1058 RGB PNG. The authored STYLE.md matched its approved source. Validated 12 local Markdown links, 14 brand/style assertions, authored Markdown with Prettier, git diff --check, and the exact 15-file manifest. Verified GROM-52 preserved all seven merged acceptance criteria and task ownership, added one brand criterion, and depends on GROM-54 without introducing a cycle; backlog doctor found no duplicate IDs. Full bun run check passed formatting, typecheck, architecture boundaries, 458 tests, build, binary smoke, and Iteration 1A verification.

Final self-review kept the Visual Blueprint Renderer runtime Inputs block byte-identical to merged GROM-50 and verified the bounded Shared Application Operations read, deterministic offline iconDomain fallback, no-network rule, and future icon-resolution boundary remain explicit. Brand assets and mood remain implementation/action constraints, not application data.

Reopened after quality review identified ambiguity between canonical identity shorthand and shipped lockup geometry, plus unclear small-motif, unavailable-hero, dark-variant, and GROM-52 ownership guidance.

Quality-review corrections added an explicit local identity interpretation without modifying canonical inputs: the shipped lockup `.md` accent is documented as the wordmark exception; the <=64 px rule is scoped to product identity while auxiliary motifs require a target-size legibility preview; the illustrated hero is explicitly unavailable; and committed dark variants are identified as upstream outputs with no local generator. GROM-52 AC8 now contains presentation requirements only, while AC3 and AC6 retain exclusive icon/fetch/network ownership. Revalidation passed nine canonical byte comparisons, eight SVG XML checks, unchanged 1487 x 1058 PNG hash, 13 local links, 14 baseline brand assertions, four package-interpretation assertions, the nonduplicative AC ownership assertion, authored-file Prettier, git diff --check, exact 15-file overall scope and modified_files match, backlog doctor, an acyclic dependency graph, and full bun run check with 458 tests plus build, smoke, and Iteration 1A verification.

Reopened for Claude-approved review follow-ups: green contrast-safe usage, honest local-override labeling for sub-64 px auxiliary motifs, selective formatting durability, and restrained assessment of semantic amber and upstream-only canonical asset concerns.

Claude review follow-ups are resolved locally. An independent luminance calculation measured #1D9E75 on white at 3.3872:1; STYLE now permits it only for non-text lines/marks/control states, the shipped logotype, and verified large text, forbids normal-size body text on white or warm white, and requires adequate rendered weight plus non-color notation. The sub-64 px auxiliary-motif allowance is now labeled an approved narrow local product-surface override of the canonical “everything” rule, while frontal remains mandatory for identity uses. Amber remains unpinned as a brand color: STYLE requires the renderer to choose one fixed accessible implementation token and use it deterministically after testing. Automated formatting scope was not expanded because changing package.json would exceed the agreed 15-file task boundary and adding brand/ wholesale could rewrite byte-exact canonical imports; explicit Prettier checks cover AGENTS.md, ARCHITECTURE.md, brand/STYLE.md, GROM-52, and GROM-54, while canonical files are protected by byte comparisons. Hardcoded lockup text positioning, canonical-rule contradictions, and the absent dark-variant generator remain upstream brand-source concerns and were intentionally not changed or split into new tasks. Revalidation passed exact canonical bytes, eight SVG XML checks, unchanged PNG, 13 links, contrast/usage/override assertions, GROM-52 ownership, selective Prettier, git diff --check, unchanged package scope, exact 15-file modified_files, backlog doctor/dependency graph, and full bun run check with 458 tests plus build, smoke, and Iteration 1A verification.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Persisted the exact official brand package and white architectural-sheet direction; clarified contrast-safe #1D9E75 usage, redundant visual cues, the approved local auxiliary-motif override, shipped asset limitations, and deterministic semantic-color ownership; and kept GROM-52 presentation requirements separate from icon/network behavior. Verified canonical bytes, links, formatting, Backlog metadata and dependencies, the exact 15-file scope, and the complete repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
