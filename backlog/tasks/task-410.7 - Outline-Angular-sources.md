---
id: TASK-410.7
title: Outline Angular sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-18 19:31'
labels: []
dependencies: []
references:
  - scanners-projects
  - angular-src-index
  - source-read
  - src-structure
  - scanners-typescript-outline
  - javascript-src-outline
modified_files:
  - plugins/scanners/typescript-outline.ts
  - plugins/scanners/angular/src/index.ts
  - test/fixtures/angular-outline/profile.component.ts
  - test/fixtures/angular-outline/profile.component.html
  - test/fixtures/angular-outline/groma/index.md
  - test/fixtures/angular-outline/groma/project.md
  - test/fixtures/angular-outline/groma/systems/studio/system.md
  - >-
    test/fixtures/angular-outline/groma/systems/studio/containers/web/container.md
  - >-
    test/fixtures/angular-outline/groma/systems/studio/containers/web/components/profile.md
  - src/viewers/source/structure.ts
  - test-bun/angular-scanner.test.ts
  - docs/scanners/angular/index.md
  - plugins/scanners/typescript/src/structure.ts
  - test-bun/code-outline.test.ts
  - plugins/scanners/javascript/src/outline.ts
  - test/fixtures/typescript-outline/outline.ts
  - test/fixtures/javascript-outline/app/checkout.mjs
  - test-bun/javascript-scanner.test.ts
  - docs/scanners/creating-a-plugin.md
parent_task_id: TASK-410
type: feature
ordinal: 463000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Angular owns component and service TypeScript files in Angular projects, so those files show no methods even though the TypeScript scanner can outline TypeScript. In callforpapers most frontend TypeScript files are Angular-owned. The Angular scanner carries its own TypeScript tooling and must not depend on the TypeScript scanner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Angular-owned TypeScript files show their classes with methods and top-level functions, each with name, line and visibility.
- [x] #2 Independent fixtures cover the outline, including files the scanner owns alongside another scanner.
- [x] #3 The Angular scanner documentation describes the outline.
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
1. Add plugins/scanners/typescript-outline.ts: one shared outline for the TypeScript-family framework scanners. readTypeScriptOutline(ts, root, references) parses each referenced file with ts.createSourceFile (no program, tsconfig or dependencies) and applies the documented rules exactly as the TypeScript reference does: top-level functions and direct function literals, classes/interfaces/enums as type with constructors, methods and method signatures as members, transparent namespace blocks, and export/export-list/export default/export = visibility read from the statement. It receives the classic typescript module as a parameter, typed by structural declarations named as the compiler names them, because the repository-root typescript package is the 7.x SDK without the classic API; each framework package passes and bundles its own pinned compiler, and the call site checks that compiler against those types. The TypeScript scanner keeps its 7.x SDK implementation; both files point to each other.
2. Angular index.ts: readCodeStructure outlines the .ts references with the Angular package's TypeScript 5.9.3; templates and stylesheets have no declarations.
3. Core (src/viewers/source/structure.ts): before calling scanners, build one request per Code file with the symbols of all its links, sent to the lowest configured scanner id among its links, so a file Angular and TypeScript both own is outlined once and keeps every entry mark.
4. Fixture test/fixtures/angular-outline (decorated component source, template, groma tree whose component Code lists the source under typescript with a symbol and under angular). Tests in test-bun/angular-scanner.test.ts: the built package outlines the component; it equals the TypeScript reference outline on both outline fixtures; core returns one outline for the co-owned file with the TypeScript link's entry mark.
5. Document the outline and the shared-file rule in docs/scanners/angular/index.md.
6. Isolated bun run check, Angular build, tui-test on a scanned fixture copy, specification and quality self-review.

