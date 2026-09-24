---
id: TASK-398
title: 'Scan Angular classes, templates, and styles as multi-file components'
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 13:31'
updated_date: '2026-09-15 14:14'
labels:
  - scanner
  - angular
dependencies:
  - TASK-397
references:
  - angular-src-index
documentation:
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/angular/src/components.ts
  - plugins/scanners/angular/src/scan.ts
  - plugins/scanners/angular/src/index.ts
  - test/fixtures/angular-output/host.ts.fixture
  - test/fixtures/angular-output/emitter.ts.fixture
  - test/fixtures/angular-output/host.scss
  - test/fixtures/angular-output/emitter.css
  - test/fixtures/angular-output/shared.css
  - test-bun/angular-scanner.test.ts
  - docs/scanners/angular/index.md
type: feature
ordinal: 444000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A fresh Angular scan currently gives a component class and its external template separate architecture records, while component styles are absent. These files implement one explicitly declared Angular component, so the default map creates avoidable curation work and misleading separation. The supported example is a component class with a local templateUrl and local styleUrl/styleUrls declarations, including the Company list example in Call for Papers.

Use the shared source-unit contract from TASK-397. The result remains one C4 component with ordinary OKF Code references. Imported services, helpers, child components, global styles, and transitive stylesheet imports are not associated merely because they are used. Scanning must remain source-only without installing project dependencies or executing its build.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A fresh scan represents a component class, its explicitly declared local external template, and its explicitly declared local component style files as one component with exact source references; inline content creates no artificial files.
- [x] #2 The association is supported by component declarations, not filename similarity or directory proximity. Shared files and conflicts with established ownership follow TASK-397 rather than silently merging components.
- [x] #3 Combined Angular and TypeScript scans retain one owner per physical file. Consecutive scans preserve identity, all member files, existing output-callback evidence, and human or agent curation.
- [x] #4 Changes to associated templates and supported style files trigger the relevant scan in an open viewer. Newly attached unowned files and disappeared associations follow the shared lifecycle rules.
- [x] #5 Focused fixtures verify class/template/style association and repeats without project dependencies. A fresh disposable Call for Papers scan demonstrates the Company list class and its declared companion files under one component, with callback relationships preserved.
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
1. Extract local literal templateUrl, styleUrl, and styleUrls companions from Angular component metadata into sourceUnits and inventory. 2. Subscribe to supported stylesheet source edits. 3. Verify a packaged dependency-free class/template/style fixture, combined TypeScript rescans, and a disposable Call for Papers Company list scan; update documentation and run checks and reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Packaged dependency-free Angular fixtures pass all five tests, including singular/plural style declarations, transitive stylesheet exclusion, inline templates, TypeScript overlap, curation and repeat scans. A real live scanner session refreshes after an external SCSS edit. Disposable Call for Papers qualification found 822 Angular source files and 225 component units; Company list owns its TS/HTML/SCSS files, all 47 callback relationships remain, and the repeat model is identical with zero created records. Result: /tmp/groma-398-qualification.json. Full check passed: 326 Bun tests, 15 optional skips, 16 Node tests, lint and types. Implementer specification and quality reviews passed; this bounded extractor uses the reviewed shared ownership model without a new architecture decision.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Angular emits explicit class/template/style source units and watches external stylesheet edits. Packaged fixtures and a dependency-free Call for Papers scan verify shared ownership, preserved callbacks and stable repeat scans. Full repository checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
