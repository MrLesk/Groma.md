---
id: TASK-480.1
title: Choose and compare revisions from the header fields
status: Done
assignee:
  - '@claude'
created_date: '2026-09-21 21:25'
updated_date: '2026-09-23 18:48'
labels: []
dependencies: []
references:
  - 'https://claude.ai/artifact/R5cB83CFiS9ZNN3qUoK2WG'
  - revision-control
  - web-page
  - button
  - search-control
  - shell
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/atoms/chrome.ts
  - src/viewers/web/atoms/popover.ts
  - src/viewers/web/search/view.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/revision/control.ts
  - src/viewers/web/page.ts
  - docs/viewers/web/index.md
  - src/viewers/web/chrome/stats.ts
  - src/viewers/web/search/control.ts
parent_task_id: TASK-480
priority: high
type: feature
ordinal: 557000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The header hides the way into a comparison at the end of the commit list, shows two commit messages clipped at 17 characters inside one 360 px control, and changes an endpoint through a menu with Change start and Change destination buttons. Alex chose one box with a rule on each side of "vs.", each message its own field that becomes the commit search in place, and the words "or compare 2 revisions" at the right end of the open search. Nothing about comparing shows by default. Shared rules and frames: parent TASK and the design page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While browsing, the header shows one revision field as wide as its commit message and nothing about comparing.
- [x] #2 Opening a field turns it into the commit search in the same place and at the same width; only a newly selected commit's message changes the field's width. At 1080 px and below, where fields show a tag or short ID, the open search takes the whole box.
- [x] #3 While the search is empty it reads "Find a commit or message…" and "or compare 2 revisions" animates in after it: inside the field while the whole placeholder still fits beside the words, else just outside the field to its right. Typing removes those words. A single-snapshot export never shows them.
- [x] #4 Activating "compare 2 revisions" moves the search to the start field while "vs." and the viewed revision slide in beside it, and the × appears as cancel. Escape, the × and a click outside restore the browsing field and view.
- [x] #5 While comparing, start and destination are two fields in one box with a rule on each side of "vs.", followed by the ×, which ends the comparison and leaves the destination open. Each field shows its commit message and is as wide as that message.
- [x] #6 When the header is short, the world counts give way first, then Search down to 200 px, then both messages clip together. The project title never gives way.
- [x] #7 Activating a field turns it into the commit search at the same position and width while the other field stays in place. No pair menu, Change start, Change destination, "To:" row or Cancel button remains.
- [x] #8 The commit list sits directly under the active field with aligned left edges, stays there when the header reflows, disables the other endpoint, and for a start opens at the destination row so its parents are the next rows.
- [x] #9 The field search uses the Search input style: height, border, background, placeholder colour and focus ring.
- [x] #10 At 1080 px and below a field shows its exact tag, else its short ID, and both fit inside the box. Hover titles keep "{commitId} - {commitMessage}".
- [x] #11 It works with 400 commits in the list, with a working-tree endpoint, in Light, Dark and Blueprint, live and static, and with reduced motion.
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
1. Atoms first, no new look. The Search field style became the shared `.chrome-field` in atoms/chrome.ts (box, focus ring while the parent carries data-open, plain input, placeholder) and search/view.ts adopted it. The Search menu entrance keyframes moved to the popover atom as `.anchored-popover.animated`, so Search and the commit list share one animation.
2. revision/view.ts owns presentation. `#revision` is a `.chrome-field` box holding the history icon, one or two field buttons (commit message, a narrow name of tag or short ID, chevron), "vs." between two rules, one shared search input moved into the first or second slot by the order property, and the words "or compare 2 revisions". The anchored popover beside it holds only the error and the results, and the x stays after the box. The pair menu, Change start, Change destination, the "To:" row, Cancel and the "Compare from" footer are deleted.
3. revision/control.ts owns state: the authoritative revision or pair, plus which field is the search (revision, from, to, or none). paint() projects that onto data-open, data-editing and data-starting. Opening a field records the closed widths so the search takes the same slot and width; nothing grows on click. The compare words end the browsing search inside the box while the whole placeholder still fits beside them (measured with a canvas in the search's font), else they move just outside the box; on a narrow header (NARROW_HEADER in view.ts, shared by its CSS and the control) they stay inside because the search takes the whole box. "compare 2 revisions" switches editing to from, and "vs." plus the viewed revision slide in while the x cancels. Selection calls the existing load. Escape, the x and an outside click cancel. A new comparison start scrolls its list to the disabled destination row; typing and errors scroll the list back to its top. One ResizeObserver on the box keeps the list under its slot. Live refresh, busy state and the body tooltip are unchanged, and a live refresh repaints neither the list nor untouched fields.
4. page.ts owns the header give-way order as a flex row: world counts (zero demand, dropped whole under 150 px by a container query, with an inner span added in chrome/stats.ts), Search down to 200 px through a large shrink factor, then both messages clip together; the project name never shrinks. Up to 1320 px Search folds to its icon while a comparison is being started or the compare words stand outside a short field; at 1080 px and below fields show tag or short ID and Search may narrow to 120 px; at 1000 px and below Search also stays folded while comparing. search/control.ts focuses Search when its folded field is clicked.
5. docs/viewers/web/index.md: header, time machine and comparison paragraphs rewritten.
6. Tests: none new. The rule and its authority are header presentation and interaction approved by Alex on the design page. The concrete failures (list not under its field, a field jumping, words not leaving, the x not cancelling, overflow at narrow widths) are visual and there is no DOM harness for web controls; history listing, exact reads and selection retention stay covered by test-bun/web-revisions.test.ts.
7. Left for after TASK-477 and TASK-478 land, because they hold uncommitted edits in chrome/shell.ts and render.ts: the stale HTMLDetailsElement cast and the revisionSelect name at chrome/shell.ts:27, the dead grid declaration for #header at chrome/shell.ts:192, and renaming the option `control` to `box`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification (browser scripts against the real viewer, not the prototype): a static export of 7be945cf to 2dca898e with 400 real commits injected into its revision list, a single-snapshot export, and live `groma web` run from an isolated git worktree so the scanner never touched the shared tree.
- Browsing at 1440 px: one field 411 px wide with the whole message, Search 280 px, no compare words, no x.
- Open: the box keeps 449 px; live "Current working tree" grew 210 to 440 px (351, 421, 435, 439, 440 across 45 ms samples); placeholder and "or compare 2 revisions" present; typing "task-463" hid the words and cut 400 rows to 7; a scrolled list returned to its top on typing.
- compare 2 revisions: search in the start slot 260 px, "vs." and the viewed revision beside it, x titled Cancel comparison; Escape, the x and an outside pointerdown each restored the browsing field; with an older destination the list opened at the disabled destination row (scrollTop 635).
- Comparing: fields 216 and 212 px, Search 200 px; editing the destination put the search at the same x and width with the list left edge on the rule after "vs." (545 px); switching straight to the start kept both slots; the x ended the comparison on its destination.
- Errors: choosing an unbundled commit showed the message at the top with the list scrolled back, editing kept, busy cleared.
- Narrow: 1100 px Search folds to its 34 px icon while a field is open and nothing overlaps; 1000 and 900 px both short IDs read whole; clicking the folded Search opens it. Narrow names prefer tag, then short ID, then Working tree (bun -e on revisionFields).
- Single snapshot: no search input, no compare words, localized notice.
- Live: 788 rows, working tree to commit comparison opened with 25 changed elements, clicks on the box icon or padding no longer choose a revision, returning to Current working tree resumes live.
- Themes: Light, Dark and Blueprint exercised. Reduced motion: the page reduced-motion rules applied unconditionally gave animation-name none for the box, the words, the input and the list.
- bun run check: lint clean for the changed files, types clean, 650 pass, 38 skip, 0 fail.

Corrections: the cold simplicity review removed a guard, a dead width cap, a window resize listener, redundant CSS and a dead export, and clarified names and comments. The full-context review found the open box covering Search between 1081 and 1320 px, IDs overflowing under 985 px, an error hidden in a scrolled list, a cancel that could not stop an in-flight load, removed focus rings and a static input label; all fixed. Final click-through found a delegated click matching body[data-revision], so the x and clicks on the box chose the working tree; the handler now matches .revision-option.

Decision kept against the simplicity review: the world counts leave whole through a container query, because restoring the 1400 px cutoff without it shows a clipped fragment beside long commit messages, and moving the cutoff to 1700 px hid counts the working-tree view has room for.

Open point for Alex: acceptance criterion 2 says a short field grows to 440 px. Between 1081 and 1320 px the header has no room for that even with Search folded (383 px at 1100 px), so it grows as far as the header allows. Criterion 2 is left unchecked until its wording is confirmed.

2026-09-23 owner decisions on criterion 2: "the input should not grow as soon as we click on it. it feels glitchy. the input can grow after we select the commit to show the commit message". A prototype of three answers for the short default field (min width; stay short and hide the placeholder; compare words outside) was shown in the browser; the owner chose the words outside ("c is perfect"). Implemented: opening keeps the field's width (the 440 px growth and its keyframes are gone, and a comparison endpoint no longer grows to 200 px); the compare words end the browsing search inside the box while the whole placeholder still fits beside them, measured with a canvas in the search's font, else they move just outside the box; a narrow header (NARROW_HEADER in view.ts, shared by its CSS and the control) keeps them inside because its open search takes the whole box. The 1320 px Search fold now applies only while a comparison is being started or the words stand outside a short field, so editing a comparison endpoint no longer moves the box. Criteria 2 and 3 reworded to match. Verification on a static export of 7be945cf to 2dca898e with the default field simulated as Current working tree: at 1920, 1440 and 1320 px a long field and both comparison endpoints keep their width and position when opened; a short field keeps its width and slides left by the words' width at 1440 and 1920 px, as in the approved prototype; at 1081 to 1100 px the words outside clip a field by 7 to 13 px through the header's give-way order; at 1000 and 900 px the narrow mode is unchanged. Reduced motion: the words outside get no animation. bun run check exit 0 (16 Node pass; 705 Bun pass, 43 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @claude
created: 2026-09-22 20:29
---
TASK-484 coordination (touch pinch): I change only the Map rows inside helpControl in src/viewers/web/page.ts and the gesture sentence under What you can do in docs/viewers/web/index.md. Your hunks stay untouched. Please stage only TASK-480.1 hunks in those files.
---

author: @claude
created: 2026-09-23 07:12
---
TASK-494 coordination: in docs/viewers/web/index.md I change only the glow sentences under What you can do (the paragraph starting 'Component selection and focused flow endpoints share one glow'). Your paragraphs stay untouched, and I stage only my own hunks in that file.
---

author: @claude
created: 2026-09-23 08:02
---
TASK-494 update: in docs/viewers/web/index.md I now also change the sentence about the selected component's breathing glow (after 'Other components are dimmed while a component is selected.') and the flow-endpoint glow sentence in the flow reader paragraph, besides the glow paragraph under What you can do. Your hunks stay untouched and I stage only mine.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web header now shows one revision field while browsing and two fields around "vs." while comparing, each only as wide as its commit message. A clicked field becomes the commit search in place, keeping its width, with the Search input look; its list sits directly under it. The way into a comparison is the words "or compare 2 revisions", which end the empty search inside the field, or stand just outside a field too short to hold them beside the whole placeholder, instead of a footer action at the end of the commit list. Only a newly selected commit's message changes a field's width. The x still ends a comparison and also cancels a pending one. Narrow windows show tag or short ID, and there an open search takes the whole box. Built on shared atoms (.chrome-field, one popover entrance), with motion from the chrome variables and off under reduced motion. Verified by browser scripts on a static pair with 400 commits, a single-snapshot export and an isolated live run, at 900 to 1920 px in Light, Dark and Blueprint, plus position and width checks of every opening at six widths; bun run check passes (705 pass, 43 skip, 0 fail). The owner confirmed it done on 2026-09-23.
<!-- SECTION:FINAL_SUMMARY:END -->
