---
id: TASK-519
title: Apply one exclusion policy across all scanners
status: Done
assignee: []
created_date: '2026-09-24 12:35'
updated_date: '2026-09-24 19:06'
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
- [x] #1 Each scanner entry in `groma/scanners.json` has its own `exclude` list, applied after the global list in gitignore order, so a `!` pattern there re-includes a globally excluded file for that scanner only.
- [x] #2 Installing or adding a scanner writes its declared default exclusions into its entry; updating a scanner leaves the entry's list unchanged.
- [x] #3 No official scanner skips tests, fixtures, generated code, vendored or build-output folders, or minified files by a rule the configuration cannot change.
- [x] #4 Every official scanner applies its effective exclusions to everything it reads, including project configs and manifests.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One file-selection policy across all twelve scanners: a user-owned global exclude list, per-scanner include and exclude lists whose defaults each package declares (only its own ecosystem's folders) and adding the scanner writes, a useGitignore flag, and scanners that read only the files Groma hands them. Delivered by TASK-519.1 (config and host), TASK-519.3 (native scanners), TASK-519.2 (TypeScript family) and TASK-519.4 (include lists, host-owned listing).
<!-- SECTION:FINAL_SUMMARY:END -->
