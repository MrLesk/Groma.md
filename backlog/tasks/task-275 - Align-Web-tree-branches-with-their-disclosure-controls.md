---
id: TASK-275
title: Align Web tree branches with their disclosure controls
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 19:44'
updated_date: '2026-09-05 20:02'
labels: []
dependencies: []
references:
  - web-shell
  - page
modified_files:
  - src/viewers/web/organisms/sidebar-section.ts
  - src/viewers/web/page.ts
type: enhancement
ordinal: 314000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use a consistent title, underline divider, then content pattern for sidebar and details sections. Align tree branches with heading and parent-row disclosure controls, and use the existing details panel inset without extra flow-tree padding.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The root flow branch aligns with the heading chevron in both panels, and nested branches align with the parent disclosure column.
- [x] #2 The shared tree keeps its existing labels, counts, selection, folding and chevron animation.
- [x] #3 The details flow heading uses the existing panel inset without extra left padding, and its branch column remains aligned.
- [x] #4 Sidebar and details sections consistently use title, divider below the title, then content; the sidebar has no extra divider after the Flows block.
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
Use the same disclosure column for headings and rows and draw branch lines at its center. Apply one shared heading-divider rule to sidebar and details sections: title, divider, content. Remove the sidebar Flows block boundary and the extra left inset from the details flow heading and rows. Verify both panels and nested alignment, folding and selection in the browser; run the repository check and final review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Headings now use the same 12px disclosure column as rows; shared branch CSS draws through its center while preserving the 16px depth step. Browser measurements: sidebar heading axis 33px equals root branch 27px + 6px; details heading 903.40625px equals branch 897.40625px + 6px; actor axes 49px and 919.40625px match their child branches 43px + 6px and 913.40625px + 6px. Structure uses the same alignment: Groma chevron 33px matches the CLI branch 27px + 6px. Light/dark screenshots and actual folding, rotation, retained counts and TypeScript scan selection passed. Own specification and quality reviews and the final full-context complexity review passed with no findings. The complete bun run check passed 105 Node tests and 306 Bun tests, with seven existing lint warnings. The initial scan-watch timing failure passed on retry without changes; log /private/tmp/groma275-check-retry.log. No documentation change or decorative content test was needed for this spacing-only refinement.

User correction: the first revision aligned branch columns but left the details separator under its heading. This revision moves that separator above the flow heading to match the sidebar.

User clarified the separator rule: all sections should keep their divider below the title. The earlier proposed above-title details override is discarded. The fix now shares heading underline styling across both panels and removes the sidebar Flows block-end divider.

Final separator revision: one shared CSS rule puts a 1px divider below sidebar and details section headings, with 6px padding below the title and 10px before content. The sidebar Flows block-end divider is removed. Details flow headings and rows use zero additional left padding. Browser inspection verified Flows, Structure, Relationships and the details flow heading all have 0px top borders and 1px bottom borders, with identical spacing; light/dark screenshots and folded-state checks passed. Branch axes remain aligned: sidebar 33px = 27px + 6px; details 889.40625px = 883.40625px + 6px; expanded actor child branches remain aligned too. The complete bun run check passed 105 Node and 306 Bun tests with seven existing warnings after the existing Web Markdown watcher timeout passed on retry, with no code changes for the retry. Log: /private/tmp/groma275-sections-check-retry.log. Implementer specification and quality reviews passed. The requested separate full-context review was launched but could not run because the reviewing agent hit a usage limit; no successful external review is claimed for this separator revision.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Sidebar and details sections now share title-divider-content styling. Removed the extra sidebar block divider and details flow-tree left padding while preserving chevron/branch alignment. Browser verification and all 411 repository tests passed. The separate review of the final separator revision was unavailable due to a usage limit.
<!-- SECTION:FINAL_SUMMARY:END -->
