---
id: TASK-503
title: Qualify and improve the React scanner on public repositories
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 20:09'
updated_date: '2026-09-23 21:53'
labels: []
dependencies: []
references:
  - react-src-index
modified_files:
  - plugins/scanners/react/src/project.ts
  - plugins/scanners/react/src/scan.ts
  - test-bun/react-scanner.test.ts
  - docs/scanners/react/index.md
  - plugins/scanners/react/src/routes.ts
  - plugins/scanners/react/src/http.ts
  - test/fixtures/react-http/app/api/listed/route.ts.fixture
  - test/fixtures/react-http/app/_lib/api/ping/route.ts.fixture
  - test/fixtures/react-http/pages/api/session.ts.fixture
  - test/fixtures/react-http/warm.tsx.fixture
  - test-bun/react-http.test.ts
  - plugins/scanners/react/src/functions.ts
  - plugins/scanners/react/src/evidence.ts
  - plugins/scanners/react/src/index.ts
  - test/fixtures/react-http/app/.well-known/security.txt/route.ts.fixture
  - test/fixtures/react-http/methods.tsx.fixture
  - 'test/fixtures/react-http/app/api/auth/[...nextauth]/route.ts.fixture'
  - test-bun/scanner-source-listing.test.ts
  - docs/scanners/creating-a-plugin.md
  - groma/systems/groma-md/containers/cli/components/react-src-index.md
type: task
ordinal: 584000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex requested a repository-by-repository pass over every official scanner not yet qualified on public projects, starting with React. Scan diverse public React TSX projects for real project-selection, tsconfig, callback-binding, Next.js route, HTTP client, entry-point and outline edge cases; fix verified React scanner failures while keeping C4 interpretation in language-neutral Groma core. Earlier passes: TASK-483 Python, TASK-485 PHP, TASK-486 Rust, TASK-487 JavaScript, TASK-491 Vue, TASK-492 Java.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public React repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported React scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the React scanner changes.
- [x] #4 Temporary repository clones are removed after React qualification and the results are reported to Alex before work starts on another scanner.
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
1. Build baseline TypeScript and React scanner packages into the session scratchpad and a shared observation harness. Ten read-only agents each clone one pinned public React repository into the scratchpad, run groma init/scanner add/scan plus the harness, and report source-backed suspected defects with minimal reproductions. They do not edit shared source.
2. Compare each report with docs/scanners/react/index.md and existing tests. Fix verified failures in the owning React or shared TypeScript-family scanner module; keep C4 meaning in core. Before each focused test, record the supported rule, the concrete wrong result and the coverage gap.
3. Re-scan affected repositories with rebuilt packages, run focused checks and bun run check, subtract task-scoped code, run the cold simplicity review and the full-context complexity review, remove all temporary clones, report to Alex and pause before the next scanner.

Repositories (agents 01-10): alan2207/bulletproof-react, excalidraw/excalidraw, t3-oss/create-t3-turbo, vercel/ai-chatbot, umami-software/umami, bluesky-social/social-app, shadcn-ui/taxonomy, epicweb-dev/epic-stack, TanStack/router, tldraw/tldraw. Clones and outputs live under the session scratchpad react/ directory; baseline packages under packages/react-base and packages/typescript. A three-slot guard limits concurrent heavy scans because four sibling scanner sessions share the machine.

Test decision for fresh-checkout configs: the React guide says project dependencies need not be installed and each selected project's tsconfig.json is read. A solution tsconfig.json (files: [] plus references, the Vite react-ts default) and a tsconfig that extends an uninstalled package (the Turborepo default) each fail the whole React observation with REACT_SOURCE_INVALID. Existing React tests use one plain tsconfig.json only. Add one parameterized test over the two layouts on the callback fixture, importing the component through a path alias that only the referenced or own config declares, so a fix that ignores that config's options still fails; the absent base must surface as a react-missing-config-base warning.

Test decision for Next.js exports (taxonomy): the guide promises an endpoint per exported method handler, and evidence.md decision 6 names the file's module code when the file exports no such function. Export lists (export { handler as GET }, the tRPC and NextAuth idiom), wrapped exports (export const PUT = wrap(...)) and a Pages Router default export of a wrapper call report no endpoint, and a broader catch-all then takes their requests as a false row; a private _folder route is reported although Next.js does not route it. Extend the react-http fixture with one export-list route, one wrapped Pages route and one private-folder route, and extend the existing endpoint, request and row expectations; a module-level fetch in a TSX file joins them because it was dropped instead of naming the module code as the TypeScript and JavaScript scanners do.

Test decision for unresolved handler types (bulletproof-react): the guide says missing external types do not prevent local callback extraction, but a named handler whose declared type comes from an uninstalled package types as any, fails the call-signature gate and is dropped silently. The callback fixture's handler has a local type only. Extend the callback fixture test family with one handler annotated by an uninstalled package type; the binding must still appear.

