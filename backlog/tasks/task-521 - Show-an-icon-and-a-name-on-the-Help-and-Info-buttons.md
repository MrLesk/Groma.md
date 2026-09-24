---
id: TASK-521
title: Show an icon and a name on the Help and Info buttons
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 14:30'
updated_date: '2026-09-24 14:46'
labels: []
dependencies: []
references:
  - web-page
  - shell
modified_files:
  - src/viewers/web/page.ts
  - src/viewers/web/chrome/credits.ts
  - docs/viewers/web/index.md
type: task
ordinal: 605000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Requested by Alex on 2026-09-24: "add a (?) icon next to the help button and add Info next to the (i) button". The header's utilities end with a text-only Help button and an icon-only (i) button that opens About Groma, so neither shows both an icon and a name. Fit already pairs its icon with a label inside the shared .chrome-button.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Help button shows a question-mark icon before its Help label
- [x] #2 The (i) button shows Info after its icon, and its accessible name is the visible label
- [x] #3 Both buttons use the shared .chrome-button icon and label layout, as Fit does, and the header fits at the widths the web map supports
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
1. page.ts: add helpIcon beside infoIcon, drawn like it (a 9-unit circle, here with a question mark); the Help summary renders ${helpIcon}<span>Help</span>, the markup Fit uses, with aria-label="Help".
2. chrome/credits.ts: the About Groma summary renders ${infoIcon}<span>Info</span> with aria-label="Info", its visible label (the popover keeps About Groma); drop the fixed 32px width and zero padding that made it a square icon button.
3. Narrow widths: in page.ts's max-width 1080px block the Help and Info labels fold to their icons with Fit's, because keeping them truncates the two short revision IDs in comparison mode at 900 to 1000px; the aria-labels keep folded buttons named. docs/viewers/web/index.md lists them where it says what leaves at 1080px.
4. Verify on exports in Chrome: header measurements from 900 to 1440px in plain and comparison mode, both popovers, screenshots in both themes.

Tests: none. This is markup and styling with no rule a test could protect; the check and the measurements cover it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
page.ts: helpIcon is drawn like infoIcon (a 9-unit circle, here with a question mark) and the Help summary renders ${helpIcon}<span>Help</span>, the markup Fit uses. chrome/credits.ts: the About Groma summary renders ${infoIcon}<span>Info</span> and no longer has the fixed 32px width and zero padding of an icon-only square.
Narrow widths: the page has body min-width 900px. Measured in Chrome with a comparison export (revision fcfeec2f from 631089ed): with the labels always shown, both short revision IDs truncated at 900 to 1000px, where the header CSS says the pair must fit; the TASK-517 build showed them whole. So the Help and Info labels fold to their icons with Fit's label in the existing max-width 1080px block, and both summaries carry aria-labels equal to their visible labels (Help, Info), as Fit has aria-label="Fit map", so a folded button keeps its name. Info's accessible name was About Groma; it now matches the visible label, and the popover keeps About Groma.
Chrome checks: comparison mode at 900, 1000, 1080, 1100, 1200, 1320 and 1440px: no header overflow, no clipped control, no truncated revision ID; labels show above 1080px (72px buttons) and fold at 1080px and below (36px). Plain map at 900, 1080, 1100 and 1440px: the same. Help and About popovers open under their buttons, right-aligned to them, inside the viewport. Screenshots in light and dark at 1440px and light at 1000px were sent to Alex.

End-of-task review (one read-only agent for TASK-518 and this task): keep the approach, no functional defect. Applied its blocking point: docs/viewers/web/index.md now says Fit, Help and Info show only their icons at 1080 px and below, and the plan no longer says to drop the aria-label. Left for Alex: move helpControl and its #help CSS into chrome/help.ts beside credits.ts and shortcuts.ts, since Help belongs to web-page while Info belongs to shell. Its cosmetic note: folded, Help and Info are 36 px wide beside the 32 px Settings button.
bun run check at 542d767e (main c8d9fe31 plus page.ts and credits.ts): Biome, types and the Node suite pass; Bun 728 pass, 45 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The header's Help button now shows a question-mark icon before Help, and the (i) button shows Info after its icon, both with Fit's icon-and-label markup inside the shared .chrome-button. At 1080 px and below their labels fold to icons together with Fit's, because keeping them there truncated the two short revision IDs in comparison mode; aria-labels equal to the visible labels keep folded buttons named, and Info's accessible name is now its visible label (the popover stays About Groma). The web viewer docs say what folds at 1080 px. Verified in Chrome on exports from 900 to 1440 px in plain and comparison mode (no overflow, no clipped control, whole revision IDs), with both popovers opening under their buttons, and by bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
