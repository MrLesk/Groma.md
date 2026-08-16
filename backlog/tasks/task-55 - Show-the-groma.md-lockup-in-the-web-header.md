---
id: TASK-55
title: Show the groma.md lockup in the web header
status: Done
assignee:
  - '@web'
created_date: '2026-08-16 18:48'
updated_date: '2026-08-16 18:49'
labels: []
dependencies: []
references:
  - src/viewers/web/page.ts
  - ../groma/brand/lockup.svg
  - ../groma/brand/README.md
documentation:
  - docs/viewers/web/index.md
priority: high
type: feature
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a human architect uses `groma web`, the header shows the official `groma.md` lockup from the Groma brand assets, not a title-case or plain-text wordmark. The lockup is the approved mark for a full product surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The groma web header shows the official groma.md lockup (glyph, lowercase groma, accent .md).
- [x] #2 The page does not depend on a sibling brand directory at runtime.
- [x] #3 docs/viewers/web/index.md names the lockup as the header mark.
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
1. Copy lockup.svg into the web plugin atoms so groma web ships the mark.
2. Inline it in the header, sized to stay readable. Drop the extra green bar; the lockup already carries the accent on .md.
3. Update docs/viewers/web/index.md. Browser-check the header.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Copied lockup.svg into src/viewers/web/atoms and inlined it in the header. Dropped the extra green bar; .md is the accent. The page does not read ../groma/brand at runtime.

Browser: header image is labeled groma.md lockup; texts are groma and .md; height 28px; HTML has no sibling brand path. tsc --noEmit passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma web now shows the official groma.md lockup in the header. The mark ships with the plugin. Verified in the browser on this repository.
<!-- SECTION:FINAL_SUMMARY:END -->
