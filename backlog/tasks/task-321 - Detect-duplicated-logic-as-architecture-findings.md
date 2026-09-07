---
id: TASK-321
title: Detect duplicated logic as architecture findings
status: Done
assignee:
  - agent
created_date: '2026-09-07 07:06'
updated_date: '2026-09-07 20:15'
labels: []
dependencies: []
references:
  - scan-observation
  - typescript-scanner
  - architecture-model
  - world-loader
  - scan-lifecycle
  - commands
  - web-viewer-details
  - details
  - architecture-findings
  - source-viewer
  - read-read
modified_files:
  - packages/scanner/src/index.ts
  - plugins/scanners/typescript/src/source-tokens.ts
  - plugins/scanners/typescript/src/source-operations.ts
  - src/types.ts
  - src/architecture-findings.ts
  - src/core.ts
  - src/scan-reconciler.ts
  - src/scanner.ts
  - src/cli.ts
  - src/viewers/web/organisms/details.ts
  - src/viewers/tui/panes/details.ts
  - docs/architecture-findings.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/evidence.md
  - docs/product-model.md
  - docs/scanners/index.md
  - docs/agent-instructions/index.md
  - test/fixtures/duplicated-logic/ready-a.ts
  - test/fixtures/duplicated-logic/ready-b.ts
  - test/fixtures/duplicated-logic/ready-c.ts
  - test/fixtures/duplicated-logic/publish.ts
  - test/fixtures/duplicated-logic/total.ts
  - test-bun/architecture-findings.test.ts
  - groma/systems/groma/containers/scanner/components/typescript-scanner.md
  - groma/systems/groma/containers/scanner/components/source-tokens.md
  - groma/systems/groma/containers/core/components/architecture-findings.md
  - groma/systems/groma/containers/scanner/components/scan-observation.md
  - src/viewers/web/organisms/code-lists.ts
  - src/viewers/web/source/view.ts
  - test-bun/inspect-details.test.ts
  - docs/viewers/web/index.md
  - docs/viewers/tui/index.md
  - groma/systems/groma/containers/web-viewer/components/source-viewer.md
  - groma/systems/groma/containers/terminal-viewer/components/details.md
  - groma/systems/groma/containers/web-viewer/components/web-viewer-details.md
  - src/viewers/source/read.ts
  - src/viewers/web/source/control.ts
  - test-bun/tui-source.test.ts
  - groma/systems/groma/containers/view-host/components/read-read.md
  - test-bun/web-source-control.test.ts
ordinal: 359000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Groma should report when named operations look like copies, including renamed locals and near-duplicates with concrete differences, without treating that as an architecture relationship or a required refactor.

A developer scanning a repository receives architecture findings: source ranges, owning components, whether copies match after renaming, and which operators, literals, or calls differ. The finding asks whether the copies are one rule that should change together or similar rules that are intentionally independent. Core owns matching, clustering, ownership, and difference reporting. Scanners only supply language facts (operations, binding-normalized tokens, source ranges). CLI, TUI, and Web expose the same findings. Fingerprints stay transient and are not written as collaborations.

Validate with known renamed copies, a changed predicate, and similar-but-independent logic. Do not persist suspected duplication as ordinary relationships or merge components from a finding.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Named TypeScript operations include binding-normalized tokens and source ranges; local names are slots, while operators, literals, property names, and unresolved identifiers remain visible
- [x] #2 Core reports architecture findings for exact renamed clones and near-duplicates, maps each instance to its component owner, and lists concrete token differences without calling the copies a bug or a required merge
- [x] #3 Findings are not stored or projected as architecture relationships
- [x] #4 groma scan reports finding counts; Web and TUI details list findings for a selected owning component with source locations
- [x] #5 Tests cover renamed copies, a deliberately changed predicate, and similar-but-independent logic using fixtures rather than live architecture
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
1. Add copiesOf(file, name, line) for other instances and whether the match is similar. List each finding once in the scan dump: the first operation, possible duplicates, and "not identical" when similar. Keep token bags off the dump.
2. Merge Files into Web Code: ownership order, declarations nested with hierarchy tree lines, file facts on hover without the extension. Methods with copies get a review mark that toggles an accordion of other locations; the method name still opens this source. What it does has no Findings section.
3. TUI How lists the same copies under the method. Scan uses the flatter dump.
4. Tests cover copiesOf and the scan listing. Docs describe Code, not a Findings dump or a separate Files section.

