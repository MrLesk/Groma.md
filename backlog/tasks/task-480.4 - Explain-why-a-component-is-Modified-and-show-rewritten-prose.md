---
id: TASK-480.4
title: Explain why a component is Modified and show rewritten prose
status: Done
assignee:
  - '@codex'
created_date: '2026-09-21 21:25'
updated_date: '2026-09-26 15:57'
labels: []
dependencies:
  - TASK-480.3
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
  - organisms-details
  - render
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/comparison/details.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/web/url.ts
  - src/viewers/web/render.ts
  - test-bun/revision-comparison.test.ts
  - docs/viewers/web/index.md
parent_task_id: TASK-480
priority: high
type: feature
ordinal: 560000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A Modified badge gives no reason. When only owned source changed, the default tab shows nothing different. Heavily rewritten prose becomes unreadable because removed and added words alternate and join ("WritesPackages", "savedowns"). Shared rules and frames: parent TASK and the design page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Modified component shows one line under its title that starts with "Changed:" and names what changed: description, name, technology, parent, group, status, draft, ownership, "N files +a −d" and "N relationships". An item that lives in a tab opens that tab.
- [x] #2 Details open on How it's built when only owned source or ownership changed and the URL names no tab.
- [x] #3 Description and overview keep word marks while under half of their text changed. Past that they show the new text under Now and the old text under Before. Text that exists only in the destination shows as Added, text that exists only in the start as Removed.
- [x] #4 Adjacent removed and added words are separated by a space.
- [x] #5 Added and Removed components keep the TASK-463.3 content rules.
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
1. Derive concise changed-field reasons and a source-only default tab from ComponentChange, without changing History status rules. 2. Render clickable reasons below the component title; preserve explicitly requested tabs. 3. Render small prose edits as separated word marks, large rewrites as Now/Before and newly added/deleted text with labels. Tests: AC 1-4 require correct reasons, source-only default and readable rewrites; history tests only classify Modified, so add focused pure presentation tests to the existing comparison fixture coverage. Verify details and tab links in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fourteen focused comparison/selection tests pass, including explicit tab round trips, source-only defaults, field reasons and text-diff mode/spacing. TypeScript and Biome pass. Browser confirmed Changed: description, 1 file +1 −1, 3 relationships, and the file reason opens How it is built and updates tab=how. Added/Removed still show their complete content. Search and revision transitions use the same source-only tab rule.

Parent TASK-480 integration is verified: live and static delivery, all three themes, small/empty comparisons, 1000 px layout, a single-snapshot export, 400 commits, reduced motion and live owned-source refresh. Final repository check passed (752 Bun tests, 16 Node tests; 48 skips; zero failures). Cold simplicity, implementer specification/quality and final full-context complexity reviews have no blocking findings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Modified components explain their changes with tab links. Source-only changes open build evidence unless an explicit tab was requested. Large rewrites use readable Before/Now text; small replacements keep separated word marks. Verified by fourteen focused tests, types/lint and browser reason-link navigation.
<!-- SECTION:FINAL_SUMMARY:END -->
