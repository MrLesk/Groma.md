---
id: TASK-480
title: Review architecture changes in the web comparison
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 21:25'
updated_date: '2026-09-26 15:57'
labels: []
dependencies: []
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
  - render
  - map
  - settings-control
  - shell
  - revision-control
  - camera
  - organisms-hierarchy
  - web-page
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/iso/camera/session.ts
  - src/viewers/web/comparison/control.ts
  - src/viewers/web/render.ts
  - src/viewers/web/iso/painting/style.ts
  - src/viewers/web/atoms/theme.ts
  - src/viewers/web/chrome/shell.ts
  - src/viewers/web/revision/control.ts
  - src/viewers/web/chrome/motion.ts
  - src/viewers/web/organisms/hierarchy.ts
  - docs/viewers/web/index.md
  - src/viewers/web/page.ts
priority: high
type: feature
ordinal: 556000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-463 delivered comparison, but a reviewer still cannot see how much changed, list it, or step through it. The way into a comparison sits at the end of the commit list: with 400 commits that list is 21,260 px tall inside a 460 px popup. Commit messages clip at 17 characters inside one 360 px control, the word diff joins removed and added words ("WritesPackages"), and the map shows through the diff pane.

Alex settled the design on 2026-09-21 against a prototype laid over the exported viewer. The design page holds the frames and the rules. This parent owns the shared rules. Each child owns one surface. Work the children in order.

## Shared rules

- Every fact comes from the comparison payload the browser already receives: component status, before, after, files with additions and deletions, and relationship status. No History, export, or stored-metadata change.
- Live and static delivery behave the same. Light, Dark and Blueprint all work.
- People name commits by message. Commit IDs appear only where width forces it.
- A control is as wide as its content. Spare header width stays empty.
- Reuse the existing web atoms and owners before writing anything new: the anchored popover and its options, the Search field input style, chrome buttons, tabs, the floating map bar surface of the Tasks panel, the shared source diff renderer, hierarchy rows and their selection, and the camera fit active tasks use. A new component needs a reason an existing one cannot serve.
- Everything the user operates moves smoothly: fields that open, widen or split, words and lists that appear, toggles, the stepper position, rows entering and leaving, pane content changes. Use the existing chrome motion and ease variables, and keep every animation off under reduced motion.
- A commit list always sits directly under the field it belongs to, left edges aligned, and follows that field when the header reflows.
- TASK-463 colours, identity rules and change rules stay.

## OKF and C4

Nothing is stored and no element or level is added. Each addition is a view over the comparison History already derives. An ordinary Markdown or OKF reader is unaffected.

## Owner decisions confirmed on 2026-09-26

- Emphasize changes during comparison: unchanged buildings and routes recede to about 40% opacity, and opening a comparison fits changed components. This overrides the TASK-463 context styling rule. The parent owns this integration.
- Use a clear change-color system with good contrast in Light, Dark and Blueprint. Map, status controls and code diffs share the same Added, Modified and Removed roles. Lime is approved for Blueprint Added when it meets those conditions; green selection remains distinct.

## Verify on the real viewer

A small comparison (1 to 5 changes), an empty comparison, a 1000 px window with both panes open, a single-snapshot export, 400 commits in the list, Dark and Blueprint, and a live working-tree endpoint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A reviewer can open a comparison from the header, see what changed as a counted list, step through every change, read why each component is Modified, and read its source diffs, through the completed children.
- [x] #2 The children behave the same in live and static delivery and in Light, Dark and Blueprint.
- [x] #3 Every check under Verify on the real viewer passes on the finished work.
- [x] #4 The shared rules on reuse, motion and commit list placement hold in every child.
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
Complete children 480.2 through 480.5 in order using existing comparison facts and web owners. Integrate approved context fading, changed-component camera fit, and shared theme colors in the parent. Verify each supported flow, run the repository check, perform one cold simplicity review, then implementer specification and quality reviews and one final full-context complexity review. Update public viewer documentation and record evidence before finalizing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
After TASK-477 and TASK-478 land, clean the leftovers TASK-480.1 could not touch in their files: the HTMLDetailsElement cast and the revisionSelect name at src/viewers/web/chrome/shell.ts:27, the dead grid-template-columns declaration for #header at chrome/shell.ts:192 (the header is a flex row now), and rename the createRevisionControl option `control` to `box`.

Alex authorized driving TASK-480 to completion on 2026-09-26, including context fading/camera emphasis and consistent accessible change colors across all three themes.

Required 1000 px browser verification reproduced a revision-search width of 12 px while its compare entry overflowed the field. Extended the existing compact header Search rule to all open revision fields below 1080 px; this is a parent shared-rule integration fix. No new test: visual layout is verified in the real browser, and the existing revision behavior tests cover search and endpoint selection.

Cold simplicity review: no blocking findings. Applied its two small deletions: the redundant filter-callback update and duplicate reasons cleanup. Focused comparison/selection checks still pass (14 tests). Implementer specification review traced each child criterion through the integrated viewer. Quality review followed revision selection → History payload → shared comparison projection/filter state → existing hierarchy/map/details/source owners. New tests cover incorrect filtering/counts/navigation, source-only tab defaults, and prose presentation without freezing decorative text. No unresolved scope-backed defect; documentation explains ownership and user flow. Browser evidence: 400 commit options in a 460 px list aligned to its field; header search/Enter opens comparison; J in revision search leaves selection unchanged; filters reset after leaving/re-entering comparison; empty pair shows No changes and no bar; real single-snapshot export has no comparison action. At 1000 px the header fix keeps compare text inside its field. Source Back restored tab=how and scrollTop=791.5 after stepping between two changed files. Reduced-motion emulation reports zero filter transition duration and removes filtered rows immediately. Shared status text contrast on theme paper: Light minimum 4.87:1, Dark 7.38:1, Blueprint 8.49:1. Opaque reader backgrounds match theme paper in all three themes. Real isolated two-commit export and live working-tree comparison both open source-only changes on How it is built; a subsequent owned-source edit refreshed live totals from +1/−1 to +3/−1 without reload.

Final full-context complexity review passed with no blocking findings or material simplification recommendations. It confirmed clear ownership from revision selection through comparison tree/filter state to existing hierarchy, map, details and source owners, without new OKF/C4 concepts. Final bun run check passed: 752 Bun tests, 16 Node tests, 48 skips, zero failures. git diff --check passed. Regenerated the real comparison and single-snapshot exports from the finished code; final comparison opens source-only details on How it is built and reports no browser console errors. All changed source/test files remain below 500 lines. The accepted changes are technology-independent viewer behavior derived from existing comparison facts; no filesystem, scanner, History or stored-schema expansion was needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed architecture comparison review: counted Changes/All hierarchy, shared status filters and J/K navigation, Modified explanations and readable prose, opaque source readers with changed-file stepping, and approved map fading/camera focus. Shared theme colors align map and code diffs, including Blueprint lime Added. Reused existing web owners and documented the flow. Verified the full browser matrix on real viewer payloads and live/static delivery; repository check passed with 768 passing tests and no failures. Required reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
