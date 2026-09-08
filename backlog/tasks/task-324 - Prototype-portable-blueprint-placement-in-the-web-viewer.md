---
id: TASK-324
title: Prototype portable blueprint placement in the web viewer
status: In Progress
assignee:
  - '@chatgpt'
created_date: '2026-09-08 06:25'
updated_date: '2026-09-08 06:56'
labels: []
dependencies: []
modified_files:
  - .github/workflows/blueprint-research.yml
  - research/blueprints/scenario.feature
  - test/fixtures/blueprint-research/projects.json
  - test/fixtures/blueprint-research/saved-card.json
  - research/blueprints/model.ts
  - research/blueprints/placement.ts
  - research/blueprints/view.ts
  - research/blueprints/panels.ts
  - research/blueprints/app.ts
  - research/blueprints/style.css
  - research/blueprints/tsconfig.json
  - research/blueprints/build.ts
  - test-bun/blueprint-research.test.ts
  - research/blueprints/capture.py
  - research/blueprints/README.md
  - research/blueprints/biome.json
  - research/blueprints/FINDINGS.md
  - research/blueprints/verify.py
  - research/blueprints/evidence/research-lint.log
  - research/blueprints/evidence/research-types.log
  - research/blueprints/evidence/domain-tests.log
  - research/blueprints/evidence/repository-check.log
  - research/blueprints/evidence/build.log
  - research/blueprints/evidence/01-library-light.png
  - research/blueprints/evidence/02-paste-dark.png
  - research/blueprints/evidence/03-bind-missing.png
  - research/blueprints/evidence/04-preview-blueprint.png
  - research/blueprints/evidence/05-created-dark.png
  - research/blueprints/evidence/06-overlapping-drafts.png
  - research/blueprints/evidence/07-invalid-paste.png
  - research/blueprints/evidence/08-stale-preview.png
  - research/blueprints/evidence/09-mobile-draft.png
  - research/blueprints/evidence/browser-results.json
  - research/blueprints/evidence/browser-tests.log
  - research/blueprints/evidence/checks.json
type: spike
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People need to inspect reusable architecture intent in their own project before a drafts store can be designed responsibly. Exercise one saved-card-checkout pattern in an isolated web research prototype, including copy, paste, explicit role/parent binding, non-mutating preview, independent local draft creation and captured states. Do not modify production authoring, scanner behavior or the architecture contract, and do not build a public store backend.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The runnable browser prototype supports catalogue copy and cross-project paste, explicit valid bindings, preview, cancel, and creation of an independent fixture draft.
- [ ] #2 Automated domain tests prove import validation, parent binding, no current-evidence mutation, overlapping drafts, distinct identities, and persistence failure without a partial commit.
- [ ] #3 Browser checks exercise the interaction, keyboard clipboard, invalid input, reload persistence, and desktop/narrow layouts; captured mockups come from those tested states.
- [ ] #4 Research documents observed limitations, changes to the proposed model, and a gated integration plan; repository checks are run and their actual outcomes recorded.
- [ ] #5 The research branch includes source, reproducible test/capture commands, evidence, and an explicit separation from production Groma.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep production behavior unchanged and use the existing Groma map renderer over isolated fixtures.
2. Define a bounded inert clipboard pattern with typed attachment roles and one explicit host container; preview without mutation and instantiate independent drafts in fixture storage.
3. Build catalogue, paste, binding, preview and draft-reading screens; keep current meaning and evidence unchanged.
4. Verify semantic invariants with concurrent unit tests, run browser journeys and capture screenshots, then run bun run check.
5. Publish the source, reproducible evidence and integration decisions on the research branch; no production schema adoption.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Isolated implementation passes 29 domain tests (63 assertions), dedicated typecheck and dedicated research lint. An earlier complete local bun run check passed; CI will re-run final source. Refined the proposal to explicit host roles and draft-owned bindings, leaving current records unchanged. Local browser URL navigation is policy-blocked; authoritative multi-browser tests and captures run on the research branch in GitHub Actions.

Recorded checks and browser evidence in research/blueprints/evidence; see checks.json for actual exit codes and tested source commit. Run 34196333865. Production contracts remain unchanged.

Recorded checks and browser evidence in research/blueprints/evidence; see checks.json for actual exit codes and tested source commit. Run 34196696514. Production contracts remain unchanged.
<!-- SECTION:NOTES:END -->
