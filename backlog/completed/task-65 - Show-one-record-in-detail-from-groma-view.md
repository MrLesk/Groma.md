---
id: TASK-65
title: Show one record in detail from groma view
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 19:46'
updated_date: '2026-08-16 20:58'
labels: []
dependencies:
  - TASK-62
references:
  - src/cli.ts
  - docs/product-model.md
  - groma/README.md
documentation:
  - docs/product-model.md
priority: high
type: feature
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an agent or a person runs `groma view <id|path>`, Groma prints one record as plain text and does not start the TUI. `--plain` is allowed and does not change that output. A TTY with no target still starts the map (TASK-62).

Resolution order for the target: an element id, else a plan id, else a repository-relative source file that matches an element's `code` file.

- An element id prints that element's card: id, kind, parent, origin, plan id when planned, code references when present, authored body prose, and authored outgoing relationships as `->  <description>  <target-id>` (the same relationship token as TASK-62).
- A plan id prints the plan, its Outcome prose, and the ghost ids still in the plan. A plan with no remaining ghosts prints that it is complete.
- A source file prints the one element whose `code` file matches that path.

An unknown target fails with a clear message and a nonzero exit code. Several elements sharing the same `code` file also fail that way.

Approved planned element (`groma view stock` in the TASK-62 fixture world):

```text
stock
kind: component
parent: api
origin: planned
plan: next

Checks stock before placing an order.
```

Approved observed element with code and an outgoing row (`groma view orders`):

```text
orders
kind: component
parent: api
origin: observed
code: src/orders.ts

Owns the order lifecycle.

->  talks to  stock
```

Approved plan with remaining ghosts (`groma view next`):

```text
next
kind: plan

The next release adds stock checks.

ghosts
stock
```

Approved complete plan (no remaining ghosts):

```text
next
kind: plan

complete
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma view <element-id> prints the approved element card and does not start the TUI; --plain is the same output
- [x] #2 groma view <plan-id> prints the plan outcome prose and remaining ghost ids, or that the plan is complete
- [x] #3 groma view <repo-relative-file> prints the one element whose code file matches; several matches fail with a clear message and a nonzero exit code
- [x] #4 An unknown target fails with a clear message and a nonzero exit code; resolution is element id, then plan id, then code file
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
1. In `src/plain-world.ts`, export `formatPlainRecord` / `renderPlainRecord` returning `{ ok: true, text } | { ok: false, message }`. Reuse winningElements, parentArchitectureId, outgoingEdges, planOutcomes. Do not run ELK/TUI.
2. Element card: id, kind, parent, origin, plan (if planned), first code file, description, then `->  description  target-id`. Omit absent fields. No name, external, incoming, extra code rows, extra body sections.
3. Plan card: approved remaining-ghosts shape; if no remaining ghosts print only `complete` (even if Outcome exists).
4. Resolution: winning element id; else plan id; else winning elements whose any `code[].file` equals the target exactly. 0 file matches → `unknown target: <target>`. 2+ → `several elements share <target>`. First code.file on the card; every code.file for lookup.
5. `src/cli.ts`: `.argument('[target]', …)`. If target is set, print the record and return BEFORE TTY/--plain/TUI. Failures: stderr, empty stdout, exitCode 1. `--plain` does not change a record.
6. product-model step 1 only: one sentence that a target prints one record and does not start the TUI.
7. Tests reuse `test/fixtures/plain-view` unchanged. Extend `test/plain-world.test.ts` and `test/cli-view.test.ts`. Construct complete-plan, collision, unknown, and element-id-beats-plan cases. CLI: four fixture targets, --plain parity, unknown, temp-tree collision. Assert no `System Context`. Never load live `groma/`.
8. Existing no-target world dump tests must still pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented in src/plain-world.ts: formatPlainRecord/renderPlainRecord resolve a winning element id, else a plan id, else a unique winning code[].file. Element cards omit absent fields and print first code.file plus authored outgoing -> description target-id. A plan with no remaining ghosts prints only complete. CLI prints that record before TTY/--plain/TUI; failures go to stderr with empty stdout and exit 1.

Simplicity review: entry is groma view <target>; work is one resolve-and-format pass over the already-merged world; result is one card or a short failure. No ELK/TUI. Stayed in plain-world.ts (277 lines). No extra module or fallback.

Validation: node --import=tsx --test test/plain-world.test.ts test/cli-view.test.ts (13/13). bun run typecheck. Fixture CLI: stock, orders, next, src/orders.ts, and stock --plain match the approved cards and do not print System Context. no-such prints unknown target: no-such on stderr, empty stdout, exit 1. No-target --plain still prints the world dump.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-16 19:55
---
Tightened after review: a target always prints one record, never the TUI. Added approved cards and file-match collision.
---

created: 2026-08-16 20:23
---
Relationship lines now use the same -> description target-id token as TASK-62.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view <id|path> prints one record as plain text and does not start the TUI. --plain is the same card. Resolution is winning element id, then plan id, then a unique code file. Unknown and colliding file targets fail with a short stderr message and exit 1. A plan with no remaining ghosts prints complete. Verified with fixture and constructed tests (13/13), typecheck, and fixture CLI cards matching the approved examples.
<!-- SECTION:FINAL_SUMMARY:END -->
