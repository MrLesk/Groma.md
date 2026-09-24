---
id: TASK-519.1
title: Configure exclusions per scanner with defaults written at install
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 12:35'
updated_date: '2026-09-24 14:32'
labels: []
dependencies: []
references:
  - package
  - scanner-registry
  - scanner-src-index
  - modules-readiness
  - modules-discovery
  - src-core
modified_files:
  - test-bun/scanner-exclusions.test.ts
  - test-bun/scanner-update.test.ts
  - src/scanner/modules/config.ts
  - src/scanner/modules/package.ts
  - src/scanner/modules/inventory.ts
  - src/scanner/registry.ts
  - test-bun/scanner-session.test.ts
  - test-bun/execution-evidence.test.ts
  - src/scanner/modules/readiness.ts
  - src/scanner/modules/discovery.ts
  - src/source-coverage.ts
  - docs/scanners/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/setup.md
  - docs/agent-instructions/structure.md
  - docs/agent-instructions/inspect.md
  - test-bun/source-coverage.test.ts
  - packages/scanner/src/index.ts
parent_task_id: TASK-519
ordinal: 601000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Core and contract slice of the exclusion policy: the configuration, the host and the plugin contract. The scanners keep their current rules until the next two slices move them into declared defaults.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A scanner entry accepts an `exclude` list of Git ignore patterns; a scanner's effective exclusions are the global list followed by its own, so `!pattern` in its list re-includes a globally excluded file for that scanner and not for others.
- [x] #2 Adding a scanner through `groma scanner add`, setup, init or the web copies the default exclusions its package declares into the new entry; updating a scanner leaves the entry's list unchanged.
- [x] #3 The host lists, checks readiness, scans, filters evidence and watches changes for each scanner with that scanner's effective exclusions.
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
1. Config (src/scanner/modules/config.ts): a scanner entry accepts `exclude`. `exclusionPatterns(config, scanner)` returns the global list followed by the scanner's own, and `exclusion(list)` turns a list into a predicate where the last matching pattern decides. `stringArray` validates pattern lists for the config, the manifest and plugin exports. Registry, readiness, discovery and source coverage match through these instead of their own `ignore()` calls.
2. Install (package.ts, inventory.ts): a scanner manifest may declare `groma.scanner.exclude`; `addScanner`, used by add, setup, init and the web, writes it into the new entry; an update keeps the entry.
3. Host (registry.ts, readiness.ts): `configuredPlugin(module, config)` builds one record per scanner, `{ plugin, settings, excluded }`. `createScannerRegistry` uses it for watching, changed files, the skip check, the scan argument and the evidence filter, and readiness for its skip check. Discovery and discovery-rule watching keep the global list.
4. Source coverage: the no-owner answer names a reader's hiding pattern, and the global pattern only when no scanner's list keeps the file.
5. Docs: docs/scanners/index.md, creating-a-plugin.md (manifest field, listings before exclusions, predicate paths), setup.md, the agent structure and inspect guides, and the scan comment in packages/scanner.
6. Test decisions. T1 scanner-exclusions: a scanner's `!pattern` restores a globally excluded file for it alone, its own pattern hides a file for it alone, in scans and watching, and its list comes from its manifest at add. T2 scanner-update: an update keeps the entry's list instead of the package's new defaults. T3: readiness and scan hooks skip inputs only the scanner's own list excludes, and in source-coverage one scanner's negation changes only its own no-owner answer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented as planned: ConfiguredScanner.exclude with exclusionPatterns and exclusion as the one owner of list order and matching (registry, readiness, discovery and source coverage use them); the manifest may declare groma.scanner.exclude, which addScanner writes into the new entry; createScannerRegistry takes one predicate per scanner for watching, changed files, the skip check, the scan argument and the evidence filter; checkReadiness receives the scanner's predicate. Review of my own diff found one wrong answer before it shipped: the no-owner reason named a global pattern even when a scanner's own list restores the file, so it now answers from the global list only when no scanner keeps the file (guarded by one extra assertion). All three test changes failed on the old code (config and manifest rejected the new fields) and pass now; focused suites 17 pass; tsc and Biome clean.

Full repository check on e6881eca (HEAD fcfeec2f plus only TASK-519.1 changes; other sessions' hunks in docs/scanners/index.md and creating-a-plugin.md excluded), separate worktree with bun install --frozen-lockfile: bun run check exit 0, 728 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change.

Cold simplicity review (fresh agent, task plus diff, no history): largely the simplest implementation. Applied: the missing no-owner row in docs/agent-instructions/inspect.md (DoD #3); dropped the unread checkReadiness argument; renamed the global predicate in the loader and fixed the readersOfFile doc; removed the stale shared-exclusions sentences in creating-a-plugin.md and the add/preserve contradiction in index.md; required scanner in exclusionPatterns; source coverage builds matchers through exclusion; clearer names; one stringArray guard; one record per scanner in the registry; no-owner assertions moved to source-coverage.test.ts. Not applied: inlining the manifest check helper as written, which would raise scannerPackage above the complexity limit; the shared guard keeps it at the limit instead. Focused suites 22 pass; tsc and Biome clean.

Full repository check on aa91d259 (HEAD fcfeec2f plus only TASK-519.1 changes after the cold review; other sessions' doc hunks excluded), separate worktree with bun install --frozen-lockfile: see the result above in this note's check log; exit recorded below.

Result of that check on aa91d259: bun run check exit 0, 728 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change.

Full-context review (a general-purpose agent with a written brief; the fork type is unavailable): keep the model; one owner per concern except two routes into the registry. Alex approved all its recommendations. Applied: one record per scanner, { plugin, settings, excluded }, built by configuredPlugin for the registry and readiness, replacing the settings wrapper and the separate exclusion lookup; creating-a-plugin.md now says listings select what the language build compiles before exclusions, moves the example's .venv from watch.exclude to the manifest, and states that the predicate takes repository-relative paths (also in the scan comment); docs/scanners/index.md says a global ! cannot restore what a scanner's own list excludes and that viewers reload the configuration themselves; references modules-readiness, modules-discovery and src-core added. The plan above was rewritten to the final approach; the steps it replaced (an optional scanner argument, a checkReadiness predicate) are recorded in the corrections above. Focused suites 29 pass; tsc and Biome clean.

Full repository check on b7bbec59 (HEAD fcfeec2f plus only TASK-519.1 changes after both reviews; other sessions' doc hunks excluded), separate worktree with bun install --frozen-lockfile: bun run check exit 0, 728 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Each scanner entry in groma/scanners.json can now carry its own exclude list, applied after the global list in Git ignore order, so a scanner's own pattern adds an exclusion and its ! pattern restores a globally excluded file for that scanner alone. A scanner package may declare default exclusions in groma.scanner.exclude; adding the scanner (CLI add, setup, init or the web) writes them into its entry, and updates keep the list. config.ts owns list order and matching (exclusionPatterns, exclusion); the host runs each scanner as one record, { plugin, settings, excluded }, built by configuredPlugin and used for watching, changed files, the skip check, the scan argument, the evidence filter and readiness; discovery keeps the global list; the no-owner answer names the pattern that hides a file for its reader. Docs cover both lists, the manifest field and that listings select what the language build compiles before exclusions. Verified: the new and extended tests in scanner-exclusions, scanner-update and source-coverage failed on the old code and pass now, and bun run check on a commit of HEAD plus only this task passes (728 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
