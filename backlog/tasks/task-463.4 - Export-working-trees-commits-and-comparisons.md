---
id: TASK-463.4
title: 'Export working trees, commits, and comparisons'
status: Done
assignee:
  - '@codex'
created_date: '2026-09-20 15:05'
updated_date: '2026-09-20 23:05'
labels: []
dependencies:
  - TASK-463.3
references:
  - web-export
  - data
  - revision-control
  - source-control
  - history-revisions
  - src-cli
  - render
  - web-page
  - source-read
modified_files:
  - src/history/revisions.ts
  - src/viewers/web/payload.ts
  - src/viewers/web/export.ts
  - src/cli.ts
  - src/viewers/web/data.ts
  - src/viewers/web/render.ts
  - src/viewers/web/revision/view.ts
  - src/viewers/web/revision/control.ts
  - test-bun/web-sharing.test.ts
  - test-bun/web-export.test.ts
  - docs/viewers/web/index.md
  - README.md
  - docs/index.md
  - groma/systems/groma-md/containers/cli/components/web-export.md
  - src/viewers/web/page.ts
  - src/viewers/source/structure.ts
  - test-bun/code-outline.test.ts
parent_task_id: TASK-463
priority: high
type: feature
ordinal: 539000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A CI job must be able to publish the same Groma experience so reviewers can inspect changes without a checkout or running Groma server. This child owns choosing export snapshots, packaging their required data, and documenting explicit CI usage. The parent TASK-463 owns the shared viewer, revision, task, and scope rules.

## Supported scenarios

```gherkin
Feature: Export Groma snapshots
  Scenario: Export one snapshot
    Given I choose the working tree or one specific commit for export
    When I open the static site
    Then it shows that snapshot's architecture and source contents
    And its header identifies that snapshot and offers no other revisions
    And no task data or task UI is present

  Scenario: Export a comparison
    Given I export commits A and B from the parent example
    When I open the static site without Git, Backlog, or a Groma server
    Then the same comparison map, details, and source diffs are available
    When I end comparison
    Then normal revision browsing offers only A and B
    And no task data or task UI is present
```
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Working-tree export preserves current architecture and sources, including relevant uncommitted changes, as one fixed snapshot. Its time-machine control identifies the working tree and explains that no other revisions are available.
- [x] #2 Exporting one specified commit includes that commit's architecture and sources regardless of the checkout, opens on that commit, and exposes its message, body, and ID. Its time-machine control explains that no other revisions are available.
- [x] #3 Comparison export bundles exactly the two requested commits and the architecture/source data needed for comparison and individual inspection. It opens in the same A-to-B comparison as live Groma.
- [x] #4 Ending comparison leaves B open. Ordinary revision selection offers only the two bundled commits; the developer can inspect either and start comparison again. No live working tree or unbundled revisions are offered.
- [x] #5 Generated data supports the same map, details, source views, and file diffs without runtime Git, Backlog, or a Groma server. Export does not contain a separate comparison algorithm or presentation.
- [x] #6 Every static export excludes task data and UI according to the parent rules, while ordinary live working-tree task behavior remains intact.
- [x] #7 Initial comparison export accepts two commits. Document concrete CI usage with explicit starting and destination commits within the parent's scope limits.
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
1. Extend explicit export options with --revision <commit> and --from <commit> (the latter requires a destination commit). Resolve exact commit metadata without reading branch history or changing checkout.
2. Export materializes the existing snapshot, comparison, layout and source readers into static views: one working tree/commit, or two commits and their two directed comparison views. Browser delivery selects only bundled views; the ordinary header and details stay shared. No Git/Backlog is used by the published browser. Remove task reads/data from every export.
3. Keep snapshot packaging in the web export domain and selected revision/pair in the existing time-machine owner. Show the one-snapshot notice; two-commit exports offer only those commits and can restart comparison after closing it. Shared URLs must restore the bundled individual/pair view.
4. Existing export tests require task data and must be replaced. Verify the approved scenarios using a temp Git repository: working-tree uncommitted source; exact commit metadata/source independent of checkout; two commits only, comparison status/diff and reverse direction through the same data boundary; no tasks. Existing sharing tests continue to verify static covers. Browser-test a static directory with no Groma server and inspect UI across modes.
5. Update CLI/web docs with explicit CI commands (no automatic PR resolution or CI integration). Curate owned architecture docs. Run focused/full checks, cold simplicity review, own specification/quality review, full-context review, then requested Grok 4.6 xhigh feedback before feature completion.
OKF/C4: exports are derived views of existing records and components, not new knowledge metadata or map levels. Ordinary Markdown keeps existing meaning; Groma history owns comparison interpretation. This remains independent of project language without adding future infrastructure.

Cold review reproduced an installed-scanner failure when export loaded dependencies from an archive. Share readSnapshotCodeStructure(repositoryRoot, snapshotRoot, world, element) with the live reader. Add one focused outline test: configured scanners in the repository must remain usable when the source root has no scanner installation/config. Existing tests only use one root; a mistaken provider lookup in the snapshot would return no outline or fail. Keep scanner execution and source content at their explicit owners.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Browser verification found the previous static-delivery CSS still hid the revision control. Removed that obsolete rule; the shared time machine is now visible in published delivery. Focused export and sharing tests pass.

Cold simplicity review found and reproduced scanner dependency resolution from archived roots. Shared readSnapshotCodeStructure now separates installed scanner ownership from snapshot source. Focused outline tests pass, and the real archived CLI example returns all 3 outlines. Targeted cold re-review passed. Implementer specification and quality reviews: CLI -> exact commits -> shared snapshot/comparison/layout/source -> packaged views -> existing header/details is clear; no second comparison algorithm, task data, or runtime repository reads. Static browser verified default comparison, end to B, select A, reload A URL, reverse comparison and source diff, plus working-tree and single-commit metadata/notices in light/dark/blueprint. No task UI or writes appeared.

Final full-context complexity review passed with no material findings. Final repository check after the scanner-root correction: 632 pass, 36 skip, 0 fail. The standalone CLI successfully exported this repository's HEAD commit to /tmp/groma-463-real-export. Browser console has no errors on the static comparison. Grok 4.6 xhigh is reviewing the complete feature before finalization.

Requested Grok CLI review completed with --model grok-4.6 --reasoning-effort xhigh (resolved model grok-4.6-build). Verdict: no AC/DoD or reproducible blockers in the supported journey. It endorsed the shared change engine, precomputed static views, domain grouping, and deletion of the task-only renderer. Non-blocking observations: neutral Unchanged badges, revision sentinel naming, and shared-source folder layering. Identity-key concern was checked against src/core.ts: annotation always assigns representationId = element.id, so this is not a current divergent-ID failure. These observations do not require additional behavior or architecture changes for this delivery. Clean feedback saved at /tmp/groma-463-grok-feedback.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Export now captures the working tree, an explicit commit, or two explicit commits with comparison. Published navigation and source inspection use the normal shared viewer and only bundled revisions; all task data is excluded. Scanner dependencies remain in the installed repository while source comes from the selected snapshot. CLI and product docs include explicit CI usage. Verified fixture navigation and source diffs across three themes, a real Groma HEAD export, focused tests, 632 passing repository tests (36 skips), and the required internal and Grok reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
