---
id: GROM-110
title: Size expanded plates to their rendered content
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 22:58'
updated_date: '2026-07-21 23:03'
labels:
  - frontend
  - visual-blueprint
dependencies: []
references:
  - MANIFESTO.md
  - brand/STYLE.md
modified_files:
  - src/web/client/graph.ts
  - src/web/client/styles.css
  - src/web/tests/model.test.ts
type: bug
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expanded component plates currently retain a 720px minimum width even when their bounded child grid is narrower, producing disproportionate empty space. Make plate geometry follow measured child content while preserving enough room for its header and controls.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An expanded plate with one or two child cards no longer reserves the former 720px minimum width
- [x] #2 Plate width is derived deterministically from the rendered child grid and header/control requirements
- [x] #3 Larger bounded grids and nested expansion remain unclipped and preserve existing spacing
- [x] #4 Automated layout tests and live OpenClaw browser QA cover the two-package case
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove the fixed 720px plate-width floor so layout width is the exact bounded child-grid width plus frame padding. 2. Allow the plate heading metadata to wrap within narrow one-card plates while preserving the collapse control clearance. 3. Add deterministic geometry tests for one-card, two-card, larger, and nested expanded plates. 4. Run formatting, focused/full checks, production build, and live OpenClaw browser QA through Packages expansion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed the 720px width floor: each plate now uses the deterministic child-grid width plus the existing 28px frame padding on both sides. Narrow headings wrap with separate row/column gaps while retaining collapse-control clearance. Geometry tests prove 296px for one card, 568px for two, 1384px for five, and exact nested containment. Validation: 525/525 Bun tests, production build, web TypeScript check, architecture boundaries, and git diff check passed. Live OpenClaw browser QA at http://127.0.0.1:1236/ verified Packages -> clawdbot/moltbot in a content-sized plate with no clipping, overlay, warnings, or errors. Full typecheck remains blocked only by unrelated GROM-107 work in tests/organization-scale/verify.ts:546 using removed focusPath.

Pre-PR integration verification now passes the complete bun run check after the merged GROM-107 fixture was migrated to expandedIds.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made expanded blueprint plates follow their rendered child grid instead of a fixed 720px minimum, with wrapping header metadata for narrow plates. Verified exact one/two/five-card and nested geometry in tests, all 525 repository tests, production build, boundary/web type checks, and the real OpenClaw Packages interaction in a clean browser session.
<!-- SECTION:FINAL_SUMMARY:END -->
