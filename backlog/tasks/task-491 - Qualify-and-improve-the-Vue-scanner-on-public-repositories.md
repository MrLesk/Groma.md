---
id: TASK-491
title: Qualify and improve the Vue scanner on public repositories
status: Done
assignee:
  - '@codex'
created_date: '2026-09-22 21:47'
updated_date: '2026-09-23 19:20'
labels: []
dependencies: []
references:
  - vue-src-index
  - scanners-projects
  - scanners-http-routes
modified_files:
  - test-bun/vue-scanner.test.ts
  - plugins/scanners/vue/src/evidence.ts
  - test-bun/nested-scanners.test.ts
  - plugins/scanners/projects.ts
  - plugins/scanners/vue/src/index.ts
  - plugins/scanners/vue/src/project.ts
  - plugins/scanners/typescript-project.ts
  - test/fixtures/vue-http/web/client.ts.fixture
  - test-bun/vue-http.test.ts
  - plugins/scanners/http-syntax.ts
  - test/fixtures/vue-http/web/Talks.vue
  - plugins/scanners/http-clients.ts
  - docs/scanners/vue/index.md
ordinal: 572000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex requested a repository-by-repository Vue scanner exercise after Rust. Scan diverse public Vue projects for real component, event, HTTP, source-association, and project-selection edge cases; fix verified scanner failures while keeping architecture meaning in language-neutral Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public Vue repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported Vue scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the Vue scanner changes.
- [x] #4 Temporary repository clones are removed after Vue qualification and the results are reported to Alex before work starts on another scanner.
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
1. Build the local Vue scanner and have ten read-only agents clone distinct public Vue repositories into isolated /private/tmp/groma-vue-491-* paths, pin commits, and run the scanner without installing repository dependencies. 2. Compare each observation with the Vue scanner guide and source, reproduce concrete incorrect results in the supported flow, and fix them in the owning Vue scanner domain. Keep language-neutral core and C4 interpretation unchanged. Before each focused test, record the supported rule, wrong result, and existing coverage gap. 3. Re-scan affected pinned checkouts, run focused checks and bun run check, complete cold simplicity and full-context complexity reviews, remove every task-owned temporary checkout, and report findings to Alex before another scanner.

First Vue evidence slice: Vue REPL uses a typed defineEmits function signature in the guide’s qualified CodeMirror interaction, but the scan misses its declared change event. The existing fixture covers only a type-literal declaration, so extend that test to make a function signature fail before fixing declaresEvent. Vue Devtools and Vuetify scans also show diagnostics on native DOM listeners; the Vue component-event contract has no SFC relationship to diagnose there, so assert the existing native button listener emits no unsupported-vue-binding diagnostic. Keep both fixes inside Vue evidence extraction.

Project-discovery slice: PrimeVue has a Vue package with tsconfig and a tracked SFC beside a nested export-only package.json; shared frameworkProjects assigns that source to the leaf and returns no project. Existing nested-scanners coverage tests nested real packages but not export manifests. Add one generic discovery test: the parent remains eligible when the leaf is not a compilable framework project. Vue source-loading slice: Nuxt and Element Plus have selected Vue packages with tracked SFCs but solution-style files:[] configs that yield zero compiler roots; existing Vue tests only include SFCs explicitly in tsconfig. Add a minimal Vue fixture with files:[] and absent generated references, assert its SFC and Nuxt route are observed. Pinia also reports a missing literal files-glob error that currently goes unnoticed; add a narrow readiness test if source-loading changes do not already surface it.

Generated-config slice: Quasar’s selected playground has tracked SFCs but extends an absent generated .quasar/tsconfig.json; the parser still supplies usable local files, yet one TS5083 makes the entire Vue observation fail. Existing invalid-config test covers malformed JSON, not a missing generated base. Add a focused fixture that expects the SFC to scan with an explicit warning; keep malformed syntax/config failures fatal and preserve compiler options that can be read. This is a reproduced fresh-checkout failure, not a general retry path.

