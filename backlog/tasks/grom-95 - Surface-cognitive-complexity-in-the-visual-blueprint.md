---
id: GROM-95
title: Surface cognitive complexity in the visual blueprint
status: Done
assignee:
  - '@codex'
created_date: '2026-07-21 18:19'
updated_date: '2026-07-21 19:15'
labels:
  - web
  - topology
dependencies: []
modified_files:
  - >-
    backlog/tasks/grom-95 -
    Surface-cognitive-complexity-in-the-visual-blueprint.md
  - groma/components/groma/web/client/api.ts.md
  - groma/components/groma/web/client/root-discovery.ts.md
  - >-
    groma/evidence/9080456d7c02f714535c79e12ec95bf94300adecfd94940588720b677f9a96a4.json
  - groma/transaction-state.json
  - src/application/contracts.ts
  - src/application/operations.ts
  - src/host/tests/reconciliation-local.test.ts
  - src/web/client/api.ts
  - src/web/client/app.tsx
  - src/web/client/canvas.tsx
  - src/web/client/graph.ts
  - src/web/client/root-discovery.ts
  - src/web/client/spec.tsx
  - src/web/tests/model.test.ts
  - src/web/tests/snapshot-api.test.ts
priority: high
type: enhancement
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give readers an evidence-grounded cue for where a TypeScript/Bun codebase is hardest to follow. GROM-92 already persists scanner-measured per-file Cognitive Complexity, but the visual blueprint currently drops it before rendering. Surface the existing scalar with its scanner provenance so it helps a reader choose what to inspect without becoming canonical intent, a role classification, or a cross-scanner comparison.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bounded web reads expose cognitive-complexity evidence with its scanner provenance without adding it to canonical component intent or the mutation model.
- [x] #2 At a level containing comparable TypeScript/Bun file components, the blueprint makes the strongest cognitive-complexity evidence easy to find and shows the exact measured score in plain language.
- [x] #3 Components with absent, ambiguous, or non-comparable scanner evidence remain unranked; the interface never combine scores from different scanners or invent a complexity score.
- [x] #4 Focused web-model and API coverage proves the comparable, unavailable, and mixed-provenance cases, and the self-blueprint demonstrates the signal on a scanned Groma file.
- [x] #5 On first load, the web client consumes at most five existing root pages until it finds an owned root, then retains the existing explicit continuation for any remaining roots so external packages cannot hide the system plate.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Project the existing current Cognitive Complexity observation, with project and exact scanner provenance, into the existing bounded component and blueprint-export views without changing canonical component state or scanner behavior.
2. Carry that optional summary through the live API and read-only snapshot adapter.
3. In the visual graph, choose one comparable same-provenance group at the current level, show its scores on the affected file cards, and name the highest measured file in the existing level readout and component detail.
4. Continue existing bounded root pages only until an owned root is available (at most 100 roots), retaining the explicit overflow control and leaving shared query ordering unchanged.
5. Cover projection, comparable/mixed/absent graph cases, root continuation, snapshot behavior, and a fresh self-scan before proportionate checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope amended with the coordinator's explicit approval: real large scans can return many external roots before the owned project root, so the UI will make bounded client-side continuation until one owned root is present.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-07-21 18:38
---
Verification note: the feature passes a fresh isolated self-scan (599 records) and static export, but the checked-in self-blueprint cannot currently be refreshed. Main's existing evidence retains a binding for removed src/cli/blueprint-html.ts (ent_285e78427fbf837690b7f6133ad2701c) and two deleted relationships, so scan correctly fails closed with reconciliation-binding-missing. A separate bounded repair is being handled; this task will not rewrite evidence or weaken reconciliation.
---

author: @codex
created: 2026-07-21 19:02
---
Post-repair verification: after GROM-100, two consecutive self-scans completed at generation 19 (603 records); the second made no changes. Bounded component and blueprint-export reads report official.typescript/default@1.0.0 evidence for root-discovery.ts (1) and api.ts (37). A static 95-component export contains the cognitive evidence and the highest-score readout. This completes the previously blocked self-blueprint criterion.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Surfaced scanner-measured cognitive complexity with exact project and scanner provenance through bounded live and static blueprint reads. The visual layer ranks only comparable evidence, highlights the highest measured file, and discovers an owned root within five bounded pages. Verified by 508 tests, a deterministic repeated self-scan, a 95-component static export, two Terra reviews, Claude, and green CI; merged as PR 91.
<!-- SECTION:FINAL_SUMMARY:END -->
