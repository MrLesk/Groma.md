---
id: TASK-407
title: Keep imported TypeScript helpers inside their application
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 15:57'
updated_date: '2026-09-15 16:03'
labels: []
dependencies: []
references:
  - typescript-src-index
  - src-lint-command
  - src-cli
  - cli
documentation:
  - docs/scanners/typescript/index.md
  - docs/component-markdown.md
modified_files:
  - test/fixtures/typescript-cli-command.json
  - test-bun/typescript-cli-command.test.ts
  - plugins/scanners/typescript/src/scan.ts
  - test-bun/typescript-placement.test.ts
  - docs/scanners/typescript/index.md
  - groma/systems/groma-md/containers/cli/components/src-lint-command.md
  - groma/systems/groma-md/containers/cli/container.md
  - >-
    groma/systems/groma-md/containers/lint-command/components/src-lint-command.md
  - groma/systems/groma-md/containers/lint-command/container.md
  - groma/relationships.md
type: bug
ordinal: 453000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TypeScript scanner promoted imported helpers into source roots based on dependency and caller counts. Core then created separate containers for new helpers, including the Lint command that runs inside Groma CLI. Remove this promotion for projects with or without bin metadata, keep independent source entry candidates, and preserve curated ownership. Correct the existing Lint command placement and author its CLI registration relationship.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Imported helpers do not become additional source roots merely because of their dependencies or callers, with or without package bin metadata.
- [x] #2 Independent TypeScript fixtures cover incremental helpers, multiple entry points sharing helpers, mixed CLI and non-CLI entries, and repeated scans preserving curated ownership.
- [x] #3 The live Lint command is a named and described component inside the Groma application, with an authored relationship from Command interface explaining command registration.
- [x] #4 Scanner documentation describes the generic source-root rule and its limits; focused checks and bun run check pass.
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
1. Remove imported/shared-helper promotion for all TypeScript projects. Keep scanned declared bins and independently entered source files as candidate roots, retaining deterministic placement for unresolved ownership.
2. Verify no-bin and bin projects, multiple entry points and shared helpers, incremental additions, naming independence, and preserved curation.
3. Combine the empty Lint command container into Groma application through Groma, describe it, and author the CLI registration relationship.
4. Verify repeated scans and the rendered map. Run focused checks, required repository check, and applicable reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Alex requested a generic TypeScript fix. The initial bin-only shortcut would hide independently entered source in a mixed package and leave the same promotion bug in projects without bin metadata. Replace the promotion heuristic instead. Source roots remain provisional evidence; C4 ownership and authored relationships belong to Groma core and curated OKF Markdown.

Verification: the expanded fixture reproduced four failures in the initial bin-only shortcut. The final generic rule passes all six entry-point scenarios plus six naming-independence cases (12 tests, 142 assertions). bun run check passes: lint/type checks, Node suite, and 346 Bun tests; 17 opt-in tests skipped. The first sandbox run failed because listeners and FSEvents were blocked; the permitted rerun passed without test changes. Existing unrelated PHP lint warning remains.

Live curation: combined empty lint-command into cli through Groma; src-lint-command keeps its ID and source reference, gains its responsibility and Project commands group; authored src/cli.ts -> src/lint-command.ts registration relationship. Two full groma scans each created 0 records and left every architecture file byte-for-byte unchanged. Browser search shows Lint command under Groma > Groma application; its details show incoming Command interface registration.

Cold simplicity review passed with no blockers. Optional fixture manifest deduplication is non-blocking. Implementer specification review: all four criteria have evidence above. Quality review: no new dependency, metadata, core ownership rule, or automatic relationship selection; removed both promotion loops, preserved existing deterministic placement and curated ownership. No scoped reproducible defects found. C4: lint is an in-process component. OKF: ordinary Markdown responsibility and source links remain readable; Groma interprets existing parent/group and file ownership fields.

Full-context complexity review passed: no blockers or material recommendations. The final change keeps scanner evidence, core reconciliation, and curated Markdown ownership separate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed TypeScript helper-promotion heuristics for projects with or without bin metadata while preserving independent entry candidates and curated ownership. Corrected Lint command placement inside Groma application and added the CLI registration relationship. Verified 12 focused tests, full bun run check (16 Node and 346 Bun tests pass; 17 opt-in tests skipped), two live scans with zero created records and unchanged architecture files, and browser placement/relationship. Simplicity, specification, quality, and full-context reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
