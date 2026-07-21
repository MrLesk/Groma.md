---
id: GROM-108
title: Derive observed-area names from evidence
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 22:42'
updated_date: '2026-07-21 23:03'
labels:
  - frontend
  - ux
  - scanner
  - visual-blueprint
dependencies: []
references:
  - MANIFESTO.md
  - brand/STYLE.md
  - docs/interface-glossary.md
modified_files:
  - src/application/observed-area-recognition.ts
  - src/application/tests/observed-area-recognition.test.ts
  - src/web/client/graph.ts
  - src/web/tests/model.test.ts
priority: high
type: bug
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Observed visual areas currently expose raw filesystem segments such as src as their primary names. Derive deterministic recognition labels from bounded scanner evidence so unfamiliar projects produce understandable first-run blueprints without inventing canonical architectural intent. Raw paths remain visible as evidence, ambiguous cases remain generic, and canonical component identity, names, parents, type, and intent are unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A conventional source-root area is presented with a human-readable evidence-derived label instead of the raw src token
- [x] #2 Declared or already-recognizable observed names are normalized without replacing them with guessed architectural intent
- [x] #3 Ambiguous or unknown path evidence falls back to an honest humanized observed-area label and retains the raw evidence path
- [x] #4 The naming derivation is deterministic, technology-neutral at the projection boundary, and does not mutate canonical component state
- [x] #5 Focused tests cover source roots, recognizable area names, acronym handling, and unknown paths
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a pure application-level observed-area recognition resolver that deterministically converts bounded path evidence into a readable label, preserves the raw evidence path, recognizes conventional source roles and common acronyms, and falls back to a humanized observed-area label. 2. Use that resolver when the disposable web projection creates observed groups and mapping-gap summaries, without changing projection IDs or canonical components. 3. Add focused resolver and OpenClaw projection tests, then run formatting, targeted tests, type checks, architecture-boundary checks, a production build, and live OpenClaw browser QA.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a pure application-level recognition resolver over bounded path evidence. Conventional roles and common acronyms receive readable labels; unknown segments are humanized with an explicit area fallback; every result retains its raw evidence path. The web projection uses the resolver only for disposable nodes and leaves projection IDs and canonical component state unchanged. Validation: 522 repository tests passed; focused naming and graph tests passed; web TypeScript, architecture boundaries, formatting, diff checks, and production build passed. Live Browser QA against OpenClaw at 1280x720 verified Extensions, Packages, Source modules, and User interface with raw paths, successful Source modules expansion, and zero console warnings/errors. Full repository typecheck remains blocked by concurrent GROM-107 work: tests/organization-scale/verify.ts still passes the removed focusPath option.

Pre-PR integration verification now passes the complete bun run check after the merged GROM-107 fixture was migrated to expandedIds.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Derived readable observed-area names from deterministic path evidence while preserving raw paths and canonical meaning. Verified with 522 tests, web typechecking, architecture and formatting checks, a production build, and live OpenClaw browser interaction.
<!-- SECTION:FINAL_SUMMARY:END -->
