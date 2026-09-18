---
id: TASK-418
title: Deliver an official JavaScript scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:32'
updated_date: '2026-09-18 18:25'
labels: []
dependencies: []
references:
  - scanners-typescript-outline
  - framework-package
  - modules-discovery
  - javascript-src-index
modified_files:
  - plugins/scanners/javascript/package.json
  - plugins/scanners/javascript/.gitignore
  - plugins/scanners/javascript/src/sources.ts
  - plugins/scanners/javascript/src/tokens.ts
  - plugins/scanners/javascript/src/evidence.ts
  - plugins/scanners/javascript/src/index.ts
  - plugins/scanners/framework-package.ts
  - plugins/scanners/javascript/build.ts
  - bun.lock
  - test/fixtures/javascript-source/src/cart.mjs
  - test/fixtures/javascript-source/src/totals.cjs
  - test/fixtures/javascript-source/src/panel.jsx
  - test/fixtures/javascript-source/public/legacy.js
  - test/fixtures/javascript-source/public/bundle.js
  - test/fixtures/javascript-source/public/vendor.min.js
  - plugins/scanners/javascript/src/declarations.ts
  - plugins/scanners/javascript/src/outline.ts
  - plugins/scanners/typescript-outline.ts
  - test/fixtures/javascript-outline/app/checkout.mjs
  - test/fixtures/javascript-outline/app/totals.cjs
  - test/fixtures/javascript-outline/app/legacy.js
  - test/fixtures/javascript-outline/groma/systems/shop/system.md
  - >-
    test/fixtures/javascript-outline/groma/systems/shop/containers/api/container.md
  - >-
    test/fixtures/javascript-outline/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/javascript-duplicates/readiness.js
  - test/fixtures/javascript-duplicates/scheduling.js
  - test/fixtures/javascript-duplicates/invoice.js
  - test/fixtures/javascript-duplicates/quote.js
  - test/fixtures/javascript-duplicates/callbacks.js
  - test/fixtures/javascript-duplicates/countdown.js
  - test/fixtures/javascript-duplicates/descend.js
  - docs/scanners/javascript/index.md
  - docs/scanners/javascript/validation.md
  - src/scanner/modules/official-catalog.ts
  - scripts/scanner-release.ts
  - README.md
  - test-bun/scanner-fresh-checkout.test.ts
  - test/fixtures/javascript-source/src/label.ts
  - test-bun/javascript-scanner.test.ts
  - test-bun/scanner-installation.test.ts
  - test/fixtures/javascript-outline/app/report.js
  - test/fixtures/javascript-parity/pick.js
  - test/fixtures/javascript-parity/pick.ts
  - test/fixtures/javascript-invalid/src/broken.js
  - docs/scanners/discovery.md
  - test/fixtures/javascript-invalid/src/valid.js
  - docs/scanners/index.md
type: feature
ordinal: 483000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The official TypeScript and React scanners read only `.ts` and `.tsx` files, so plain JavaScript gets no architecture evidence: Node and browser projects without TypeScript, JavaScript shipped inside other stacks such as WordPress plugins, and React projects written in `.jsx`. JavaScript is one of the most common languages in repositories. Tracked vendored and minified files such as `jquery-ui.min.js` are common next to authored code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An official JavaScript scanner reads authored `.js`, `.mjs`, `.cjs` and `.jsx` files, including ES modules, CommonJS and browser scripts, without installing project dependencies or running project tools.
- [x] #2 Minified files are excluded by default, and the shared `scanners.json` exclusions apply.
- [x] #3 The scanner reports files, declarations, operations and calls through the standard observation contract, and provides the source outline expected from every official scanner.
- [x] #4 Discovery recommends the scanner for repositories with JavaScript sources, and the scanner does not depend on or duplicate evidence from other official scanners.
- [x] #5 Independent fixtures cover module formats, JSX, browser scripts and minified-file exclusion.
- [x] #6 The scanner is published through the shared release workflow, and the README language table and scanner documentation list it.
- [x] #7 The scanner reports source ranges and binding-normalized tokens for operation bodies, so groma lint compares JavaScript.
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
1. Add plugins/scanners/javascript: package.json (id javascript, file discovery rule for .js/.mjs/.cjs/.jsx, pinned classic typescript 6.0.3), src/sources.ts (git-tracked file selection plus minified exclusion), src/evidence.ts (symbols, operations, unresolved calls), src/tokens.ts (binding-normalized body tokens for named operations), src/index.ts (plugin, observation, shared outline through plugins/scanners/typescript-outline.ts).
2. Parse each authored file alone with the bundled classic compiler (ts.createSourceFile), so no tsconfig, program, project dependency or project tool is needed; .js and .jsx parse JSX, .mjs and .cjs parse as modules.
3. Exclude minified sources: a .min.js/.min.mjs/.min.cjs name or an average line length of 500 characters or more. Core applies the shared scanners.json exclusions to the observation.
4. Package the scanner with the shared framework builder, skipping the compiler declaration libraries a parse-only scanner never reads; register it in src/scanner/modules/official-catalog.ts and scripts/scanner-release.ts.
5. Document it in docs/scanners/javascript/index.md and validation.md, and add the README language row.
6. Add fixtures test/fixtures/javascript-source (ESM, CommonJS, JSX, browser script, minified files), javascript-outline (Code references to JS declarations) and javascript-duplicates, plus test-bun/javascript-scanner.test.ts and the fresh-checkout example entry.
7. Run bun install and bun run check in a detached worktree copy.

