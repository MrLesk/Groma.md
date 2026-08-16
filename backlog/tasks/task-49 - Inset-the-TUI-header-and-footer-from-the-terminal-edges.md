---
id: TASK-49
title: Inset the TUI header and footer from the terminal edges
status: Done
assignee:
  - '@alex'
created_date: '2026-08-16 17:33'
updated_date: '2026-08-16 17:39'
labels: []
dependencies: []
priority: high
type: enhancement
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a developer runs groma view, the header and footer sit one blank row in from the terminal edges instead of flush against them. The three panes still fill the space between those rows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header sits one blank row below the top of the terminal
- [x] #2 The footer sits one blank row above the bottom of the terminal
- [x] #3 Hierarchy, map, and details panes fill the space between the inset header and footer
- [x] #4 A test covers the inset as layout behavior, not decorative chrome strings
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [x] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shift paneLayout so header.y is 1 and footer.y is height-2; body starts at y=2 with height-4.
2. Keep chrome painters reading layout.header/footer; buffer.clear leaves the edge rows blank.
3. Add a concurrent layout test for the inset geometry.
4. Update docs/viewers/tui/index.md and the AGENTS.md TUI map. Leave observed architecture Markdown to the in-progress architecture rewrite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
paneLayout is the only code change. Painters already follow bounds.

Verification:
- bun test test-bun/terminal-viewer.test.ts: 24 pass including the new geometry test.
- agent-tty 120x36 bun src/cli.ts view: row 0 blank, row 1 header (groma), row 34 footer, row 35 blank.
- Cold simplicity review PASS. Spec review PASS. Quality review PASS.
- bun run typecheck fails only in test-bun/relationship-text.test.ts (other agent, out of scope).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view now leaves one blank row above the header and one below the footer. paneLayout insets the chrome (header y=1, footer y=height-2, panes in between). Verified with the new layout geometry test (24/24 terminal-viewer tests) and a live 120x36 agent-tty frame showing blank, header, panes, footer, blank.
<!-- SECTION:FINAL_SUMMARY:END -->
