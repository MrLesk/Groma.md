---
id: TASK-399
title: 'Scan Vue external scripts, templates, and styles as multi-file components'
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 13:31'
updated_date: '2026-09-15 14:18'
labels:
  - scanner
  - vue
dependencies:
  - TASK-397
references:
  - vue-src-index
documentation:
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/vue/src/project.ts
  - plugins/scanners/vue/src/index.ts
  - test/fixtures/vue-output/External.vue
  - test/fixtures/vue-output/logic.ts.fixture
  - test/fixtures/vue-output/markup.html
  - test/fixtures/vue-output/panel.css
  - test/fixtures/vue-output/shared.css
  - test-bun/vue-scanner.test.ts
  - docs/scanners/vue/index.md
type: feature
ordinal: 445000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vue components can declare their implementation in separate script, template, and style files. A useful default scan should retain that explicit association instead of exposing companion files as unrelated architecture components or omitting them. The supported example is a Vue single-file component using valid local external script, template, and style src declarations.

Use TASK-397 source-unit evidence and ownership rules. The .vue file and its directly associated implementation files form one existing C4 component with multiple OKF Code references. Ordinary imports of helpers, child components, global styles, and transitive stylesheet dependencies remain outside this association. No dependency installation, application execution, or stylesheet compilation is required.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A fresh scan associates a .vue file with its directly declared local external script, template, and style files and exposes them under one component with exact source paths.
- [x] #2 Normal inline Vue components retain their existing behavior. Ordinary imports and similarly named neighboring files do not become companion files without an explicit supported association.
- [x] #3 Vue and TypeScript overlap leaves one owner per physical file. Repeated scans preserve component identity, associated files, existing supported event evidence, and human or agent curation.
- [x] #4 Edits to supported external block files trigger a Vue refresh in an open viewer. Incremental attachments, shared-file ambiguity, existing ownership conflicts, and disappearing associations follow TASK-397.
- [x] #5 A minimal valid Vue fixture with external script, template, and style blocks verifies the packaged scanner through core and component details without project dependencies; supported inline event-binding behavior remains verified.
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
1. Read compiler-provided Vue block declarations and emit units for valid local external script/template/style sources. 2. Preserve existing inline event evidence and subscribe to external file edits. 3. Exercise the packaged scanner with a minimal external-block fixture through core, details data, overlap and repeat scans; update docs and run checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Five packaged Vue tests pass without target dependencies. The external-block fixture associates External.vue with logic.ts, markup.html and panel.css while leaving an ordinary imported helper and transitive stylesheet separate. Both existing inline callback relationships remain. TypeScript overlap, authored content and reordered repeats preserve ownership. A real viewer scanner session refreshes after each script, template and style edit. Invalid script setup/src combinations are rejected in accordance with the official Vue specification. Full repository check passed; implementer specification and quality reviews found no blocking issues. Extraction uses the existing compiler declarations and reviewed source-unit ownership rules.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Vue reports valid local external script/template/style blocks as one source unit and watches companion edits. Packaged fixtures verify dependency-free scanning, preserved inline callbacks and curation, stable overlap and live refresh. Full repository checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
