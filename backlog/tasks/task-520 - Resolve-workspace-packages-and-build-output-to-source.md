---
id: TASK-520
title: Resolve workspace packages and build output to source
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 12:36'
updated_date: '2026-09-24 16:08'
labels: []
dependencies: []
references:
  - scanners-projects
  - workspace-packages
documentation:
  - docs/scanners/typescript/index.md
  - docs/scanners/javascript/index.md
modified_files:
  - test-bun/typescript-workspace.test.ts
  - plugins/scanners/workspace-packages.ts
  - plugins/scanners/typescript/src/projects.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/typescript/src/graph.ts
  - plugins/scanners/entry-points/source.ts
  - plugins/scanners/entry-points/javascript.ts
  - plugins/scanners/typescript/src/scan.ts
  - docs/scanners/typescript/index.md
  - groma/systems/groma-md/containers/cli/components/workspace-packages.md
  - groma/systems/groma-md/components/workspace-packages.md
ordinal: 604000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In a monorepo checked out fresh, without node_modules, an import of a workspace package by its package name resolves to nothing, and an entry declared on build output (a package `bin` or `main` under `dist/`, or a script such as `node dist/main.js`) is dropped because the file does not exist. TypeScript qualification (TASK-504) measured 49 lost cross-package import edges in create-t3-turbo, and immich, shadcn/ui and vscode lost their real entries. Alex approved the design on 2026-09-24: one shared module maps a repository package name to its source, and build output back to source through the package tsconfig's `outDir` and `rootDir`, used by the TypeScript scanner and the shared entry reader; other TypeScript-family scanners follow later on the same module.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the TypeScript scanner, a bare import that names a package in the repository resolves to that package's source through its `exports`, else its `main` or `types`; a target under the package tsconfig's `outDir` maps to the same path under `rootDir` with a source extension, and a target that cannot be mapped stays unresolved.
- [x] #2 Calls through such an import resolve to the imported package's source operations.
- [x] #3 A package `bin`, or a package script that runs build output such as `node dist/main.js`, becomes an entry on its source file when the same mapping finds it.
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
1. Owner module plugins/scanners/workspace-packages.ts: every named package.json in the repository is a workspace package. `packagePaths` maps each package name, and each subpath it serves, to every target in the order TypeScript tries them (an exports string, fallback array entries, then the types, import, default and require conditions in object order; else types, typings and main). A target under a build `outDir` becomes the same path under `rootDir`, with a declaration file named by its JavaScript name, and the compiler takes the first target that names a file. A name two packages share, or a manifest that is not JSON, names no package. `sourceOf` maps a built entry file to its `.ts` or `.tsx` source.
2. TypeScript scanner: projects.ts `buildOutputs` lists the configs that state both `outDir` and `rootDir`. source-analysis.ts adds the mappings to every program's `paths`, where an identical key in the config's own `paths` wins, and takes each file's imports only from the program of the config that owns it (a file no config owns, from any program reaching it), so a package's own aliases resolve as its config states. Build outputs travel as data through SourceEvidence and ImportGraph.
3. Entries: EntrySources carries the build outputs, and the entry reader's `sourced` helper maps each declared entry file through `sourceOf` before the existing callback, so a `bin` or `node dist/main.js` on build output becomes an entry on its source. Package `main` is not an entry (Alex, 2026-09-24).
4. Docs: docs/scanners/typescript/index.md. Architecture: the workspace-packages component under the CLI, in Scanner support.
5. Test decisions, test-bun/typescript-workspace.test.ts. T1, AC1 and AC2: built exports mapped through outDir and rootDir, a `./*` pattern whose build-only target gives way to its source, a name two packages share, a non-JSON manifest and an unmappable legacy package, with edges and resolved calls. T3, AC1 (reproduced wrong edge): a package file reads its imports with its own config, not the aliases of an app importing it. T2, AC3: a bin and a node dist/main.js script on build output give entries on their sources.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented: plugins/scanners/workspace-packages.ts (packagePaths, sourceOf, BuildOutput) owns package and build-output mapping; projects.ts buildOutputs derives each config's outDir and rootDir (or the compiler's default root); source-analysis.ts adds the mappings to every program's paths before the config's own; graph and scan carry the outputs; the entry reader maps a declared entry file through EntrySources.sourceOf. A probe confirmed the native API resolves a bare name through an absolute paths target. Real repository: create-t3-turbo 8f945b7b cross-package import edges 0 to 49 (the 49 specifiers TASK-504 recorded) and cross-package resolved calls 0 to 12. That run found one defect in my first rule: stopping at the first matching exports condition left @acme/api ({ types: dist, default: src }) unresolved, because its config extends an uninstalled workspace config and states no outDir; targets are now tried in condition order and the first that maps to source wins, as TypeScript's resolver does. Both new tests failed on the old code; the ambiguous-name and fall-through rules each have a fixture case.

