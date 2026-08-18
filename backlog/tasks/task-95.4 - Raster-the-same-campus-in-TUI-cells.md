---
id: TASK-95.4
title: Raster the same campus in TUI cells
status: In Progress
assignee:
  - '@grok'
created_date: '2026-08-18 20:48'
updated_date: '2026-08-18 21:26'
labels: []
dependencies:
  - TASK-95.1
references:
  - src/viewers/tui
  - test/fixtures/openclaw-view
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-95
priority: high
type: feature
ordinal: 104000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone uses groma view on the OpenClaw fixture, the terminal map paints the same city contract as the SVG proof: one campus, named level plus underlay, people and externals as marks, readable titles at Context scale.

This task is the TUI raster only. It does not add cone arrows or change chrome/map-first layout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TUI Context shows named systems, people, and externals plus container underlay
- [ ] #2 Software wrappers keep campus size; people and externals are marks
- [ ] #3 Titles remain readable at Context scale
- [ ] #4 The TUI campus matches the city contract from TASK-95.1
- [ ] #5 Fixture tests cover projection and navigation invariants, not decorative glyphs
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Project TUI cells from semanticView(world, { level, focusId }) so named / underlay / mark / campus is the source of what exists. Map those items onto existing DisplayRole (card, hidden, *-boundary) without merging SemanticRole into that enum.
2. Paint named systems/containers as titled wrappers, named components as titled cards, underlay as wrappers without lettering the name, marks as titled cards, and items absent from the semantic view as hidden. Context therefore no longer titles nested components.
3. Use semantic item bounds: software wrappers keep world-layout campus size; marks keep world origin and named-level size. Grow mark cells in screen space only when a title would not fit; never shrink wrappers with a second geometry.
4. Attach routes to named, mark, or campus (semantic edges), never to underlay. Lit walks still draw when the level would hide the relationship.
5. Cover OpenClaw Context (and the same contract at Containers/Components) with fixture tests for titled vs underlay, mark bounds vs campus wrappers, and selection. Update existing projection/route tests that assumed the full nest. Update TUI docs. Run bun test on touched TUI tests and tsc if types/imports changed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Projected TUI cells from semanticView. DisplayRole stays the TUI paint enum; projection-display maps named/underlay/mark/campus onto card, hidden, and *-boundary. Underlay wrappers draw without lettering a name. Software wrappers keep world-layout campus size. Marks use semantic bounds (world origin + named-level size) and grow in screen cells only when a title needs room; campus wrappers do not block that growth. Routes attach to named, mark, or campus (semantic edges); lit walks fall back to hidden ends so they still draw. Context no longer titles nested components.

Verification:
- bun test test-bun/tui-campus.test.ts test-bun/projection.test.ts test-bun/projection-routes.test.ts (15 pass)
- bun test test-bun/navigation.test.ts test-bun/chrome.test.ts test-bun/camera.test.ts test-bun/tree.test.ts test-bun/inspect-details.test.ts test-bun/viewer-lifecycle.test.ts (also pass)
- bunx tsc --noEmit (clean)
- agent-tty 120x36 on test/fixtures/openclaw-view: Context shows titled OpenClaw campus, titled Operator/WhatsApp/Anthropic/Telegram marks, and untitled container underlay boxes. Wait used text OpenClaw, not System Context.

Simplicity: dropped endpointOf wrapper and the letterName re-export; paint and tests import letterName from projection-display. Files stay under 500 lines.
<!-- SECTION:NOTES:END -->
