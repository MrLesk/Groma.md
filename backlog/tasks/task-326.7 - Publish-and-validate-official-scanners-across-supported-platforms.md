---
id: TASK-326.7
title: Publish and validate official scanners across supported platforms
status: In Progress
assignee:
  - '@codex'
created_date: '2026-09-08 21:34'
updated_date: '2026-09-09 13:19'
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
Developers on supported macOS, Windows, and Linux targets can install official scanner releases through Groma and reproduce the documented scan journey using their existing language tools. Deliver the package publication and consumer validation needed to turn the language tasks into available official plugins, and register the tested exact versions in the official catalog.

Reuse suitable packaging and CI work from the C#, Java, Go, and Rust research branches and Groma's existing compiled-release pipeline. Validate the actual distributable package in compiled Groma rather than treating source tests or staged files as proof of consumer installation. Declare and test the supported OS/CPU and language-tool versions, including the operating-system requirements of any native worker. Do not claim support from a skipped job or a successful research setup workflow.

First complete the Java/Angular/embedded-TypeScript journey on ../callforpapers, then qualify C#, Go, and Rust against their supported examples. Publish the separate Angular plugin with its own compatible TypeScript tooling and verify that Groma's embedded 7.1 SDK remains available. Test shared-file identity, complementary evidence, and explicitly reported conflicting claims without a plugin-priority winner. Include framework discovery/coverage reporting, source-change rescanning, curated ownership, explicit scan failure, and rerunning discovery after a supported project is added. Support documentation must identify limits without promising all languages, frameworks, or runtime interactions. This task implements the release pipeline and consumer checks; it is not a documentation-only sign-off.

The official framework package set also includes Vue and React from TASK-326.10 and TASK-326.11. Apply the same actual-artifact consumer qualification, documented tooling, source-ownership preservation, and truthful catalog availability to their single reviewed examples after technical acceptance. Public naming and publication approval requirements remain unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Versioned official C#, Java, Go, Rust, and Angular packages are published and installable through Groma; the catalog identifies compatible versions, actual technology coverage, and Angular's complementary role alongside embedded TypeScript.
- [ ] #2 Consumer verification uses the actual distributable artifacts with compiled Groma and documented language tools on every advertised OS/CPU target; unsupported targets and native runtime requirements are stated explicitly.
- [ ] #3 ../callforpapers completes discovery, selection, installation, readiness, scan, and human review with Java, Angular, and embedded TypeScript, without manually configuring a plugin path or assembling compiler inputs.
- [ ] #4 Each additional scanner passes its declared supported example through the same lifecycle; the resulting coverage report distinguishes supported analysis from unresolved or unsupported evidence.
- [ ] #5 Source and supported HTML-template updates and repeat scans preserve curated ownership. Overlapping scanners do not duplicate elements; complementary evidence is retained and disputed claims do not produce derived relationships. An enabled scanner failure preserves the previous complete architecture, and rediscovery recognizes a newly added supported project.
- [ ] #6 Release instructions and CI provide reproducible exact-version installation and required project preparation, with no claim that users can scan without their language tools.
- [ ] #7 Repository checks and the required task reviews pass, and release evidence records the tested artifacts, platforms, tool versions, supported examples, and material limits.
- [ ] #8 Vue and React packages pass their reviewed examples through the same actual-artifact consumer and declared-platform release gates, and verified exact releases are included in the official catalog.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [ ] #2 Relevant checks pass and changes remain task-scoped.
- [ ] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect package builders and exact-version installer; keep public names, native package layout, and CI topology pending coordinator/user decisions.
2. Pack existing scanner builds with npm and exercise those artifacts through a local registry and compiled Groma in disposable consumer projects, starting with callforpapers Java/Angular/embedded TypeScript. Record artifact hashes, actual host/tool versions, coverage and map evidence.
3. Implement the approved package layout and nonpublishing five-platform CI qualification, using existing supported examples and project preparation. Keep catalog release availability conditional on actual qualified publication.
4. Verify curated ownership, complementary evidence, repeat/source/template edits, explicit failure preservation and rediscovery. Run focused checks; request coordinator cold review, perform specification/quality review, then serialized repository check and full-context review.
5. Record exact qualification results and remaining publication approvals; do not publish, tag, alter authentication, or claim unexecuted platforms.
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
<!-- SECTION:NOTES:END -->
