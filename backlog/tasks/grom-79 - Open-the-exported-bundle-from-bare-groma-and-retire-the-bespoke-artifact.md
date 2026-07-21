---
id: GROM-79
title: Open the exported bundle from bare groma and retire the bespoke artifact
status: Done
assignee:
  - '@codex'
created_date: '2026-07-20 17:45'
updated_date: '2026-07-21 18:07'
labels:
  - pivot
  - cli
  - renderer
milestone: m-5
dependencies:
  - GROM-78
modified_files:
  - ARCHITECTURE.md
  - DEVELOPMENT.md
  - README.md
  - groma/components/groma/cli/blueprint-html.ts.md
  - groma/components/groma/cli/program.ts.md
  - groma/transaction-state.json
  - src/cli/blueprint-html.ts
  - src/cli/program.ts
  - src/cli/surface.ts
  - src/cli/tests/blueprint-html.test.ts
  - src/cli/tests/export.test.ts
  - src/cli/tests/scan.test.ts
  - tests/iteration-1a/verify.ts
priority: medium
type: chore
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bare groma in an interactive terminal opens the exported bundle instead of the bespoke blueprint-html.ts artifact, ending the era of two hand-maintained renderers. The artifact renderer and its duplicated canvas, gesture, and branding code retire; its tests migrate to the bundle path. The manifesto surface promise holds: the local artifact stays non-mutating, network-free, and semantically equivalent to the terminal and web views. The Iteration 1A black-box pins exact CLI behavior and will need updating.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bare groma in an interactive terminal opens the exported bundle built from bounded shared reads
- [ ] #2 The blueprint-html.ts renderer and its duplicated gesture and branding code are removed, with tests migrated to the bundle path
- [ ] #3 The local artifact stays non-mutating and network-free, and terminal plus json fallbacks are unchanged
- [ ] #4 Iteration 1A black-box expectations are updated and green, and bun run check stays green
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Trace bare interactive dispatch, exported-bundle assembly, opener behavior, and renderer-specific coverage from merged GROM-78.
2. Route interactive bare groma through the deterministic exported bundle while preserving noninteractive and JSON fallbacks.
3. Remove the bespoke blueprint HTML renderer and migrate focused unit/Iteration 1A expectations plus public docs to the single bundle path.
4. Record the implementation as unverified by product-owner instruction; leave acceptance criteria unchecked and do not run tests, checks, reviews, CI, push, or PR actions.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the supported boundary: interactive plain bare groma now uses the exact static exported-bundle generator and temporary-file presenter, while noninteractive and interactive JSON overview behavior remains on the existing terminal path. The bundle continues to use the fixed bounded shared export read, embedded read-only snapshot adapter, self-contained assets, and connect-src none policy. Removed the bespoke blueprint-html renderer, its duplicated canvas/gesture/brand implementation, its renderer-specific test, and its canonical component/relationships through supported Groma mutations. Migrated focused CLI and Iteration 1A expectations, including byte equality between explicit export and bare-open bundle output, and updated README, architecture, and development documentation.

Unverified by product-owner instruction. Alex explicitly directed that no local tests, checks, formatting verification, review agents, Claude review, CI wait, push, or pull request action be run. Acceptance criteria remain unchecked and the task remains In Progress.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Interactive bare groma now opens the same exported bundle as groma export; the bespoke renderer and duplicated presentation code were removed while noninteractive and JSON paths were preserved. Unverified by product-owner instruction; acceptance criteria remain unchecked and no local checks, CI wait, or review were performed.
<!-- SECTION:FINAL_SUMMARY:END -->
