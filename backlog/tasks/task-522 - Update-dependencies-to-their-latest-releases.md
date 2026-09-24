---
id: TASK-522
title: Update dependencies to their latest releases
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 16:23'
updated_date: '2026-09-24 17:23'
labels: []
dependencies: []
references:
  - src-structure
  - typescript-src-index
  - src-initialize
  - vue-src-index
  - angular-src-index
modified_files:
  - package.json
  - biome.json
  - plugins/scanners/angular/package.json
  - plugins/scanners/typescript/package.json
  - plugins/scanners/vue/package.json
  - plugins/scanners/react/package.json
  - bun.lock
  - plugins/scanners/typescript/src/structure.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - src/init-command-ui.ts
  - test-bun/angular-scanner.test.ts
  - docs/scanners/angular/index.md
  - docs/scanners/vue/index.md
  - plugins/scanners/vue/src/project.ts
  - plugins/scanners/angular/src/project.ts
  - docs/scanners/react/index.md
  - docs/scanners/javascript/index.md
  - docs/scanners/discovery.md
type: chore
ordinal: 606000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-09-24 a check of the Info panel found that 10 of its 18 libraries were behind npm, TypeScript was on an older 7.1 nightly, and two listed libraries (`web-worker`, `webcola`) are no longer imported anywhere. The scanner plugins also pin older releases, including Angular 21 and TypeScript 5.9 or 6.0. Alex asked to bump every package dependency to its latest major, minor or patch release after checking the changelogs. TypeScript 7 exports only its version and a new `unstable/*` API from the package root. The scanners that parse through the classic compiler API (Angular, Vue, React, JavaScript) therefore cannot adopt 7.x by a version bump.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every third-party dependency in the root and workspace package manifests is pinned to its newest release; a package kept on an older line has the reason recorded in this task
- [x] #2 The unused `web-worker` and `webcola` dependencies are removed, so the Info panel lists only libraries Groma uses
- [x] #3 The changelog of every updated package is reviewed and every breaking change that affects Groma is adapted
- [x] #4 `bun run check` and `bun run build` pass, and the built binary starts
- [x] #5 The browser map, terminal map, init prompts and the scanners whose libraries changed still work in a manual check
- [x] #6 Documentation that names bundled dependency versions matches the new versions
- [x] #7 Transitive dependencies are at the newest versions their dependents declared ranges allow, so bun update reports no changes; packages held a major behind are listed with the dependent that holds them
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
1. Compare every root and workspace dependency with npm latest and read the release notes between the pinned and the newest version.
2. Pin the newest releases in the root and scanner manifests; remove web-worker and webcola, which nothing imports; move the Biome schema URL with the CLI.
3. Keep the Angular, Vue, React and JavaScript scanners on TypeScript 6.0.3: TypeScript 7 exports only its version and an unstable API from the package root, so the classic compiler API these scanners parse with ends at 6.0. Angular 22 requires TypeScript >=6.0 <6.1.
4. Adapt code to breaking API changes the typecheck and tests report: the TypeScript nightly createProgram and snapshot API, and the clack cancel type.
5. Tests: no new test. The Angular Nx test proves that an option the scanner compiler cannot read becomes an angular-unreadable-config warning (docs/scanners/angular/index.md). Its fixture used stableTypeOrdering, which TypeScript 6.0.3 now reads, so the test would lose its concrete failure; the fixture switches to singleThreaded, a TypeScript 7 option 6.0.3 rejects with TS5023. Existing coverage already exercises every changed path.
6. Update docs naming bundled versions (Angular, Vue) and the stale TS 5.9.3 comment.
7. Verify in a worktree at HEAD with only this task hunks: bun install --frozen-lockfile, bun run check, bun run build and binary start, framework scanner package builds, a self-scan and groma lint compared with HEAD, terminal map and init prompts compared with HEAD under tui-test, and the browser map with the project preview.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changelog review (2026-09-24), pinned -> newest:
- @clack/core 1.4.3 -> 1.5.1, @clack/prompts 1.7.0 -> 1.8.1: accessible mode, async validation, path Tab completion, guide bar styling fixes; prompts now return the typed CANCEL_SYMBOL instead of symbol. Adapted: the scanner multiselect passes an explicit type argument to the cancel helper.
- comark and @comark/html 0.6.2 -> 0.7.0: heading ids from text only, parser/stringifier hardening, YAML block scalars as bindings, HTML5 self-closing tags. Verified: all 643 architecture records in groma/, test fixtures and examples parse and re-render byte-identically (frontmatter data, rendered frontmatter, body, node tree) under both versions; the project preview only changes <br /> to <br>, with identical sanitising.
- @opentui/core 0.5.10 -> 0.5.12: Bun 1.4 runtime support, diff and resize fixes, pointer styles, text alignment. No API change for Groma.
- ignore 7.0.9 -> 7.0.10: a wildcard followed by a partial separator match now matches as git does (f*o/*/* matches foo/b/c).
- @biomejs/biome 2.5.12 -> 2.5.14: new nursery rules (not enabled) and fixes; the same rule violations are reported by both versions on this tree. biome.json schema URL follows the CLI.
- @types/bun 1.4.1 -> 1.4.2: bun-types 1.4.2 is byte-identical to 1.4.1 except its version, so the Bun 1.4.1 runtime pin stays accurate.
- @types/node 26.4.1 -> 26.6.2 and tsx 4.23.13 -> 4.23.15: declarations and bug fixes only.
- typescript (root and TypeScript scanner) 7.1.0-dev.20260905.1 -> 7.1.0-dev.20260924.1, the newest next build: 79 commits; the unstable API moved compilerOptions to the second createProgram argument and replaced updateSnapshot with createSnapshot. Adapted source-analysis.ts and structure.ts.
- @angular/compiler and @angular/core 21.2.17 -> 22.2.0: data-prefixed attributes no longer bind, `in` variables throw, TypeScript >=6.0 <6.1 required. Angular scanner TypeScript 5.9.3 -> 6.0.3.
- Vue: @vue/compiler-dom, vue, @vue/compiler-sfc 3.5.42 -> 3.5.43 (bug fixes); TypeScript 5.9.3 -> 6.0.3, which Vue language tools support (vue-tsc peer >=5.0; their workspace uses 6.0.3).
- React scanner dev dependencies react and @types/react 19.2.x -> 19.3.0 (features; no scanner-visible change).
- Removed web-worker and webcola: no repository file imports them; webcola last in TASK-156 (61737a84), and it alone pulled six d3 packages.
Kept on older lines: the Angular, Vue, React and JavaScript scanners stay on TypeScript 6.0.3 because typescript 7.x exports only lib/version.cjs and unstable/* from its root and has no classic compiler API. Already newest: @parcel/watcher, @resvg/resvg-wasm (2.7 is alpha), commander, diff, fuse.js, good-enough-parser, php-parser, pyodide (315 is alpha), @volar/typescript, @vue/language-core. Bun itself stays 1.4.1 (toolchain, not a package dependency; 1.4.2 exists).

Verification (worktree at 16ff0735 plus only this task hunks; the shared tree carries other sessions in-progress edits):
- bun install --frozen-lockfile, then bun run check: exit 0. Biome reports the same 3 warnings and 2 infos as 2.5.12 on this tree; tsc 7.1.0-dev.20260924.1 clean; Node 16/16; Bun 734 pass, 45 skip, 0 fail (779 tests, 137 files). The first full run under Bun 1.4.1 failed only the Angular Nx fixture, fixed as planned; the final run ran under Bun 1.4.2 because the machine Bun changed during the task.
- bun run build: dist/groma 0.4.0 starts and prints groma view --plain.
- Angular, Vue and React scanner packages build with the new compilers.
- Self-scan of this repository with HEAD dependencies and with this change: identical summary (created 0, refreshed 97, matched 0, findings 39), no groma/ changes, identical groma lint output.
- Terminal map (tui-test, 120x36): root and container screens identical to HEAD after the scanner notice settles.
- Init prompts (tui-test): project name, folder, scanner multiselect cancel (prints Initialization cancelled, exit 0) and empty submit, first-scan decline; screens identical to HEAD.
- Browser map from the worktree: map, hierarchy and details render without console errors; the project editor Preview renders the overview Markdown.
- Info panel rows now list 11 runtime libraries and 5 development tools, each shown version equal to the installed one.

End-of-task review: a general-purpose agent reviewed from a written brief (the fork agent type is unavailable in this environment). Kept: the dependency removals, the three API adaptations, separate TypeScript pins for the repository and the TypeScript scanner, and the singleThreaded fixture; a classic-API scanner moved to TypeScript 7 already fails the typecheck. Fixed a miss it found: plugins/scanners/angular/src/project.ts still named TypeScript 5.9. Applied with Alex approval on 2026-09-24: scanner docs and comments no longer copy exact versions from the manifests (they state TypeScript 6.0 as the last release with the classic compiler API and the native TypeScript 7 SDK for the TypeScript scanner, and point to the manifest for exact versions), and biome.json points at the installed configuration schema so the Biome version lives only in package.json. Declined by Alex: reverting @types/bun to 1.4.1; Alex already runs Bun 1.4.2 locally.
Follow-ups noticed and not done here: the Angular scanner treats TS5025 (unknown option with a suggestion, such as checkers) as fatal instead of angular-unreadable-config; the Info panel shows an SSH repository URL for @resvg/resvg-wasm and "MIT License" for @comark/html; the init wizard shows an empty Project readiness box when no scanner is selected; the Vue and PHP scanners hard-code engineVersion (still correct); the repository pins Bun 1.4.1 in packageManager and CI.

Final check on the exact commit tree (HEAD 16ff0735 plus these 18 files, bun install --frozen-lockfile): bun run check exit 0; same 3 Biome warnings and 2 infos; tsc clean; Node 16/16; Bun 734 pass, 45 skip, 0 fail.

Follow-up on 2026-09-24 (Alex asked about nanoid 3 vs 6 and asked to run bun update): bun update reports no changes. The shared bun.lock already held 7 in-range refreshes written at 19:14 by another run: js-yaml 5.2.2 -> 5.4.2, entities 8.0.0 -> 8.1.0, nanoid 3.3.18 -> 3.3.19, ansi-regex 6.2.2 -> 6.3.0, strip-ansi -> 7.2.0 for string-width, get-east-asian-width 1.6.0 -> 1.7.0, @babel/parser 7.29.8 -> 7.29.9. Alex approved committing them under this task. Packages a major behind stay because their dependents declare older ranges: in the Groma binary, @opentui/core pins marked 17.0.1, string-width 7.2.0 and strip-ansi 7.1.2 (emoji-regex 10 through string-width); markdown-exit, comark parser, wants entities ^7, linkify-it ^5 and uc.micro ^2; clack wants sisteransi ^1; @parcel/watcher wants node-addon-api ^7; js-yaml wants argparse ^2. Scanner and development tooling only: postcss 8 (through @vue/compiler-sfc) wants nanoid ^3; the Vue compiler wants Babel 7, estree-walker ^2, magic-string ^0.30 and entities ^7; good-enough-parser 1.1.23 pins old @thi.ng packages, moo and @types/moo; @types/node pins undici-types ~8.9. Forcing them with overrides would run these packages against majors they do not declare (nanoid 4+ is ESM-only while postcss 8 requires it), so none is overridden. Verification: HEAD 48ea5bcf plus the refreshed bun.lock, bun install --frozen-lockfile, bun run check exit 0 (Node 16/16, Bun 736 pass, 45 skip, 0 fail); the comark round trip of 643 records already ran on js-yaml 5.4.2 and entities 8.1.0.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated every root and scanner dependency to its newest release after reviewing each changelog: clack, comark and @comark/html, OpenTUI, ignore, Biome, @types/node, @types/bun, tsx, the TypeScript 7.1 nightly for the repository and TypeScript scanner, Angular 22.2 and Vue 3.5.43 with their own TypeScript 6.0.3, and React 19.3 for the React scanner tests. Removed the unused web-worker and webcola, so the Info panel lists only libraries Groma uses. The classic-API scanners stay on TypeScript 6.0 because TypeScript 7 has no classic compiler API. Adapted the TypeScript scanner to the nightly createProgram and createSnapshot API and the init wizard to the typed clack cancel value; the Angular unreadable-config fixture now uses a TypeScript 7 option. Scanner docs state the TypeScript rule instead of copying versions, and biome.json uses the installed schema. A follow-up refreshed transitive dependencies to the newest versions their dependents allow (bun update reports no changes); the packages still a major behind are held by their dependents ranges and are listed in the notes. Verified in clean worktrees with only these changes: bun run check green, binary build and start, framework scanner package builds, an identical self-scan and groma lint against HEAD, identical terminal map and init screens against HEAD under tui-test, the browser map and project preview, byte-identical comark round trips of 643 architecture records, and green CI on Ubuntu, macOS and Windows for the first run containing the dependency commit.
<!-- SECTION:FINAL_SUMMARY:END -->
