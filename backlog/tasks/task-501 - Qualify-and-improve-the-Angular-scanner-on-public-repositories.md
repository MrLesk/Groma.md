---
id: TASK-501
title: Qualify and improve the Angular scanner on public repositories
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 20:07'
updated_date: '2026-09-24 16:17'
labels: []
dependencies: []
references:
  - angular-src-index
  - scanners-projects
modified_files:
  - test/fixtures/angular-output/host.ts.fixture
  - plugins/scanners/projects.ts
  - plugins/scanners/typescript-project.ts
  - plugins/scanners/angular/src/project.ts
  - plugins/scanners/angular/src/components.ts
  - plugins/scanners/angular/src/evidence.ts
  - plugins/scanners/angular/src/template.ts
  - plugins/scanners/angular/src/scan.ts
  - plugins/scanners/angular/src/http.ts
  - plugins/scanners/angular/src/index.ts
  - plugins/scanners/entry-points/javascript.ts
  - test-bun/angular-scanner.test.ts
  - test/fixtures/angular-http/talk.service.ts.fixture
  - test-bun/angular-http.test.ts
  - docs/scanners/angular/index.md
  - docs/scanners/evidence.md
  - groma/systems/groma-md/containers/cli/components/angular-src-index.md
  - plugins/scanners/angular/package.json
  - bun.lock
  - docs/scanners/creating-a-plugin.md
  - plugins/scanners/angular/src/directives.ts
type: task
ordinal: 582000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Angular scanner is qualified on one callforpapers output-to-parent flow and small fixtures. Real repositories combine Angular versions, workspace layouts (Angular CLI multi-project, Nx, Vite-based), standalone and NgModule components, signal inputs and outputs, inline and external templates, server rendering and HttpClient patterns that those fixtures do not exercise. Alex asked on 2026-09-23 for a scanner-by-scanner pass over the official scanners not yet qualified on public repositories; this task covers Angular. Diverse public Angular projects are scanned to expose real edge cases, and verified scanner failures are fixed while C4 interpretation stays in language-neutral Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public Angular repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported Angular scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the Angular scanner changes.
- [x] #4 Temporary repository clones are removed after Angular qualification and the results are reported to Alex before work starts on another scanner.
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
1. Build the Angular and JavaScript scanner packages into the session scratchpad. A scratch runner scans one clone with the raw Angular scanner (observation, source units, output bindings, HTTP requests, entries, diagnostics, listing consistency), then with the full Groma pipeline (TypeScript + Angular, plus Java or JavaScript where the repository has that backend).
2. Ten read-only agents clone ten pinned public Angular repositories into separate scratch clones, run the runner, and classify findings against the Angular scanner contract with source evidence and minimal reproductions: realworld, nx-examples, ionic-conference-app, jhipster-sample-app, dspace-angular, spartan, ngrx/platform, analog, ngx-admin, Angular-JumpStart.
3. Verify each reported defect against source. Before each focused regression, record the supported rule and its authority, the concrete wrong result and the coverage gap. Fix in the owning Angular or shared TypeScript-family scanner module; C4 interpretation stays in core.
4. Re-scan affected clones, run focused checks and bun run check, do the subtraction pass, run the cold simplicity review and the full-context complexity review, delete every clone, report to Alex and pause before the next scanner.

Test decision A (selector-less components): the Angular guide ties source units only to literal templateUrl/styleUrl/styleUrls. Routed pages and dialogs without a selector (Ionic TabsPage, five JHipster delete dialogs, ngx-admin WindowFormComponent) lose their unit, their templates become separate components, and their template bindings are never inspected. The fixture host declares an unused selector, so no test covers a selector-less parent. Remove that selector from the host fixture: the existing source-unit and binding tests then fail before the fix.

Test decision B (project loading): the Angular guide promises that each selected project compiles its own TypeScript sources and that readiness and scan agree with the source listing. Real workspaces break this: Angular CLI 20+ and Nx write solution configs (files [] plus references), so the observation is silently empty (nx-examples, spartan, ngrx modules); Nx keeps @angular/core in the root package while project configs live below it (spartan apps/app never selected); specs, JSON modules and .mts configs become Angular-only components (ionic 5, realworld 6, ngrx 305); a TypeScript 6 option fails the whole observation (ngrx stableTypeOrdering). Existing tests use one own tsconfig with plain roots. Add one Angular scanner case with a solution config, an Nx-style root that declares Angular without its own config, a spec file and a newer compiler option: the component must be scanned, the spec and JSON must stay out of files and the listing, and the option must only warn.

Test decision B also covers two Nx workspace facts the same repositories exposed: a project.json build target is an application entry named after the project, with its polyfills and environment replacements in that application (nx-examples, ngrx apps, spartan); and a stylesheet a component names that the checkout lacks warns instead of failing the whole observation (Angular-JumpStart Storybook stories). Existing entry tests read only angular.json and existing unit tests have every resource present.

