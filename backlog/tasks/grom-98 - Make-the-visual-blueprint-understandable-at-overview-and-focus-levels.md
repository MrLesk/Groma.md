---
id: GROM-98
title: Make the visual blueprint understandable at overview and focus levels
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 18:27'
updated_date: '2026-07-21 20:15'
labels:
  - frontend
  - ux
  - visual-blueprint
dependencies: []
references:
  - MANIFESTO.md
  - brand/README.md
  - brand/STYLE.md
  - docs/interface-glossary.md
modified_files:
  - src/application/contracts.ts
  - src/application/operations.ts
  - src/host/tests/application-operations-local.test.ts
  - src/web/client/api.ts
  - src/web/client/app.tsx
  - src/web/client/canvas.tsx
  - src/web/client/graph.ts
  - src/web/client/model.ts
  - src/web/client/spec.tsx
  - src/web/client/styles.css
  - src/web/tests/model.test.ts
  - src/web/tests/snapshot-api.test.ts
priority: high
type: enhancement
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Redesign the first human experience from the system overview into a focused domain so Groma produces a bounded architectural map that can be understood at normal viewing scale. Preserve the approved architectural-sheet brand direction, but correct the current hierarchy: explanatory chrome dominates the viewport, auto-fit makes components and relationships illegible, focused domains expose raw file/import topology, and search/detail surfaces foreground opaque implementation identifiers. Keep the work to one coherent vertical slice and avoid introducing a new design system, renderer, semantic model, or generalized framework.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At the supported desktop viewport, the initial overview makes component names, responsibilities, containment, and the primary relationships readable without zooming or consulting an explanatory legend
- [x] #2 The overview and each focused level enforce a bounded legibility budget; additional components remain reachable through explicit focus or search instead of being auto-fitted below readable size
- [x] #3 The blueprint remains the dominant surface, while title, scan metadata, notation, and help stay compact or available on demand without obscuring the map
- [x] #4 Focused architectural levels do not present raw source files and import topology as if they were curated architecture; scanner-only candidates or implementation evidence remain visibly distinct from canonical intent
- [x] #5 Relationships between visible components are traceable and directionally clear, and selecting a component emphasizes its relevant paths without relying on color alone
- [x] #6 Search and inspection lead with architectural context, purpose, containment, and relationships; stable opaque identities and low-level evidence remain available without dominating the default experience
- [x] #7 The interface keeps the canonical lowercase groma.md identity, exact #1D9E75 accent, white technical-sheet direction, and the existing shared semantic operations for live and exported views
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Simplify the existing web graph into one bounded level projection that keeps intent-bearing architecture readable at the supported desktop viewport and makes overflow or implementation-only detail reachable through explicit focus/search instead of shrinking the sheet.
2. Recompose the existing React Flow canvas so the blueprint dominates: compact metadata/help, readable fixed node scale, restrained architectural-sheet notation, and traceable directional primary relationships with selected-path emphasis.
3. Reorder search and inspection around name, purpose, containment, and relationships; keep stable IDs and scanner evidence available in secondary technical disclosure, and visibly distinguish evidence-only implementation candidates from curated intent.
4. Preserve the same shared application operations for live and exported views, extending only the existing bounded view data if an explicit intent/evidence cue is required.
5. Add focused projection/interaction coverage and verify one desktop overview→focus→inspect/search flow in the rendered app, plus proportional type/format checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a fixed desktop legibility budget: 8 architectural components, 8 primary relationships, 5 implementation-evidence rows, and one bounded 12-child read per focus. Current evidence support is projected as a boolean on existing ComponentView/export reads; meaning-empty evidence-bound fine-grained components move to a dashed implementation register instead of the architecture graph. Search and inspection now lead with purpose, containment, and relationships; technical identity/evidence is collapsed. Objective QA at 1440x900: overview rendered all 8 Groma domains at transform scale 1 with a 300x48.5 compact title block; selection produced 4 emphasized edges, 4 endpoint nodes, and 3 dimmed unrelated nodes; application focus rendered 0 file nodes plus 5 explicitly labeled evidence rows and +6 continuation; operations search exposed no stable ID until technical details. In-app Browser had no available backend, so rendered interaction used local Playwright fallback. Verification: format check, both TypeScript configs, 47 focused web/application/host tests, and console-error-free rendered flow.

Pre-PR review resolution: both Terra passes found that unloaded search results lost evidence and containment context. Search now carries the existing bounded evidence cue in both live and exported views, uses one conservative implementation-evidence predicate, preserves unknown-parent context, and adds visible observed cues. Claude judged the net-simplifying redesign ship-worthy; its broader readout/layout questions were outside this task's approved bounded-sheet direction. Review-fix verification: typecheck, 20 focused application/web tests with 183 assertions, format check, and diff check pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the first visual blueprint a bounded, readable architectural sheet with purpose-first cards, compact help, directional path emphasis, honest implementation-evidence focus, and context-first search/inspection. Verified the 1440x900 overview→select→focus→search/inspect flow, format and type checks, the original 47 focused tests, and 20 review-fix tests with 183 assertions.
<!-- SECTION:FINAL_SUMMARY:END -->