Ancestor-config slice: Slidev’s packages/client declares Vue and has 109 SFCs, while the root tsconfig includes them and the package has no local config. Current project discovery returns only docs. Add a generic project-discovery option for a package that has a tracked ancestor tsconfig, preserving the current local-config rule for React and Angular. Vue alone uses that option and reads compiler options from the nearest config; its explicit source roots remain limited to the selected package. Add a nested fixture proving the child is selected and scanned, then recheck Slidev.

Configuration visibility: Pinia’s selected online playground declares a files glob that TypeScript treats as a missing literal root (TS6053). The Vue scan now finds its SFCs and request, but readiness still hides this invalid declaration. Existing tests check malformed JSON only. Add a focused test that keeps the SFC observation and reports the missing declared root as a diagnostic, without treating missing external type packages as a source failure.

Shared HTTP value slice: Hoppscotch proves axios.create({ ...defaults, baseURL: literal }) loses the literal base because ownProperty returns unknown at an earlier spread and never reaches the overriding property. This affects all TypeScript-family scanners through one language-neutral syntax helper. Existing Vue HTTP coverage has axios.create without an earlier spread. Extend that fixture with one request whose path must keep the literal base, verify it fails before changing the shared property-order rule, and run React/TypeScript/Angular/JavaScript HTTP checks afterward.

Shared fetch-method slice: Vuetify constructs a global URL object and passes it to fetch; the scanner reports unknown URL text and omits GET, although URL objects cannot carry a Request method. Existing Vue HTTP coverage checks string inputs and options, not a URL instance. Add one source-level fetch(new URL(...)) regression that requires GET while retaining an unknown path. Recognize the runtime URL constructor through the shared checker so a project-defined URL class is not mistaken for it, then run the TypeScript-family HTTP suites.

Common Vue emit forms: Vuetify’s Chat/List.vue declares a literal runtime defineEmits array and emits from its template; Vue Devtools’ QuoteControls uses a typed emit called directly by template controls. Both child events are bound to direct parent functions, but the scanner reports no event relationship. Existing coverage only exercises type-literal emits inside script functions. Extend the fixture first for literal runtime arrays, then for direct template emit calls. Require one declared literal event, the same resolved emit symbol, an exact source position, and the existing direct parent handler; use a source operation for template code rather than inventing an architecture box.

Nested ownership correction from full-context review: a parent Vue tsconfig with a broad include compiles an already selected child Vue package, duplicating Child.vue roots and operations. Existing nested tests use sibling configs and miss parent-child overlap. Add a minimal parent-child fixture whose child file and operation must appear once; verify it fails before filtering parent compiler root names to that package’s assigned tracked sources. Retain configured TS/JS roots owned by each selected package and explicit SFC/Nuxt roots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-487 currently records docs/scanners/vue/index.md and shared HTTP/source helpers. This Vue pass will avoid those files unless a verified fix needs them; coordinate only on a real file-level overlap. Other active task files do not overlap Vue source/tests.

Before Vue changes, the focused Vue suite had 12 pass and 2 fail because active TASK-487 shared HTTP changes now recognize a named undici fetch, while Vue HTTP expectations still omit it. This is a concurrent upstream change, not a Vue regression introduced by TASK-491. Vue package build passed. Initial public scans already expose separate project-discovery and Vue event coverage gaps; each will be verified against source before a fix.

Vue event slice is red-to-green: existing fixture changed to function-typed defineEmits lost both known bindings before the fix, then restored them after reading the function type. A native button listener no longer produces an unsupported SFC binding diagnostic. The focused test passes; pinned Vue REPL now reports 2 invocations instead of 1 and only 1 diagnostic instead of 26, while Vue Devtools retains 8 valid invocations and drops diagnostics from 152 to 34. No architecture/core rule changed.

