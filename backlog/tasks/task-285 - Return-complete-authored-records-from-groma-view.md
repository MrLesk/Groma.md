---
id: TASK-285
title: Return complete authored records from groma view
status: Done
assignee:
  - '@codex'
created_date: '2026-09-05 21:52'
updated_date: '2026-09-05 22:00'
labels: []
dependencies: []
references:
  - plain-text-view
  - commands
documentation:
  - docs/product-model.md
modified_files:
  - src/cli.ts
  - src/plain-world.ts
  - >-
    test/fixtures/plain-view/groma/systems/shop/containers/api/components/orders.md
  - >-
    test/fixtures/plain-view/groma/systems/shop/containers/api/components/stock.md
  - test/cli-view.test.ts
  - docs/product-model.md
  - groma/systems/groma/containers/cli/components/plain-text-view.md
  - test-bun/web-authoring.test.ts
type: feature
ordinal: 324000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents must be able to inspect the complete authored architecture through the existing read-only CLI. Element IDs and exact source-file targets return the same complete Markdown record; flow IDs return their authored record and ordered steps. The plain world remains compact and exposes groups and a flow index. This implements the approved reader portion of the Backlog.md evaluation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma view <element-id> returns the complete authored Markdown record, including all source evidence and authored sections.
- [x] #2 groma view <source-file> resolves its unique owner and returns the same authored record as the element ID.
- [x] #3 groma view <flow-id> returns the complete flow record with its ordered steps.
- [x] #4 groma view --plain remains a compact architecture overview and includes group names and a flow index.
- [x] #5 Reads do not scan or modify architecture; existing supported draft lookup and invalid or ambiguous target behavior remain clear.
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
1. Keep validated architecture ownership resolution and read exact authored Markdown for element, source-file, and flow targets through the existing Groma document reader.
2. Keep draft lookup and clear lookup errors; add group labels and a compact flow index to the overview.
3. Update view help, product documentation, and the plain-text-view architecture responsibility. Add focused fixture-based CLI verification, run bun run check, and perform specification and quality reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented exact authored Markdown reads using the existing core-owned document reader after normal architecture validation. Source-file lookup checks every Code reference and keeps the existing ambiguous-owner error. Element/flow IDs return raw source; draft IDs retain their completion/member summary. Plain overview adds component group labels and a sorted flow ID/title index.
Focused verification: 18 Node tests passed across cli-view, group, add, and remove. Reader tests cover complete metadata and body equality, both source references, exact flow source with ordered steps, groups, flow index, no source scan or repository-content changes, unknown targets, and ambiguous ownership. Focused Biome lint is clean. Full bun run check will be run by the coordinator after peer implementations settle.
Self-review identified an existing Web authoring assertion for the replaced summary format; coordinating that one test-file correction with TASK-286. Other current Web response assertions are affected by TASK-286 receipts, not this reader change.

Specification review: all five acceptance criteria have focused CLI evidence. Element and exact source targets are byte-equal to authored fixtures; the flow output is byte-equal to its multi-step source; overview group labels and flow index are present without full sections; draft summaries and unknown/ambiguous errors remain supported; copied repository contents stay unchanged during reads with unscanned source present.
Quality and simplicity self-review: the read path validates through the existing architecture reader/model, indexes authored document IDs, resolves file ownership from all Code references, and reads the selected source through readDocument. Removed the lossy element formatter instead of introducing another serializer or architecture concept. No compatibility, fallback, scanner, or ownership changes. Source and test files remain under 500 lines, and focused lint is clean.
Corrected the pre-existing Web authoring reader assertion to compare CLI output with the authored source. Its targeted Bun test passes (1 pass, 5 filtered); direction, description, and technology assertions remain. The shared Web test file is released to TASK-286 for its receipt assertions. Ready for coordinator review and final repository check; no commit, push, or terminal task status change performed.

Final full-context complexity review found no blocking findings or material architecture recommendations. The existing reader owns raw source reads and the CLI owns presentation; the lossy formatter was removed. Final bun run check passed: 106 Node tests and 293 Bun tests, zero failures, typecheck and lint completed. Seven pre-existing complexity warnings remain in untouched files; no new warnings. Changes are limited to the approved reader behavior.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Element IDs, flow IDs and exact owned source files now return complete authored Markdown. The compact overview includes component groups and a flow index; draft summaries and clear lookup errors remain. Verified with fixture-based exact-output, ownership, read-only and CLI tests plus the full 399-test repository check. Specification, quality and full-context complexity reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
