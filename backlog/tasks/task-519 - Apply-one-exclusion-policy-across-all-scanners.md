---
id: TASK-519
title: Apply one exclusion policy across all scanners
status: To Do
assignee: []
created_date: '2026-09-24 12:35'
updated_date: '2026-09-24 12:35'
labels: []
dependencies: []
references:
  - package
  - scanner-registry
  - scanner-src-index
  - scanners-projects
ordinal: 600000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Each scanner decides on its own, in code, which tests, fixtures, generated files, vendored folders and build output to skip. Users cannot see or change those rules: a `!` pattern in `groma/scanners.json` cannot restore them, and only 6 of the 12 official scanners apply the configured exclusions to what they read. TypeScript qualification also showed sources under `build/` being scanned while that folder's tsconfig.json and package.json were skipped. Alex decided the model on 2026-09-24: a global exclusion list, a per-scanner list that adds to or overrides it, and scanner-provided defaults that are written into the scanner's list when it is installed, which people then extend or override. What stays inside a scanner is language coverage, meaning what the language's own build compiles.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each scanner entry in `groma/scanners.json` has its own `exclude` list, applied after the global list in gitignore order, so a `!` pattern there re-includes a globally excluded file for that scanner only.
- [ ] #2 Installing or adding a scanner writes its declared default exclusions into its entry; updating a scanner leaves the entry's list unchanged.
- [ ] #3 No official scanner skips tests, fixtures, generated code, vendored or build-output folders, or minified files by a rule the configuration cannot change.
- [ ] #4 Every official scanner applies its effective exclusions to everything it reads, including project configs and manifests.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->