Test decision C (bindings): the guide binds an output to a parent method through a matched source child. Real templates bind outputs of source directives (JHipster and Angular-JumpStart sort directives, emitting with next), children that emit from their own template (RealWorld delete, ngrx, Analog), parents with inline templates (spartan 884 of 884 components, ngrx 18 bindings) and imports gathered in constant arrays (spartan). Existing tests cover one component child emitting from its class, bound in an external template. Add one case with an inline parent template importing a constant array of a directive and a component: the directive's next and the child's template emit must each become the binding to the parent method.

Test decision D (HTTP): the guide reports HttpClient requests at the function that runs them. A request in a constructor is dropped (ngx-admin bubble map), one in a field initializer is dropped (Analog products page), and httpResource reports nothing (JHipster 6, spartan, Analog). The HTTP fixture calls the client only from methods. Extend it with a constructor call, a field initializer and an httpResource: each must report its GET request.

Test decision E (inherited outputs): a binding holds when the matched child emits the output it declares. DSpace declares @Output in a base suggestion component and emits it in the matched subclass (12 bindings); the scanner searches only the declaring class, so it reports a diagnostic. The bindings test declares the directive's output on the directive itself. Move the sort directive's output to a base class it extends: the binding must still become the relationship to the parent method.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ten pinned public Angular repositories were scanned read-only by ten agents with a scratch runner (raw Angular observation plus the full Groma pipeline): gothinkster/angular-realworld-example-app dd99ed2cf39c805d719f943c5d7061a5683d98a8; nrwl/nx-examples 42cfd423aca65262200a3b371adbfdf526498876; ionic-team/ionic-conference-app 1ba827fe4da6c201b9bde4d0e426b28b400aa058; jhipster/jhipster-sample-app 6b000b5d23a36c45e01472471b84a44fa2464044 (with Java); DSpace/dspace-angular 2f1bf85ce2ea823503f10005d6e7b769643de06d; spartan-ng/spartan 4f6dba69f14a9c94c03bd0dda88b0cf6a1480c17; ngrx/platform 32c4c74bd838cf00f8f318753f44cbd11387754b; analogjs/analog 997472dae298c21add861e486061b13dc112cae8; akveo/ngx-admin dc6a442704bfef34b776b5eb15faf852d9e2f75c; DanWahlin/Angular-JumpStart bebc5431dfc65111a88bc2a5a27abf59888dd91d (with JavaScript).

Defects found and fixed: solution configs compiled nothing (nx-examples, spartan, ngrx modules, Analog, Angular CLI 20+ shape); Nx roots that declare Angular without their own config were never selected (spartan, Analog apps); specs, JSON modules and .mts configs became Angular-only components (Ionic 5, RealWorld 6, ngrx 305, DSpace 962); a TypeScript 6 option or an uninstalled extended config failed the whole observation (ngrx, Analog); a missing styleUrl failed the whole observation (Angular-JumpStart); selector-less components lost their unit and template inspection (Ionic, JHipster 5, ngx-admin, DSpace 3); the listing disagreed with the scan (nx-examples); HttpClient calls in constructors and field initializers were dropped (ngx-admin, Analog); readiness built every program only to check configs.

Coverage gaps closed: outputs of source directives with EventEmitter next (JHipster 5, Angular-JumpStart 5, DSpace 14); outputs emitted from the child's own template (RealWorld, ngrx 11, DSpace 18); inline templates (spartan 884 components, ngrx 18 bindings); imports gathered in constant arrays (spartan); outputs declared in a base class and emitted by the matched subclass (DSpace 12); httpResource (JHipster 6, spartan, Analog); Nx project.json build targets with polyfills and environment replacements (nx-examples, ngrx, spartan, Ionic, ngx-admin).

Rescan with the rebuilt package (Angular observation only): RealWorld 8 bindings (was 6), 18 requests, no specs; nx-examples 78 files, 3 units, 1 entry (was 0 files); Ionic 15 units (was 13); JHipster 54 units, 5 bindings (was 0), 46 requests; DSpace 888 units, 297 bindings, no specs (4332 to 3364 files); spartan 2076 files, 876 units, 15 bindings, 1 request (was 0 files); ngrx 874 files, 86 units, 7 entries (was a failed scan); Analog 634 files, 101 units, 10 bindings, 11 requests, 25 entries (was 83 scaffolding files); ngx-admin 141 units, 3 requests (was 2); Angular-JumpStart 10 bindings with 3 missing-resource warnings (was a failed scan). The full pipeline on RealWorld, Ionic, nx-examples, JHipster and Angular-JumpStart exited 0; RealWorld derives 6 Angular rows (was 4).

