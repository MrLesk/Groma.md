---
id: TASK-28.9
title: Draw nested boxes from components up
status: Done
assignee:
  - grok
created_date: '2026-08-15 16:25'
updated_date: '2026-08-15 16:38'
labels: []
dependencies: []
references:
  - docs/viewers/tui/index.md
  - docs/viewers/index.md
documentation:
  - docs/viewers/tui/index.md
parent_task_id: TASK-28
priority: high
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When someone runs `groma view`, the map is built from the inside out. Components keep their laid-out size and spacing. Each container is the box around its components. Each internal system is the box around its containers. Groma must look like that system box, not a tiny card the size of a person. People and external systems stay compact cards. `+` still enters and the camera still frames the current level; this task does not change keys or details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 At System Context, Groma is a system box large enough to enclose its containers, not a compact card the size of a person
- [x] #2 Components keep their laid-out size and spacing
- [x] #3 Each container is drawn around its components
- [x] #4 Each internal system is drawn around its containers
- [x] #5 People and external systems stay compact titled cards
- [x] #6 docs/viewers/tui/index.md describes this inside-out nested map
- [x] #7 Headless tests and an agent-tty 120x36 start view show Groma larger than a person card, with containers inside it
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
ELK already places components and encloses them in containers and systems. The TUI currently shrinks every context peer to a 21x5 card, so Groma looks like a person.

1. People and external systems stay compact titled cards centered in their projected bounds.
2. Components use their projected ELK bounds (actual size and spacing). Containers and internal systems use their projected ELK bounds as boundaries, not cards.
3. Draw the nest at every level: components, then container frames around them, then system frames around the containers. Do not hide containers or components at System Context. Camera still frames the current level.
4. Keep relationship visibility level-filtered so context does not draw every internal arrow.
5. Do not shove component cards around to force a 21x5 floor. Only separate overlapping person/external cards.
6. Update docs/viewers/tui/index.md and the headless frames. Confirm with agent-tty at 120x36 that Groma is larger than a person card and contains its containers.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ELK already nests components in containers in systems. The TUI was shrinking every context peer to a 21x5 card, so Groma looked like a person.

People and external systems stay titled cards. Components, containers, and internal systems keep projected ELK bounds. drawWorld paints components, then container frames, then system frames. People and externals are only drawn at System Context so they do not cover Groma's title after enter. Sibling components stay hidden at Components.

Cold simplicity deleted the unused compact molecule, paint pass, and DisplayRole member. Two boundary roles stay because they pick border style and paint order.

Verification:
- bun test test-bun/terminal-viewer.test.ts 9/9
- bun run check: tsc 7.0.2, architecture validate, 52 Node, 9 Bun
- agent-tty 120x36: System Context shows SYSTEM · Groma as a large box with containers inside and people/Git as cards; + shows Containers · Groma with CONTAINER · Core wrapping component boxes.

Reviews: simplicity FINDINGS applied, targeted re-review PASS, specification PASS, quality PASS.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view now draws the map from the inside out. Components keep their laid-out size and spacing. Containers are the boxes around those components. Internal systems are the boxes around those containers. Groma is that system box, not a person-sized card. People and external systems stay compact titled cards at System Context.

Verified by bun test test-bun/terminal-viewer.test.ts 9/9, bun run check, and an agent-tty 120x36 start plus + into Containers.
<!-- SECTION:FINAL_SUMMARY:END -->
