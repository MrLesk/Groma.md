---
id: TASK-171
title: Soften web group-zone borders
status: Done
assignee:
  - '@codex'
created_date: '2026-08-24 21:14'
updated_date: '2026-08-24 21:24'
labels: []
dependencies: []
references:
  - iso-map
modified_files:
  - src/viewers/web/iso/style.ts
ordinal: 182000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect views grouped sibling components in Groma web, the group zone should remain visible without its outline competing with the architecture inside it. The approved example is the Map painting group: keep its existing thickness and hatch, but use the standard neutral geometry stroke instead of the darker muted stroke.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sibling group zones use the standard neutral geometry stroke in light and dark themes
- [x] #2 Group-zone thickness, hatch, labels, layout, and interaction remain unchanged
- [x] #3 The Map painting group reads as background organization while its contained buildings remain clear
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
1. Delete the sibling group zone's darker stroke override so its ground inherits the existing shared map-line geometry stroke; keep the zone-specific hatch and existing building-level stroke weight unchanged. 2. Verify the focused map tests and the Map painting group in light and dark browser themes. 3. Run the cold simplicity and full-context architecture reviews, apply the accepted deletion, and recheck the original finding.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the trial as one token substitution in src/viewers/web/iso/style.ts: sibling group-zone grounds now use var(--map-line) instead of var(--muted). The existing stroke-width rule, hatch fill, labels, layout, and event behavior were not changed. Verification: bun test test-bun/iso-map.test.ts passed 14/14; git diff --check passed. Browser QA on the current Groma architecture found 6 rendered zones, a non-empty map and no console warnings or errors. The Map painting zone resolved to rgb(162, 166, 174) in light theme and rgb(107, 113, 122) in dark theme, matching --map-line; its scaled stroke remained 2px at 477% zoom before and after the theme interaction. The shared groma/README.md currently has an unfinished profile edit with no lead description, so the preview used a temporary copy with a valid description and did not modify that shared file.

Simplicity gate: both the cold reviewer and full-context architecture reviewer found the explicit replacement stroke redundant because the shared #map .ground rule already supplies var(--map-line). Accepted the finding and deleted the zone-specific stroke declaration. Final ownership is simpler: the shared geometry rule owns border color; the zone rule owns only its hatch fill. This removes one declaration and reduces the chance of future visual drift.

Final verification after simplification: bun test test-bun/iso-map.test.ts passed 14/14 and git diff --check -- src/viewers/web/iso/style.ts passed. Fresh browser QA rendered 6 zones with the Map painting group inheriting rgb(162, 166, 174) in light theme and rgb(107, 113, 122) in dark theme at the same 1px fitted width; the map was non-empty and the console had no warnings or errors. The targeted simplicity re-review confirmed the redundancy was removed with no in-scope regression. Alex approved the visual result as better. No public contract or documentation changes are required for this decorative token ownership change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the group-zone border's darker color override so sibling groups inherit Groma web's shared neutral geometry stroke while retaining their existing hatch, weight, layout, labels, and interactions. Verified with 14 focused map tests, targeted diff validation, light/dark browser inspection with no console issues, both required simplicity reviews, and Alex's visual approval.
<!-- SECTION:FINAL_SUMMARY:END -->
