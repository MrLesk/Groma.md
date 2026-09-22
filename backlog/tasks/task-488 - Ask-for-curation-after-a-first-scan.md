---
id: TASK-488
title: Ask for curation after a first scan
status: Done
assignee:
  - '@claude'
created_date: '2026-09-22 21:35'
updated_date: '2026-09-22 21:53'
labels: []
dependencies: []
references:
  - src-welcome
  - shell
  - src-cli
  - instructions
modified_files:
  - src/empty-world.ts
  - src/viewers/web/chrome/empty.ts
  - src/agent-instructions.ts
  - src/cli.ts
  - test-bun/first-scan-curation.test.ts
  - docs/agent-instructions/index.md
  - docs/agent-instructions/inspect.md
  - docs/product-model.md
ordinal: 569000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A scan writes evidence, never prose, so its first map is a starting point. People take it for the finished architecture, and nothing in the browser, the scan report, or the agent guides says a coding agent should curate it. While the map has components but no element has a description or an overview, the browser map and a single groma scan say it is a first scan and point to a coding agent, and the agent guides tell agents to ask the user whether they want it curated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While the map has components and no element has a description or an overview, the browser map shows a compact, dismissible First scan notice that asks for a coding agent to curate the architecture; it disappears once any element has a description or an overview, and a past revision never shows it
- [x] #2 A single groma scan ends its report with the same next step while the architecture awaits curation
- [x] #3 In such a project groma agent-instructions opens with a first-scan note, and the agent guide and the managed AGENTS.md block tell agents to ask the user once whether to curate the architecture and to curate only after a yes
- [x] #4 Focused tests cover the check, the scan report line, the agent note, and the browser notice; bun run check passes
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
1. Add awaitsCuration(world) to src/empty-world.ts: components exist and no element has a description or an overview; add the First scan title and hint.
2. Browser: reuse the compact empty-state notice in src/viewers/web/chrome/empty.ts for the first-scan state; keep it dismissible, hidden for past revisions and in map-only view, and move it below the Iso, 2D and Layers bar.
3. CLI: after a single groma scan, print the same next step; groma agent-instructions without a guide name prints a first-scan note above the index.
4. Agents: one sentence in the managed AGENTS.md block and a rule in the guide index (ask once, curate only after a yes).
5. Docs in docs/agent-instructions/index.md, docs/agent-instructions/inspect.md and docs/product-model.md; focused tests in test-bun/first-scan-curation.test.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Signal: awaitsCuration(world) in src/empty-world.ts. A scan writes evidence, never prose, so a map whose components exist while no element has a description or a non-empty overview has not been curated by anyone; the first description or overview written by an agent or a person ends the state. The check is language- and scanner-independent (it reads only element prose) and reuses hasComponents, so an empty map and a map without components keep their existing notices.

Browser: the existing compact empty-state notice (src/viewers/web/chrome/empty.ts) shows First scan / Ask your coding agent to curate this architecture. It is dismissible for the page session, hides on live updates once curation starts, never shows for a past revision, and hides with the rest of the chrome in map-only view (F1 or hud=off), so embedded maps in talks stay clean. It moved from top 78px to 130px, below the Iso, 2D and Layers bar (top 74px, 44px tall) that covered its title; the no-components notice shares that position. The section label is now Map notice and the dismiss label Dismiss message, since the notice is no longer only about an empty map.

CLI: a single groma scan prints First scan. Ask your coding agent to curate this architecture. after its report while the state holds; groma scan --watch does not repeat it on every fold. groma agent-instructions without a guide name prints firstScanAgentNote above the index in such a project and nothing extra elsewhere (errors while loading, such as an uninitialized repository, count as no note). The managed AGENTS.md block now says: When it reports a first scan, ask the user whether they want you to curate the architecture. docs/agent-instructions/index.md adds the rule: ask once, curate only after a yes, do not ask again in the same conversation after a no.

Docs: docs/agent-instructions/index.md, docs/agent-instructions/inspect.md (scan row), docs/product-model.md (first-scan behavior). docs/viewers/web/index.md is left alone because five other tasks edit it.

Verified: test-bun/first-scan-curation.test.ts (check, notice markup, AGENTS.md block, scan line and agent note through the CLI in a temp project) passes; biome lint has no findings in these files; typecheck passes; Node tests pass; the bun suite has 4 failures in sheet routing and Vue scanning tests that belong to other sessions' work in progress (TASK-482, TASK-487) and do not load these modules. Checked in a browser: a raw scan of a demo project shows the notice below the view bar, and adding one description hides it live.

Final validation: bun run check passes on the last commit (50b83843) plus only this task's and TASK-490's changes in a separate clone (677 pass, 43 skip, 0 fail). In the shared working tree the suite shows 3 failures that belong to other sessions' uncommitted work (Vue scanning, route crossings). Browser check on the working tree: the notice shows on a raw scan, dismissing it keeps it hidden through a live update that is still a first scan, adding one description hides it, and ?hud=off never shows it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A first scan now says so. While the map has components but no element has a description or an overview, the browser map shows a compact, dismissible First scan notice (Ask your coding agent to curate this architecture), a single groma scan ends with the same line, and groma agent-instructions opens with a note telling agents to ask the user whether to curate; the managed AGENTS.md block and the guide index carry the ask-once rule. The notice now sits below the Iso, 2D and Layers bar, which used to cover it. Verified with test-bun/first-scan-curation.test.ts, an isolated bun run check (0 failures), and browser checks for showing, dismissing, hiding on curation, and map-only view.
<!-- SECTION:FINAL_SUMMARY:END -->
