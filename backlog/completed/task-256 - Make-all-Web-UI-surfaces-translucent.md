---
id: TASK-256
title: Make all Web UI surfaces translucent
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 16:48'
updated_date: '2026-09-05 17:13'
labels: []
dependencies: []
references:
  - popover
  - page
  - view
  - revision-history
  - web-shell
  - project-editor
  - flow-controls
  - work-overlay
modified_files:
  - src/viewers/web/atoms/popover.ts
  - src/viewers/web/page.ts
  - src/viewers/web/search/view.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/organisms/tip.ts
  - src/viewers/web/atoms/chrome.ts
  - src/viewers/web/project/editor.ts
  - src/viewers/web/flow/row.ts
  - src/viewers/web/work/badge.ts
  - src/viewers/web/work/pins.ts
  - src/viewers/web/work/summary.ts
  - src/viewers/web/chrome/motion.ts
type: bug
ordinal: 295000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect uses the Web viewer, Help and every other UI surface should have a translucent background. Alex identified the fully opaque Help popup and requested an audit and correction of all UI components. Apply transparency to backgrounds while preserving readable text, icons, behavior, and the architecture map.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Help and Search inherit the shared translucent popup surface, and the audit covers header popovers, panels, dialogs, tooltips, controls, badges, and scrollbars across Light, Dark, and Blueprint themes.
- [x] #2 Every audited UI background has transparency, including active and selected states, with readable foregrounds and no opaque nested surface defeating it.
- [x] #3 Browser screenshots and computed styles verify the supported states; interactions remain unchanged and bun run check passes.
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
1. Capture the reported Help state and inventory opaque background rules, including pseudo-elements and active states. 2. Remove opaque popup overrides and replace remaining solid UI fills with translucent colors using the existing theme palette. 3. Verify screenshots and computed backgrounds across themes, review the scoped diff, and run the repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser verification exposed sharp pane text showing through translucent Help despite its 18 px blur: the header itself was a filtered ancestor. Moved only the header background and blur to its own pseudo-element so the popup can blur content behind the header. Pane styles and map composition remain unchanged.

Source audit covers every Web background declaration: shared/header popovers, Help, Search, Revision and pin tooltips, panes, dialogs, form controls, selected controls, active flow checks, task badge faces/labels, scrollbars, and theme transition wash. Solid foreground strokes and the page canvas remain separate from translucent UI surfaces. Help/Search use the shared 78 percent paper surface; foreground text opacity stays 1. Header blur moved to a pseudo-element after a real screenshot exposed unblurred pane text behind Help. Existing viewer fixture browser checks in Light, Dark, Blueprint confirm Help and Search at alpha 0.78, dialog alpha 0.78, inputs 0.72, and transparent buttons; scans of visible HTML found no fully opaque UI backgrounds. Screenshots are in /tmp/groma-opacity-audit. Cold simplicity and own specification/quality reviews pass with no blocker. Current live Groma preview is independently blocked by route safety checks during concurrent architecture/layout work, so visual checks used the supported viewer fixture from the same shared source checkout. Full lint/type checks pass; 300 of 301 Bun tests passed in the first host run and its only live-reload timeout passed isolated in 309 ms. A final full run is underway.

Final verification: lint and TypeScript pass; all 104 Node tests and 300 of 301 Bun tests pass. The architecture Markdown live-reload test again timed out at 20 seconds in the full suite, although it passed alone in 309 ms. Full check evidence: /tmp/groma-ui-256-257-check-final.log. AC 3 and check-related DoD remain unchecked; task stays In Progress. Full-context complexity review also passed with no material recommendations. Audit report with accepted screenshots: /tmp/groma-opacity-audit/audit.md. No public contract or documentation changes are needed for these surface styles.

The subsequent full shared-source bun run check passed, independently confirmed from /tmp/groma255-check6.txt: lint and types passed, 104 Node tests passed, 301 Bun tests passed, zero failures. The previous full-suite timeout no longer blocks completion. All acceptance criteria and Definition of Done items are now verified.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made Web UI backgrounds translucent, removed opaque Help/Search overrides, and isolated header blur so popup blur works. Verified supported interactions, computed styles and screenshots in Light, Dark and Blueprint using the existing viewer fixture. Full repository check passed: 104 Node and 301 Bun tests.
<!-- SECTION:FINAL_SUMMARY:END -->
