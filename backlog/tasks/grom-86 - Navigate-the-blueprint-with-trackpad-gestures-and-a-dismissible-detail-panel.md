---
id: GROM-86
title: Navigate the blueprint with trackpad gestures and a dismissible detail panel
status: Done
assignee:
  - '@claude'
created_date: '2026-07-20 21:26'
labels:
  - pivot
  - web
  - renderer
milestone: m-5
dependencies: []
priority: high
type: feature
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two interaction corrections against the expert-career-path map. Scrolling zoomed the sheet, which is jarring on a trackpad and unlike that map, where scroll never zooms and pinch does; two-finger movement should pan. The component detail panel was mounted permanently, so it occupied the right edge and squeezed the canvas even with nothing selected, showed a placeholder instead of content, and offered no way to close it once open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Two-finger movement pans the sheet, pinch zooms, and scrolling never zooms
- [ ] #2 The detail panel appears only when a component is selected and returns the full sheet width when closed
- [ ] #3 The panel can be dismissed by an explicit close control and by Escape
- [ ] #4 bun run check stays green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Canvas now sets panOnScroll with zoomOnScroll false and zoomOnPinch, matching the career-path map's key property that scroll never zooms while adding trackpad panning; drag-to-pan and the disabled double-click zoom are unchanged. SpecPanel returns null without a selection instead of rendering a placeholder, gained a close control in its heading, and app.tsx only reserves the right gutter while a selection exists, so the sheet uses the full width otherwise. Escape clears the selection, matching how the search field is dismissed. Verified in the browser against the compiled binary: no panel and full-width sheet with nothing selected, panel with working close control after selecting a component. Noted while verifying, not a defect: eight source-boundary relationships from before the containment change persist in this repo's canonical state because the scan reports partial relationship coverage for the workspace scope, so reconciliation refuses to remove them — missing evidence is not proof of absence. They clear on a scan with complete coverage or by explicit curation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The sheet now moves the way a trackpad expects: two fingers pan, pinch zooms, and scrolling never changes zoom. The component detail panel opens on selection, closes by button or Escape, and no longer occupies the canvas when there is nothing to show.
<!-- SECTION:FINAL_SUMMARY:END -->
