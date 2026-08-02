---
id: TASK-16
title: Declutter the Groma implementation without changing its supported behavior
status: Done
assignee:
  - '@codex'
created_date: '2026-07-28 17:47'
updated_date: '2026-07-28 17:59'
labels: []
dependencies: []
references:
  - docs/superpowers/specs/2026-07-28-simplicity-review-design.md
modified_files:
  - src/markdown-emitter.mjs
  - src/viewer/reload-status.mjs
  - src/viewer/server.mjs
  - test/markdown-emitter.test.mjs
  - test/reload-status.test.mjs
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reduce accidental complexity across Groma's current implementation while preserving the documented supported product flows. Start from the cold read-only review produced with Claude Fable 5, but treat every recommendation as a hypothesis to validate against the README, architecture contracts, completed task acceptance criteria, and tests. Prefer deletion, inlining, and removal of unused configuration. Do not add behavior, compatibility, edge-case handling, fallback/recovery, hardening, or future-facing abstractions. The intended stopping point is the simplest implementation that still supports Markdown validation, plan-versus-observed viewing, C4 navigation, live Markdown reload, and the Revision 03 source-to-Markdown-to-viewer flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The documented Markdown validation, plan comparison, C4 navigation, live reload, and Revision 03 source-to-Markdown-to-viewer flows behave exactly as before
- [x] #2 The resulting production and test code contains fewer lines, modules, configuration channels, or duplicated validation concepts, with each removal justified by supported-flow evidence
- [x] #3 An unfamiliar reviewer can trace each supported entry point through responsibilities and state to its result without relying on conversation context
- [x] #4 No new behavior, backwards compatibility, edge-case handling, fallback or recovery behavior, hardening, or future-facing abstraction is introduced
- [x] #5 npm run check, npm run test:release-gate, and npm run test:viewer:browser pass after the simplification
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
1. Keep the supported entry points and data flow unchanged: architecture validation and unit checks, viewer startup and Markdown reload, source refresh, release gate, and browser navigation/comparison.
2. In src/markdown-emitter.mjs, retain Comark parsing of every rendered component but delete the renderer AST self-audit; the fixed template, validated IDs/readable text/source ranges, safe observed target names, deterministic escaping, and resolved target index make every deleted branch unreachable for supported input.
3. Reduce observed target indexing to the data emission consumes: Comark parse, stable ID, safe single-line H1 text, duplicate-ID rejection, missing-target rejection, and the exact hand-authored scanner parent. Delete revalidation of unrelated hand-authored containment, external fields, canonical paths, prose, and relationship tables, plus the one test whose only subject is unsupported invalid hand-authored Markdown.
4. Inline the single nullable reload-error value in src/viewer/server.mjs; delete src/viewer/reload-status.mjs and its unit test while preserving API/SSE replay, last-valid payload, failure publication, and success clearing.
5. Remove undocumented unused viewer inputs GROMA_REVISION, GROMA_SYSTEM_ID, GROMA_PORT, and --system. Preserve --revision, --port, the fixed focal system groma, test repository injection, and GROMA_TEST_IO_AUDIT.
6. Run focused emitter and viewer lifecycle/browser checks, inspect the net deletion and supported entry-point-to-result flows, and leave the uncommitted tree ready for the required cold simplicity review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Discovery and baseline evidence before implementation:
- npm run check passed architecture validation for 4 revisions and 109/109 Node tests.
- npm run test:release-gate passed 5/5.
- npm run test:viewer:browser passed 12/12.
- README.md documents only npm run viewer, --revision, and the fixed Groma focal system; all repository launchers use --port and optionally --revision. No contract, completed task acceptance criterion, test, or caller uses GROMA_REVISION, GROMA_SYSTEM_ID, GROMA_PORT, or --system.
- TASK-12 and groma/source-observation.md authorize target resolution from a validated complete observation plus canonical observed Markdown, with duplicate and missing targets rejected before writes. The full validateObservedIndex pass revalidates unsupported invalid hand-authored trees already owned by npm run validate:architecture and the runtime architecture model.
- validateRenderedDocument audits only values produced by a fixed renderer after observation validation, safe target-name validation, exact escaping, target resolution, and canonical path construction. Its parse failure remains meaningful and will be retained; its AST equality branches cannot diverge for supported input.
Rejected optional Claude hypotheses:
- Do not remove the architecture-reader JSON serialization round trip. TASK-4 AC #4 and its completed correction explicitly promise serializable Comark-derived data and distinguish serialize-stage failures; deleting that boundary is not justified by the four bounded simplifications.
- Do not inline viewer focus. The pure three-level focus transition is a separately tested interaction-state boundary used by the UI; inlining would trade a tiny module for less direct behavior coverage without simplifying a supported flow.
Corrections to stale completed-task notes: TASK-15 already removed emitter transactions, fingerprint watcher fallback, topology recovery, and terminal watcher state. Those historical TASK-8/TASK-12/TASK-13 notes are not current production authority; current README/contracts and current code define the supported stable-filesystem flow.

