---
id: GROM-103
title: Make the blueprint a continuous scale-normalized canvas
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 20:33'
updated_date: '2026-07-21 21:05'
labels:
  - frontend
  - ux
  - visual-blueprint
  - scale
dependencies: []
references:
  - MANIFESTO.md
  - brand/STYLE.md
  - docs/interface-glossary.md
modified_files:
  - scripts/verify-binary.ts
  - src/application/observed-structure.ts
  - src/application/operations.ts
  - src/application/reconciliation.ts
  - src/cli/tests/export.test.ts
  - src/host/tests/reconciliation-local.test.ts
  - src/web/client/app.tsx
  - src/web/client/canvas.tsx
  - src/web/client/graph.ts
  - src/web/client/model.ts
  - src/web/client/root-discovery.ts
  - src/web/client/styles.css
  - src/web/tests/model.test.ts
  - tests/iteration-1a/verify.ts
  - tests/organization-scale/verify.ts
priority: high
type: enhancement
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the large-repository visual experience exposed by the OpenClaw stress test. The current overview flattens 85 components into the domain layer, renders an arbitrary first page, and replaces the canvas when focus changes. The result should be one continuous architectural sheet: each focus level presents roughly 16–20 meaningful parts, lower-scale or uncurated scanner candidates remain folded or visibly evidence-only, and focusing spatially zooms into the existing containment boundary while nearby context remains visible. Bounded application reads remain internal and canonical scale is never guessed or rewritten by the renderer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At a supported desktop viewport, the OpenClaw overview shows its meaningful top 16–20 architectural parts, or all parts when fewer exist, without a page, cursor, load-more, or read-more-roots control
- [x] #2 Unscaled or lower-level scanner candidates are not presented as domain-scale siblings; the disposable projection folds or distinguishes them without assigning or rewriting canonical scale
- [x] #3 Focusing a component zooms into that same containment boundary and reveals its nested contents while nearby sibling context remains visible in the surrounding canvas
- [x] #4 Returning to the parent reverses the same spatial transition, and prefers-reduced-motion users receive the equivalent state change without animated movement
- [x] #5 Live web and exported blueprint views retain one shared semantic read path, bounded deterministic output, and no canonical layout or focus state
- [x] #6 A representative OpenClaw-scale fixture and rendered interaction verify the overview and focus behavior without introducing user-visible pagination
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Stop observed containment from writing canonical scale while preserving structural parent/shared evidence and removing legacy evidence-owned scale on rescan. 2. Load bounded pages internally and rank a deterministic 20-part visual level, rendering uncurated scanner components as unscaled candidates. 3. Keep one recursive React Flow graph mounted so stable component ids expand into nested containment groups, then frame the target with nearby siblings and reverse the same motion on return. 4. Verify with an 85-candidate fixture, a disposable OpenClaw rescan, rendered overview/focus/back/reduced-motion interaction, and the full project check before local review and PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
OpenClaw evidence reads now identify all 85 root children as evidence-bound. A disposable OpenClaw worktree rescan completed in 2.8s and reduced the first 100 canonical components from 75 scanner-owned scales to zero while preserving evidence bindings; the root scale was also cleared. At 1440x900, browser verification rendered 20/20 fully visible ranked candidates with no page/load-more/read-more control. Focusing @openclaw/voice-call retained its stable id, changed the same node into a nested group with five children, kept nearby siblings visible, and returning restored the same id as a card with 20/20 visible. Reduced-motion emulation produced the same focused state with only the 120ms opacity transition and no spatial transition. Full bun run check passed: formatting, type checks, boundaries, 508 tests, compiled binary smoke, and Iteration 1A verification.

Pre-PR review resolution: both Terra xhigh passes identified the multi-root focus gap; focused roots now expand recursively while sibling roots remain and a regression test covers it. The second pass also prompted code-unit ranking, deferred child reads for multi-root blueprints, and canonical scale notation for evidence-supported curated scales. Claude prompted an explicit 'visible / total at this level' disclosure without pagination, scale-neutral 'inside' copy, a continuous-zoom renderer name, derivation of focus id, and comments around the nearby-context camera. Final bun run check passed with 511 tests after these fixes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the page-shaped eight-card renderer with a deterministic 20-part continuous canvas. Scanner containment no longer writes canonical scale, legacy evidence-owned scale is cleared on rescan without touching curated scale, and evidence support remains complete for large snapshots. Focus now expands the same stable node recursively with nearby context and reversible/reduced motion. Verified on an 85-child OpenClaw state, a disposable full rescan, focused model fixtures including multi-root behavior, rendered overview/focus/back/reduced-motion interaction, and the full 511-test compiled-binary check.
<!-- SECTION:FINAL_SUMMARY:END -->
