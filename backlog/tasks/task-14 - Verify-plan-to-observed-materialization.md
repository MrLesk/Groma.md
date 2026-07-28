---
id: TASK-14
title: Verify plan-to-observed materialization
status: Done
assignee:
  - '@codex'
created_date: '2026-07-27 20:56'
updated_date: '2026-07-28 03:22'
labels: []
milestone: m-2
dependencies:
  - TASK-7
  - TASK-8
  - TASK-13
references:
  - README.md
  - groma/README.md
  - groma/plans/03-code-observation/README.md
  - 'https://c4model.com/'
  - 'https://github.com/comarkdown/comark'
modified_files:
  - README.md
  - e2e/release-gate.spec.js
  - src/architecture-comparison.mjs
  - test/architecture-comparison.test.mjs
priority: high
type: task
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revision 03 is the release gate for Groma’s first complete plan-to-materialization story. Open the already-built Revision 02 viewer with the selected plan 03-code-observation and a controlled fixture whose plan contains one component absent from the TASK-10-owned generated subtree, so the TASK-7 comparison draws it as a ghost. Implement that component using only the TASK-10 TypeScript/Bun source shape and declare the exact stable C4 ID already present in the selected plan. Verify that TASK-13 observes the supported change, TASK-12 updates readable component Markdown and ## Source evidence under the owned observed subtree, and the already-open viewer changes that same ID from planned-only to observed without restart or source access.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The controlled fixture selects plan 03-code-observation in the Revision 02 viewer, begins with one stable component ID present only in that selected plan, and draws it as a ghost addition
- [x] #2 Implementing a supported source declaration with that exact stable ID creates the matching component under the TASK-10-owned observed subtree and records readable ## Source evidence
- [x] #3 The already-open Revision 02 viewer changes that element from ghost addition to observed without process restart or direct source access
- [x] #4 One end-to-end test covers supported add, modify, and remove source changes and the corresponding Markdown and plan-03 visual comparison states
- [x] #5 Repeating the workflow without source changes produces byte-identical generated Markdown and an equivalent C4 graph
- [x] #6 The workflow preserves hand-authored and unrelated observed elements and modifies no named plan file
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the narrow TASK-13 browser handoff probe with one disposable Plan 03 source-materialization story for the exact stable component ID `typescript-observer`, seeded from a valid minimal supported source baseline that owns the other two scanner components.
2. Assert ghost addition → unchanged materialization → modified comparison → ghost addition in the same open document, including deterministic status attributes, badges, model/comparison/projection state, emitted Markdown, Source evidence, and Comark structure.
3. Restart only the source-refresh process and repeat the exact source bytes, proving byte-identical owned Markdown plus deep-equal graph/projection/comparison while the viewer PID and document sentinel remain unchanged.
4. Hash manual observed, unrelated observed, all unowned observed, and every named-plan byte before/after; audit viewer reads remain confined to Markdown; enforce nested process/fixture cleanup on dynamic ports.
5. Normalize only Markdown soft line breaks during comparison so source-compatible one-line descriptions can be equivalent without hiding wording changes.
6. Update the release-gate documentation, run the isolated gate repeatedly plus architecture/unit/full browser checks in proportion to risk, inspect the final diff, finalize TASK-14, and commit main clean.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the disposable Plan 03 materialization gate around exact ID `typescript-observer`: the controlled supported-source baseline owns the other two scanner components, then add/unchanged rerun/modify/remove drives ghost → unchanged → modification → ghost in one open viewer. The gate reads emitted Markdown and Source evidence, parses it with Comark, rebuilds the observed model from disk, checks comparison/projection equivalence, hashes manual/unrelated/unowned/named-plan bytes, audits viewer Markdown-only reads, and uses dynamic viewer ports with nested cleanup.

Focused execution exposed a core TASK-7 comparison defect: Plan 03 descriptions use ordinary Markdown soft wraps, but TASK-10 source text forbids line breaks, making visually identical materialization permanently modified. Added a red pure comparison regression, then normalized only CRLF/LF soft wraps for description equivalence; real wording changes remain modifications. No scanner, emitter, watcher, or UI feature was added. In-app Browser attempt failed exactly with `Browser is not available: iab`; task-authorized repository Playwright fallback passed the lifecycle flow.

Final validation: focused Plan 03 lifecycle passed 3/3 consecutive runs; isolated release gate passed 5/5; `npm run check` validated 4 revisions and passed 153/153 Node tests; full repository Playwright passed 12/12. Screenshot inspection confirmed ghost, unchanged, and modified treatments on the exact node. `git diff --check`, canonical `groma/` diff, residual fixture scan, and viewer/source-process scan were clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed Revision 03’s disposable end-to-end materialization gate for exact stable ID `typescript-observer`. One open Plan 03 viewer now proves source add → unchanged observed component with canonical Markdown/Source evidence → real modification → removal/ghost, plus an identical-source refresh-process restart with byte-identical owned output and deep-equal model/comparison/projection. Manual, unrelated, unowned observed, and all named-plan bytes are hash-protected; viewer reads remain Markdown-only; dynamic processes and fixtures are cleaned. Fixed the core comparison mismatch that treated ordinary Markdown soft wraps as architecture changes, with a red/green unit regression that still detects wording changes. Verified by 3 repeated focused gates, 5/5 isolated release gates, 153/153 Node tests, 12/12 full browser flows, screenshot review, and clean scope/cleanup audits. In-app Browser was attempted first and returned `Browser is not available: iab`; repository Playwright was the authorized fallback.
<!-- SECTION:FINAL_SUMMARY:END -->
