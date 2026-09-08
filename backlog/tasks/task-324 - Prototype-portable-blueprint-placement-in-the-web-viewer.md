---
id: TASK-324
title: Prototype portable blueprint placement in the web viewer
status: Done
assignee:
  - '@chatgpt'
created_date: '2026-09-08 06:25'
updated_date: '2026-09-08 07:08'
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
  - research/blueprints/RESULTS.md
type: spike
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
People need to inspect reusable architecture intent in their own project before a drafts store can be designed responsibly. Exercise one saved-card-checkout pattern in an isolated web research prototype, including copy, paste, explicit role/parent binding, non-mutating preview, independent local draft creation and captured states. Do not modify production authoring, scanner behavior or the architecture contract, and do not build a public store backend.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The runnable browser prototype supports catalogue copy and cross-project paste, explicit valid bindings, preview, cancel, and creation of an independent fixture draft.
- [x] #2 Automated domain tests prove import validation, parent binding, no current-evidence mutation, overlapping drafts, distinct identities, and persistence failure without a partial commit.
- [x] #3 Browser checks exercise the interaction, keyboard clipboard, invalid input, reload persistence, and desktop/narrow layouts; captured mockups come from those tested states.
- [x] #4 Research documents observed limitations, changes to the proposed model, and a gated integration plan; repository checks are run and their actual outcomes recorded.
- [x] #5 The research branch includes source, reproducible test/capture commands, evidence, and an explicit separation from production Groma.
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
1. Keep production behavior unchanged; import the existing Groma composer, map renderer, camera and themes over two isolated fixtures.
2. Validate a bounded inert clipboard pattern with typed participant roles and an explicit host container; keep preview pure and create independent drafts that own their bindings and planned relationships.
3. Expose catalogue, copy/paste, binding, preview/cancel, draft creation and current-evidence inspection; persist only fixture localStorage.
4. Run dedicated lint/type/domain checks and bun run check, build the self-contained browser prototype, exercise three browser engines, capture desktop/narrow states and fix evidence-backed defects.
5. Record the tested revision, actual logs/screens, observed limits and production integration gates on the research branch; leave production contracts unchanged.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Isolated implementation passes 29 domain tests (63 assertions), dedicated typecheck and dedicated research lint. An earlier complete local bun run check passed; CI will re-run final source. Refined the proposal to explicit host roles and draft-owned bindings, leaving current records unchanged. Local browser URL navigation is policy-blocked; authoritative multi-browser tests and captures run on the research branch in GitHub Actions.

Recorded checks and browser evidence in research/blueprints/evidence; see checks.json for actual exit codes and tested source commit. Run 34196333865. Production contracts remain unchanged.

Recorded checks and browser evidence in research/blueprints/evidence; see checks.json for actual exit codes and tested source commit. Run 34196696514. Production contracts remain unchanged.

Recorded checks and browser evidence in research/blueprints/evidence; see checks.json for actual exit codes and tested source commit. Run 34197144111. Production contracts remain unchanged.

Recorded checks and browser evidence in research/blueprints/evidence; see checks.json for actual exit codes and tested source commit. Run 34197530648. Production contracts remain unchanged.

Final tested source b90464649c46e3010e7db5f55aa59ac389ecb100 passed all six verification stages in GitHub Actions run 34197530648: 30 domain tests/65 assertions, full repository check with 110 Node + 385 Bun tests (the 30 are included), 36 browser assertions across Chromium/Firefox/WebKit, and nine freshly captured screens. Visual review corrected mobile feedback covering actions; hit-testing now occurs while copy feedback is present. A follow-up failed browser run exposed delayed clipboard feedback after repaint; view-generation gating and an explicit visible-feedback wait corrected it. The final screenshots were inspected, including the mobile footer. Source scope was compared against main baseline: only research code/docs/evidence, fixtures, one test file, workflow and this task are added. No production modules or architecture documents changed. Implementer scope/quality review completed; no independent-agent review or human usability certification is claimed. RESULTS.md records exact tested source, commands, counts and image links.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered an isolated, runnable blueprint placement prototype using Groma's real renderer. Native clipboard transfer between differently named project fixtures produces a reviewed, independent draft without changing current meaning or evidence. Draft-owned bindings support overlap and simplify the earlier membership proposal. Fixed stale retry and mobile/async feedback defects. Verified source b90464649c46e3010e7db5f55aa59ac389ecb100 in run 34197530648: root check, 30 domain tests and 36 browser assertions pass; nine actual captures and reproducible reports are preserved. Production Groma authoring, scanning and the public store remain outside this research implementation.
<!-- SECTION:FINAL_SUMMARY:END -->