Implementation before the cold simplicity gate:
- src/markdown-emitter.mjs now parses every rendered component with Comark but no longer re-parses its own fixed output into a second field/table/link verifier. Supported output remains checked independently by the emitter integration test, TASK-4 load, architecture validation, and release gate.
- Observed target indexing now reads only the frontmatter ID/kind/parent, one safe single-line H1 label, and source filename needed for target links and exact scanner-parent ownership. Duplicate observed/generated IDs, missing relationship targets, unsafe decoded link labels, and the exact scanner parent still reject before mutation. Removed containment/external/path/prose/relationship-table revalidation and its unsupported noncanonical-prose test.
- Viewer reload state is one local nullable reloadError in server.mjs. The module and dedicated state-object test were deleted; browser coverage still proves error replay, last-valid retention, and clearing after success.
- Removed GROMA_REVISION, GROMA_SYSTEM_ID, GROMA_PORT, and --system. Retained --revision, --port, fixed focal system groma, GROMA_TEST_REPOSITORY_ROOT, GROMA_TEST_IO_AUDIT, and onFilesystemAccess.
Verification before simplicity review:
- node --check on both changed production modules passed.
- Focused emitter plus viewer lifecycle passed 8/8.
- Focused reload/race/reconnect/filter Playwright passed 4/4.
- npm run check validated 4 revisions and passed 107/107 Node tests.
- npm run test:release-gate passed 5/5.
- npm run test:viewer:browser passed 12/12.
- git diff --check passed; groma/, README.md, package.json, and package-lock.json are unchanged.
- Production/test diff removes 365 lines and adds 21, deletes two modules, removes four configuration channels, and leaves TASK-16 uncommitted and In Progress for the required cold review.

Cold simplicity review: PASS with no blocking findings and no further authority-backed deletion. The cold reviewer independently traced the supported flows, confirmed that the deleted tests did not uniquely encode supported requirements, confirmed retained emitter checks are contract-backed, and found that the 21 added production/test lines introduce no new concepts.
Non-blocking notes rejected without code change:
- Optional one-line wrapping in src/viewer/server.mjs is cosmetic and not required by formatting or acceptance criteria.
- Do not add a frontmatter null guard in the emitter; it would add handling for unsupported invalid hand-authored input outside the accepted scope.

Fresh final verification after the cold review and before commit:
- npm run check validated 4 revisions (36 elements, 34 relationships) and passed 107/107 Node tests.
- npm run test:release-gate passed 5/5, including Revision 02 isolation, Plan 03 source materialization, and the complete Markdown-to-view gate.
- npm run test:viewer:browser passed 12/12, including live reload, stale-generation ordering, error replay, C4 navigation, sibling navigation, and comparison containment.
- git diff --check passed and groma/, README.md, package.json, and package-lock.json remain unchanged.
- Final production/test delta is 21 additions and 365 deletions (net -344 lines), with two modules and four configuration channels removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decluttered Groma without changing its documented flows: removed redundant emitter AST/tree validation, inlined viewer reload-error state, deleted two single-purpose modules/tests, and removed four unused configuration channels while preserving Comark parsing, target safety, viewer test seams, live reload, comparison, C4 navigation, and Revision 03 materialization. A cold simplicity review passed with no blocking findings. Fresh final verification passed npm run check (4 revisions; 107/107 Node tests), release gate 5/5, browser 12/12, and diff/canonical-architecture hygiene. Production/test code is net 344 lines smaller.
<!-- SECTION:FINAL_SUMMARY:END -->
