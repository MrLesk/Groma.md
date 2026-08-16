---
id: TASK-66
title: Edit architecture meaning with groma edit
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 19:46'
updated_date: '2026-08-16 21:10'
labels: []
dependencies:
  - TASK-63
references:
  - src/cli.ts
  - groma/README.md
  - docs/product-model.md
documentation:
  - docs/product-model.md
  - groma/README.md
priority: high
type: feature
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a person or agent runs `groma edit`, Groma updates authored meaning through the CLI. People and agents do not edit `groma/` files by hand. A new id is TASK-63. This command only changes meaning for an id that already exists.

`--description <prose>` is required except when `--plan` restates an observed id and you want the current lead prose copied as-is.

Three cases:

1. `groma edit <element-id> --description <prose>` — replace the lead prose (the paragraphs after the heading, before the next heading) on the document that currently owns that id: the planned file if the id is planned, otherwise the observed file. Frontmatter, heading, relationships, and other sections do not change.
2. `groma edit <element-id> --plan <plan-id> [--description <prose>]` — author a required change. The same id is restated in that plan and the box shows as planned until accepted. If that plan does not exist yet, Groma writes the same plan README TASK-63 would write. If the id is already a ghost in this plan, only its lead prose updates. If another plan already claims the id, the command fails. The restated file keeps the observed heading, kind, parent, and relationships, and omits `code` so `groma accept` still needs a scan match.
3. `groma edit <plan-id> --description <prose>` — set the plan README `## Outcome` body to that prose, creating the section if needed. The plan id and heading do not change.

Resolution: an element id first, else a plan id. `--plan` is only valid on an element. On success the command prints `ok` and the id, then exits 0.

Approved observed edit. `orders` is observed, body `Owns the order lifecycle.`, with `code` and an outgoing row. After `groma edit orders --description 'Places and tracks customer orders.'` the observed file has that new lead paragraph and the same frontmatter, heading, and relationships.

Approved restatement. Same `orders`, plan `next` does not yet claim it:

```text
groma edit orders --plan next --description 'Places an order through a guided checkout.'
```

writes `groma/plans/next/` if needed and a planned `orders` document whose id, kind, parent, and heading match observed, whose lead prose is the new sentence, whose relationships are copied, and which has no `code`. The merged world shows `orders` as `planned:next`.

Approved plan outcome. After `groma edit next --description 'The next release adds stock checks.'` the plan README contains:

```markdown
---
id: next
---

# Next

## Outcome

The next release adds stock checks.
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma edit <element-id> --description <prose> replaces only the lead prose on the document that currently owns that id and prints ok plus the id
- [x] #2 groma edit <element-id> --plan <plan-id> [--description <prose>] restates that id in the plan with no code, shows the box as planned, and creates the plan README if needed
- [x] #3 groma edit <plan-id> --description <prose> sets the plan README Outcome body to that prose
- [x] #4 An unknown id, a missing required --description, --plan on a plan id, a non-kebab plan id, or an id already claimed by another plan fails with a clear message, a nonzero exit code, and no writes
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
1. Document surgery in markdown-emitter.ts: export omitCode (empty code frontmatter), replaceLeadProse (replace paragraphs after H1 until next heading), setOutcomeSection (replace or insert ## Outcome after H1). Keep heading/frontmatter/later sections.
2. Export ensurePlanReadme from src/create.ts — same first-use README as create. No other create behavior change.
3. Add src/edit.ts editArchitecture. Fail before any write. Index observed + planned docs separately (keep both). Restatement path: groma/plans/${planId}/${architectureRelative(observed.sourceFilename)}. Copy observed source, omit code, optional new lead. Do not use renderObservedDocument (it drops relationships).
4. Wire edit in src/cli.ts: edit <id> --description <prose> --plan <plan-id>. Description is optional at Commander level; validate in edit.ts. Same try/catch as create.
5. product-model step 3 only: name the three edit cases.
6. test/fixtures/edit/ minimum world: shop, api, orders (with code + relationship to stock), stock. Empty plans. test/edit.test.ts node:test, temp copy per test, never live groma/.
7. Cover all ACs and the failure table. Stay <= 500 lines.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified with `node --import=tsx --test test/edit.test.ts test/create.test.ts` (10 pass) and `bun run typecheck`.

AC1: `groma edit orders --description` replaces only observed lead prose and prints `ok` plus `orders`. After restatement, the same command writes the planned owner.

AC2: `groma edit orders --plan next --description` writes the restated file without `code`, keeps heading/kind/parent/relationships, creates the first-use plan README, and `groma view --plain` shows `orders  component  Orders  planned:next`. Omitting `--description` copies current lead. An existing plan README is left alone.

AC3: `groma edit next --description` creates `## Outcome` matching the approved README, then replaces that body on a second edit.

AC4: unknown id, missing `--description`, `--plan` on a plan id, non-kebab plan id, and an id already claimed by another plan fail with the specified messages, a nonzero exit, and no writes.

Did not scan and did not add a live observed `edit` container.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-16 20:02
---
Tightened after review: named --description, approved observed/restate/outcome examples, restatement omits code so accept still needs a scan match.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`groma edit` updates authored meaning for an existing id: lead prose on the current owner, restatement into a plan without `code`, and plan README Outcome. Success prints `ok` and the id. Verified with `node --import=tsx --test test/edit.test.ts test/create.test.ts` (10 pass) and `bun run typecheck`.
<!-- SECTION:FINAL_SUMMARY:END -->
