---
id: TASK-467
title: Use bounded zoom steps for map surface titles
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 18:16'
updated_date: '2026-09-20 18:40'
labels: []
dependencies: []
references:
  - map
  - iso-project
  - scene
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/iso/project.ts
  - src/viewers/web/iso/text.ts
  - src/viewers/web/iso/map.ts
  - test-bun/iso-map.test.ts
  - docs/viewers/web/index.md
  - src/sheet/measure.ts
type: enhancement
ordinal: 543000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex reports excessive title padding, small distant labels and Safari lag from font changes at every zoom. Use a small finite set of useful text-size and spacing layouts, chosen against the actual map. Keep titles inside their reserved outer boundary and leave their SVG attributes unchanged between preset boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 System, container and group titles use a small finite set of predetermined size and spacing steps, with clearer text in distant views and no continuous font or gap adjustment.
- [x] #2 Titles stay within their permitted outer boundary while retaining readable placement and selection in isometric and 2D views.
- [x] #3 Zooming keeps packed architecture unchanged and retains cached camera motion; title attributes are untouched while zoom stays in the same range.
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
1. Sheet measurement reserves fixed larger title bands; projection carries each title band width and height without changing C4 identities, containment, or OKF Markdown meaning. 2. Map text painting fits four fixed plane-space presets inside those bands. Preset thresholds use absolute camera scale, so the rule depends on visible scale rather than repository size or language. Exact zoom never enters font or padding arithmetic. 3. The map remembers the applied preset. Settled zoom crossing a threshold updates titles once; same-range zoom and camera movement skip all title attribute work. Repainting a scene generates the matching preset directly. 4. Regression authority is the user request for finite layouts and the reported continuous resizing. Test full layout equality within every range in both projections and with roomy and constrained bands; the former screen-normalized assertion masked this failure. Existing geometry coverage checks reserved bounds, roof separation, camera fit and world immutability. Verify actual browser mutations, glyph containment, title selection, Iso/2D appearance, and Safari zoom behavior; run bun run check. Sheet measurement owns the reservation, projection supplies it, and text painting owns the visible layouts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
No active Backlog task overlaps these files. TASK-402 and TASK-166 explain the current external label band; the user now replaces their extra screen clearance rule. The existing glow changes from TASK-466 remain uncommitted and will be preserved. Boundary clarification is optional; after leaving the question open, continued with the existing below-item placement shown in the screenshots, bounded by the reserved band within the surrounding surface.

Initial bounded layout passed 39 focused tests and TypeScript, but visual inspection of the live Browser map container at k=0.056 showed its old 72-unit band limited the title to roughly three plane-screen pixels. Increase the fixed reserved band so the requested larger distant text has space; do not loosen containment or add collision handling.

Actual browser glyph measurement caught a group title extending about 4.4 plane pixels past its 144-unit band. The old 1.1-em estimate omitted part of the map font descent. The bounded layout now reserves a full 1.3-em line box and places the baseline inside it; browser glyph containment is rechecked directly.

Kept the established 0.9-em baseline within the larger 1.3-em line box after the first actual-bounds pass exposed an extra baseline offset. This preserves top clearance and leaves enough space for descent.

Quality review removed the obsolete hypothetical base-font rectangles from the label test. The geometry check now exercises the actual bounded layout at each tested zoom, plus the unchanged boundary anchor, instead of also asserting the discarded fixed-gap presentation.

Final implementation and verification: screen presets now use larger text and short gaps, with the complete title and its selectable area constrained to a fixed label band. The band reserves three times the base heading allowance once during layout. Body geometry, containment and route placement do not change with zoom. Browser map measured about 17.7 plane-screen pixels at k=0.161 (the previous 36-unit font would be about 5.8), and the close preset measured 40 at k=0.615. Direct getBBox checks found no title overflow in the live map at distant and close scales or the nested fixture in Iso and 2D; the earlier actual-font overflow was reproduced before the final line-box correction and absent afterward. Clicking the fixture Api title selected api. Native Safari screenshots at 319% and 499% showed the larger headings, tight leader gaps and placement within the enclosing surface. Temporary browser tabs and fixture server were closed; the main viewer remains running on port 4747. Forty-six focused sheet/projection tests passed; final bun run check passed: lint and types, Node tests, 622 Bun tests passed, 36 skipped, zero failures (log /tmp/groma467-verified-check.log). The existing unrelated scanner-release complexity warning remains. Implementer specification and quality reviews found all acceptance criteria met, no supported-flow defect or added complexity needing another module, and no new architecture meaning or dependency. Each changed source/test file remains below 500 lines, git diff --check passes, and unrelated task changes remain intact.

Reopened after Alex reported that fonts still resize at every zoom and Safari lags. Confirmed surfaceLabelLayout divides size and padding by the exact camera zoom, while commitCamera rewrites all title attributes on every scale commit. Previous test multiplied values by zoom and therefore hid this failure; previous completion evidence did not establish fixed SVG layouts or Safari zoom performance.

Before correction, repeated Safari zoom-button actions from 319% up to 974% and back sampled 42–56 FPS during interaction (60 FPS at rest). This is a baseline for the same live map and action sequence, not an isolated rendering benchmark.

Correction: four fixed plane-space layouts now replace all exact-zoom size and padding arithmetic. The map remembers the current range and skips the entire title-update loop unless that range changes; a scene repaint generates the correct preset directly instead of generating and then rewriting every title. The regression failed before the correction and all 25 iso-map tests pass after it. On the live map, a MutationObserver measured zero title attribute writes through six successive settled zooms (k 0.066–0.202), one batch of 156 writes for 26 labels at the 0.25 boundary, and no further writes at k 0.315. Actual glyph bounds at that scale fit all 26 reserved bands. Repeated Safari zoom-button samples after correction were 46–54 FPS versus 42–56 before; this does not establish a general FPS improvement. It does confirm removal of continuous title layout work while normal camera commits still have a rendering cost.

Final correction verification: fourteen successive settled zoom stops from k 0.066 to 1.202 produced exactly three label-update batches, at the 0.25, 0.5 and 1.0 thresholds (468 attribute writes total for 26 titles). Same-range stops wrote zero title attributes. Direct browser glyph measurements found no overflow in any of the four layouts or after switching to 2D. Clicking the Browser map title selected export. Inspected the whole map, working-scale groups and close Browser map title in Iso, the Browser map title in 2D, and native Safari at working scale. Full bun run check passed: lint and types, Node tests, 622 Bun tests passed, 36 skipped, zero failures; log /tmp/groma467-discrete-check.log. Existing unrelated scanner-release complexity warning remains. Specification and quality self-review confirmed the requested finite layouts, no exact-zoom geometry arithmetic, correct preset initialization after scene/projection changes, unchanged bounds and hit ownership, and no extra abstraction or dependency. Changed files stay under 500 lines, git diff --check passes, and unrelated changes remain intact. Temporary observers and test tabs were removed; the updated main viewer remains on port 4747. Safari zoom stops still have brief FPS dips, so no overall frame-rate improvement is claimed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Four fixed title layouts replace continuous exact-zoom sizing and padding. The map skips all title writes within a range and updates once after crossing a preset boundary. Titles remain bounded and selectable. Verified three update batches across fourteen zoom stops, actual glyph bounds and selection in Iso/2D, and Safari appearance; bun run check passes. Normal Safari camera commits still produce brief FPS dips.
<!-- SECTION:FINAL_SUMMARY:END -->
