---
id: TASK-361
title: Update project scanner versions explicitly
status: Done
assignee:
  - '@codex'
created_date: '2026-09-12 20:39'
updated_date: '2026-09-12 20:58'
labels:
  - scanners
dependencies:
  - TASK-360
references:
  - TASK-228.2
  - scanner-modules
documentation:
  - docs/scanners/creating-a-plugin.md
modified_files:
  - src/scanner/modules/inventory.ts
  - src/scanner/cli.ts
  - docs/scanners/creating-a-plugin.md
type: feature
ordinal: 407000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Projects can already add and remove scanners, but replacing an installed scanner version requires removing its selection first. Users need an explicit operation to move a selected scanner to a chosen npm version or Git revision while retaining its project settings. Preserve reproducible restores and prevent upgrades to Groma itself from silently replacing project scanners. This task does not require background update checks, automatic latest-version selection, or a batch update service.

Keep this work limited to scanner plugins. Project selection stays in the existing scanner configuration, downloads are shared across projects, and discovery metadata uses the contract from TASK-358. No marketplace, third-party recommendation index, global activation scope, compatibility migration, or new plugin framework is required. Follow TASK-352: use focused manual evidence for installation and release plumbing, keep automated tests on domain behavior, and run the normal repository check for code changes.

The required updates stay within the selected npm package or the selected Git repository. Switching between npm and Git, changing package names, or changing repositories is not required. For npm acceptance evidence, two versions of the TASK-359 example may be served through a disposable local registry; the example need not be publicly published. The Git acceptance uses two recorded revisions of the TASK-360 example. This verification must not recreate the removed qualification infrastructure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A user can explicitly replace a configured scanner with a chosen exact npm version or Git tag/commit through Groma, using the existing installation and validation flow without removing the scanner first.
- [x] #2 The new package retains the selected scanner identity; its exact npm version or resolved Git commit is recorded only after successful installation and validation. A rejected replacement leaves the recorded selection unchanged.
- [x] #3 Per-scanner settings and shared project exclusions survive a version update, and other projects using a different cached version keep their selection.
- [x] #4 Users can inspect the recorded source/version and readiness after an update. Restoring the project installs that exact selection; scanning, viewer startup, and a Groma upgrade do not silently advance it.
- [x] #5 Verify one explicit npm version replacement and one Git revision replacement using the same small author example, and document the command and preserved configuration behavior.
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
Add scanner update <id> <source>, restricted to the same npm package or HTTPS Git repository. Reuse explicit package installation and manifest validation, check scanner identity, then replace only source while preserving settings and project exclusions. Verify successful npm and Git updates, exact restoration, rejected identity/origin and failed install retaining configuration, and other-project isolation with the author example. Use disposable local package data, with no npm publication or account operation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Compiled CLI manual evidence: updated the bundled author example from local-registry package 0.1.0 to 0.2.0 and Git recorded commit to the moved v1 tag. Settings, exclusions and a second project retained their selections; missing Git revision, changed repository and wrong replacement scanner ID left configuration unchanged. Removed the downloaded 0.2.0 package, restored and scanned the exact recorded version. No npm executable, publication or account operation used. bun run check passed: 16 Node tests, 256 Bun tests, 6 existing skips. Own specification and quality reviews passed: this bounded command reuses installation and changes only a validated source after success; no new lifecycle framework.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-09-12 20:42
---
Astra reviewed this task without conversation history. Clarified the identified handoff gaps; unresolved release or example choices are explicitly recorded rather than inferred. Scope and To Do status are unchanged.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added explicit scanner update for the same npm package or Git repository. Installation and scanner identity validation precede configuration writes, preserving settings, exclusions and other projects. Verified compiled npm/Git replacement, rejection without config change and exact restoration with disposable example packages; repository checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
