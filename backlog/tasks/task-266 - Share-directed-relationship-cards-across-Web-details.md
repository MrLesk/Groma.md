---
id: TASK-266
title: Share directed relationship rows across Web details
status: Done
assignee:
  - codex
created_date: '2026-09-05 18:28'
updated_date: '2026-09-05 18:39'
labels: []
dependencies: []
references:
  - web-viewer-details
  - web-shell
documentation:
  - >-
    /Users/alex/.codex/generated_images/01a0720f-0723-7a12-9d7c-c1ec990b5af0/exec-94a76b8c-2e44-4822-a7df-2d7bf0ab02b9.png
  - >-
    /var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/codex-clipboard-450ba4c4-23e0-4b59-8885-af85fa3dde08.png
modified_files:
  - src/viewers/web/organisms/relationship-card.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/page.ts
  - test-bun/inspect-details.test.ts
  - test-bun/flows.test.ts
  - docs/viewers/web/index.md
  - design-qa.md
type: enhancement
ordinal: 305000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an architect selects a component or relationship in Web details, Groma shows a compact horizontal Source → Destination row. Clickable endpoint names and kinds flank the relationship description and arrow. Element lists mark the selected endpoint with THIS and the center action opens the relationship. Rows use small text and dividers, with no enclosing borders, lateral padding or technology. Technology remains editable. Approved example: the annotated horizontal relationship layout with the requested smaller text and divider-only treatment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Component lists and standalone relationship details share a compact horizontal Source → Destination row with endpoint names and kinds, a central description and arrow, no technology, and dividers between list rows instead of enclosing cards.
- [x] #2 Component lists mark the selected endpoint with THIS for outgoing and incoming relationships; standalone relationship details have no THIS badge.
- [x] #3 Endpoint controls select their element, the center action in list rows opens their relationship, and existing edit, accept and remove behavior is preserved.
- [x] #4 Relationship inclusion and peer promotion remain unchanged; fixture business tests cover directed endpoints and selection context.
- [x] #5 Browser checks cover both views, incoming and outgoing relationships, light and dark themes and supported widths; bun run check and required reviews pass, and documentation describes the result.
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
1. Preserve promoted relationship semantics and expose both directed endpoints. 2. Render one shared horizontal row with compact endpoint names and kinds, description above the center arrow, and THIS only on the selected element. Use dividers between rows without enclosing borders or lateral padding; technology remains editable but is omitted from reading. 3. Verify fixture business rules and browser behavior, document the final result, run repository checks and required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: bun run check passed (301 Bun tests, Node suite, types and lint; seven pre-existing complexity warnings, none in changed functions). Browser verified both endpoints, list action navigation, THIS on incoming/outgoing endpoints and absent from standalone details, Edit/Cancel, light 420px and dark 360px panes without card overflow; no browser errors. Design comparison passed; evidence in design-qa.md. Cold simplicity review found no blocking changes; its documentation clarification was applied. Implementer specification and quality reviews found no unmet criteria or supported-flow defects; existing edit/accept/remove ownership is unchanged.

User revised the approved example with an annotated card: remove technology and place the relationship name in the arrow between endpoints. Applied as a revision within this task before completion.

Targeted simplicity review of the user revision passed; removed the now-unnecessary inner layout wrapper as recommended.

User further simplified the design: smaller fonts, no enclosing card or lateral padding, and a divider between relationship rows. The shared renderer and center action remain unchanged.

Final user revision verified: smaller text, no card border/lateral padding, dividers only between rows. Narrow 900px browser rows and each of their three children had identical client/scroll widths. Source, destination and center navigation remain operational; both THIS directions verified. Full-context complexity review passed with no material recommendations. Shared checkout repository check hit unfinished TASK-267 startup changes, so final task checks use a temporary committed baseline with only TASK-266 code applied.

Final verification passed on the isolated committed baseline with TASK-266 changes only: bun run check, 104 Node tests and 301 Bun tests, zero failures, seven existing complexity warnings. Final specification and quality reviews passed against the revised criteria; design-qa.md records the final source and captures. No blocking review findings remain.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shared compact directed relationship rows across element lists and relationship details. Names and kinds flank the action and arrow; THIS marks the current endpoint. Removed enclosing cards, side padding and displayed technology, while keeping endpoint navigation and editing. Verified browser behavior in light/dark at 420px and 360px panes, zero row overflow, required reviews, and bun run check with 104 Node plus 301 Bun tests passing.
<!-- SECTION:FINAL_SUMMARY:END -->
