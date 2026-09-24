---
id: TASK-404
title: Keep scanned component titles and callback relationships readable
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 14:01'
updated_date: '2026-09-15 14:49'
labels:
  - scanner
  - web
dependencies: []
references:
  - src-scanner
  - scan-evidence
  - organisms-details
documentation:
  - docs/component-markdown.md
  - docs/relationship-inference.md
modified_files:
  - src/scan-component-naming.ts
  - src/scan-reconciler.ts
  - src/relationship-inference.ts
  - test-bun/scan-component-naming.test.ts
  - test-bun/source-relationships.test.ts
  - docs/scanners/index.md
  - docs/relationship-inference.md
  - test-bun/scanner-evidence.test.ts
priority: high
type: bug
ordinal: 450000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Call for Papers Company list details pane exposes a generated ID as a title: Cfpdev cfpdev src main webapp app callforpaper companies company list component e9fe312b. Its relationship repeats similarly expanded endpoint names and three copies of Invokes supplied ... callback for cancelled, error, and merged. The screenshot demonstrates a failure in generated architecture content, not merely insufficient panel width. TASK-329 already intended hash-free titles, but core currently calls displayName on the final allocated ID.

Correct naming and derived callback wording at their shared source so all scanners and architecture readers receive useful content. Keep source names such as ProposalService intact; collision handling for identity must not force full paths and hashes into display titles. Use concise wording that retains every concrete callback name and the proven direction, without inventing business meaning or assuming every callback is an event. The supported rendered example is Company merge dialog calling the supplied cancelled, error, and merged callbacks handled by Company list.

Readable titles belong in the standard OKF title field, independently of groma.id. Relationship meaning stays in the existing linked Markdown relationship description, so ordinary readers can understand it. Existing C4 ownership and inference evidence remain authoritative. This work does not add relationship kinds, new metadata, HTTP inference, compatibility migrations, or automatic rewriting of human-authored titles and descriptions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fresh scans assign concise source-derived component titles independently of ID allocation. Identifier casing such as ProposalService is preserved; path-prefix and hash collision handling does not leak into titles. Exact source paths remain available through Code references.
- [x] #2 Files with colliding stems, including a class and template with the same basename, retain distinct identities and correct ownership without requiring titles to reproduce unique IDs. Results are deterministic across source and scanner observation order and do not depend on multi-file association tasks.
- [x] #3 Multiple proven named callbacks for one ordered source-file pair produce a concise combined description that includes every distinct callback name once and preserves direction and callback meaning. The shared rule applies to all scanners supplying this evidence; it does not infer event or business semantics from names.
- [x] #4 Repeat scans preserve corrected generated output, component IDs, source ownership, and authored titles and relationship descriptions. No viewer-only trimming or hash-hiding substitute is used to conceal incorrect stored content.
- [x] #5 A fresh disposable Call for Papers scan demonstrates readable Company list and Company merge dialog titles and the complete concise callback relationship in details, endpoint navigation, and ordinary architecture Markdown. Existing repository-specific prototype titles can be regenerated through Groma-owned operations without introducing a migration.
- [x] #6 Independent concurrent fixtures cover title versus identity allocation, source-name preservation, collisions, ordering, repeat scans, authored content, and callback aggregation/direction. Browser inspection verifies the supplied narrow-pane example without hiding names or callback information; bun run check passes and relevant documentation describes the corrected behavior.
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
1. Separate source-derived display titles from stable collision-safe IDs in core. 2. Aggregate proven callback names once per ordered file pair without changing inference eligibility. 3. Verify collisions, ordering, repeat scans and authored content using independent fixtures. 4. Regenerate a disposable Call for Papers architecture and inspect Markdown and the narrow details pane; update docs and run the full check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nineteen focused naming/relationship tests pass, including source casing, collisions without source units, scanner ordering, repeat scans, and authorship. Full check passed: 340 Bun, 17 optional skips, 16 Node. Updated the obsolete reserved-filename title expectation. Fresh Call for Papers fold produced Company list component and Company merge dialog component with one concise cancelled/error/merged callback statement in Markdown. Browser inspected at 1280x720 and 1024x768; narrow details retain all names, and source/destination navigation selects the correct endpoint. Implementer specification and quality reviews passed; no viewer trimming, migration or inference expansion.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Separated readable source titles from collision-safe IDs and combined proven callback names once per ordered pair. Verified fresh Call for Papers Markdown and narrow browser details, endpoint navigation, independent fixtures and the full repository check.
<!-- SECTION:FINAL_SUMMARY:END -->
