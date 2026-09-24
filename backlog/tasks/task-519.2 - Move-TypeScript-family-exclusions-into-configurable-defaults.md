---
id: TASK-519.2
title: Move TypeScript-family exclusions into configurable defaults
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 12:35'
updated_date: '2026-09-24 18:31'
labels: []
dependencies: []
references:
  - scanners-projects
  - angular-src-index
  - javascript-src-index
  - react-src-index
  - typescript-src-index
  - vue-src-index
  - workspace-packages
modified_files:
  - plugins/scanners/typescript/package.json
  - plugins/scanners/typescript/src/files.ts
  - plugins/scanners/typescript/src/index.ts
  - plugins/scanners/typescript/src/graph.ts
  - plugins/scanners/typescript/src/scan.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/typescript/src/projects.ts
  - plugins/scanners/workspace-packages.ts
  - test-bun/typescript-workspace.test.ts
  - docs/scanners/typescript/index.md
  - plugins/scanners/javascript/package.json
  - plugins/scanners/javascript/src/sources.ts
  - plugins/scanners/javascript/src/index.ts
  - docs/scanners/javascript/index.md
  - docs/scanners/javascript/validation.md
  - test-bun/javascript-scanner.test.ts
  - plugins/scanners/react/package.json
  - plugins/scanners/react/src/scan.ts
  - plugins/scanners/react/src/index.ts
  - plugins/scanners/react/src/project.ts
  - test-bun/react-scanner.test.ts
  - docs/scanners/react/index.md
  - plugins/scanners/vue/package.json
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/vue/src/project.ts
  - test-bun/vue-scanner.test.ts
  - docs/scanners/vue/index.md
  - test/fixtures/javascript-source/public/bundle.js
  - test-bun/scanner-source-listing.test.ts
  - plugins/scanners/projects.ts
  - plugins/scanners/typescript-project.ts
  - plugins/scanners/entry-points/javascript.ts
  - plugins/scanners/angular/package.json
  - plugins/scanners/angular/src/project.ts
  - plugins/scanners/angular/src/scan.ts
  - test-bun/angular-scanner.test.ts
  - test-bun/nested-scanners.test.ts
  - test-bun/scanner-evidence.test.ts
  - docs/scanners/angular/index.md
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - groma/scanners.json
parent_task_id: TASK-519
ordinal: 602000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TypeScript-family slice of the exclusion policy (typescript, javascript, react, vue, angular and their shared helpers). Starts after the Angular qualification session (TASK-501) lands, because it edits the same shared helpers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The TypeScript, JavaScript, React, Vue and Angular scanners declare their test, fixture, minified, generated, vendored and build-output exclusions as defaults and no longer skip those files in code.
- [x] #2 They apply their effective exclusions to sources, tsconfig files, package manifests and HTML pages alike, so a folder's sources and its configuration are read or skipped together.
- [x] #3 Groma's own `groma/scanners.json` lists the defaults of its configured TypeScript-family scanners.
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
1. TypeScript, JavaScript, React and Vue: package defaults; no policy in code (the TypeScript ignore list and glob engine, the JavaScript .min name rule and line-length check); the predicate reaches file selection, tsconfig discovery, workspace manifests and project reads; listings come before exclusions; watch.exclude is empty.
2. Angular: defaults (*.spec.ts, *.test.ts, .angular/, node_modules/, vendor/, dist/, build/, coverage/, generated/); isTest deleted; the predicate reaches project selection, sources, tsconfig discovery and the entry reader.
3. Shared helpers: withJavaScriptEntries requires the scanner's predicate for package.json, angular.json, project.json, nx.json and HTML; frameworkProjects and frameworkProjectFiles take it (listings pass none); one reader, packageManifest in projects.ts, lets a package.json that is not JSON name no package or dependency, for frameworkProjects and packagePaths alike; projectFiles and its folder set are deleted. Groma's own folders need no new home: Git never lists .git, the watcher already skips groma/.groma, and no scanner reads Markdown or scanners.json.
4. groma/scanners.json: the typescript, react, vue and angular entries carry their defaults, edited in place.
5. Docs: each scanner page links to the shared exclusion section; the overview says only language coverage stays built in; the plugin guide's React listing row.
6. Tests: one proof per scanner with broken inputs in excluded places (and a ! restore where a rule used to live in code); obsolete tests of deleted rules removed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Handoff from the TASK-519.1 full-context review. The first scanner slice to start adds the exclusion argument to checkReadiness (contract, and readiness.ts passing the record's excluded) together with its first reader. The slice that lands last deletes the shared folder set in plugins/scanners/projects.ts; its groma, .groma and .git entries are Groma's own state rather than policy and need an explicit home. plugins/scanners/project-scanner.ts (Go, Java) and Java's own scan drop the predicate today, and projectScanner runs each project with its folder as root, so it must pass file => excluded(path.posix.join(key, file)). Remove the exclusion rules from watch.exclude in the same change, or a ! restore changes what is read without triggering a rescan. Update Groma's own groma/scanners.json by editing entries in place; removing and re-adding would drop the C# input and Rust manifest settings. Prove it with a broken input in an excluded folder beside valid sources, plus a !-restored file that must appear: output-only checks pass even when a scanner ignores the predicate, because the host filters evidence anyway. Everything a scanner reads means the inputs it selects, not files a compiler reads as context.

Test decisions (rule and authority, the wrong result it catches, the gap it closes). Authority: TASK-519 AC3 and AC4 and this task's AC1 and AC2. Each proof puts an input that fails the scan if read in an excluded place, because output-only checks pass even when a scanner ignores the predicate:
- typescript-workspace: built output holding an invalid tsconfig.json and a copied @acme/api manifest, page.spec.ts excluded and !page.test.ts restored; wrong result: the scan fails on the config, the import stays unresolved through the copied manifest, or the old code rule hides the restored file.
- javascript-scanner: the fixture test passes the defaults, so the .min.js name stays out by pattern; 'the scan reads a minified name a later pattern restores' catches a .min rule left in code. The line-length test and the long-lined fixture file (public/bundle.js) were deleted with the rule (AC3 forbids a minified rule the configuration cannot change).
- react-scanner 'React reads no source its exclusions name...': a broken editor.test.tsx, a restored panel.test.tsx, and a vendored React package with an invalid tsconfig.json; wrong result: readiness or scan fails, the restored test is missing, or an unfiltered project selection reads the vendored config (REACT_SOURCE_INVALID, confirmed by removing the predicate from frameworkProjects).
- vue-scanner 'Vue reads no source its exclusions name, even one its config includes': a broken vendored component the tsconfig includes; wrong result: VUE_SOURCE_INVALID (confirmed by removing the predicate from the project's root names). The restore case was dropped after the cold review: Vue never had a rule in code a restore could expose.
- angular-scanner: the Nx test now passes the defaults, and its listing assertion names the spec (listings come before exclusions); 'Angular reads no project, config, source or entry declaration its exclusions name, and a ! pattern restores a spec' holds a vendored Angular package with an invalid tsconfig.json and a broken source, an invalid generated/angular.json, a vendored package.json that is not JSON beside a tsconfig.json, and !src/app.spec.ts. Removing the predicate from project sources, from tsconfig discovery or from the entry reader each fails it, and so does a strict manifest read in the listing.
- nested-scanners: dropped the node_modules case, whose rule (the shared folder set) no longer exists; scanner-evidence: dropped test-file inputs that only exercised the rules now in defaults; scanner-source-listing: the JavaScript row names public/vendor.min.js, which only the defaults hide.
Corrections: removed JavaScript's line-length check, which the delegated brief had kept in code against TASK-519 AC3; the React and Vue scans and the entry reader, which the delegated agent was told to leave, now get the predicate; the shared manifest reader moved from workspace-packages.ts to projects.ts so frameworkProjects and packagePaths share one rule (a package.json that is not JSON names no package or dependency). Cold simplicity review applied: removed a wrong JavaScript doc statement (the host skips a scanner whose sources are all excluded, so its readiness message never appears), trimmed the JavaScript and Vue tests to the assertions that can fail, dropped a listing-test workaround for the shared tree, defaulted the predicate once at each plugin entry point and required it in scan-only helpers, and clarified the Vue matcher guard and the manifest reader's reason.

Verification: bun run check on a commit of main 48ea5bcf plus TASK-519.3 plus only this task's files (43bb39eb): 741 pass, 48 skip (toolchain-gated suites), 0 fail; tsc clean; Biome clean except three older warnings in files this task does not change. The focused TypeScript-family suites (angular, typescript, javascript, react, vue, nested-scanners, scanner-exclusions, source-coverage, execution-evidence, scanner-evidence, declared-source-listing) pass in the shared tree: 142 pass, 0 fail. Each new proof was checked against its wrong result by removing the predicate it guards.

Behavior note from the full-context review: the shared reader applies in scans too, so a package.json that is not JSON and that no exclusion names makes its package no React, Vue or Angular project rather than failing the scan (the TypeScript scanner still reads its sources). A scan that selects an unreadable manifest fails with its parse error only in the PHP and Rust scanners.

Alex's decision (2026-09-24) after the full-context review: a scanner's defaults name only its own ecosystem's files and folders, so vendor/ and generated/ left the TypeScript, JavaScript, React, Vue and Angular defaults (node_modules/, dist/, build/, coverage/, their test or minified names and Angular's .angular/ stay). Groma's scanners.json entries, the scanner pages and the tests follow: the React, Vue and Angular proofs put their excluded inputs under node_modules/ and dist/. Full-context review R1 applied: the plugin guide now says Groma runs every listing before each readiness check and scan, so a listing that throws fails its scanner, and that a manifest the build cannot read names nothing. The review's structural recommendations went to TASK-519.4 with Alex's include-list and useGitignore model.

Verification after the defaults decision, on main be1ba357 plus TASK-519.3 (commit aa8edbd1): bun run check 741 pass, 48 skip, 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TypeScript, JavaScript, React, Vue and Angular scanners no longer hide tests, minified, dependency or build files in code: TypeScript's ignore list and glob engine, JavaScript's .min rule and line-length check, and Angular's spec rule are gone. Each package declares that policy as default exclusions naming only its own ecosystem's folders and names (node_modules/, dist/, build/, coverage/, test or minified names, Angular's .angular/), written into its scanners.json entry at add. The predicate reaches sources, tsconfig discovery, workspace manifests, framework project selection and the shared entry reader (package.json, angular.json, project.json, nx.json, HTML), which now requires it. The shared folder set and projectFiles are deleted, and one reader lets a package.json that is not JSON name no package or dependency, so listings, which run before exclusions, never fail on a broken excluded manifest; the plugin guide now says what a listing owes. Groma's own typescript, react, vue and angular entries carry their defaults. Verified by proof tests with broken inputs in excluded places for TypeScript, React, Vue and Angular, each confirmed to fail when its predicate is removed, a restored .min name for JavaScript, and bun run check on a commit of main plus TASK-519.3 plus only this task (741 pass, 0 fail). Visible include lists and a useGitignore flag follow as TASK-519.4.
<!-- SECTION:FINAL_SUMMARY:END -->
