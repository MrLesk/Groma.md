---
id: TASK-63
title: Create a planned ghost with groma create
status: Done
assignee:
  - '@grok'
created_date: '2026-08-16 19:46'
updated_date: '2026-08-16 20:49'
labels: []
dependencies: []
references:
  - src/cli.ts
  - src/markdown-emitter.ts
  - groma/README.md
  - docs/product-model.md
  - src/create.ts
  - test/create.test.ts
  - test/fixtures/create
documentation:
  - docs/product-model.md
  - groma/README.md
modified_files:
  - src/create.ts
  - src/cli.ts
  - docs/product-model.md
  - test/create.test.ts
  - test/fixtures/create/groma/observed/README.md
  - test/fixtures/create/groma/missing/README.md
  - test/fixtures/create/groma/plans/README.md
  - test/fixtures/create/groma/observed/systems/shop/system.md
  - test/fixtures/create/groma/observed/systems/shop/containers/api/container.md
priority: high
type: feature
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a person or agent runs `groma create <name> --plan <plan-id> --kind <kind> --description <prose>`, Groma authors a planned element document in that plan. People and agents do not edit `groma/` by hand; this command is how a new part enters the world. A required change to an id that already exists is TASK-66, not this command.

The new id is the kebab-case of the name and is the id the element keeps when accepted. The document heading is the given name. The body is the description prose. Kind is one of `person`, `system`, `container`, or `component`. `--parent <id>` is required for `container` and `component`, and is forbidden for `person` and `system`. The parent must already exist in the merged world. Groma writes the file on the C4 path under `groma/plans/<plan-id>/`.

`--plan` is required. The plan id must already be lowercase kebab-case; Groma does not rewrite it. The first use of a new plan id creates `groma/plans/<plan-id>/` and a README whose frontmatter declares that immutable id and whose heading is the readable form of the id. That README has no Outcome prose yet; TASK-66 authors plan outcomes.

On success the command prints `ok` and the new id, then exits 0.

Approved example. In a world that already has container `api`, this command:

```text
groma create Stock --plan next --kind component --parent api --description 'Checks stock before placing an order.'
```

prints `ok` and `stock`, and writes:

```markdown
---
id: stock
kind: component
parent: api
---

# Stock

Checks stock before placing an order.
```

If `groma/plans/next/README.md` did not exist, Groma also writes:

```markdown
---
id: next
---

# Next
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma create <name> --plan <plan-id> --kind <kind> --description <prose> authors a planned element whose id is the kebab-case of the name and prints ok plus that id
- [x] #2 --parent is required for container and component, forbidden for person and system; the ghost appears as planned in the merged world under that parent
- [x] #3 First use of a new kebab-case plan id writes the plan README with that immutable id and a readable heading
- [x] #4 A duplicate id, unknown parent, missing required flag, illegal kind or parent pair, or non-kebab plan id fails with a clear message, a nonzero exit code, and no writes
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
1. Add `src/create.ts`: validate then write. Index observed + plan documents by id (planned wins). Fail before any mkdir/write. Do not run layout/scan.
2. Reuse `renderObservedDocument` + `writeObservedDocument` unchanged. Reuse `kebabCase` / `displayName`. Mirror existing C4 path helpers (see `architectureRelative` / observed path construction in scan-reconciler). Approved path: `groma/plans/next/systems/shop/containers/api/components/stock.md`.
3. Wire `create` in `src/cli.ts` only: `create <name> --plan --kind --description [--parent]`. Import from `./create.ts`.
4. `docs/product-model.md` step 3 only: name the create command. Do not rewrite the rest.
5. Tests: `test/create.test.ts` (node:test). New fixture `test/fixtures/create/` — minimum world: observed shop + api, empty plans. Do NOT reuse `test/fixtures/plain-view` (it already has stock). Copy fixture to a unique temp dir per test. Never read live `groma/`.
6. Cover approved command, parent rules, first vs existing plan README, and every AC#4 failure.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validate-then-write in src/create.ts. Index observed + plan documents by id (planned wins). Fail before any mkdir/write. Reuse renderObservedDocument, writeObservedDocument, kebabCase, and displayName. C4 paths mirror scan-reconciler; approved file is groma/plans/next/systems/shop/containers/api/components/stock.md.

CLI wiring is create <name> --plan --kind --description [--parent]. docs/product-model.md step 3 names `groma create`.

Simplicity pass removed the write-buffer array and the exported input type.

Verification:
- node --import=tsx --test test/create.test.ts — 5/5 pass
- bun run typecheck — pass
- bun src/cli.ts create Stock --plan next --kind component --parent api --description 'Checks stock before placing an order.' against a temp copy of test/fixtures/create printed ok / stock and wrote the approved component document and first-use plan README
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-08-16 19:55
---
Tightened after review: named flags, approved created documents, and failure cases. This command is only for new ids.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`groma create` authors a new planned element under groma/plans/<plan-id>/ on the C4 path and prints ok plus the kebab-case id. First use of a kebab-case plan id writes the plan README; an existing README is left alone. Duplicate id, unknown parent, missing flag, illegal kind or parent, and non-kebab plan id fail with a clear stderr message, a nonzero exit, and no writes.

Verified by test/create.test.ts (5/5), bun run typecheck, and a CLI spawn of the approved Stock command against a temp fixture copy.
<!-- SECTION:FINAL_SUMMARY:END -->
