---
id: TASK-397
title: Accept explicit multi-file source units from scanners
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 13:30'
updated_date: '2026-09-15 14:14'
labels:
  - scanner
  - core
dependencies: []
references:
  - scanner-src-index
  - src-scanner
  - scanners-projects
  - scanner-registry
documentation:
  - docs/component-markdown.md
  - docs/scanners/evidence.md
modified_files:
  - packages/scanner/src/index.ts
  - plugins/scanners/observations.ts
  - src/scanner/registry.ts
  - src/scan-source-units.ts
  - src/scan-reconciler.ts
  - test-bun/scan-source-units.test.ts
  - test-bun/scanner-exclusions.test.ts
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/evidence.md
  - docs/component-markdown.md
type: feature
ordinal: 443000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fresh scans create one component per unowned file even when a framework or language explicitly identifies several files as one implementation unit. Humans and agents should receive useful initial ownership without manually combining these files. Angular class/template/style files, Vue external component blocks, and C# partial classes are the approved plugin examples.

Scanners supply source associations; core owns architecture identity and ownership. The durable result is an existing C4 component with multiple Code references in OKF Markdown. Associations remain temporary evidence, not a new architecture level or persisted inference history. Existing curation remains authoritative. Plugin extraction belongs in dependent tasks; broader naming, domain grouping, container inference, and relationship detection are outside scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scanner observations can express explicit multi-file source units. Public contract parsing, validation, project path relocation, observation combination, and exclusions preserve valid associations without claiming excluded files.
- [x] #2 A fresh scan creates one component per unambiguous unit, containing all participating files and their scanner attribution. Every physical file has at most one owner, including files also reported by another scanner.
- [x] #3 Repeated scans and reordered overlapping observations preserve identity and membership. Human or agent renames, moves, combines, descriptions, and authored relationships remain intact.
- [x] #4 A newly discovered unowned file associated with an existing unit joins its component. Files with different established owners, or shared ambiguously by proposed units, are not silently merged or reassigned; the unresolved association is reported.
- [x] #5 A disappearing association preserves established ownership and is reported for review. Existing missing-file and failed/incomplete-scanner retention rules remain effective; automatic ownership migrations and splits are excluded.
- [x] #6 Details expose every member file and relationships project through the common owner without internal self-links. Focused fixtures verify fresh creation, repeats, scanner overlap, incremental attachment, conflicts, and disappearance while preserving curation.
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
1. Add explicit source-unit evidence to the scanner contract and preserve it through parsing, relocation, composition, and exclusions. 2. Reconcile unambiguous units through existing component ownership, attach only unowned files, and report conflicts or unsupported existing membership without stored provenance. 3. Verify fixtures for lifecycle, overlap, curation, and relationship projection; update contracts and run required checks and reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented explicit sourceUnits with primary and member paths, deterministic composition, exclusion handling, and core ownership reconciliation. New fixture checks pass for contract, overlap, attachment, conflicts, unsupported membership, authored content, manual combines/moves, and self-link suppression. Full repository check passed outside sandbox: 323 Bun tests, 15 optional skips, and Node suite. Initial sandbox run blocked filesystem watchers, test server ports, and process inspection; no assertions or execution policy were weakened. Cold simplicity review underway.

Cold simplicity review passed with no blockers. Applied its two suggestions: count overlapping memberships directly, and explicitly omit sourceUnits in the non-associating scanner test. Adjusted review wording to describe current evidence without implying stored association history. Implementer specification review maps all six ACs to fixture and existing retention checks; quality review found no remaining supported-flow defect.

Final complete check passed: 323 Bun tests, 15 optional skips, 16 Node tests, lint and types. Full-context complexity review passed with no findings. Source-unit lifecycle is verified through shared core/model details data and existing relationship projection; no viewer semantics or persisted metadata changed.

Angular integration review found a supported lifecycle gap: removing a template declaration also removes that still-existing file from the scanner inventory. The current support check only inspected observed members, so it retained ownership but omitted the required review diagnostic. Reopening AC5 for a focused regression and correction.

The companion-removal regression failed before the fix and now passes. Membership review examines retained same-scanner Code references after the existing missing-file refresh, including still-existing companions that are no longer inventoried. The targeted correction adds no history or ownership behavior. Specification/quality re-review confirms the required disappearance diagnostic and existing failed-scanner retention.

Full repository check after the integration regression fix passed: 326 Bun tests, 15 optional skips, 16 Node tests, lint and types.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Scanners can report explicit multi-file source units. Core creates or extends one component when ownership is unambiguous, preserves curation, and reports conflicts or unsupported existing membership. Parsing, composition, relocation and exclusions preserve associations. Fixtures, full repository checks, and required reviews passed.
<!-- SECTION:FINAL_SUMMARY:END -->