Review round (Codex, Grok cold reviews at cf8e7975):
7. One outline engine (Grok u04 TASK-410 #2, Grok-all outlines #1; Codex u04 TASK-410 #2): plugins/scanners/typescript-outline.ts outlines an already parsed source file and reads nodes by syntax kind, so the TypeScript scanner passes its native SDK's SyntaxKind and the source files of its project snapshot, while the framework and JavaScript scanners keep parsing text with their classic compiler. plugins/scanners/typescript/src/structure.ts keeps only the snapshot lookup. Visibility comes from the modifiers written in the source (export, private, protected, #name), stated once; JSDoc tags do not change it, as the documented TypeScript and JavaScript visibility rows already say.
8. Methods named by a string or numeric literal, such as "save"() {}, are listed under their literal name (Codex u04 TASK-410.7, 410.8, 410.9); computed names stay unlisted.
9. Red tests: the TypeScript outline fixture gains quoted and numeric method names, checked through the TypeScript scanner and the Angular package; a JavaScript outline fixture member with a JSDoc @private tag stays public.
Not in this task: Codex u04 TASK-410 #1 (terminal navigation on declarations sharing a line) belongs to the viewer lane.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Sharing: plugins/scanners/typescript-outline.ts takes the classic typescript module as a parameter. The root typescript package is the 7.x SDK (its main export has only the version), so the shared file cannot import compiler types; a structural OutlineCompiler interface lists the calls it makes. A scratch probe confirmed the Angular 5.9.3, React 6.0.3 and Vue 5.9.3 compilers satisfy it and that a missing member is a type error at the call site. The TypeScript scanner is unchanged: it has only the 7.x SDK. Parity: on test/fixtures/typescript-outline/outline.ts, on a #name member, and on five repository sources the Angular outline equals the TypeScript reference outline exactly.
Reproduced defect: with Code listing profile.component.ts under typescript and angular, core readCodeStructure returned the file twice and terminal declaration stops listed each declaration twice. Core now keeps one outline per file (the first scanner id's; configured scanners are sorted by id, so Angular's outline with its Code symbol is kept). The co-owned test fails without this fix (52 extra received lines) and passes with it.
Verification: bun test test-bun/angular-scanner.test.ts test-bun/code-outline.test.ts (10 pass). Isolated worktree bun run check exit 0 (lint: 1 existing warning in test-bun/iso-map.test.ts; tsc clean; node 16 pass; bun 376 pass, 20 skip, 0 fail). bun plugins/scanners/angular/build.ts in that worktree built dist/package with the shared outline bundled against ./typescript.cjs. tui-test on a fixture copy scanned by the real TypeScript and Angular scanners (added package.json, git init): How lists profile.component.ts once with initials private, greeting public, ProfileComponent entry with constructor, save, label protected and #reset private, then profile.component.html without declarations; Down x7 Enter opens profile.component.ts:30 and Down x8 Enter stays at :30.
Proposed, not applied: docs/scanners/creating-a-plugin.md (held by TASK-416) could state after 'Groma orders the files by the component's Code' that a file several scanners outline shows the first scanner id's outline. Follow-up note: each scanner only receives the symbols of its own Code references, so entry marks on a co-owned file follow the kept scanner's references.

Cold review corrections (coordinator decisions), applied: core now chooses one scanner per file before calling scanners (lowest configured scanner id among the file's Code links) and sends it the symbols of every link for that file, so a symbol on the typescript link still marks entry when Angular outlines the file; no outline is computed and discarded, and the rule no longer depends on config sort order or sort stability. New parity test compares the built Angular package with the TypeScript reference on test/fixtures/typescript-outline and test/fixtures/angular-outline; both implementations carry a comment pointing to the other. Shared module types renamed to compiler names with the 7.x SDK explanation; top-level visibility reads the statement's modifier flags. Test renames ('the built Angular package outlines component sources', 'a file Angular and TypeScript both own shows one outline'), reference import renamed to readReferenceOutline in test-bun/code-outline.test.ts, fixture tsconfig.json deleted (the reference infers a project without it), Angular doc names types and namespace contents, entry, and which scanner outlines a shared file. The contract-doc note on shared-file outlines is routed by the coordinator (creating-a-plugin.md is held by TASK-416).
Verification after corrections: bun test test-bun/angular-scanner.test.ts test-bun/code-outline.test.ts 11 pass. Isolated worktree bun run check exit 0 (lint: existing warning in test-bun/iso-map.test.ts only; tsc clean; node 16 pass; bun 387 pass, 24 skip, 0 fail). bun plugins/scanners/angular/build.ts built dist/package with the shared outline bundled. The tui-test run above predates the core rework; the co-owned core behavior after it is covered by the automated test.

Review round (Codex and Grok cold reviews at cf8e7975). Verified with a probe on one source through both engines: methods named "save", 'load' and 42 and the interface signature "fetch" were missing from both the TypeScript scanner's outline and the shared outline (Codex u04, TASK-410.7, 410.8, 410.9); the two engines were separate code (Grok u04 TASK-410 #2, Grok-all outlines #1). The claimed JSDoc divergence did not reproduce on files each scanner owns: both engines honour JSDoc @private only in JavaScript files, and the TypeScript scanner owns only .ts and .tsx.
Change: plugins/scanners/typescript-outline.ts is the one outline engine. outlineSource(compiler, source, context) reads an already parsed source by syntax kind, looked up by name in the SyntaxKind the caller passes; outlineDeclarations and readTypeScriptOutline keep parsing text with a classic compiler for Angular, React and Vue. plugins/scanners/typescript/src/structure.ts keeps only the native SDK snapshot lookup, since that SDK has no standalone parser, and calls outlineSource. plugins/scanners/javascript/src/outline.ts passes the source it already parses instead of parsing twice. Visibility reads the modifiers written in the source (export, private, protected, #name), so a JSDoc @private or @protected tag no longer narrows a JavaScript member, as the documented JavaScript row ('members are public unless their name is private') already states. Methods and method signatures named by a string or number literal are listed under that literal; computed names stay unlisted.
Tests: test/fixtures/typescript-outline/outline.ts gains 'save'(), 404() and "fetch"(), checked through the TypeScript scanner (test-bun/code-outline.test.ts) and, by the existing parity test, the built Angular package; test/fixtures/javascript-outline/app/checkout.mjs gains a JSDoc @private method that stays public. Both tests fail with the three source files reverted.
Verification: bun run check in an isolated worktree at ed695d75 plus this task's files exit 0 (biome: pre-existing warning and infos only; tsc clean; bun 564 pass, 35 skip, 0 fail); the Angular, React, Vue and JavaScript packages build there.
Not in this lane: Codex u04 TASK-410 #1 (terminal navigation stuck on declarations sharing a line) is a viewer finding.

Cold review of this round, applied: test/fixtures/typescript-outline/outline.ts gains overloads, a private method, an accessor, a function expression published by export default, and a nested Tools.Text namespace, and test-bun/code-outline.test.ts expects member visibility too, so the TypeScript scanner, Angular and parity tests cover the kind-name reading; typescript-outline.ts declares type Kinds and drops the casts after boolean aliases (typeMembers returns a type's members); docs/scanners/creating-a-plugin.md lists methods with a computed name among the declarations not listed (only this hunk is committed; the file also holds another lane's edits). Re-verification: bun run check in an isolated worktree at bec16796 plus this task's files exit 0 (tsc clean; bun 570 pass, 35 skip, 0 fail); the Angular, React, Vue and JavaScript packages build there. Its two new lint warnings were in the fixture (a function expression and an unused private method); the fixture now uses the method and states why the function expression stays, biome reports nothing for it, and the outline, Angular and parity tests pass (11 pass).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Angular-owned TypeScript files now show their source outline. New plugins/scanners/typescript-outline.ts applies the documented TypeScript outline rules by parsing each file with the classic compiler a framework scanner passes in (typed structurally, since the root typescript package is the 7.x SDK); the Angular scanner passes its pinned 5.9.3 compiler and outlines only .ts files. Core now outlines each Code file once, with the lowest configured scanner id among its links and the symbols of all its links, fixing duplicated outlines and terminal stops for files Angular and TypeScript both own. Verified with test/fixtures/angular-outline and test-bun/angular-scanner.test.ts (outline rules and lines through the built package, parity with the TypeScript reference on both outline fixtures, one outline with the entry mark for a co-owned file), an isolated bun run check (exit 0), the Angular package build, and tui-test on a scanned fixture copy. Documented in docs/scanners/angular/index.md.

Review round: after external cold reviews, the TypeScript scanner and the Angular, React, Vue and JavaScript scanners share one outline engine, plugins/scanners/typescript-outline.ts, which reads a parsed source by syntax kind so each scanner passes the compiler that parsed it; visibility comes from the modifiers written in the source, and methods named by a string or number literal, such as "save"() {}, are listed. Verified by the extended typescript-outline and javascript-outline fixtures (failing without the fix), the Angular parity tests, bun run check in an isolated worktree and the four package builds.
<!-- SECTION:FINAL_SUMMARY:END -->
