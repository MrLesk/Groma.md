---
id: TASK-62
title: Print the world as plain text from groma view
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 19:46'
updated_date: '2026-08-16 20:39'
labels: []
dependencies: []
references:
  - src/cli.ts
  - docs/product-model.md
  - docs/viewers/tui/index.md
documentation:
  - docs/product-model.md
priority: high
type: feature
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an agent or a person runs `groma view --plain`, or runs `groma view` with no target and stdout is not a TTY, Groma prints the merged world as plain text and does not start the TUI. On a TTY, `groma view` with no target still starts the map.

This is the world read surface for agents. It is a projection of the same world core already gives the TUI, not a TypeScript scan dump and not the `observation.txt` tree.

The print is a one-pass index. People, then internal systems, then external systems; children nest by indent and sort by id. Each element is a short block: handle, kind, readable name, then the lead paragraph and that element's authored outgoing relationships, then its children. A `plans` section follows when any plan exists. A kind-count line closes the print.

Line grammar:

```text
<id>  <kind>  <Name>  [external]  [planned:<plan-id>]  [file]
  <lead paragraph>
  ->  <description>  <target-id>
  <child block>
```

Only authored outgoing edges appear, on the source. No promoted ancestor routes and no person-launcher expansion. The first `code` file is listed when present; the symbol is not. Further prose, incoming edges, extra `code` rows, and a single record are TASK-65.

This task covers only the no-target world print.

Approved example (a fixture world, not live `groma/`):

```text
buyer  person  Buyer
  Pays for goods.
  ->  uses  shop
shop  system  Shop
  The store the buyer uses.
  api  container  Api
    HTTP API.
    orders  component  Orders  src/orders.ts
      Owns the order lifecycle.
      ->  talks to  stock
    stock  component  Stock  planned:next
      Checks stock before placing an order.
  web  container  Web
    Storefront.
git  system  Git  external
  Versions the Markdown.

plans
next
  The next release adds stock checks.
  stock

1 person, 2 systems, 2 containers, 2 components
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma view --plain with no target prints the merged world from core in the approved index shape: id, kind, name, lead paragraph, and authored outgoing edges on the source, including people
- [x] #2 Planned ghosts are marked planned:<plan-id> and counted in their kind; a plans section lists each plan outcome and its remaining ghost ids
- [x] #3 When stdout is not a TTY and no target is given, groma view prints that same text and does not start the TUI
- [x] #4 The printed ids, names, origins, authored relationships, and first code files are the same world core supplies to the TUI; tests use a fixture world, not live groma/
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
1. Add a small formatter module (e.g. src/plain-world.ts) that takes the merged annotated architecture (one element per architecture id; planned wins when an id is restated) plus plan README outcome prose, and prints the approved index.
2. Load through core (loadArchitecture + existing annotate/merge). Do NOT run ELK / layoutArchitectureWorld / start the TUI for the plain path. Extract a no-layout load if loadArchitectureViewModel always layouts — the user action does not need a map.
3. Wire groma view --plain and non-TTY groma view (no target) in src/cli.ts only. If process.stdout.isTTY and not --plain, keep the existing TUI start.
4. Update docs/product-model.md step 1 only: mention --plain / non-TTY print. Do not rewrite the rest of the file.
5. Fixture-test in test/ (node:test, like test/cli-scan.test.ts). Own a new minimum fixture under test/fixtures/ that exhibits the approved example. Do not load live groma/. Assert the projection (ids, names, planned mark, outgoing on source, plans section, counts) — not live product names.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Print path: loadArchitecture + annotateArchitecture (no ELK), then formatPlainWorld. One element per architecture id; planned wins. Authored outgoing edges stay on the winning source. Plan README ## Outcome first paragraph plus remaining planned ids.

Fixture test/fixtures/plain-view owns the approved example. Observed stock.md exists only so orders can author talks-to in the observed revision; planned stock wins in the print.

Verification:
- node --import=tsx --test test/plain-world.test.ts test/cli-view.test.ts → 5 pass
- bun run typecheck → pass
- bun src/cli.ts view --plain (cwd test/fixtures/plain-view) prints the approved index and exits 0
- bun src/cli.ts view with piped stdout prints the same text, exits 0, no TUI
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-16 19:55
---
Tightened after review: approved example is a fixture merged-world dump, not the TypeScript observation.txt. World print is only when no target is given.
---

created: 2026-08-16 20:23
---
Replaced the observation.txt tree-plus-appendix dump with a one-pass index: meaning and outgoing edges on each element, plus a plans section.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view --plain, and groma view when stdout is not a TTY, print the merged world as a one-pass index and do not start the TUI. A TTY still opens the map. Verified with fixture tests (approved example, planned-wins merge, CLI --plain and piped view) and typecheck.
<!-- SECTION:FINAL_SUMMARY:END -->