Project-discovery regression failed before the shared fix and now passes: export-only package.json files no longer hide a parent framework project. The shared selector still respects nearest eligible nested React/Angular/Vue projects; 8 nested-scanners tests pass. Vue now passes tracked SFCs and Nuxt route files as compiler roots in addition to tsconfig roots. A solution-style files:[] test failed before and passes after. Pinned PrimeVue now scans 3 SFCs in packages/core instead of no project; Nuxt basic scans 218 files and 19 routes instead of zero; Element Plus scans all 1,008 tracked SFCs instead of 781; Pinia now includes its online playground SFC and request. The focused nested/Vue/duplicate suite passes 20 tests. Root Nuxt now reaches deliberately malformed test fixtures and fails on Vue syntax, consistent with existing fail-on-invalid-source contract; basic fixture scan is valid.

Quasar generated-config regression failed before the fix and passes after: TS5083 from an absent extended config becomes a scan warning while other config/syntax errors remain fatal. Its pinned playground scans 7 SFCs, and the repository-wide scan now completes with 268 SFCs and one explicit config warning. The focused test verifies the SFC and warning. Readiness uses the same selected roots as scan.

Slidev ancestor-config regression failed before the generic selector option and now passes: packages/client scans under the root config, while React/Angular still require their local configs. Pinned Slidev now reports 132 SFCs and 4 requests, including packages/client/builtin/BlueSky.vue, versus 21 SFCs and no requests before. Vue source listing now uses the same selection. Pinia’s missing files-glob warning is red-to-green while its SFC/request remain observed. Hoppscotch object-spread regression failed before the one-helper property-order fix and passes after; its pinned newsletter POST now keeps literal api/public/subscription path after the unknown host. Shared Vue/React/TypeScript/Angular/JavaScript HTTP suite passes 23 tests.

Final pinned rerun: Vue REPL 2 event invocations; Nuxt basic fixture 197 SFCs and 19 endpoints; Devtools 15 invocations including 7 direct template emits; PrimeVue 3 SFCs; Element Plus 1008 SFCs and 77 invocations; Vuetify 1265 SFCs and 13 requests; Quasar 268 SFCs; Slidev 132 SFCs; Hoppscotch sh-admin 13 requests and 3 template emits; Pinia 38 SFCs. Hoppscotch newsletter POST retains api/public/subscription after an unknown host, and Vuetify pwa.ts fetch(new URL(...)) reports GET with an unknown path. Focused Vue/nested/HTTP suite passes 24 tests and 141 assertions. Docs updated for current Vue behavior. bun run check passed Biome and typecheck but its Bun suite failed one unrelated route-crossings test while a separate agent is changing the route-layout files; all Vue and shared HTTP cases passed in that run.

Cold simplicity review traced scanVue -> selected Vue packages/source roots -> Vue compiler -> event and HTTP evidence -> observation. It found no blocking issue or safe abstraction/test deletion. Its one test clarity suggestion was applied; a comment now identifies nearest selected Vue package as source owner. Implementer specification review: ten pinned repository observations and named regression evidence are present; Vue behavior and documentation match. AC3 awaits a full check free of another agent’s route-layout failure, and AC4 awaits clone cleanup/report. Implementer quality review: Vue event links require a declared literal event, same emit symbol, mapped source position, and direct resolved parent handler; template source is an evidence operation, not a C4 element. Shared property and URL changes use language-neutral syntax and pass React/Angular/TypeScript/JavaScript HTTP checks. New tests would fail the concrete earlier misses and do not freeze prose. Known limits: invalid Vue syntax in selected Nuxt fixtures and malformed Hoppscotch declaration source still abort their repository-wide scans under the documented invalid-source rule; PrimeVue/Pinia packages without a direct Vue dependency remain outside selection. Focused suite after review: 44 pass, 210 assertions; diff check clean.

