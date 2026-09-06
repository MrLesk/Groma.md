---
id: TASK-178
title: Add Biome to the project check
status: Done
assignee:
  - '@codex'
created_date: '2026-08-26 17:35'
updated_date: '2026-08-26 18:04'
labels: []
dependencies: []
modified_files:
  - biome.json
  - package.json
  - bun.lock
  - src/architecture-model.ts
  - src/architecture-reader.ts
  - src/sheet/place.ts
  - src/viewers/web/project/editor.ts
  - src/world-layout.ts
  - src/sheet/route.ts
  - src/viewers/web/iso/project.ts
  - test-bun/helpers.ts
  - test-bun/sheet-route.test.ts
  - test/edit.test.ts
  - test/scan-watch.test.ts
  - AGENTS.md
  - CONTRIBUTING.md
ordinal: 190000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers and agents run one repository command to apply Biome linting, TypeScript checking, and tests. Biome should initially lint the supported TypeScript surface without formatting or import-assist changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running bun run check invokes Biome linting, TypeScript checking, and the existing test suites
- [x] #2 Biome checks the supported top-level TypeScript files and reports cognitive complexity above 15
- [x] #3 Biome does not format files or organize imports
- [x] #4 AGENTS.md and CONTRIBUTING.md explain the single bun run check workflow
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
1. Add a pinned Biome dependency and a linter-only configuration over the top-level TypeScript surface. Keep the recommended preset, disable the repository-incompatible non-null assertion rule, and report cognitive complexity above 15 as a warning while the existing 41 findings remain.
2. Resolve the current blocking recommended-rule diagnostics without touching files already being changed by other agents.
3. Extend the existing check script so bun run check is the only documented command and runs Biome, TypeScript, and tests.
4. Document the workflow in AGENTS.md and CONTRIBUTING.md.
5. Run bun run check, inspect the task-only diff, and complete the required simplicity and contextual architecture reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Corrected the rules preset key from preset to recommended after the pinned Biome 2.4.13 binary rejected the former against its schema.

Implemented pinned Biome 2.4.13 with formatter and assist disabled. The recommended-rule baseline is clean after small type and callback fixes; the remaining 41 diagnostics are only cognitive-complexity warnings above 15. bun run check passed: Biome checked 160 files, TypeScript 7.0.2 passed, 81 Node tests passed, and 168 Bun tests passed.

Cold simplicity and contextual architecture reviews found no blocking issues. Both recommended removing the unused vcs.defaultBranch setting; removed it because the supported command does not use --changed. The contextual review confirmed the warning-only complexity rollout is the smallest honest adoption until a separate cleanup can make the rule an error.

Final specification and quality review passed. The task-only diff has no whitespace errors. The pinned executable reports Biome 2.4.13. A second bun run check passed after review cleanup with the same evidence: 41 expected complexity warnings, TypeScript passed, 81 Node tests passed, and 168 Bun tests passed.

Alex confirmed completion and authorized commit and push.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added pinned Biome linting to the single bun run check workflow, kept formatting and import assist disabled, cleaned the recommended-rule baseline, and documented the workflow for agents and contributors. Verified with Biome 2.4.13, two successful bun run check runs, 81 passing Node tests, 168 passing Bun tests, and cold simplicity plus contextual architecture reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
