---
id: TASK-393
title: Update npm scanners without requiring a version
status: Done
assignee:
  - '@codex'
created_date: '2026-09-14 13:39'
updated_date: '2026-09-14 13:45'
labels: []
dependencies: []
references:
  - package
  - src-cli
  - modules-settings
  - scanners-settings
modified_files:
  - src/scanner/modules/inventory.ts
  - src/scanner/cli.ts
  - src/scanner/modules/settings-model.ts
  - src/scanner/modules/settings.ts
  - src/viewers/web/scanners/settings.ts
  - test-bun/scanner-update.test.ts
  - docs/scanners/setup.md
  - docs/scanners/creating-a-plugin.md
type: bug
ordinal: 439000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users expect scanner update to install a newer release without looking up an exact version. Currently both an omitted source and a bare npm package name fail, while the web Update form repeats the installed source. Reuse the existing compatible stable release selector and keep the resolved version pinned for team restores.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 For a configured npm scanner, update with only its id or with the same bare package name selects the newest compatible stable release and saves its exact version.
- [x] #2 The web Update action updates an npm scanner without a source form; choosing an exact version remains available.
- [x] #3 Updates preserve settings, exclusions, scanner identity and package origin; rejected updates leave the project selection unchanged. Git updates still require an explicit revision and local plugins use their configured path.
- [x] #4 A focused update test and browser verification pass, documentation explains both automatic selection and exact sources, and bun run check passes.
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
1. Resolve omitted npm sources and bare npm names through the existing published release selector in updateScanner. Keep validation and config writes in the existing update flow. 2. Make CLI source optional and the shared web action accept an omitted source. Send npm Update directly; retain a separate exact-source action. 3. Verify upgrades, pinned config, rejection and web interaction with disposable fixtures; run the repository check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Specification and quality self-review passed. CLI optional source and web update both call updateScanner, which resolves npm names through the existing compatible stable release selector before existing origin, identity, installation and config validation. Exact source behavior and Git revision requirements remain unchanged. No architecture data model or scanner evidence changes. The focused local-registry regression verifies omitted and bare sources, compatibility filtering, exact pinning, installed version, settings/exclusion preservation, explicit source selection, origin rejection, local-source guidance and registry failure without selection changes. Browser qualification used a disposable copy of test/fixtures/flows plus a TypeScript source and empty nested tsconfig. The published scanner 0.1.1 reproduced No inputs were found. One web Update click installed 0.1.2, completed scanning and removed Needs attention; Choose version opened the exact-source form. Both actual CLI forms from the user screenshot independently upgraded 0.1.1 to 0.1.2. Full bun run check passed lint, types, 16 Node and 313 Bun tests; 6 existing optional native tests skipped. git diff --check passed. Existing TASK-392 changes remain separate and untouched.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CLI updates accept a scanner id alone or the same bare npm package name. Web Update performs the same release selection directly; Choose version retains exact-source updates. Verified real TypeScript 0.1.1 to 0.1.2 upgrades through both CLI forms and the web, including recovery from the reported scan error. Repository checks pass.
<!-- SECTION:FINAL_SUMMARY:END -->
