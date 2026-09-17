---
id: TASK-428
title: Summarize discovered source files per technology
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-17 18:51'
labels: []
dependencies: []
references:
  - modules-discovery
modified_files:
  - src/scanner/modules/catalog.ts
  - src/scanner/modules/discovery-rules.ts
  - src/scanner/modules/discovery.ts
  - docs/scanners/discovery.md
  - test-bun/scanner-discovery.test.ts
  - docs/scanners/creating-a-plugin.md
type: enhancement
ordinal: 501000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`groma scanner discover` prints one line per matching file for technologies identified by source files rather than a project file. A PHP plugin with 21 files produces 21 nearly identical lines, which hides the recommendations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Discovery prints one line per technology identified by source files, with the file count and the first matching path.
- [x] #2 Technologies identified by project files keep one line per project file.
- [x] #3 Discovery documentation shows the summarized line; focused tests cover it.
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
1. src/scanner/modules/discovery-rules.ts: a presence rule (type file) whose patterns all match a file extension, such as **/*.php, identifies its technology by source files; its findings carry sourceFiles: true. Rules naming exact project files (tsconfig.json, setup.py) and parsed project files (*.csproj, pom.xml, Cargo.toml) stay project declarations, so no plugin manifest or plugin contract changes.
2. src/scanner/modules/catalog.ts: TechnologyFinding gains the optional sourceFiles flag.
3. src/scanner/modules/discovery.ts: formatDiscovery groups source findings by technology, declaration and version, keeping the position of the first finding, and prints one line per group: <technology> <version> <declaration>: <count> files; first <path> (one file prints <declaration>: <path>). Project declarations keep one line each. The JSON result keeps every finding.
4. docs/scanners/discovery.md: show the summarized line and say that other declarations keep one line per project file.
5. test-bun/scanner-discovery.test.ts: a temporary Git repository with several .php files and two tsconfig.json project files; assert one php line carrying the count and the first path, and one line per tsconfig.json.
6. Verify with bun run check in an isolated worktree and groma scanner discover in this repository, before and after.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: a presence rule (type file) whose patterns all match a file extension, such as **/*.php, finds its technology in source files; discoveryRuleFindings marks those findings with sourceFiles: true (TechnologyFinding in catalog.ts). Rules that name exact project files (tsconfig.json, setup.py, requirements.txt) and parsed project files (*.csproj, pom.xml, Cargo.toml, go.mod, package.json) stay project declarations, so no plugin manifest, plugin contract, or creating-a-plugin.md change was needed. formatDiscovery groups source findings by technology, declaration and version at the position of the first finding and prints '<technology> <version> <declaration>: <count> files; first <path>', or '<declaration>: <path>' for a single file; project declarations keep their existing line. discoverScanners and the --json result keep every finding, so paging (TASK-420) can page the grouped lines and the web setup list is unchanged.
Verification: test-bun/scanner-discovery.test.ts builds a temporary Git repository with three .php sources and two tsconfig.json projects: the PHP technology prints one line carrying '3 files' and only the first path, one .php source prints the path without a count, and the two TypeScript projects keep one line each. In this repository, groma scanner discover went from 27 to 23 lines; the five Swift source lines became 'swift version unresolved Swift source files: 5 files; first plugins/scanners/swift/worker/Contract.swift'. bun run check in an isolated worktree at 92af9300 with only TASK-428 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 432 bun tests pass (24 skipped), 0 fail.

Cold review applied. Documentation: docs/scanners/discovery.md now states the criterion correctly (a file-presence rule whose patterns are all extension globs, such as *.php and *.swift, summarizes; exact filenames such as tsconfig.json or setup.py and parsed project files such as *.csproj keep one line per file) and gained the *.swift row. The same clause was added to the file rule row in docs/scanners/creating-a-plugin.md; that file had TASK-416's uncommitted hunks, and TASK-416's commit 6bea8c0b staged the whole file, so my clause is already in that commit and is not part of this task's commit.
Accepted optional findings: findingGroups is one Map keyed by technology and declaration for flagged findings and by the finding object otherwise, relying on insertion order, with version out of the key; FindingGroup.files is now fileCount and the rule sets sourceFiles: findsSourceFiles(rule) with an optional boolean; the test uses its own two-scanner catalog (an extension-glob rule and an exact project-file rule) instead of the production PHP and TypeScript manifests, and reads the evidence column by splitting tabs.
Re-verification: focused tests pass; groma scanner discover in this repository still prints one Swift line for five files. bun run check in an isolated worktree at 6bea8c0b with only TASK-428 changes passed: biome and tsc clean apart from existing warnings in other files, 16 node tests and 436 bun tests pass (25 skipped), 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma scanner discover now prints one line per technology that a file-presence rule identifies through extension globs, carrying the file count and the first matching path, so a project's PHP or Swift sources no longer bury the recommendations; this repository's report fell from 27 to 23 lines. Rules that name exact files or parse a project file keep one line each, and the --json result still lists every finding. Verified with test-bun/scanner-discovery.test.ts on a temporary Git repository and its own two-scanner catalog (three source files summarize with the count and first path, one source file prints no count, two project files keep their own lines), the real command in this repository, and bun run check in an isolated worktree (16 node and 436 bun tests pass).
<!-- SECTION:FINAL_SUMMARY:END -->
