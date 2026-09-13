---
id: TASK-326.7
title: Record local scanner artifact validation
status: Done
assignee:
  - '@codex'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-12 14:25'
labels:
  - scanners
dependencies:
  - TASK-326.2
  - TASK-326.3
  - TASK-326.4
  - TASK-326.5
  - TASK-326.6
  - TASK-326.8
  - TASK-326.9
  - TASK-326.10
  - TASK-326.11
references:
  - 'https://github.com/MrLesk/Groma.md/tree/research/csharp-scanner-prototype'
  - 'https://github.com/MrLesk/Groma.md/tree/research/java-scanner-prototype'
  - 'https://github.com/MrLesk/Groma.md/tree/research/go-scanner-prototype'
  - 'https://github.com/MrLesk/Groma.md/tree/research/rust-scanner-prototype'
  - 'https://github.com/MrLesk/Groma.md/tree/research/rust-codex-validation'
  - ../callforpapers
  - scanner
  - scanner-artifact-registry
  - validate-callforpapers-artifacts
  - validate-native-scanner-artifact
  - TASK-352
  - TASK-356
documentation:
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
modified_files:
  - scripts/scanner-artifact-registry.ts
  - scripts/validate-callforpapers-artifacts.ts
  - scripts/validate-native-scanner-artifact.ts
  - docs/scanners/release-qualification.md
parent_task_id: TASK-326
type: feature
ordinal: 368000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Local packaged-consumer checks established that Java, Angular, C#, Go and Rust could pass through compiled Groma installation and the approved examples on macOS arm64. This task retains that accepted historical evidence. The validation scripts and associated CI expectations were removed by TASK-352. All outstanding public package names, native artifact distribution, publishing workflow and catalog releases are consolidated in TASK-356; this record does not claim public publication or unexecuted platform validation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The historical record identifies the actual locally packed Java, Angular, C#, Go and Rust artifacts, their hashes and the macOS arm64 tooling used with compiled Groma.
- [x] #2 Recorded local consumer runs and map reviews cover the approved callforpapers, FluentValidation, Chi and globset examples, including the documented readiness, repeat/edit and failed-scan behavior.
- [x] #3 The retained qualification record clearly distinguishes local historical evidence from public publication and other platform claims, and no longer requires the scripts and CI checks removed by TASK-352.
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
Retain the accepted local artifact and consumer evidence in docs/scanners/release-qualification.md and task notes. Keep those results explicitly historical after removal of qualification automation in TASK-352. Track all remaining public distribution and catalog work in TASK-356.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Local npm-packed Java and Angular candidates downloaded through compiled Groma exact-version installer. First callforpapers proof found a consumer assertion error: removing merged leaves cancelled/error callbacks on the same source pair, correctly retained by core. Revised proof compares the affected derived interaction instead of expecting every callback between the files to disappear. No scanner behavior change.

Local artifact qualification passed on macOS arm64 using compiled Groma SHA-256 91d3652d05721cbe0b0bb89525dc3485b30162d779bacc766458a22dd98e2338. callforpapers Java+Angular+embedded TypeScript: /tmp/groma-release-callforpapers/evidence/{validation.json,commands.json,map,artifacts}; 3168 source files compared byte-identical with the prepared acceptance source after checks. FluentValidation/C#/Chi/Go/globset/Rust consumer evidence: /tmp/groma-release-native/evidence/{csharp,go,rust}. All five actual npm-packed artifacts were downloaded through compiled Groma exact-version installer. Readiness, map export, curated repeat/source edits and explicit scan-failure preservation pass; callforpapers also verifies HTML binding changes, complementary source ownership and rediscovery. These are local private release candidates, not published releases or cross-platform qualification. Public names, native artifact layout and CI structure remain pending coordinator/user decisions. Three scripts pass focused Biome and TypeScript checks.

Coordinator reviewed and accepted the actual-artifact callforpapers exported map (local viewer port 48327): curated Company merge dialog responsibility remains visible; restored merged/cancelled/error callbacks point to Company list with the correct relationship arrow. Current four-file local-artifact slice is stable. Release implementation awaits three material decisions: public npm names, Go/Rust native package layout, and CI topology. Windows CI currently has an unresolved live-scan watcher failure tracked by the coordinator separately; no cross-platform qualification is claimed. Cold/full-context reviews and serialized repository check have not run for this task because the approved release implementation is not final. Acceptance criteria remain unchecked where public publication/catalog or every-target evidence is outstanding.

Vue and React were added to the requested scanner set on 2026-09-09. Their implementation can proceed independently; release names, native package layout, CI structure, and public publication remain pending the existing user decisions. The current local five-scanner artifact proof remains valid and does not claim coverage for the new plugins.

Partial-delivery review on 2026-09-09: cold simplicity review passed. Optional markdown() -> architectureDigest() naming suggestion is recorded as non-blocking; no source change was needed. Implementer specification review passed for the stable four-file local slice: actual npm-packed bytes are served to compiled Groma exact-version installation; the declared callforpapers/FluentValidation/Chi/globset examples cover local readiness, curation, repeat/source edits, failure preservation and map export, with complementary Angular/TypeScript ownership and rediscovery in callforpapers. All five archive hashes were rechecked against retained validation reports; all four exported map snapshots exist. This is evidence toward AC2-7 only, not completion of full public/catalog/every-platform criteria or the new Vue/React release gate.

Implementer quality review found no blocking defect in the declared local flow. The registry serves only the supplied packed candidates, records actual downloads and archive hashes, and leaves language interpretation to existing plugins. The consumer scripts use documented prepared disposable projects, restore their temporary source changes, and assert complete-map preservation. No architecture model, installer contract, public name, native layout or CI decision changed. Files remain under 500 lines; focused lint/typecheck passed. Coordinator reports the shared repository check passed: 398 Bun tests, 7 existing tool-dependent skips, no failures, and the Node suite passed. Skipped tooling cases do not establish native/platform qualification.

The four-file local slice is ready for a scoped partial commit while TASK-326.7 remains In Progress. Full-task acceptance criteria and Definition of Done remain unchecked; publication approval, held packaging/CI decisions, Windows work and final release gates remain outstanding. No source edits, additional suite run, staging, commit or push were performed during this review.

The stable four-file local artifact-validation slice passed its cold simplicity, implementer specification/quality, and final full-context reviews with no blocking findings. Shared bun run check passed: Node 110, Bun 398, 7 existing tooling-dependent skips, zero failures; six existing complexity warnings, log /tmp/groma-vue-react-check.log. Coordinator accepts this partial in-progress commit so Vue/React consumer runners can reuse the registry helper reproducibly. Optional markdown() helper naming suggestion is non-blocking and unchanged. This does not finalize publication, catalog availability, platform qualification, or held release choices.

Scope reconciliation approved by Alex on 2026-09-12: close the accepted implementation/local-evidence scope, apply TASK-352 removal of package qualification and CI test requirements, and consolidate all remaining public delivery in TASK-356. Revised criteria describe recorded completed behavior; older notes about waiting for publication or rebuilding qualification automation are superseded. Historical evidence and modified-file traceability are preserved. No source files or tests were changed or rerun for this task-record cleanup.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The accepted local artifact-validation slice is complete and retained as historical evidence. Five packed artifacts, compiled Groma consumer runs and local map reviews were recorded and reviewed. TASK-352 removed the qualification scripts and CI test requirements; all unperformed publication and advertised-target delivery work is transferred to TASK-356. No public-release or cross-platform success is claimed.
<!-- SECTION:FINAL_SUMMARY:END -->