Test decision for test files (bulletproof-react 28 components, epic-stack 2): the TypeScript scanner leaves test directories and .test/.spec files out by default, and React is its complement on the same TSX files, yet React inventories them and core creates components owned only through React. Existing React tests have no test file. Add one case with a Child.test.tsx beside the fixture: it must not appear in React files, and its invalid syntax must not fail the scan.

Test decision for handlers in TypeScript modules (umami, 9 sites): the guide requires the attribute to name a source function, but the scanner accepts only TSX declarations, so a handler imported from a .ts module gets a diagnostic instead of a binding. No existing case imports a handler from a module. Add one case where the callback fixture's handler lives in handlers.ts; the binding and the derived row must target that module.

Test decisions for the second finding batch: (1) bluesky emitted a false binding from a .web.tsx parent to the native Menu variant that moduleSuffixes resolved; one case with a shared Menu.tsx, a Menu.web.tsx and a web parent must bind nothing from the web parent while a shared parent still binds. (2) tldraw and excalidraw dropped fetch calls in object-literal and class methods; extend the react-http fixture with one file holding both, and add the rows. (3) tldraw lost a Next.js route in a .well-known directory the tsconfig glob skips; add one such route file to the react-http fixture. (4) excalidraw-app was never scanned because it has no tsconfig beside its package.json, and a parent package compiling a nested package reported that package's facts twice; one case with an app package using the root config and a nested library package must scan the app, keep the app-to-library binding once and report the library's own request once. (5) useCallback handlers (bluesky 118 direct sites, tldraw 91), inline arrows (bluesky 226, excalidraw 128), forwardRef and memo components, props.onX() calls (excalidraw 37) and defaulted callback props were not bound; one parameterized case over the callback fixture covers each shape.

Approved by Alex after the report: fix source roots, close the docs gap, apply the package-naming renames, keep the five coverage extensions. Test decision for source roots (end-of-task review, verified): a file of another React package that a binding touches was listed under the scanning package's root too, so core's container placement sees conflicting parents; the ancestor-config test already builds that layout but never checks roots. Extend it: lib/editor.tsx must carry only lib's package root.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Before agent scans, two whole-scan failures reproduced on minimal samples with the baseline package: (a) a solution-style tsconfig.json (files: [] plus references to tsconfig.app.json, the default Vite react-ts layout) fails the React observation with REACT_SOURCE_INVALID 'must include React TSX source files'; (b) a tsconfig extends of an uninstalled workspace package (default Turborepo layout, fresh checkout) fails with 'File ... not found'. Both contradict the documented fresh-checkout contract.

Fixes landed in the shared tree (uncommitted): project.ts loads each package through its tsconfig.json or, for a solution config, the configs it references; absent extended bases (TS5083/TS6053) become react-missing-config-base warnings; sources are the files the TypeScript scanner reads less project exclusions, so tests stay out and only their syntax errors no longer fail the scan; Next.js export lists, wrapped exports and wrapper default exports name the handler or the file's module code; private _folders are not routed; module-level requests name the module code; a prop the component calls binds a resolvable function regardless of declared types, and diagnostics cover only props the component calls or spreads onto such components. Fixed package rerun: t3-turbo original configs scan with 4 warnings and 5 endpoints (was a whole-scan failure, 1 endpoint); epic-stack original config scans (was failure) with 69 files after 2 tests left out; taxonomy adds the NextAuth Pages route; bulletproof-react 213 files (28 test files left out) and 6 diagnostics (was 51).

Second batch fixed from agent reports: methods and accessors are operations; Next.js route files outside the config (dot directories) are compiled roots; packages may use an ancestor tsconfig (excalidraw-app) and files belong to the nearest React package while components resolve across packages; the React listing is the TypeScript scanner's files while any React project exists (vendor path no longer read but unlisted); platform files bind only within their build under moduleSuffixes (bluesky false fact); useCallback, memo, forwardRef, inline arrows, defaulted props and props.onX() bind; diagnostics name the prop and reason; destructured route exports and test-only packages handled after a tldraw rerun exposed a whole-scan failure for a package holding only tests.