8. Report outline visibility from how a file publishes a name: an ECMAScript export, a CommonJS `module.exports`/`exports.name` assignment, or, in a file that states no module boundary, every top-level declaration, because those names are globals.
9. Guard the token spellings against the TypeScript scanner with a fixture holding the same body in both languages.

Review round (Codex, Grok cold reviews at cf8e7975):
10. Invalid syntax fails the scan (Codex u09 #2): parsing alone recovers from errors, so the scanner asks the classic compiler for the syntactic diagnostics of the files it parsed and fails with JAVASCRIPT_SOURCE_INVALID naming each file, line and error, as the documented scanner contract and the React, Vue and Angular scanners do. Red test with an invalid fixture file.
11. docs/scanners/discovery.md gains the JavaScript file-presence row (Grok u09 #1).
Already resolved in TASK-424.7's commit: the third tokenizer copy (Codex u09 #3) now uses the shared plugins/scanners/typescript-operations.ts. Skipped: JSX in .js (Grok-all) does not reproduce, since the classic compiler parses .js with the JSX language variant (probe: no parse errors, a JsxElement node). HTTP findings (http-scope, http-reads, http-endpoints, http-requests) belong to the HTTP lane under TASK-416.11.

12. Coordinator decision, replacing step 10: a file that does not parse contributes no evidence instead of failing the scan, because scanners do not see the scanners.json exclusions and a broken vendored or template script would otherwise stop the whole scan. The file keeps its inventory entry with no symbols, and one JAVASCRIPT_SOURCE_INVALID warning names each such file with its first parse error. Only parse errors count, so TypeScript-style type annotations, as in many Flow-typed files, keep their evidence.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation

The scanner bundles the pinned classic TypeScript 6.0.3 compiler and parses each authored file alone with `ts.createSourceFile`, so no tsconfig, program, type checker, project dependency or build tool is involved. That compiler already reads `.js`, `.mjs`, `.cjs` and `.jsx`, treats `.js` and `.jsx` as JSX dialects, and lets the scanner reuse plugins/scanners/typescript-outline.ts for the outline and the same token spellings as plugins/scanners/typescript/src/source-tokens.ts, so a body compares equal across JavaScript and TypeScript.

File selection uses the shared projectFiles Git boundary. Minified output is excluded by a `.min.js` style name and by an average line length of 500 characters or more, which keeps vendored bundles under ordinary names out. Core applies the scanners.json exclusions to the observation.

Evidence: one source-group root, top-level functions and classes as symbols, operations for functions, function literals and methods with a body, tokens and inclusive line ranges only on named operations, and calls that stay unresolved because one parsed file proves no target. Code outside every function belongs to a module operation, as the TypeScript reference reports it, so a browser script's top-level calls keep an owner.

Outline visibility follows how a file publishes a name: an ECMAScript export, a CommonJS `module.exports`/`exports.name` assignment, or, in a file that states no module boundary, every top-level declaration, because those names are globals. The shared outline module gained one optional `exported` field for the names a block publishes outside an export list.

Verification

- bun run check passes in a detached worktree holding HEAD plus only this task's changes (Biome clean for the new files, tsc clean, 16 Node tests, 462 Bun tests).
- test-bun/javascript-scanner.test.ts: 5 tests covering module formats, JSX, browser scripts, minified and TypeScript exclusion, exact positions, module-owned top-level calls, repeat determinism, curation stability, configured exclusions and watch patterns, lint findings, and the outline with its visibility rules.
- GROMA_TEST_PACKAGES fresh-checkout test passes for the built javascript package with only Git on PATH and network access blocked.
- Local qualification on a disposable tracked-source copy of wifi-densepose at 66392cb4: discovery recommended JavaScript, 47 authored files, 1249 operations (758 compared), 4762 unresolved calls, repeat scan identical, second fold created no elements, groma lint reported 32 findings.

Corrections during implementation

- The first minified line-length rule divided by a line count that a trailing newline inflated, so a single-line bundle scored half its real average; the rule now measures the trimmed text.
- test-bun/scanner-installation.test.ts staged fake npm packages containing index.js inside the scanned project, so JavaScript became an unpublished recommendation and bulk installation failed. The fixture now ignores its own scaffolding directories and tarballs.

Self review

Specification: every acceptance criterion has evidence in test-bun/javascript-scanner.test.ts, the fresh-checkout package run, or docs/scanners/javascript/validation.md. Nothing outside the scanner, its registration, its documentation and its fixtures changed, except two shared-file lines (the optional outline `exported` field and the framework build's declaration-library switch) and one test fixture that staged .js scaffolding inside the project it scanned.

Quality, recorded as non-blocking follow-ups:
- checkReadiness reads each JavaScript file to prove authored source exists, so setup reads the same files the following scan reads.
- The outline parses a referenced file twice: once to read how it publishes names, once inside the shared outline, which takes text by contract.
- The shared visibility table in docs/scanners/creating-a-plugin.md has no JavaScript row. That file is being edited by TASK-410 right now, so the rules are documented on the scanner page instead.
- The scanner is not registered in this repository's groma/scanners.json, so Groma's own architecture does not yet own its JavaScript files or the new plugin components.

Cold review corrections

- outline.ts inferred the module boundary from the published names, so a CommonJS file that publishes a value rather than a bare identifier (`exports.run = function(){}`, `module.exports = function plugin(){}`, `module.exports = { weigh: value => ... }`) fell into the browser-script branch and reported its private helpers as public. The boundary now comes from the presence of an `exports` or `module.exports` assignment, separately from the names it publishes, and test/fixtures/javascript-outline/app/report.js covers it.
- Added test/fixtures/javascript-parity with the same body in `.js` and `.ts`, and a test asserting the two scanners produce identical tokens, so the duplicated tokenizer cannot drift unnoticed.
- Added `**/*.min.jsx` to watch.exclude to match the minified-name rule, and asserted it.
- Documented that test sources are treated like any other JavaScript source, unlike the TypeScript scanner's default omission, and that discovery counts any JavaScript file name, minified files included, so readiness may then report no authored source.
- Left docs/architecture-findings.md and the shared visibility table in docs/scanners/creating-a-plugin.md to the agents that own them.

Final verification: bun run check exits 0 in a detached worktree holding the Swift commit plus only this task's changes (16 Node tests, 477 Bun tests, 32 skips, 0 failures).

Shared registration lines committed here

TASK-431 (Swift) was committed first, but four registration edits could not be separated from this task's, so they ride in this commit and are named here:

- src/scanner/modules/official-catalog.ts: the `import swift` line, adjacent to the `import javascript` line, and the catalog array line that now lists both `swift` and `javascript`.
- scripts/scanner-release.ts: the `scannerIds` line listing both, together with the Swift-only staging and assembly hunks in the same file.
- test-bun/scanner-fresh-checkout.test.ts: the `examples` map holding both fixtures and the unresolved-call exception list naming both scanners.
- bun.lock: the workspace and resolution entries for @groma/scanner-javascript and @groma/scanner-swift, which Bun writes as one contiguous block.

The README language table was separable, so the Swift row is in the Swift commit and the JavaScript row is here.

The working tree also holds an uncommitted repository-wide rescan from another session, over sixty new element documents plus a modified groma/relationships.md, including the Swift and JavaScript scanner elements. Committing the Swift or JavaScript fragment of it would have added a new shared `groma-md-build` container and left the relationships that reference the new elements uncommitted, so no groma/ document is in either commit. That batch belongs to the session that produced it.

Review round (Codex and Grok cold reviews at cf8e7975). Verified with a probe: a file holding export function broken( { ... } produced a successful observation with a broken operation (Codex u09 #2), and docs/scanners/discovery.md had no JavaScript row (Grok u09 #1). Fixed: plugins/scanners/javascript/src/index.ts parses every source, then asks the classic compiler for the syntactic diagnostics of those parsed files through a program that reads no other file (noLib, noResolve), and fails with JAVASCRIPT_SOURCE_INVALID naming each file, line and error, like the React, Vue and Angular scanners; TypeScript-only syntax such as a type annotation in a .js file fails too, as the compiler reports it. docs/scanners/javascript/index.md states the failure; docs/scanners/discovery.md lists the JavaScript file-presence rule. Test: test/fixtures/javascript-invalid holds one broken file; the new test fails without the fix. Resolved in TASK-424.7's commit 83cc22fa: the third tokenizer copy (Codex u09 #3), now plugins/scanners/typescript-operations.ts. Skipped: JSX in .js (Grok-all) does not reproduce; the classic compiler parses .js with the JSX language variant, and the probe found a JsxElement and no parse error. HTTP findings belong to TASK-416.11. The modified-file list was re-recorded without the literal quotes the earlier entries carried. Verification: bun run check in an isolated worktree at 2452ec73 plus this task's files exit 0 (biome: pre-existing warning and infos only; tsc clean; node 16 pass; bun 525 pass, 35 skip, 0 fail); bun plugins/scanners/javascript/build.ts succeeds there.

Coordinator decision applied (replaces the scan failure above): plugins/scanners/javascript/src/index.ts reads each file's parse errors from the pinned compiler's source file (the public API reports them only through a program, mixed with checks that reject TypeScript-only syntax the parser still reads). A file with a parse error keeps its inventory entry with no symbols and contributes no operations, calls or HTTP facts; one warning diagnostic, JAVASCRIPT_SOURCE_INVALID, lists each such file with its first error line, and the rest of the scan proceeds. Probe: a .js file with a type annotation, a JSX .js file and a module using private fields and static blocks all keep their evidence; the broken file yields none. Test: test/fixtures/javascript-invalid holds broken.js and valid.js; the test asserts no evidence for broken.js, evidence for valid.js and the warning, and fails without the fix. docs/scanners/javascript/index.md describes it, and docs/scanners/index.md names the JavaScript scanner as the exception to 'Syntax errors remain scan failures'. Verification: bun run check in an isolated worktree at 996fb4e9 plus this task's files exit 0 (biome: pre-existing warning and infos only; tsc clean; bun 558 pass, 35 skip, 0 fail); bun plugins/scanners/javascript/build.ts succeeds there.

Cold review of this round, applied: parse errors that only strict mode raises on octal literals and escapes (codes 1121, 1487, 1488, 1489, such as 0755 or '\033[31m') are ignored as a named set, because JavaScript outside strict mode accepts them; each file that does not parse gets its own JAVASCRIPT_SOURCE_INVALID warning with file and line, which the scan report groups; the page states that the source outline still lists the declarations the parser recovers from such a file, and the Validation list names the fixture. test/fixtures/javascript-invalid/src/valid.js is CommonJS with a legacy octal literal and a type annotation, so ignoring those codes or switching to program syntactic diagnostics fails the test. Re-verification: bun run check in an isolated worktree at 19b20fe4 plus this task's files exit 0 (biome: pre-existing warning and infos only; tsc clean; bun 564 pass, 35 skip, 0 fail); bun plugins/scanners/javascript/build.ts succeeds; the test fails with index.ts reverted.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered the official JavaScript scanner as @groma/scanner-javascript. It bundles the pinned classic TypeScript 6.0.3 compiler and parses each authored .js, .mjs, .cjs and .jsx file alone, so ECMAScript modules, CommonJS and browser scripts are read without a tsconfig, a program, project dependencies or project tools. Minified output is excluded by a .min.js style name and by an average line length of 500 characters or more, and core applies the configured scanners.json exclusions. The scan reports one source root, top-level functions and classes as symbols, operations for functions, function literals and methods with a body, unresolved calls, and a module operation that owns a script's top-level work. Source ranges and binding-normalized tokens are attached only to named operations, with the TypeScript scanner's token spellings, so groma lint compares JavaScript. The source outline reuses the shared TypeScript outline module and reports visibility from how a file publishes a name. Registered in the official catalog, the shared release staging, the README language table and docs/scanners/javascript.

Verified with test-bun/javascript-scanner.test.ts (6 concurrent tests over the javascript-source, javascript-outline, javascript-parity and javascript-duplicates fixtures), the shared fresh-checkout package test with only Git on PATH and network access blocked, and a disposable tracked-source copy of wifi-densepose at 66392cb4 where discovery recommended the scanner, 47 authored files produced 1249 operations with 758 compared bodies and 4762 unresolved calls, a repeat scan was identical, a second fold created no elements and groma lint reported 32 findings. bun run check exits 0 in a detached worktree holding only this task's changes: 16 Node tests and 477 Bun tests pass.

Review round: after external cold reviews, a JavaScript file that does not parse keeps its inventory entry but contributes no declarations, operations, calls, HTTP facts or tokens, and gets a JAVASCRIPT_SOURCE_INVALID warning at its first parse error while the rest of the scan proceeds (sloppy-mode octal literals and TypeScript-style annotations still parse); discovery documentation lists the JavaScript rule; the tokenizer copy was replaced by the shared TypeScript-family module in TASK-424.7. Verified by the javascript-invalid fixture test (fails without the fix), bun run check in an isolated worktree and the package build.
<!-- SECTION:FINAL_SUMMARY:END -->