5. Restore How it's built scroll when Back leaves source, matching the task-diff pane.

6. Warning labeled possible duplicates sits on the method row; expansion lists only the copies. Back from source restores How scroll.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scanner emits binding-normalized operation tokens and source ranges. Core fingerprints exact clones, indexes 3-grams for near-duplicates (LCS ≥ 0.7), union-finds overlapping matches, maps file owners, and lists bag-diff token differences. Findings are process-local after a scan, attached to the annotated world, never written as relationships. CLI prints the count and dump; Web and TUI details list owner findings with file:line.

Simplification applied: unused core re-exports removed; token validation collapsed onto operationTokens; redundant shared-gram re-check and unused (anonymous) skip dropped. CLI dump kept so scan exposes findings, not only a count.

Verification: bun run check (350 tests). Fixture tests cover renamed copies, a missing predicate, and similar-but-independent logic. groma scan of this repo: 69 findings; kebabCase/displayName exact copies across TypeScript scanner and Core naming. Web TypeScript scanner What-tab shows Findings and opens naming.ts from a location link. TUI details for TypeScript scanner shows the same Findings list.

Non-destructive TypeScript observation of /Users/alex/projects/backlog.md (no Markdown writes): 212 files, 4661 operations, 13.4s, 7 exact clone groups (including setAlias in five files, collectArchivedMilestoneKeys), useful similar cluster for canonicalizeMilestone vs canonicalizeMilestoneValue, and 149 similar findings including transitive blobs of short list helpers.

Material follow-up (not applied): treat a similar finding as one pair of fingerprints rather than a union-find connected component, so unrelated near-matches do not chain into one review question.

How it's built now owns copies: Files merged into Code with hierarchy tree lines and hover file facts; methods with copies get a review mark that toggles an accordion of other locations (owner · file:line, “not identical” when similar). What it does has no Findings dump. TUI How lists the same copies under the method. Scan lists each finding once without token bags. Clicking a copy can open a peer-owned file while keeping the current selection. bun run check 351 pass. Web TypeScript scanner How: kebabCase/displayName marks, accordion, peer src/naming.ts opens at the copy line, this-method and file rows still open owned source. TUI How shows possible duplicates under kebabCase.

Web copies nest under the expanded method with the same tree as declarations under a file; the parent rail continues through the expansion. Warning icon replaces ≈. Each copy is the operation name plus file:line. TUI uses the same two-line copy rows.

Back from source restores How it's built scroll (same pattern as task-diff). Verified on TypeScript scanner: tokenizeOperation at scroll 1800 and kebabCase copy both return to the same position; bun run check 353 pass.

Dropped the possible-duplicates heading so copies sit directly under the method in Web and TUI. Scan dump still uses possible duplicates: as a listing separator. bun run check 353 pass.

Restored possible duplicates as muted caption text, not a tree row. Copies stay nested like declarations. TUI dim label restored. bun run check 353 pass.

possible duplicates sits next to the warning on the method row. Expansion is only the copies. TUI has no extra heading. bun run check 353 pass.

Finalization: bun run check 353 pass. Fixture tests cover renamed exact copies, a missing-predicate similar match, similar independent rules, and unrelated total. Scan attaches findings to the annotated world and does not write them as relationships. Web How shows the warning label next to the method; TUI How lists copies under the operation. Browser: TypeScript scanner kebabCase warning, copies, peer src/naming.ts, Back restores scroll.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Core reports duplicated TypeScript operations as architecture findings after a scan, not as relationships. Web and TUI How show copies next to the owning method; scan prints a count and listing. Verified with fixture tests, bun run check (353 pass), and browser checks on TypeScript scanner How (warning label, copy open, Back restores scroll).
<!-- SECTION:FINAL_SUMMARY:END -->