Pinned public repositories, baseline package -> fixed package (react-fix3): alan2207/bulletproof-react 9506629ed003a561c6627735480cce4994244bb4 (no false fact; 28 test files became components; handler with unresolved type dropped; now 213 files, 3 invocations, 3 diagnostics from 51); excalidraw/excalidraw 4850bf336fe0a8501af49d84deebc7fb56357cc2 (dev-docs extends of an uninstalled base failed the whole scan; excalidraw-app never scanned; now 5 projects, 155 invocations from 20, 104 diagnostics from 212); t3-oss/create-t3-turbo 8f945b7bb3bfb3ca8358d48b1ff0214079bc11ee (all four React packages failed on workspace extends; export-list and property route handlers missing, repro false catch-all row; now scans with 4 warnings and 5 endpoints from 1); vercel/chatbot c2f8235e1f3ea903ad8b7f61447c4f74164b5c58 (re-exported NextAuth handlers missing; now 17 endpoints from 15, 18 invocations from 0); umami-software/umami ec0ff50388c264ed8ce46f00967e92f7e71476ae (positive control: 57 invocations and 203 endpoints verified; now 145 invocations, 119 diagnostics from 214, 14 test files left out); bluesky-social/social-app b4b8b5451cb432c17b80b48aee51c9ba30c47b78 (missing extends base failed the scan; false .web.tsx binding to a native variant; vendor file read but unlisted; now 656 invocations from 113, 321 diagnostics from 1012, no cross-platform binding); shadcn-ui/taxonomy 298a8857c7128a0d121e7f699dfd729f23b3966d (HTTP control: all requests and rows correct; NextAuth Pages route and module-level requests missing; private folder repro; now 9 endpoints and 8 requests); epicweb-dev/epic-stack 8473afd804b66dba6a23f317908dc35d1535e90d (array extends of an uninstalled config failed the scan; React Router app has no Next.js false endpoint; now scans with 1 warning, 69 files); TanStack/router ddad69a4a4b18c19e3fcc510ac1e21f9dab883a7 (149 packages; benchmark packages whose config compiles no TSX failed the whole scan); tldraw/tldraw f73c0603e63e5fa1c35f6da2c8f1d970b62c54d5 (no false fact; .well-known routes, method requests missing; fix2 rerun exposed a test-only package failing the scan, fixed in fix3; now 279 invocations from 28, 5 endpoints from 2, 109 diagnostics from 236). Spot checks of 20 random new bindings in umami and tldraw found no false fact.

TanStack/router with react-fix3 (original clone): scan completes (baseline failed the whole scan), 142 packages, 1610 files, 24 invocations from 1, 7 diagnostics from 56. fix3 held every package's programs at once (2.97 GB RSS); scan.ts now visits packages one at a time, and fix4 measures 0.90 GB RSS with identical results. Clean-worktree bun run check (HEAD plus only TASK-503 files, the other task's shared-fetch rows reverted): 715 pass, 43 skip, 4 fail; the React listing expectation was then updated for the new fixtures, and the three Python scanner failures are 20 s timeouts under load 30-80 that pass alone (16 pass with a longer timeout). A final full check is still required.

Cold simplicity review and its targeted re-review applied: one compiler program per package (first referenced config compiling a component the scanner reads), one propCalls for one or all props, no handler-side platform check (no reproduced failure), plain operation names, renamed route export helpers, folded shape tests with a row helper, doc wording. Final complete check in a clean detached worktree at the pre-change HEAD plus only TASK-503 files (TASK-504's twelve shared-fetch rows reverted there): bun run check exit 0; Biome 561 files with 4 pre-existing warnings outside this task; 16 Node tests; Bun 719 pass, 43 skip, 0 fail.

All temporary clones, harness outputs, scanner packages and the clean worktree were deleted after the last verification (about 1.1 GB); no clone remains. Full-context end-of-task reviewer ran as a general-purpose agent with a written brief because the fork agent type is unavailable; its ten recommendations await Alex's decision and were not applied. Derived callback file-pair rows before -> after the coverage extensions: umami 48 -> 86, tldraw 10 -> 69, excalidraw 9 -> 77, bluesky 37 -> 220, chatbot 0 -> 7, bulletproof-react 0 -> 3.

Curation: the live scan watcher created singleton components src-evidence and src-project for the new React source files and proto-config-tmp for a prototype file that existed for seconds; proto-config-tmp (no Code left) was removed, and the two new files were moved into the cli container and combined into react-src-index, whose Code now lists them.

Alex approved the report: keep the five coverage extensions, fix source roots (a file another React package owns now keeps that package's root, asserted in the nested-package test), close the docs gap (React row in the creating-a-plugin listing table, React intro), rename package-meaning roots to directory. Other end-of-task review items (shared config and ownership owner across TypeScript-family scanners, moving the TypeScript file listing to a shared module, reusing the shared executable check, a named propCalls result, splitting evidence.ts, building the test package once) remain follow-ups after the sibling sessions land. Final check on current main da681df9 plus exactly this task's content in a clean worktree: bun run check exit 0; Biome 4 pre-existing warnings outside this task; Node 16 pass; Bun 721 pass, 43 skip, 0 fail. The commit carries only this task's hunks: TASK-504's twelve shared-fetch rows in test-bun/react-http.test.ts and other sessions' hunks in docs/scanners/creating-a-plugin.md stay with their tasks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Qualified the React scanner on ten pinned public repositories and fixed what they exposed: whole-scan failures on fresh checkouts (uninstalled extended configs, solution configs, packages whose config compiles no components or only tests), false facts (web files bound to native component variants, Next.js handlers exported through lists, wrappers, re-exports or destructuring missing so catch-all routes took their requests, private folders routed), missing evidence (packages compiled by an ancestor config, requests in methods and at module level, dot-directory routes, handlers in TypeScript modules or typed by uninstalled packages) and noise (test files as components, duplicate facts and mixed source roots across nested packages, type-dependent diagnostics). With Alex's approval the scanner also binds inline arrows, useCallback handlers, memo and forwardRef components, defaulted props and props.onX(). Verified by focused regression tests, reruns on every clone with 20 sampled new bindings correct, and bun run check on current main (721 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
