---
id: TASK-359
title: Provide a runnable third-party scanner authoring example
status: Done
assignee:
  - '@codex'
created_date: '2026-09-12 20:39'
updated_date: '2026-09-13 02:24'
labels:
  - scanners
dependencies:
  - TASK-356
references:
  - TASK-358
  - TASK-228.2
documentation:
  - docs/scanners/creating-a-plugin.md
modified_files:
  - examples/scanner/package.json
  - examples/scanner/index.ts
  - examples/scanner/project/inventory-example.json
  - examples/scanner/project/src/greeting.js
  - examples/scanner/project/src/message.js
  - examples/scanner/README.md
  - docs/scanners/creating-a-plugin.md
  - tsconfig.json
  - biome.json
  - examples/scanner/project/src/extra.mjs
type: feature
ordinal: 405000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A third-party developer needs a complete example they can copy and run outside the Groma repository, without workspace-only imports or internal build assumptions. Existing documentation and local-path installation describe parts of the flow; this task supplies an executable example package and the accompanying author journey. Use the smallest scanner that reports real source inventory and root membership for its supplied small project fixture. It must not invent architecture components or add a new language analysis engine. Restarting Groma is sufficient for local iteration; hot reload and a scaffolding command are not required. npm is optional for sharing; Git distribution is handled by the dependent Git installation task.

Keep this work limited to scanner plugins. Project selection stays in the existing scanner configuration, downloads are shared across projects, and discovery metadata uses the contract from TASK-358. No marketplace, third-party recommendation index, global activation scope, compatibility migration, or new plugin framework is required. Follow TASK-352: use focused manual evidence for installation and release plumbing, keep automated tests on domain behavior, and run the normal repository check for code changes.

The supplied project fixture is a runnable teaching example, not a new release qualification suite. Verify it with focused manual commands; only genuine domain behavior belongs in automated tests under TASK-352. Packaged-consumer evidence may use a disposable local npm registry and a prepared tarball. Public publication of the demonstration package is not required.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A copyable example package runs outside the Groma repository using the published scanner contract, with its entry point, required dependencies, discovery metadata, and one small source fixture included.
- [x] #2 A developer adds the example through the existing local-folder command, scans the fixture, changes the scanner, and sees the change after restarting or rerunning Groma without publishing or reinstalling the local package.
- [x] #3 The example explains the path from source evidence to Groma architecture: the plugin supplies observations and discovery data; Groma owns architecture interpretation and persistence. Its output satisfies the current scanner contract.
- [x] #4 The guide takes an unfamiliar developer from copying the example through local use and preparing an npm publication under their own name. Installation by exact npm source requires no official catalog registration. Any executable runtime dependencies are included or clearly declared.
- [x] #5 Record focused execution evidence for the local authoring and packaged-consumer flow. This task does not require publishing a demonstration package to a public registry.
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
Provide one runnable source-inventory scanner package and tiny source fixture using the published @groma/scanner@0.1.0 contract. Document copying it, dependency installation, build, local add/scan/edit/rerun, and package preparation. Verify outside this repository against public npm and compiled Groma; use the normal repository check for code. No scaffolder, hot reload, new language engine, or public example-package publication.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Copied example outside repository with staged contract; compiled Groma added and scanned it. Expanded scanner inventory to include supplied .mjs file, rebuilt and rescanned without reinstall: map gained that source. Packed tarball and loaded it in a separate consumer successfully. Runtime package imports fail under compiled Bun, so example bundles its runnable entry as official scanners do; guide documents this author step. Own specification and quality review passed. Public-contract evidence in AC1 remains deferred by user instruction not to publish npm. Remaining implementation tasks proceed using prepared artifacts.

Final repository-wide verification also passed after the dependent Git/update/TypeScript work. Authoring implementation is prepared; only the published contract prerequisite in AC1 remains outstanding.

2026-09-13: @groma/scanner@0.1.0 published publicly. Copied the unchanged author package outside the repository, installed its exact public dependency from registry.npmjs.org, built it, and used compiled Groma to install and scan the supplied fixture. Changing its filter to include extra.mjs, rebuilding and rerunning changed the map without reinstalling. A packed tarball was extracted and installed as a separate consumer; scan passed. Evidence: /tmp/groma359-public-verify.py and /tmp/groma359-public-example-path. The initial npm installation-metadata response lagged publication; the later documented install succeeded without changing the dependency or install flow. Removed the obsolete staged-contract instruction. Own specification and quality reviews pass; all acceptance and Definition of Done items now have evidence.
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
Delivered a copyable scanner authoring example with its source fixture, published @groma/scanner@0.1.0 dependency, bundled entry and guide. Verified outside the Groma repository: public dependency installation, compiled local add/scan, implementation changes without reinstall, and packed-consumer scan. Relevant repository checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
