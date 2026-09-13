---
id: TASK-360
title: Install and restore scanner plugins from pinned Git sources
status: Done
assignee:
  - '@codex'
created_date: '2026-09-12 20:39'
updated_date: '2026-09-13 02:31'
labels:
  - scanners
dependencies:
  - TASK-356
  - TASK-359
references:
  - TASK-228.2
  - TASK-358
  - scanner-modules
documentation:
  - docs/scanners/creating-a-plugin.md
modified_files:
  - src/scanner/modules/package.ts
  - src/scanner/modules/inventory.ts
  - src/scanner/registry.ts
  - src/scanner/cli.ts
  - docs/scanners/creating-a-plugin.md
type: feature
ordinal: 406000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A third-party author should be able to share a scanner through a Git repository without publishing to npm. Extend the existing Groma scanner installation flow to accept a public Git repository source alongside exact npm versions and local folders. A supported Git repository contains one runnable scanner package at its root using the same manifest and runtime contract. Native worker programs, when required, must already be supplied by the author; this task does not add consumer compilation or a GitHub release-asset downloader. Establish the npm journey first, then prove Git sharing with the runnable author example.

Keep this work limited to scanner plugins. Project selection stays in the existing scanner configuration, downloads are shared across projects, and discovery metadata uses the contract from TASK-358. No marketplace, third-party recommendation index, global activation scope, compatibility migration, or new plugin framework is required. Follow TASK-352: use focused manual evidence for installation and release plumbing, keep automated tests on domain behavior, and run the normal repository check for code changes.

Before the manual public-HTTPS acceptance run, record the concrete repository URL, tag, and resolved commit used for the author example. The repository must expose one runnable scanner package at its root; its author supplies any required build output. Runtime dependencies follow the existing scanner installation contract, including no dependency on installation scripts. Selecting or preparing this example does not expand support to private repositories or repository subdirectories.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The same Groma add operation accepts a public HTTPS Git repository with a tag or commit, installs its root scanner package, and validates it through the same plugin contract as npm and local sources; no catalog listing is required.
- [x] #2 Groma records the repository and resolved immutable commit so a teammate can restore exactly the same scanner even if a tag later points elsewhere. Restore uses the recorded commit rather than selecting a newer revision.
- [x] #3 Git installations use the shared cache while activation and scanner settings remain project-specific. Listing, readiness, scanning, and removal work through the existing flow; removing a project selection preserves downloads needed by other projects.
- [x] #4 A developer shares the runnable author example through a Git source; another project installs it and a second checkout restores the same commit. Required runtime dependencies are available through installation, without building a native scanner on the consumer machine.
- [x] #5 Document the supported Git source form, author packaging responsibilities, exact-revision restore, and explicit installation requirement. No automatic network installation occurs during scanning or viewer startup.
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
Use the shared installer for git+https://repository#tag-or-commit, pin resolved commits in project configuration, and retain explicit restore and shared cache behavior. Publish the bundled teaching example at https://github.com/MrLesk/groma-scanner-example.git with tag v0.1.0, then verify public add/check/scan and exact restore into a second checkout using compiled Groma 0.3.0. Keep prior moved-tag and isolation evidence; do not add private-repository or subdirectory support.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented git+https://repository#tag-or-commit through shared installer. Focused compiled CLI verification used the TASK-359 bundled example and a disposable local Git repository, with Git URL rewriting for the HTTPS-shaped source: add, list, check, scan, moved-tag exact restore in a second project, no implicit installation on missing scan, and independent removal all passed. This verifies installation behavior, not public HTTPS hosting; AC1/4 public-network evidence remains pending. bun run check passed: 16 Node tests, 256 Bun tests, 6 existing skips. Cold simplicity review found no changes needed. Own specification and quality review found no implementation blocker; source parsing, cache ownership, immutable config and explicit network boundary meet scope.

Final full-context complexity review found no material findings. Implementation preparation is complete; public HTTPS hosting evidence remains explicitly pending.

Prepared the public Git acceptance example at https://github.com/MrLesk/groma-scanner-example.git, tag v0.1.0, root commit 0f51dbd. Its root package uses published @groma/scanner@0.1.0 and includes the built dist/index.js plus source fixture and license. Public hosting and HTTPS verification follow; no local Git URL rewrite is used for this run.

Public HTTPS acceptance passed using https://github.com/MrLesk/groma-scanner-example.git tag v0.1.0, resolved commit 0f51dbd6758e2ccbd25c8116d694dc0444f623de, with compiled Groma 0.3.0. The root package includes its built entry and declares published @groma/scanner@0.1.0. In disposable projects, public add/check/scan and listing passed; deleting only this example's newly created shared cache then restoring from a second checkout fetched the exact recorded commit and preserved configuration bytes. Removing the first selection retained the second selection and shared download. No URL rewrite or local registry was used. Evidence: /tmp/groma360-public-verify.py and /tmp/groma360-public-evidence.json. Existing moved-tag behavior evidence remains valid. Own specification and quality review found no remaining acceptance blocker.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @codex
created: 2026-09-12 20:41
---
Astra reviewed this task without conversation history. Clarified the identified handoff gaps; unresolved release or example choices are explicitly recorded rather than inferred. Scope and To Do status are unchanged.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Git scanner installation through the same package contract and project selection flow as npm and local folders. Tags are pinned to full commits, explicit install restores them, and downloads are shared without global activation. Public Git example add/check/scan and cold-cache second-checkout restore passed with Groma 0.3.0; moved-tag, settings and isolation evidence also passed.
<!-- SECTION:FINAL_SUMMARY:END -->