Cold simplicity review (no history) traced listSourceFiles, checkReadiness and scanAngular through projects, config ownership, programs, templates, HTTP and entries; nothing blocking. Accepted and applied: removed the unused @angular/compiler-cli dependency (bun.lock loses 97 lines) and its plugin-guide example; removed Evidence.templates; moved source units into Templates so resource checks and missing-resource warnings live in one place; reused one unwrap helper; deleted httpResource text/blob/arrayBuffer, block-body factories and accessor operations that no qualified repository used; merged entryFiles into reachedFiles and reused packageFor for the Nx workspace root; dropped a no-op filter; one unreadable-config message; the bindings test no longer freezes core's statement wording; renamed angularSources to angularProjects and inspect to bindOutputs; documented how a referenced config wins a tie.

A suite run exposed that sources imported by a config's roots but not named by it got a second default program, doubling the Angular nested test time (16.9 s against 8.1 s on HEAD, a 20 s suite timeout). Such a source now compiles in the program that imports it; the test runs faster than HEAD in back-to-back runs.

Implementer specification review: AC1 evidence is in these notes; AC2 fixes each have a focused test (fixture host without selector; Nx workspace case covering solution configs, root dependency, specs, JSON modules, unreadable settings, missing stylesheet and project.json entries; bindings case covering directive outputs with next, an inherited output, a child template emit, inline templates and constant import arrays; HTTP fixture covering a constructor, a field initializer and httpResource GET and POST). AC3 and AC4 pending. Quality review: each responsibility has one module (project.ts selection, configs and programs; components.ts directive metadata and outputs; template.ts views, units and bindings; http.ts requests; evidence.ts operations; scan.ts orchestration; entry-points/javascript.ts shared entries); the new tests fail for the concrete wrong results and do not freeze prose; changed functions stay within the complexity limit and every file is under 500 lines.

Removed all ten temporary clones (scratchpad angular-501/repos, 253 MB); a find for leftover groma-angular temporary directories returned nothing. Scan summaries remain in the session scratchpad for the report.

Final verification: bun run check passed on 8c541abe, a commit of current main f76c666b plus exactly this task's hunks built in a temporary index (the shared index untouched): Biome, typecheck, Node suite and Bun suite, 734 pass, 45 skip, 0 fail. Earlier runs under heavy machine load (load average 31 to 39 from parallel sessions) timed out in unrelated Swift and Python tests that pass alone in 22 s and 10 s. The first suite run also exposed the doubled Angular nested-project time, fixed before this run. The complete change was checked against the core/scanner separation rule another session relayed: the scanner code names no C4 concept and no core file changed.

Full-context review (a general-purpose agent with a written brief of the conversation; the fork agent type is not available in this session) kept the approach. Alex approved its four in-task changes, now applied: resourceCall reads the request object through the shared heldAt and heldParts and directiveImports uses the shared unwrapped, so Angular's own copies are gone; components.ts is now directives.ts and the parsed template type is ParsedTemplate; AngularProgram states owned and readable sources, with inRepository moved into project.ts; one repository() test helper replaces three. The live scan watcher created a component for directives.ts and dropped the removed components.ts; groma edit --combine folded it back into angular-src-index. Its cross-scanner follow-ups (one shared TypeScript-family project model, a newer bundled TypeScript for Angular, one helper for files that facts name, neutral names for the shared value helpers, renaming packageFor) went to Alex as open decisions, with the URL-base rule, shared-template units, SSR server targets and NgModule children.

Final verification after the approved review changes: bun run check passed on 13d5c964, main f45ad201 plus exactly this task's hunks built in a temporary index, with 734 pass, 45 skip and 0 fail. The Angular scanner, HTTP, execution-entry and nested Angular tests passed in the shared tree as well. Alex received the Angular report with the clones already removed and approved the review changes, Done, commit and push.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Qualified the Angular scanner on ten pinned public repositories (RealWorld, nx-examples, Ionic conference, JHipster, DSpace, spartan, ngrx platform, Analog, ngx-admin, Angular-JumpStart) and fixed what they exposed. Projects now compile through the TypeScript configs that own their sources: solution configs, Nx roots that declare Angular once, specs left out, unreadable settings and missing template or style files warn instead of failing the scan. Components without a selector keep their units. Output bindings now cover source directives, inherited outputs, emits in the child's own template, inline templates and constant import arrays. HTTP requests include constructors, field initializers and httpResource. Nx project.json build targets with their polyfills and environment replacements form application entries. The unused @angular/compiler-cli dependency is gone. Verified with focused Angular, HTTP and entry tests, rescans of all ten repositories, and bun run check (734 pass, 45 skip, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
