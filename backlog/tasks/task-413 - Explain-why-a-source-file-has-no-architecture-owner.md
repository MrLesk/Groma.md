---
id: TASK-413
title: Explain why a source file has no architecture owner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-18 15:47'
labels: []
dependencies: []
references:
  - scanner-registry
  - src-core
  - scanner-src-index
  - javascript-src-index
  - angular-src-index
  - react-src-index
  - vue-src-index
  - java-src-index
  - rust-src-index
  - csharp-src-index
  - go-src-index
  - php-src-index
  - typescript-src-index
modified_files:
  - src/scanner/registry.ts
  - src/source-coverage.ts
  - src/plain-world.ts
  - test-bun/source-coverage.test.ts
  - docs/agent-instructions/inspect.md
  - test-bun/scanner-source-watch.test.ts
  - packages/scanner/src/index.ts
  - docs/scanners/creating-a-plugin.md
  - plugins/scanners/typescript/src/index.ts
  - plugins/scanners/php/src/index.ts
  - plugins/scanners/python/src/index.ts
  - plugins/scanners/go/src/index.ts
  - plugins/scanners/java/src/index.ts
  - plugins/scanners/rust/src/index.ts
  - plugins/scanners/csharp/src/index.ts
  - test-bun/scanner-source-listing.test.ts
  - plugins/scanners/javascript/src/index.ts
  - plugins/scanners/typescript-project.ts
  - plugins/scanners/angular/src/index.ts
  - plugins/scanners/react/src/index.ts
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/swift/src/index.ts
type: enhancement
ordinal: 468000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`groma view <file>` reads only stored architecture (`src/plain-world.ts`). A mistyped path, a file no enabled scanner reads, an excluded file and a new file waiting for a scan all answer `unknown target`, so agents cannot tell a typo from a coverage gap. Scanner watch patterns are not an accurate source selection: Java watches every `.java` file, including test sources it never reads. Storing the scanned file list would rewrite thousands of lines on each scan.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each official scanner can list the repository files it would analyze for the current settings without analyzing them or executing project tools.
- [x] #2 `groma view <file>` for a file without an owner reports one reason: not a repository file, excluded by a named `scanners.json` pattern, read by no enabled scanner, or read by named scanners but not scanned yet.
- [x] #3 Owned files still resolve to their architecture record.
- [x] #4 The scanner plugin contract and command documentation describe the file listing and the messages.
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
1. Contract: ScannerPlugin gains listSourceFiles(repositoryRoot, settings), required of official scanners, returning the repository-relative files the scanner would analyze now, selected the way scan selects them, without analyzing a file or running a project tool.
2. src/scanner/registry.ts exposes sourceFiles(root): each scanner that can list, bound to its configured settings, with shared exclusions applied.
3. src/source-coverage.ts asks four questions in order and returns exactly one reason: git ls-files membership, then each scanners.json exclude pattern matched alone so the answer names it, then the scanners that list the file, then the waiting-for-a-scan case.
4. src/plain-world.ts calls it only when no element owns the file, so element, flow, draft and owned-file answers stay as they are.
5. Every official scanner lists from its own selection: TypeScript, PHP, Python, Go, Java, Rust, C#, JavaScript, and Angular, React and Vue through a shared plugins/scanners/typescript-project.ts helper that lists each framework project's sources and companion templates and stylesheets.
6. Tests: the four messages with generated plugins, an owned file after a scan, and one exact listing per official scanner against its existing fixture.
7. Docs: the plugin contract describes the listing and the four reasons; the inspect guide documents the messages.
8. Run focused tests, then bun run check in an isolated worktree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core slice done; ACs 2 and 3 checked. AC 1 and the contract half of AC 4 are blocked: packages/scanner/src/index.ts and docs/scanners/creating-a-plugin.md both carry another lane's uncommitted compared-operations doc comments, and a plugin cannot add a hook that the ScannerPlugin interface does not declare, because each plugin uses satisfies.
src/source-coverage.ts asks four questions in order and returns exactly one reason: git ls-files membership (tracked and unignored, the same boundary a scan selects from), then each scanners.json exclude pattern matched alone so the answer names the pattern, then the enabled scanners that list the file, then the waiting-for-a-scan case. src/plain-world.ts calls it only when no element owns the file, so element, flow, draft and owned-file answers are unchanged. src/scanner/registry.ts exposes sourceFiles(root), binding each scanner's configured settings and dropping shared exclusions, and carries a temporary local type for the hook until the contract file is free.
Messages: 'unknown target: <target>; not a repository file', 'no owner: <file>; excluded by scanners.json pattern <pattern>', 'no owner: <file>; no enabled scanner reads it', 'no owner: <file>; read by <scanners> and not scanned yet, so run groma scan'.
Evidence: test-bun/source-coverage.test.ts covers all four messages, a mistyped id, a mistyped path and an owned file after a scan. test-bun/scanner-source-watch.test.ts's fake registry gained the new member. Isolated bun run check exited 0 (Bun 461 passed, 30 skipped, 0 failed; Node 16 passed). docs/agent-instructions/inspect.md documents the four reasons.

