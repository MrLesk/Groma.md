---
id: TASK-401
title: Deliver a self-contained PHP scanner
status: Done
assignee:
  - '@codex'
created_date: '2026-09-15 13:55'
updated_date: '2026-09-15 14:42'
labels:
  - scanner
  - php
dependencies: []
references:
  - modules-discovery
  - scanner-src-index
documentation:
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/evidence.md
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/php/package.json
  - bun.lock
  - plugins/scanners/php/src/evidence.ts
  - plugins/scanners/php/src/index.ts
  - plugins/scanners/php/build.ts
  - plugins/scanners/php/.gitignore
  - src/scanner/modules/official-catalog.ts
  - scripts/scanner-release.ts
  - test/fixtures/php-source/plugin.php
  - test/fixtures/php-source/view.php
  - docs/scanners/php/index.md
  - test-bun/php-scanner.test.ts
  - test-bun/scanner-fresh-checkout.test.ts
  - docs/scanners/index.md
  - docs/scanners/discovery.md
  - docs/scanners/publishing.md
  - docs/scanners/php/validation.md
type: feature
ordinal: 447000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Call for Papers contains 22 tracked PHP files under src/main/php/cfp_dev_wordpress_plugin, including a WordPress plugin entry point, shortcode functions, and mixed PHP/HTML templates. No current official scanner discovers or analyzes these files. Developers need PHP source evidence through the existing plugin discovery, installation, scan, and refresh flow. TASK-390 provides the recent language-plugin delivery example; TASK-396 establishes that installed scanners carry all analysis tools and need no target-project dependencies.

The supported real example is the PHP subtree in Call for Papers, without Composer or a running WordPress installation. This is a PHP language scanner, not a WordPress framework relationship detector. It returns source facts through the shared contract; core owns C4 component identity and placement. Ordinary OKF Code references make source ownership readable outside Groma. Do not infer architecture collaborations or multi-file ownership merely from include/require statements, directory proximity, or WordPress hook names.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Official discovery recommends the PHP plugin for the tracked PHP source in Call for Papers even without composer.json; installing the packaged plugin makes it available through the normal scanner flow.
- [x] #2 The scanner reports deterministic PHP source inventory, source roots, declarations, and function/method operations with exact file locations, including supported PHP embedded in HTML. Missing external definitions and dynamic call targets are not claimed as resolved.
- [x] #3 A relocated packaged scanner analyzes the supported example without project dependency installation, a separately installed PHP runtime, WordPress, downloads during scanning, or execution of project code; its supported PHP syntax versions and analysis limits are documented.
- [x] #4 PHP source edits and newly added PHP files trigger refresh through the shared watcher. Combined scans with the existing Java, TypeScript, and Angular plugins and repeated scans retain one physical file owner, deterministic results, and human or agent curation.
- [x] #5 Concurrent minimal fixtures verify the contract and refresh/reconciliation behavior. A disposable Call for Papers scan accounts for all 22 tracked PHP files, records any concrete limitations, and demonstrates useful PHP Code references in component details without changing application files.
- [x] #6 The official catalog, package build, release checks, and scanner documentation include PHP using the current plugin delivery conventions; bun run check passes.
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
1. Package a pinned JavaScript PHP parser with source-only Git inventory and parser-derived declaration/operation evidence; leave runtime calls unresolved. 2. Integrate PHP discovery, packaging, release validation and documentation using existing scanner conventions. 3. Verify independent mixed PHP/HTML fixtures, invalid syntax, repeat scans and live edits; qualify the relocated package on the 22 Call for Papers PHP files without project dependencies. 4. Run focused/full checks and required simplicity and context reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Qualification passed on disposable Call for Papers commit 1cb6783f3379664e3f176e72c5419064ce24dbfd: 22 PHP files, 95 declarations, 114 operations, 700 unresolved calls; four-scanner reversed repeat identical, zero created, one owner per PHP file. An older Java package timed out; the current reviewed package completed. PHP focused tests 3 pass; relocated fresh-checkout test 1 pass with only Git on PATH and network blocked; full check 332 Bun pass, 17 optional skips, 16 Node pass. Cold simplicity review found no required changes. Implementer specification and quality reviews found no blocking defects; runtime call limits are explicit.

Full-context complexity review passed with no material recommendations or blockers; source evidence, core ownership, packaging and refresh have clear existing owners.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the self-contained PHP plugin with official discovery, release packaging, live refresh, exact syntax evidence and documented runtime limits. Verified 22 Call for Papers PHP files in a stable combined scan, isolated package execution, concurrent fixtures, the full repository check, and both required reviews.
<!-- SECTION:FINAL_SUMMARY:END -->
