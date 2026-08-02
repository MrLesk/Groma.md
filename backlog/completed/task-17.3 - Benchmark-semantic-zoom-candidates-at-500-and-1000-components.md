---
id: TASK-17.3
title: 'Benchmark semantic-zoom candidates at 500 and 1,000 components'
status: Done
assignee:
  - '@codex'
created_date: '2026-07-29 21:20'
updated_date: '2026-07-30 16:31'
labels: []
dependencies: []
references:
  - groma/plans/04-semantic-zoom-viewer/README.md
modified_files:
  - src/spikes/semantic-zoom/fixture.mjs
  - src/spikes/semantic-zoom/main.jsx
  - src/spikes/semantic-zoom/styles.css
  - groma/plans/04-semantic-zoom-viewer/README.md
parent_task_id: TASK-17
priority: high
type: spike
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an evaluator runs the disposable semantic-zoom benchmark, it reports repeatable initial-render measurements for AntV G6 and MSAGL.js at 500 and 1,000 components using the same deterministic graph at each size. The result distinguishes raw timing from whether the candidate supports the approved fixed-world Groma interaction, so a faster but incompatible renderer is not presented as the better product choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both candidates are measured with identical deterministic fixtures at exactly 500 and 1,000 components, with component and relationship counts recorded.
- [x] #2 Each reported result uses a warm-up followed by at least five fresh measurements and reports the median initial-render time; failed runs are reported as failures rather than discarded.
- [x] #3 The comparison states which candidate is faster at each size and separately states whether each candidate supports the fixed-world semantic-zoom interaction.
- [x] #4 The benchmark remains disposable, uncommitted, and does not add production performance infrastructure, fallback behavior, or candidate-specific hardening.
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
1. Keep the existing parameterized benchmark fixtures and corrected first-render measurements unchanged.
2. Show the recorded 500- and 1,000-component medians and compatibility conclusion directly above the live candidate preview when benchmark mode is active.
3. Verify the summary, candidate switch, console health, and existing project checks in the browser; keep the spike uncommitted.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Benchmark method: one warm-up per candidate and size, followed by five fresh browser renders in an alternating sequence. Each size used one deterministic benchmark fixture for both candidates with identical IDs, containment, fixed positions, and within-container relationships. The 500-component fixture had 490 relationships; the 1,000-component fixture had 990. Both timers cover candidate setup through the first rendered, ready-to-display frame.

500 components: AntV G6 runs were 211, 208, 204, 206, and 201 ms (median 206 ms, range 201–211). MSAGL.js runs were 172, 176, 177, 169, and 177 ms (median 176 ms, range 169–177). MSAGL’s median was about 15% lower.

1,000 components: AntV G6 runs were 434, 402, 401, 430, and 400 ms (median 402 ms, range 400–434). MSAGL.js runs were 311, 360, 340, 307, and 319 ms (median 319 ms, range 307–360). MSAGL’s median was about 21% lower. All 20 measured runs completed.

Interpretation: MSAGL is faster for raw initial layout/render on the common benchmark graph. G6 remains the selected Groma foundation because the full authored scene includes cross-boundary relationships that MSAGL fails to render, MSAGL relayouts rather than preserving the fixed positions, and it lacks the required C4 landmark behavior. The benchmark does not compare semantic-level switch time because MSAGL has no equivalent behavior.

Correction history: the first measurement stopped MSAGL when setGraph resolved, before its first WebGL frame, while G6 included its ready-to-display work. Quality review identified the asymmetric endpoint. The discarded measurements were replaced after instrumenting MSAGL’s first completed tile frame; none of the earlier values remain in the result.

Verification: both 500- and 1,000-component pages rendered without browser console warnings/errors on the common graph; the 1,000-component G6 level control changed to Containers with fixed geometry unchanged; disposable Vite build passed; npm run check passed architecture validation and 107/107 tests; git diff --check passed. Cold simplicity review and specification review passed.

Final review: targeted quality re-review confirmed that MSAGL now records time only after its loaded first WebGL frame and that the README contains only corrected results. Specification and quality reviews both pass with no remaining criterion-backed findings.

User requested that the completed comparison result be visible inside the interactive preview. Reopened only to present the already-verified evidence; no benchmark rerun or production behavior is added.

Visible-result verification: benchmark mode now presents the recorded 500- and 1,000-component medians, performance winner, and G6 compatibility decision above the live preview. Browser verification at 1,000 components confirmed that switching from G6 to MSAGL preserves the summary and updates the running candidate; application console logs were empty. The focused cold simplicity, specification, and quality reviews passed with no criterion-backed findings. Disposable Vite build, npm run check (107/107 tests), and git diff --check passed.

Selection-authority correction: these measurements remain valid only for G6 and MSAGL. They are partial benchmark evidence for TASK-17.7 and do not authorize excluding React Flow or any other inventory candidate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Benchmarked AntV G6 and MSAGL.js with identical deterministic graphs at 500 components/490 relationships and 1,000 components/990 relationships, then placed the verified comparison directly in the interactive benchmark preview. MSAGL had lower median initial-render times (176 vs 206 ms at 500; 319 vs 402 ms at 1,000), while G6 remains selected because it supports Groma’s fixed-world semantic zoom. Verified the visible summary and candidate switch in the browser, with empty application console logs, a disposable Vite build, architecture validation, 107 passing tests, git diff validation, and cold simplicity/specification/quality reviews.

Scope clarification: this benchmark does not establish the best Groma renderer beyond G6 versus MSAGL.
<!-- SECTION:FINAL_SUMMARY:END -->
