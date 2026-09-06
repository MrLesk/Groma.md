---
id: TASK-94
title: Add an OpenClaw C4 fixture from product docs
status: Done
assignee:
  - grok
created_date: '2026-08-18 20:06'
updated_date: '2026-08-18 20:08'
labels: []
dependencies:
  - TASK-93
documentation:
  - backlog/docs/doc-2 - OpenClaw-upper-band-semantic-layout.md
modified_files:
  - test/fixtures/openclaw-view
  - test-bun/openclaw-view.test.ts
  - test-bun/helpers.ts
priority: high
type: feature
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma needs an upper-band fixture that is a real product, not Shop and not OpenClaw’s old scanner dump. Author a Groma 3 C4 world from OpenClaw’s product docs: one operator, OpenClaw, Gateway and sibling containers, WhatsApp, Telegram, and Anthropic. Put it under test/fixtures so loaders never read the live OpenClaw tree or groma/components. Then run the semantic collapse and pin-layout evaluation on that world.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 test/fixtures/openclaw-view holds a loadable Groma 3 observed world with kebab-case ids, kinds, parents, and GFM relationships
- [x] #2 The world is authored from OpenClaw product docs: operator, OpenClaw, six containers, WhatsApp, Telegram, Anthropic; no npm stubs or hashed ent_ ids
- [x] #3 loadArchitectureViewModel loads the fixture and layoutArchitectureWorld succeeds
- [x] #4 Semantic Context sizes OpenClaw for its name, not the nested plate; pin-on-Enter keeps OpenClaw and neighbor origins
- [x] #5 An evaluation note records counts and layout measurements for Codex
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
1. Write test/fixtures/openclaw-view/groma observed Markdown from the docs-based C4 proposal (operator, OpenClaw, six containers, three externals).
2. Load it through core and run world-layout, semanticView, fresh ELK, and pin-on-Enter.
3. Add a fixture test that the world loads and Context OpenClaw is name-sized with stable pinned origins.
4. Record measurements in the OpenClaw evaluation doc.
5. Do not read or copy openclaw/groma/components.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Authored from OpenClaw docs (gateway architecture + README). Ignored openclaw/groma/components. 11 elements, 13 relationships. loadArchitectureViewModel succeeds. Context OpenClaw 44×40 vs world 297×180. Pin keeps origins. Pinned plate overlaps Anthropic and Telegram. bun test test-bun/openclaw-view.test.ts 2 pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added test/fixtures/openclaw-view, a Groma 3 C4 world from OpenClaw product docs (operator, OpenClaw, six containers, WhatsApp, Telegram, Anthropic). Semantic Context sizes OpenClaw 44×40; pin-on-Enter keeps neighbor origins. Measurements in backlog doc-2. Verified with bun test test-bun/openclaw-view.test.ts (2 pass).
<!-- SECTION:FINAL_SUMMARY:END -->