Full repository check on a6645976 (HEAD c8d9fe31 plus only TASK-520 changes; the entry-reader hunk written against main, where the Angular session's uncommitted edit changes the same lines; the other session's docs hunk excluded), separate worktree with bun install --frozen-lockfile: bun run check exit 0, 730 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change.

Cold simplicity review (fresh agent, task plus diff, no history): close to minimal. Applied: removed the unset-rootDir default, which TypeScript 7 rejects (TS5011) rather than infers and which no qualified repository needed (shadcn builds with tsup and states no outDir; immich sets rootDir); removed the untested name/* mapping for packages without exports; the paths comment and doc now say only an identical key in the config's own paths wins, and fall-through is limited to file targets; outputHolding uses find; source extensions are .ts and .tsx, the only files the scanner selects; unused fixture lines removed; renamed packages to workspacePaths and outputs to buildOutputs; the entry reader now receives build outputs as data and calls sourceOf itself instead of a closure. Also fixed from my own lint check: my entry mapping had raised the existing withJavaScriptEntries callback from 16 to 17, so the mapping moved into a sourced helper and the callback stays at 16. Rechecked: 93 tests pass across the TypeScript-family suites; create-t3-turbo still resolves 49 cross-package imports and 12 calls. Build-output entries help packages built by tsc with outDir and rootDir; bundler-built packages (tsup, esbuild), such as shadcn's CLI, are not mapped.

Full repository check on 155b6043 (HEAD 4f267070 plus only TASK-520 changes after the cold review; the entry-reader hunk written against main; the other session's docs hunk excluded), separate worktree with bun install --frozen-lockfile: exit and counts as follows in the next note.

Result on 155b6043: bun run check exit 0, 730 pass, 45 skip, 0 fail. Its Biome warnings are in code this task did not change, except the existing withJavaScriptEntries callback, which stays at complexity 16 as on main.

Alex decided (2026-09-24, after the full-context review): package main is not an entry source, because it declares what an import loads rather than something that runs; AC3 no longer names it. Alex also approved: a file's imports come only from the program of the config that owns it (reproduced wrong edge on an immich-shaped fixture), an unparsable package.json names no package, the compiler tries every served target in order, the component joins the CLI's Scanner support group, one term (workspace packages), paths precedence stays the documented limit, and an immich re-measure.

Applied Alex's approval: owner-program imports (the immich-shaped test failed with the wrong edge to server/src/types.ts and passes now); non-JSON manifests name no package (the test failed with a JSON parse error for the whole scan and passes now); the compiler now receives every served target in order, so the pattern case (failed before) resolves and the module shrank to 95 lines; sourced takes SourceEntry; one term, workspace packages; the repeated fresh-checkout sentence removed, so docs/scanners/index.md is no longer changed by this task; workspace-packages component moved under cli into Scanner support with a description. Checks: 106 tests pass across the TypeScript-family suites. Re-measured: create-t3-turbo 8f945b7b keeps 49 cross-package import edges and 12 resolved calls; immich e66f2c76, against main, imports into @immich/sdk 0 to 172 and into the plugin SDK 0 to 9, no package source gains an edge into server/, and node dist/main.js in @immich/scripts becomes an entry on packages/scripts/src/main.ts.

Full repository check on f9b21220 (HEAD 709a8920 plus only TASK-520 changes; the entry-reader hunk written against main), separate worktree with bun install --frozen-lockfile: bun run check exit 0, 732 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change, and the existing withJavaScriptEntries callback stays at complexity 16 as on main. Main then gained only a comment change in three C# worker files, so the commit is rebuilt on it with identical task content.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In a fresh checkout without node_modules, the TypeScript scanner now resolves bare imports of workspace packages to their source. The new plugins/scanners/workspace-packages.ts reads every named package.json and gives each program compiler paths for the package name and its served subpaths, listing every target in TypeScript's order, with a target under a config's outDir mapped to the same path under its rootDir, so the compiler resolves imports and calls across packages. A name two packages share, or a manifest that is not JSON, names no package, and each file's imports come only from the program of the config that owns it. Entries declared on build output, a package bin or a node dist/main.js script, attach to their source file through the same build outputs; package main is not an entry. Verified: the three workspace tests failed on the old code and pass; create-t3-turbo gains all 49 cross-package import edges and 12 resolved calls; immich gains 181 imports into its SDK packages, no package edge into server/, and its scripts entry on packages/scripts/src/main.ts; bun run check on a commit of HEAD plus only this task passes (732 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
