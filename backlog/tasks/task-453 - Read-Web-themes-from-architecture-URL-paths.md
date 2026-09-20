---
id: TASK-453
title: Read Web themes from architecture URL paths
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 12:27'
updated_date: '2026-09-20 12:35'
labels: []
dependencies: []
references:
  - render
modified_files:
  - src/viewers/web/url.ts
  - src/viewers/web/render.ts
  - test-bun/web-theme.test.ts
  - docs/viewers/web/index.md
type: feature
ordinal: 525000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The reusable Groma Action will publish under architecture/{theme}/. The Web viewer currently reads only the query string and saved browser preference, so opening that path cannot select the publisher's theme. Keep theme interpretation in the Web viewer, with no HTML rewriting in the Action and no change to OKF Markdown or C4 meaning.

Scenario: Open an architecture page with a path theme
Given an exported Groma map is served at /example/architecture/blueprint/
When a visitor opens that URL without a theme query parameter
Then the map opens in Blueprint even if the visitor previously saved another theme
And an explicit theme query parameter or a later Theme menu choice can override that initial choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A published map recognizes auto, light, dark and blueprint in a trailing architecture/{theme}/ path, including a repository prefix.
- [x] #2 An explicit valid theme query parameter takes priority over the path; paths without a recognized theme retain the existing saved-preference behavior.
- [x] #3 Theme menu changes, including Auto, remain correct when the URL is saved or reloaded from a themed publication path.
- [x] #4 The Web documentation describes the path convention and theme precedence; focused tests and the repository check verify the supported flow.
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
1. Extend the existing Web URL-state reader to accept search and pathname together. Recognize a trailing architecture/{theme}/ segment using the existing theme-mode validator; explicit query > path > saved preference. Theme is viewer state, not stored OKF metadata or a C4 concept.
2. Keep URL writing in the same module. Omit the theme query when it matches the path default; preserve explicit Auto when it overrides a themed path. Pass location from the browser session, without changing the exporter or rewriting HTML.
3. Document the path convention in the existing Web guide, preserving its unrelated current edits. No active task records overlap the URL/session files or this guide.
4. Coverage gap: there are no existing URL/theme tests. Add minimum concurrent tests for the user-requested path selection, existing saved-preference behavior without a path, query precedence, and read/write round trips including Auto. These detect a path opening with the wrong theme and a Theme-menu choice being lost on reload. Use an empty architecture graph because theme choice does not depend on architecture.
5. Exercise a locally exported map under /example/architecture/blueprint/ in the browser and change its theme. Run focused tests and bun run check, perform the implementer's specification/quality review and the required final full-context review. Keep this core change in its own commit; publication and the Action's CLI-version update follow the documented release approval flow.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The user confirmed that the Groma release will happen later. Implement and verify the source change now; do not release Groma or change the Action CLI pin in this task. Focused theme tests pass (4/4).

Validation: bun run check passed with 16 Node tests and 612 Bun tests passing (36 existing platform/tool-dependent skips). Existing unrelated Biome warnings remain; none are in the changed files. The four focused URL/theme tests passed. A real mixed JavaScript/TypeScript fixture was scanned using published Groma, then exported with the changed local Groma. At /site/architecture/blueprint/, the browser's Theme menu showed Blueprint. Selecting Auto added theme=auto, and reload kept Auto while the map and assets remained usable.

Implementer specification/quality review: all four AC have direct evidence. The browser session passes location to the existing URL module; one private pathTheme helper uses the existing theme validator; read and write share its path default so Auto overrides survive. No palette, exporter, scanner, OKF/C4 model, or compatibility code changed. Tests exercise wrong-theme and lost-choice failures without checking decorative text. The existing Web guide's unrelated task-pin edits will be left unstaged.

The final full-context review found no issue in the Groma change and recommended keeping path parsing inside the existing URL owner. The only finding was the Action Pages example deployment link; that correction is tracked in TASK-2 in the Action repository.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Groma now reads auto/light/dark/blueprint from architecture/{theme}/ publication paths through its existing URL-state owner. Explicit query choices override the path; absent path themes retain saved preferences. URL writing preserves overrides including Auto. Verified with four focused tests, the full repository check (16 Node and 612 Bun passes; 36 existing skips), and a real exported map in the browser. The release is deferred at the user's request; only source implementation is complete.
<!-- SECTION:FINAL_SUMMARY:END -->