Contract landed: ScannerPlugin gained listSourceFiles(repositoryRoot, settings), the temporary local type and its TODO are gone, and docs/scanners/creating-a-plugin.md has a Source file listing section stating the rule (select as scan selects, analyze nothing, run no project tool, leave out tests and generated output), that a listing may still name a file the analysis finds unreachable, the four groma view reasons, and that a plugin without the hook contributes nothing to that answer.
Seven official scanners list their files from the selection their own scan uses: TypeScript (listTypeScriptFiles), PHP and Python (their inventory helpers, Python filtered to .py because declaration files describe projects), Go (module directories, skipping dot directories, testdata and _test.go, matching the worker's walk), Java (Maven's declared sourceDirectory or src/main/java, Gradle's parsed source roots, so test sources are excluded), Rust (each crate's src tree) and C# (project directories from the configured inputs, solutions read as text, excluding bin and obj). Angular, React, Vue and JavaScript remain.
Approximations recorded in the contract: a Rust module no crate root declares and a C# file excluded by an MSBuild item glob can appear in a listing, because deciding either needs analysis or a build.
Evidence: test-bun/scanner-source-listing.test.ts asserts the exact listing for each of the seven scanners against its existing fixture, with no worker or project tool run. Isolated bun run check exited 0 (Bun 488 passed, 32 skipped, 0 failed; Node 16 passed; Biome findings only in untouched files).
Verification note: an isolated worktree whose bun install --frozen-lockfile failed (HEAD's lockfile no longer matches package.json) produced a false Swift discovery failure. Recreating the worktree with a plain bun install reproduced a clean pass with and without this change.

Re-verified from current HEAD (6806c41f) with bun install --frozen-lockfile: install clean, bun run check exited 0 (Bun 488 passed, 32 skipped, 0 failed; Node 16 passed). The earlier Swift discovery failure was a worktree created before the JavaScript and Swift scanner packages were committed, not a lockfile problem.

JavaScript scanner lists its files with the same authored selection scan uses (javaScriptSources), so a .min name, minified text recognized by line length, and a TypeScript file stay out. Its listing test asserts exactly the four authored files of test/fixtures/javascript-source. Eight official scanners now list their files; Angular, React and Vue remain.

Angular, React and Vue list per framework project through plugins/scanners/typescript-project.ts: every source of the scanner's kind inside a project directory plus companion templates and stylesheets, with a project-relative rule for extras. React adds the Next.js files whose location declares a route (app/**/route.ts|tsx and pages/api/**), so middleware and declaration files stay out. Vue lists .vue, .ts and .js, which covers a Nuxt project's server/api and server/routes below the repository root. A first attempt read each tsconfig instead and missed an imported component, so the listing selects by extension inside the project and leaves program resolution to the analysis, matching the limit the contract already states.
Eleven official scanners now list their files; test-bun/scanner-source-listing.test.ts asserts one exact listing each. Final isolated bun run check from current HEAD with a frozen install exited 0 (Bun 510 passed, 32 skipped, 0 failed; Node 16 passed; Biome findings only in untouched files). Live check in this repository: groma view plugins/scanners/typescript-project.ts answers 'no owner: ...; read by typescript and not scanned yet, so run groma scan'.

Cold review applied; AC 1 now covers twelve official scanners, not eleven.
1. Swift lists its files with its own files(root) selection, which excludes Package.swift and the .build, Pods and Carthage directories. Its fixture row asserts the two Swift sources.
2. The shared framework helper no longer adds companion extensions. Angular and Vue name them in their own sources, so React lists only its TSX components and Next.js route files; a test writes globals.css into a React project and asserts it is absent while an Angular stylesheet is present.
3. Exclusion is decided with the combined pattern list, so a documented negation restores its file, and the answer then names the last matching non-negated pattern. A test covers both directions with **/*.generated.ts and !src/keep.generated.ts. A negation cannot restore a file inside an excluded directory, which is Git's own rule and what the scanners apply.
4. The contract now tables every approximation: Rust modules no crate root declares, Go files its build constraints exclude, C# files an MSBuild item glob excludes, and Angular and Vue templates or stylesheets no component declares. It also states the rule that a listing must never leave out a file the scan reads.
5. docs/agent-instructions/inspect.md has the blank line the reason table needs.
6. The registry member is now readersOfFile(root, file), returning the scanner ids that read that file, which removed the tuple type, the filter and the caller's includes.
7. Verified live through the CLI in this repository after rebuilding the bundled framework packages, because a packaged scanner loads from dist and its hook only takes effect after a rebuild: 'unknown target: src/source-coverag.ts; not a repository file'; 'no owner: test-bun/source-coverage.test.ts; excluded by scanners.json pattern /test-bun/'; 'no owner: README.md; no enabled scanner reads it'; 'no owner: plugins/scanners/typescript-project.ts; read by typescript and not scanned yet, so run groma scan'. The rebuilt bundles are ignored build output and are not part of this commit.
Follow-up recorded, not implemented: a scanner whose listSourceFiles throws makes groma view fail instead of answering, and a fallback needs the owner's decision.
Isolated bun run check exited 0 (Bun 513 passed, 32 skipped, 0 failed; Node 16 passed).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
groma view <file> now explains why a file has no architecture owner instead of answering 'unknown target'. src/source-coverage.ts asks four questions in order and returns exactly one reason: the file is not in the repository listing (tracked and unignored, the boundary every scan selects from), a named scanners.json pattern excludes it, no enabled scanner reads it, or the scanners that read it have not scanned it yet. src/plain-world.ts consults it only when no element owns the file, so element, flow, draft and owned-file answers are unchanged. The evidence comes from a new ScannerPlugin hook, listSourceFiles, which every official scanner implements from the selection its own scan uses, without analyzing a file or running Maven, Gradle, dotnet, go or cargo: TypeScript, PHP, Python, Go, Java, Rust, C#, JavaScript, and Angular, React and Vue through a shared framework-project helper. src/scanner/registry.ts exposes those listings with each scanner's configured settings and the shared exclusions applied. Verified by test-bun/source-coverage.test.ts (all four messages, a mistyped id, a mistyped path, and an owned file after a scan) and test-bun/scanner-source-listing.test.ts (one exact listing per official scanner against its existing fixture, with no worker or project tool running), plus an isolated bun run check at current HEAD: exit 0, Bun 510 passed, Node 16 passed. The plugin contract and the inspect guide document the listing rule, its limits and the four messages.
<!-- SECTION:FINAL_SUMMARY:END -->
