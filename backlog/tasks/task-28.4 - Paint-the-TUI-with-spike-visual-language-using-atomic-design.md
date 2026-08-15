---
id: TASK-28.4
title: Paint the TUI with spike visual language using atomic design
status: Done
assignee: []
created_date: '2026-08-15 13:00'
updated_date: '2026-08-15 13:08'
labels: []
dependencies:
  - TASK-28.1
references:
  - docs/viewers/tui/index.md
  - docs/viewers/index.md
  - docs/historical-investigations.md
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give the documented TUI plugin the visual language of the spike/groma-tui exploration without taking features from that spike.

The spike is UI/UX evidence only. Product features come from docs/viewers and TASK-28.2. This task rebuilds the current world paint so observed cards, planned ghosts, missing hatch, selection, and chrome density feel like the spike, implemented as TypeScript atomic design: atoms, molecules, organisms, composed by the viewer template.

Out of scope: spike-only product ideas (code level, 1-4 jumps, q quit, ? help, wordmark tabs, comparison badges, breadcrumb as product chrome, Esc to change level). Navigation, details, z, +, -, arrows, and f stay TASK-28.2. R refresh already exists on TASK-28.2 and must keep working.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 paintWorld is composed from TypeScript atoms, molecules, and organisms; viewer code still asks core for the world and does not read architecture Markdown
- [x] #2 Observed items are solid titled cards with an origin chip and a left spine; planned ghosts use dotted or dashed borders; missing cards use hatch
- [x] #3 The header shows the current level and item; the footer shows `- context | containers | components +` and the keys that currently apply
- [x] #4 The TUI does not add undocumented keys, a fourth level, wordmark tabs, breadcrumb chrome, or C4/ title prefixes
- [x] #5 R still reloads through core and Esc still exits; existing world geometry tests still pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
- [x] #5 Headless frames show spine, dashed planned borders, and missing hatch without undocumented chrome
- [x] #6 bun test test-bun/terminal-viewer.test.ts and bun run check pass
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Split viewer paint into TypeScript atomic layers: atoms (theme, cell, text, border), molecules (chip, spine, card, compact, boundary, route, selection), organisms (chrome, world), with paintWorld as the template.
2. Keep only documented TUI features. Apply spike visual language in code: origin chip, left spine, dashed planned borders and routes, missing hatch, selected tint, header underline. Do not add C4/ prefixes, breadcrumb chrome, wordmark tabs, a fourth level, or extra keys.
3. Remove the cancelled spike-port leak of TASK-28.2 features (details panel, Enter, f, breadcrumb projection fields) so navigation and inspect stay on TASK-28.2.
4. Keep product docs on why and what. Do not document how the TUI looks; the running viewer is that representation. R remains a documented action.
5. Keep R refresh. Update headless tests for the visual language and the atomic module boundary, then run bun test and bun run check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Paint lives in src/viewer/ui as atoms, molecules, and organisms. paintWorld is the template. Spike look is in the drawing code: origin chip, left spine, dashed planned borders and routes, missing hatch, selected tint, header underline.

Product docs stay on why and what. docs/viewers/tui/index.md no longer describes cards, chips, dotted borders, or header/footer chrome. The running TUI is how it looks. R remains a documented action. Navigation and details stay TASK-28.2.

Cold simplicity review dropped card/boundary descriptions, wrapText/truncate, a separate fillCard pass, and unused type barrels.

Verification: bun test test-bun/terminal-viewer.test.ts 6/6; bun run check (tsc, architecture, 85 Node tests, 6 TUI tests). Frames assert spine, dashed/hatch characters, footer keys, and the absence of C4/ prefixes and breadcrumb chrome.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebuilt TUI paint as TypeScript atoms, molecules, and organisms using the spike visual language. Features stayed on the product docs and TASK-28.2. Docs now say what the TUI does, not how it looks. Verified with bun test test-bun/terminal-viewer.test.ts 6/6 and bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
