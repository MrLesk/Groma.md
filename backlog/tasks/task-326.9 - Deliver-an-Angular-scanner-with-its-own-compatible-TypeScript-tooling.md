---
id: TASK-326.9
title: Deliver an Angular scanner with its own compatible TypeScript tooling
status: Done
assignee:
  - '@scanner-angular'
created_date: '2026-09-08 21:43'
updated_date: '2026-09-08 22:15'
labels:
  - scanners
dependencies:
  - TASK-326.8
  - TASK-326.4
references:
  - ../callforpapers
  - ../callforpapers/package.json
  - >-
    ../callforpapers/src/main/webapp/app/callforpaper/companies/company-merge-dialog.component.ts
  - 'https://angular.dev/tools/cli/aot-compiler'
  - 'https://angular.dev/reference/versions'
  - scan
  - scanner
  - scanner-index-2
  - scanner-build-2
documentation:
  - docs/scanners/evidence.md
  - docs/scanners/creating-a-plugin.md
  - docs/component-markdown.md
modified_files:
  - plugins/scanners/angular/package.json
  - bun.lock
  - test/fixtures/angular-output/package.json
  - test/fixtures/angular-output/tsconfig.json
  - test/fixtures/angular-output/emitter.ts.fixture
  - test/fixtures/angular-output/host.ts.fixture
  - test/fixtures/angular-output/host.html
  - test/fixtures/angular-output/emitter.html
  - plugins/scanners/angular/src/index.ts
  - plugins/scanners/angular/src/scan.ts
  - plugins/scanners/angular/build.ts
  - plugins/scanners/angular/.gitignore
  - test-bun/angular-scanner.test.ts
  - docs/scanners/angular/index.md
  - docs/scanners/angular/validation.md
parent_task_id: TASK-326
type: feature
ordinal: 370000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Developers scanning ../callforpapers can install an official Angular plugin alongside the Java plugin and Groma's embedded TypeScript scanner. Angular supplies framework-specific evidence on top of the language evidence, and both Angular and TypeScript intentionally inspect some of the same files. The Angular plugin is a separate scanner using the existing plugin lifecycle and the core composition rules from its dependency task.

The plugin carries its own compatible TypeScript dependency and uses established Angular compiler tooling. Groma continues shipping its embedded TypeScript 7.1 SDK. Do not require Angular to share that compiler instance, upgrade the target application, use a nightly compiler without demonstrated compatibility, or recreate Angular template/language semantics. Choose and verify an Angular/TypeScript pair that understands the target project's declared Angular version. A plugin-local compiler dependency is distinct from bundling a complete development environment.

Use ../callforpapers as the real-project acceptance source; it currently declares Angular 21.2, TypeScript 5.9, and already has Angular compiler/compiler-cli dependencies. The first supported Angular flow is CompanyMergeDialogComponent under src/main/webapp/app/callforpaper/companies: its external template connects a button event to onMerge(), the class uses an injected CompanyService, and its merged output can bind to a parent handler. Establish one concrete template event/output binding and its source endpoints with a human-reviewed example. Injection, routing, and other Angular constructs outside that example must remain stated coverage limits until separately approved.

Use existing TypeScript evidence and plugin infrastructure where appropriate, but no Angular research branch is assumed. Build only the Groma adapter and evidence extraction that the supported example requires. An Angular component is source evidence, not automatically a C4 component. Core owns relationship interpretation and produces the existing readable OKF Markdown; the Angular plugin does not write architecture.