Full-context complexity review found a material nested ownership defect: a parent Vue tsconfig with include **/*.vue compiled a selected child package too. A new parent+child regression failed before the fix (Child.vue had two project roots) and passed after filtering configured compiler roots to assigned tracked sources. The compiler still resolves imports across packages, but observed files belong to their nearest selected Vue project; a configured parent helper.ts remains observed. The reviewer found no other architecture change needed.

The first ownership fix exposed a regression in the Vue HTTP fixture: a selected package depended on a declaration file from its parent that the new root filter dropped. It also hid Pinia’s missing declared root warning. The final compiler roots are all tracked code assigned to the project plus configured roots that are not assigned to a different selected Vue project. Inventory excludes imported files assigned to another selected project, while type resolution can still read them. The focused Vue/nested/HTTP suite passes 25 tests and 145 assertions after this correction; the parent-child regression confirms Child.vue has one root and one wave operation, and the existing HTTP fixture confirms external declarations remain available.

Pinned public checkouts, baseline -> final classification: Vue REPL 9b5bc873415bbc6fcba6080b9402d140175d5b03 (typed function emits restored); Nuxt f258408a2820f609e1b378ad9fe95cb8d53c7063 (basic fixture now 19 server endpoints; root still has deliberately invalid Vue fixture); Devtools 389aaa43d371b123ec23d83a595ee5fbceb18fa0 (direct template emits restored, native-listener noise removed); PrimeVue c51a51a514f6119b60f149e950cea60540c455ba (core package discovered despite export-only manifests; Options API remains outside current event inference); Element Plus fe303f3707739b2ef17b945d8566ba30f910914d (all 1008 tracked SFCs reached); Vuetify 6d6513edcadc19abf1edf8f05c81312ffab55480 (global URL fetch GET restored, native noise removed); Quasar b277ec87c775a058b2028c5cc7e89b2bf2fc20af (absent generated config warns rather than aborts); Slidev 30a0a54c8739b4b395d9b336a6304cc8ebcc3947 (client package discovered under ancestor config); Hoppscotch d86e59f6e9574c69f01b300691b9f4396eeb38d2 (axios spread baseURL restored; root still has malformed declaration source); Pinia f4e0cb7a8193f564c27f6527b3f954e114a7534c (online playground SFCs reached and missing files-root warning surfaced). Final rerun after ownership correction succeeded for all qualified package scans. Latest typecheck and diff check pass.

Final bun run check after all Vue code changes: Biome and TypeScript stages passed; Bun suite had 700 pass, 43 skip, 1 fail. The sole failure is test-bun/route-crossings.test.ts (routesCross returned true where false expected) in another agent’s active src/sheet route-layout work, with no modified-file overlap with TASK-491. All Vue tests passed in this run. Every /private/tmp/groma-vue-491* checkout and observation was removed; find verification returned no matches.

Targeted full-context re-review confirmed the original nested ownership defect is resolved: Child.vue has one child package root and one wave operation in both the new parent-import regression and the reviewer’s original no-import reproduction. No remaining defect in that finding.

Alex requested commit and push on 2026-09-23. Rechecked the task-scoped Vue, nested-project, React, Angular, TypeScript and JavaScript HTTP tests: 45 pass, 214 assertions. The independent route-crossings test still fails in another agent’s route-layout files; complete repository check AC3 remains open. Vue task files will be committed and pushed without unrelated workspace changes.

Full repository check at 9a0e9bb1 in a clean detached worktree (bun install --frozen-lockfile, bun run check): Biome and typecheck pass; Node 16 pass; Bun 705 pass, 43 skip, 0 fail. The earlier route-crossings failure is resolved by the committed routing work, so AC3 and DoD 1-2 now have objective evidence.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Qualified the Vue scanner on ten pinned public repositories and fixed function-typed and runtime-array emits, direct template emits, native-listener diagnostic noise, project discovery under export-only manifests and ancestor tsconfigs, solution-style configs, missing generated base configs, nested package ownership, spread axios baseURL values, and fetch with a URL object. Verified with focused Vue, nested-project and TypeScript-family HTTP tests and the full repository check at 9a0e9bb1 (Node 16 pass; Bun 705 pass, 43 skip, 0 fail). Temporary clones were removed.
<!-- SECTION:FINAL_SUMMARY:END -->
