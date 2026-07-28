# Groma Decluttering Implementation Plan

> **For the implementing agent:** Execute this plan in TASK-16 using the
> repository's Backlog.md workflow. Treat every cleanup candidate as a
> hypothesis until its behavior is traced to an acceptance criterion, contract,
> or supported-flow test.

**Goal:** Make the current Groma implementation easier to understand by
deleting redundant validation, indirection, and unused configuration without
changing any documented supported behavior.

**Architecture:** Preserve the existing entry points and data flow. Simplify
inside those boundaries, starting with the four highest-confidence findings
from the Claude Fable 5 cold review. Prefer deletion and inlining; do not create
a shared abstraction merely to remove textual duplication.

**Technology:** JavaScript ES modules, Bun, Node.js test runner, Comark,
Playwright, Backlog.md.

---

## Supported flows that define authority

1. `npm run check` validates the Markdown architecture and runs unit tests.
2. `npm run viewer` loads plan and observed Markdown, builds the architecture
   model, serves it, and live-reloads Markdown changes.
3. `npm run source:refresh` observes the explicitly supported TypeScript source
   shape and emits observed component Markdown.
4. `npm run test:release-gate` proves the source-to-Markdown-to-viewer flow.
5. `npm run test:viewer:browser` proves the supported viewer interaction.

Completed task acceptance criteria and repository contracts remain authority
even when a cleanup would otherwise look attractive.

## Task 1: Establish the baseline and validate the cold review

**Read:**

- `README.md`
- `groma/source-observation.md`
- `src/markdown-emitter.mjs`
- `src/viewer/server.mjs`
- `src/viewer/reload-status.mjs`
- `test/markdown-emitter.test.mjs`
- `test/reload-status.test.mjs`
- `test/viewer-server-lifecycle.test.mjs`

1. View TASK-16, mark it in progress, and assign it through the Backlog CLI.
2. Run `npm run check`, `npm run test:release-gate`, and
   `npm run test:viewer:browser`.
3. Trace each proposed deletion to its callers, tests, contracts, and completed
   task acceptance criteria.
4. Record the final current approach in TASK-16's Implementation Plan. Record
   rejected Claude findings and their authority in Implementation Notes, not
   in the plan.

## Task 2: Apply the four bounded simplifications

**Modify:**

- `src/markdown-emitter.mjs`
- `src/viewer/server.mjs`
- `test/markdown-emitter.test.mjs` only when a test exists solely for deleted,
  unsupported behavior

**Delete when independently confirmed redundant:**

- `src/viewer/reload-status.mjs`
- `test/reload-status.test.mjs`

1. Keep Comark parsing of rendered Markdown but remove redundant AST
   self-verification that cannot fail after the supported input validation.
2. Reduce observed-index validation only as far as existing TASK-12 authority
   permits. Preserve duplicate-ID and missing-target checks.
3. Inline the single nullable reload error state into the viewer server.
4. Remove viewer configuration channels that are unused by every documented
   entry point and supported test flow.
5. Run the focused emitter, viewer lifecycle, release-gate, and browser tests
   after each coherent deletion.

Do not implement the review's optional reader serialization or viewer focus
suggestions unless the four bounded changes are complete, all checks pass, and
their deletion is independently proven to reduce concepts without weakening an
explicit contract. Do not create a shared AST-helper module.

## Task 3: Stop for the cold simplicity gate

1. Finish the implementation and focused checks without committing or
   finalizing TASK-16.
2. Report the diff as ready for the orchestrator's cold simplicity review.
3. Apply only accepted deletion, consolidation, naming, or clarification
   findings from that review.
4. Permit at most one targeted re-review of those findings and regressions
   caused by their fixes.

## Task 4: Verify and finalize

1. Run:

   ```bash
   npm run check
   npm run test:release-gate
   npm run test:viewer:browser
   ```

2. Confirm the diff has a net reduction in code and concepts and introduces no
   new supported behavior.
3. Record verification evidence and rejected cleanup findings in TASK-16
   Implementation Notes.
4. Follow `backlog instructions task-finalization`, check every acceptance
   criterion only with objective evidence, write the final summary, and move
   TASK-16 to its terminal status.
5. Commit the task-scoped changes directly to `main`.
