---
id: TASK-95.2
title: Draw OpenClaw Context as an SVG campus
status: Done
assignee:
  - '@grok'
created_date: '2026-08-18 20:48'
updated_date: '2026-08-18 21:32'
labels: []
dependencies:
  - TASK-95.1
references:
  - test/fixtures/openclaw-view
documentation:
  - docs/viewers/web/index.md
modified_files:
  - src/viewers/web/campus-svg.ts
  - src/viewers/web/server.ts
  - test-bun/campus-svg.test.ts
  - docs/viewers/web/index.md
parent_task_id: TASK-95
priority: high
type: feature
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone opens the OpenClaw Context proof, Groma shows the campus as SVG: named systems, people, and external systems, plus container underlay inside OpenClaw. Titles are screen-space type, not photographed onto world planes.

This is the web proof of the city contract. It does not change TUI paint, add cone arrows, or redo chrome.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An SVG of OpenClaw at Context names Operator, OpenClaw, WhatsApp, Telegram, and Anthropic
- [x] #2 OpenClaw's six containers appear as unnamed underlay inside the OpenClaw wrapper
- [x] #3 Titles are screen-space and stay sharp; they are not canvas textures on world planes
- [x] #4 People and external systems are marks, not campus-sized plates
- [x] #5 The proof uses the city contract from TASK-95.1
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
Add a focused SVG campus from semanticView. Do not change TUI, city contract modules, chrome, or the Three.js city.

1. Add campusSvg(view) in src/viewers/web/campus-svg.ts. Draw every item as a rect at item.bounds. Emit SVG <text> only for named and mark. Leave underlay untitled. Titles are SVG text, not CanvasTexture.
2. Keep the hook tiny: GET /context.svg returns campusSvg(semanticView(world, { level: 'context' })).
3. Tests load test/fixtures/openclaw-view through loadArchitectureViewModel, call semanticView at context, then campusSvg. Assert Operator/OpenClaw/WhatsApp/Telegram/Anthropic are titled; the six OpenClaw containers are untitled underlay shapes inside the OpenClaw wrapper; mark rects use semantic mark bounds, not the world person plate.
4. State in docs/viewers/web/index.md that Context is this SVG campus.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented campusSvg(view) in src/viewers/web/campus-svg.ts. Rects use semantic item.bounds. SVG <text> titles only for named and mark. Underlay is untitled. GET /context.svg serves campusSvg(semanticView(world, { level: 'context' })). Three.js city, chrome, and TUI untouched.

Simplicity: dropped the CSS block (fills live on the rects so underlay is visible) and folded the texture-vs-text assertions into the title test.

Verification:
- bun test test-bun/campus-svg.test.ts test-bun/web-live.test.ts — 6 pass
- bunx tsc --noEmit — clean

Look at it: from test/fixtures/openclaw-view run `bun ../../../src/cli.ts web` and open /context.svg.

Spec review: compliant. Quality review: approved. Orchestrator re-ran bun test test-bun/campus-svg.test.ts — 4 pass. bunx tsc --noEmit clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
OpenClaw Context is an SVG campus from semanticView: titled named systems and marks, untitled container underlay, mark bounds not world plates, titles as SVG text. Served at GET /context.svg. Verified with bun test test-bun/campus-svg.test.ts (4 pass) and bunx tsc --noEmit. Spec and quality reviews approved.
<!-- SECTION:FINAL_SUMMARY:END -->