HTML template edits must participate in the supported rescan lifecycle. Automated tests use a minimal independent Angular fixture, never the live callforpapers tree. Java-to-Angular HTTP matching, automatic Spring runtime wiring, and exhaustive Angular support are outside this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A separately installable official Angular scanner runs alongside Java and embedded TypeScript in compiled Groma without replacing or changing Groma's embedded TypeScript 7.1 SDK.
- [x] #2 The Angular plugin carries compatible TypeScript tooling and uses established Angular analysis APIs; the supported compiler pair is verified against the target project's Angular version without changing that project's dependencies.
- [x] #3 The supported external-template event/output binding is resolved to concrete source endpoints and contributes shared-contract evidence beyond the ordinary TypeScript scan; unsupported or ambiguous bindings remain explicit.
- [x] #4 Files inspected by both Angular and TypeScript follow the shared composition contract, preserving one curated owner and avoiding duplicate architecture elements or blanket scanner precedence.
- [x] #5 Changing the supported HTML template triggers the Angular rescan path, and repeat scans preserve curated architecture; scanner failure preserves the previous complete map.
- [x] #6 The selected company-merge flow in ../callforpapers has a human-reviewed result with all three scanners enabled; independent fixture tests cover the corresponding behavior.
- [x] #7 The package and documentation state required tooling, compiler-version compatibility, supported Angular evidence, and coverage limits, and are ready for common release qualification.
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
1. Build a separately installable Angular ESM package with pinned compiler/compiler-cli 21.2.17 and plugin-local TypeScript 5.9.3. Bundle compiler imports against that local SDK and ship its standard-library declarations; keep embedded TypeScript 7.1 unchanged.
2. Use Angular template type checking to resolve a unique external-template output-to-method binding. Use TypeScript declaration identity for exact emit and caller endpoints, including arrow callbacks. Emit temporary shared operations and UTF-16 source positions with angular provenance; report unsupported bindings explicitly.
3. Reuse shared composition and HTML watch dispatch. Verify independent built-artifact fixtures for complementary evidence, exact endpoints, curated owner preservation, unsupported expressions, HTML rescan, and failed-scan preservation.
4. Validate the unchanged callforpapers source in an acceptance copy using its frozen-lock Angular core 21.2.19 with Java, Angular, and embedded TypeScript in compiled Groma. Curate each selected TS/HTML pair through existing Groma commands, verify repeat/failure preservation, and export the concrete map for coordinator review.
5. Complete cold simplicity review, implementer specification/quality reviews, the serialized repository check, coordinator browser acceptance, and full-context review. Record public naming, publication, and non-macOS execution as separate release work.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the separately built Angular package using NgtscProgram/template symbols and exact TypeScript declaration identity. Bun workspace hoisting initially resolved compiler-cli against embedded TS7; the approved package-contained build now bundles every compiler TypeScript import from plugin-local5.9.3 and copies standard library declarations. EmbeddedTS7.1 remains unchanged. Independent built-artifact tests:3 pass/23 assertions, including arrow source positions, callback absent from TS alone, explicit unsupported expressions, curated ownership, actual HTML watch dispatch, and failed-scan preservation. Focused Biome and typecheck pass. Actual callforpapers copy used unchanged pnpm frozen lock (core21.2.19) with scanner compiler21.2.17/TS5.9.3; Angular emitted711 files/121 operations/121 invocations. Compiled Groma with Java+Angular+embeddedTS succeeded, selected merged binding matches HTML line8 and emit line87, repeat scan and failed analysis both preserve1396 architecture documents byte-for-byte. Restored source/configuration matched3171 source-copy files byte-for-byte. Package and documentation are ready for cold simplicity review; map export is running. Publication/platform and coordinator acceptance remain gates.

Cold simplicity review passed without required changes. Implementer specification review: AC1 is proven by the built package installed alongside Java and embeddedTS in compiled Groma; AC2 by isolated compiler21.2.17/TS5.9.3 and unchanged application lock core21.2.19; AC3 by independent and actual source-position/binding witnesses with TS-only contrast; AC4 by one source owner retaining both provenance contributions and order-stable curated records; AC5 by actual HTML watcher dispatch and malformed-template atomicity; AC6 has coordinator inspection of the concrete callback map, with requested TS+HTML responsibility curation and preservation/export being completed in the acceptance copy; AC7 package docs state exact tooling and limits while public/platform qualification remains separate. Implementer quality review found no reproducible defect or unnecessary abstraction in the supported flow. Compiler APIs own resolution, core owns meaning, and artifact tests exercise the consumer path. No new/changed source exceeds500 lines or introduces a complexity warning. Shared bun run check is running under the coordinator-granted exclusive slot.

Coordinator approved the concrete callback map and requested acceptance-only curation: merged each selected TS+HTML pair under existing merge-dialog and company-list owners. Repeat scan preserves1394 documents byte-for-byte. Shared bun run check found two failures outside Angular: release-version copied fixture omits worker.ts required by the Java export fix; web-authoring add/remove encountered ENOENT during background map reload. Angular tests pass; lint/typecheck/Node suite pass. Full log:/tmp/groma-angular-shared-check.log. Coordinator owns assignment of those fixes; no unowned files changed.

Final evidence: the coordinator accepted the refreshed browser map with 1,394 documents. Both selected TS/HTML pairs share their existing responsibility owner, and the merge dialog interaction shows supplied merged/cancelled/error callbacks to the company list with Angular provenance. Curated repeat and malformed-template failure both preserved all 1,394 documents byte for byte; the copied source was restored before successful export. Cold simplicity and full-context reviews passed without required changes. Implementer specification and quality reviews passed. The shared check passed after the Java release fixture correction: 382 Bun tests passed, one Java tooling test skipped, zero failures; lint, type checking, and the Node suite passed. Log: /tmp/groma-angular-shared-check-after-java-fixture.log. The independently reproduced pre-existing web mutation/read race is tracked separately as TASK-327, with no web files changed here. Acceptance map: /var/folders/fd/cgvn5zh52tb_sbt7hp_vtbmm0000gn/T/groma-angular-acceptance-3gz__0fe/map/index.html. Built consumer package: plugins/scanners/angular/dist/package. Public publication and Windows/Linux execution remain separate release qualification, not claimed here.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered an independently installable Angular compiler-backed scanner with isolated TypeScript 5.9.3, concrete external-template output bindings, and shared ownership/rescan behavior. The approved CompanyMergeDialog flow passed compiled Java+Angular+TypeScript validation and coordinator browser review after TS/HTML responsibility curation. Focused tests, both external reviews, implementer reviews, and bun run check passed. Package documentation records exact compiler compatibility and narrow coverage; public naming, publication, and Windows/Linux qualification remain separate release work.
<!-- SECTION:FINAL_SUMMARY:END -->
