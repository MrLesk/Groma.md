---
id: TASK-504
title: Qualify and improve the TypeScript scanner on public repositories
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 20:09'
updated_date: '2026-09-24 06:12'
labels: []
dependencies: []
references:
  - typescript-src-index
  - scanners-http-routes
  - scanners-typescript-outline
  - src-http-endpoints
  - scanners-projects
  - csharp-src-index
modified_files:
  - plugins/scanners/typescript/src/projects.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - plugins/scanners/typescript/src/graph.ts
  - plugins/scanners/typescript/src/scan.ts
  - test-bun/nested-scanners.test.ts
  - docs/scanners/typescript/index.md
  - plugins/scanners/typescript/src/http-checker.ts
  - plugins/scanners/typescript/src/source-operations.ts
  - plugins/scanners/http-routers.ts
  - plugins/scanners/http-clients.ts
  - plugins/scanners/typescript/src/source-imports.ts
  - plugins/scanners/typescript-outline.ts
  - plugins/scanners/http-paths.ts
  - plugins/scanners/http-values.ts
  - plugins/scanners/typescript/src/http-controllers.ts
  - plugins/scanners/http-routes.ts
  - plugins/scanners/entry-points/javascript.ts
  - test-bun/typescript-http.test.ts
  - test-bun/react-http.test.ts
  - test-bun/vue-http.test.ts
  - test-bun/javascript-http.test.ts
  - test/fixtures/typescript-http/hono-routes.ts.fixture
  - test/fixtures/typescript-http/nest-options.ts.fixture
  - test/fixtures/typescript-http/hono-server.ts.fixture
  - test/fixtures/typescript-http/unsupported.ts.fixture
  - test/fixtures/typescript-nest-fastify/tsconfig.json.fixture
  - test/fixtures/typescript-nest-fastify/e2e/check.ts.fixture
  - test-bun/typescript-source-usage.test.ts
  - test-bun/source-relationships.test.ts
  - test-bun/execution-evidence.test.ts
  - docs/scanners/javascript/index.md
  - plugins/scanners/http-checker.ts
  - test/fixtures/typescript-nest-fastify/controller.ts.fixture
  - test/fixtures/typescript-nest-fastify/library/controller.ts.fixture
  - test/fixtures/typescript-nest-fastify/library/tsconfig.json.fixture
  - test/fixtures/typescript-nest-fastify/main.ts.fixture
  - plugins/scanners/typescript/src/source-symbols.ts
  - plugins/scanners/typescript/src/native-checker.ts
  - groma/systems/groma-md/containers/cli/components/typescript-src-index.md
  - groma/systems/groma-md/containers/cli/components/src-http-endpoints.md
  - groma/systems/groma-md/containers/cli/components/native-checker.md
  - groma/systems/groma-md/containers/cli/components/source-symbols.md
  - groma/systems/groma-md/components/source-symbols.md
  - groma/systems/groma-md/containers/cli/components/csharp-src-index.md
type: task
ordinal: 585000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TypeScript scanner has been qualified on Groma itself, OpenClaw and small fixtures. Real TypeScript repositories combine tsconfig inheritance from packages that a fresh checkout does not install, project references, workspace packages without node_modules, path aliases, NodeNext .js specifiers, Deno import maps, platform-specific files, very large repositories and several HTTP frameworks that the fixtures do not exercise. Alex asked on 2026-09-23 for a scanner-by-scanner pass over every official scanner not yet qualified on public repositories, starting with TypeScript in this session: scan diverse public TypeScript projects, diagnose real edge cases, and fix verified scanner failures while keeping C4 interpretation in language-neutral Groma core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ten distinct public TypeScript repositories are scanned at recorded commits, with concrete evidence and each result classified.
- [x] #2 Verified defects in the supported TypeScript scan flow are fixed with focused regression coverage where existing tests leave a gap.
- [x] #3 The complete repository check passes after the TypeScript scanner changes.
- [x] #4 Temporary repository clones are removed after TypeScript qualification and the results are reported to Alex before work starts on another scanner.
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
1. Baseline worktree at HEAD 8674cb84 in the session scratchpad with a scan harness (raw observation, end-to-end scan with only the local TypeScript scanner, resolved imports beside written specifiers, source outline). Ten read-only agents each clone one pinned public repository into scratchpad ts/NN-name and report classified, source-backed findings with minimal reproductions; they never edit the shared checkout. Repositories: microsoft/vscode (scale, nested tests, build/), bluesky-social/social-app (expo tsconfig base, platform files), immich-app/immich (NestJS, generated SvelteKit config, OpenAPI SDK, CLI bin), t3-oss/create-t3-turbo (workspace tsconfig packages and imports), modelcontextprotocol/typescript-sdk (NodeNext .js specifiers, example servers), cloudflare/templates (wrangler entries, Hono, workers types), nestjs/nest (sample apps, controllers, versioning), denoland/fresh (deno.json, import maps, extension imports), excalidraw/excalidraw (Vite HTML entries, paths aliases, workspace packages), shadcn-ui/ui (Next.js apps, CLI bin to build output, fixture projects). Probe: gothinkster/node-express-realworld-example-app.
2. Compare findings with docs/scanners/typescript and existing tests. For each verified wrong result, record the supported rule, the wrong result and the coverage gap, then fix it in the owning TypeScript scanner module or the shared TypeScript-family helper that owns the rule, with the smallest focused test. Small practical gaps inside existing scanner responsibilities are fixed; new capabilities (new framework or entry formats) go to Alex first. Core and C4 policy stay language-neutral.
3. Rerun affected repositories, focused checks and bun run check in a worktree at the task commit, subtraction pass, cold simplicity review, full-context complexity review, remove every clone and the baseline worktree, report to Alex and pause before the next scanner.

Test decision T1, absent extended config. Rule and authority: official scanners scan a fresh checkout without installing project dependencies or building (docs/scanners/creating-a-plugin.md readiness, docs/scanners/index.md Fresh checkouts). Wrong result: a tsconfig.json that extends an uninstalled package (@tsconfig/node20, expo/tsconfig.base, a workspace config package) or a generated file (.svelte-kit/tsconfig.json) makes tsgo report TS6053 or TS5083 and the whole TypeScript scan throws, so the repository gets no TypeScript evidence. Reproduced in a two-file repository; the Vue scanner already downgrades TS5083. Gap: no TypeScript scanner test has an absent base. Smallest test: one project extending a missing package base and a missing relative base keeps both files and their import edge and reports one warning naming the config; invalid options still fail (existing test).

Test decisions after the ten scans (rule and authority; wrong result; gap; smallest test):
T2 owner: TS doc "the nearest containing configuration owns a file"; a deeper config that includes files from elsewhere through an extended include takes them, so their paths aliases stop resolving (nest: 409 integration files); nested tests cover only containing configs; one nested-scanners case with a non-containing deeper config.
T3 duplicate endpoints: TS doc decision 8 and one fact per route; a controller also compiled by a second program (e2e spec outside the include) is reported twice with conflicting order, breaking Fastify specificity; the FastifyAdapter fixture has one program; add an e2e spec outside the include to it, expected table unchanged.
T4 self edge: import edges link local sources; `declare module "x"` beside an import of uninstalled "x" makes a file import itself and lose its root; no augmentation coverage; one source-usage case.
T5 symbols: TS doc lists every exported declaration of the file; export lists, `export default name`, destructured exports and `export type {}` give no symbols; the symbols test has only keyword exports; extend it.
T6 Hono cross-file route: TS doc decision 8 (an importing file runs after the imported file top level); a child router from another module mounted by route() is only blocked; fixture mounts same-file children only; add a child module and a mount at the end of hono-server.
T7 NestJS: controller prefix per TS doc HTTP table and decision 5 constants; `@Controller({ path })` and a string enum member block every route (nest 17 controllers, immich 46 routes); nest fixture has string prefixes only; add one controller file with both forms.
T8 Express 5: decision 7 keeps the literal before a pattern; `/files{/*splat}` loses files and blocks the whole app (MCP); no Express 5 group in fixture; add two patterns.
T9 fetch method: TS doc, only a non-URL input such as a Request states no method; a string-typed input stated none (immich, fresh, shadcn); existing TS, JS, React and Vue expectations encoded the wrong result and now assert GET.
T10 overloads: calls resolve to local implementations and supplied callbacks bind; calls to an overloaded function stay unresolved and its callbacks unbound (excalidraw pointFrom 742 calls); callback tests use plain functions; one overloaded variant.
T11 commands: JS doc, each literal local node/bun/tsx/ts-node command supplies an entry; tsx watch, runtime options, env assignments and cross-env give none (shadcn, nest, social-app); the chained test has plain commands; extend it, plus bun build giving none.
T12 HTML entry name: an entry name is a starting title; every bundler index.html is named index (shadcn 5 containers, excalidraw 2); no coverage; one assertion.
Speed changes are behavior-preserving: identical observations before and after on five repositories, no new test.

Correction T1: the test expects one warning per absent extended config, each naming the config that extends it (two in the test).

Correction T3 (full-context review): keying duplicate routes on the handler file's owner drops the application's placement when a library config owns a NestJS controller (reproduced: libs/api controller reached from apps/server main.ts with a FastifyAdapter; the library program's fallback reading won). Rule and authority: TS doc NestJS row, the application is named by the file calling NestFactory.create. Wrong result: the Fastify application's unordered reading is replaced by the controller-file fallback. Gap: the FastifyAdapter fixture had the controller inside the application's config. Smallest test: move the fixture controller into library/ with its own config, expected table unchanged apart from the path.

Approved by Alex after the full-context review: analyzeSourceFiles runs one program per config and mergedEvidence states each fact's cross-program rule; analyzeProject builds one native checker adapter per program (typescript/src/native-checker.ts, renamed from http-checker.ts) for operations and entries; exported symbols live in typescript/src/source-symbols.ts. The four-scanner config-base rule and Angular's owner rule wait until the Angular session lands.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Pinned public checkouts and classification (baseline 8674cb84): gothinkster/node-express-realworld-example-app 30b68e1e (probe; chained Router() construction hides every route, G); t3-oss/create-t3-turbo 8f945b7b (absent workspace tsconfig base failed the scan D; workspace package imports unresolved G; export lists missing D; next/vite/expo entries G); immich-app/immich e66f2c76 (absent SvelteKit and Docusaurus bases D; enum controller prefix 46 of 303 routes G; string fetch input without method D; dist commands G; SvelteKit $lib alias G); denoland/fresh 86d6cdeb (Deno _test files, deno.json tasks and import maps G; side-effect script import edge L; string fetch method D); cloudflare/templates a0bb6ef9 (Astro and agents bases D; Hono cross-file route only blocked D; Hono use(path, mw) blocks 5 of 12 apps, design question; module augmentation self edge D; wrangler main entries G); nestjs/nest 5100837b (Controller options form D; non-containing config owns files D; duplicate endpoints from a second program D; e2e-spec naming and flags before scripts G); modelcontextprotocol/typescript-sdk 7f7a94c2 (19 workspace bases D; Express 5 group loses prefix D; path-scoped Express middleware blocks, design question); shadcn-ui/ui 98a1fe67 (Astro base D; string fetch method D; tsx options and watch give no entry D; index.html entries all named index G; dist bin G); bluesky-social/social-app b4b8b545 (react-native base D; platform variants G; env-prefixed commands D; scheme plus computed host segment D low impact); excalidraw/excalidraw 4850bf33 (Docusaurus base D; overloaded calls unresolved D; index names G). microsoft/vscode pending.
Speed: skipping declaration-file declarations, batching per-call HTTP and router reads, reading axios member names before resolving clients, and caching aliases and declarations per symbol gave identical observations on five repositories and 2 to 6 times faster scans (MCP 7.8 to 2.2 s, Fresh 9.6 to 1.6 s).
All eleven new or changed tests fail against the baseline and pass on the fix, each run alone. The owner check reads each endpoint operation file from the observation instead of parsing the opaque operation ID.

Cold simplicity review (fresh agent, task plus diff, no history): each fix is small and sits in the module that owns its rule; every new or changed test fails on the wrong result it targets. Applied its findings: decoratorPath reads the controller path through heldParts; one shared inBatches helper in plugins/scanners/http-checker.ts replaces four hand-written batch loops; the Checker contract states that an adapter may answer nothing for a declaration-file declaration; docs and comments say a primitive such as a string; the runtime options list keeps only -r, --require, --import and --tsconfig, which the qualified repositories use; the owner rule reads containment first, then depth (outranks); the HTML entry name is computed once per page; the entry test title names page scripts; the React helper comment matches its row. The operation-id parsing it flagged was already replaced by the observation operation file. With the project test settings (two workers, 20 s timeout) the seven focused suites pass 49 of 49.

Full repository check on a commit of HEAD bc1efc3b plus only TASK-504 changes (3f0e0a37, built in a temporary index; other sessions hunks in entry-points/javascript.ts and react-http.test.ts excluded), in a separate worktree with bun install --frozen-lockfile: bun run check exit 0, 709 pass, 43 skip, 0 fail. Its four Biome warnings predate this task (the entry reader warning is the existing withJavaScriptEntries flatMap).

microsoft/vscode b448f61e (tenth repository): the baseline observation did not finish in 88 minutes (bun 14.3 GB, compiler 10.2 GB); the fixed scanner finishes in 287 s with about 23 GB combined peak on one 7,142-file program (D scale, reported). Sources under a build path segment are observed while that directory's tsconfig.json, package.json scripts and HTML pages are skipped by the shared project boundary (D, belongs to the exclusion policy decision; in vscode itself only two entries change). No product entry: main, extension main and workbench pages point at build output (G, dist-to-src proposal). Express created from a lazy import('express') is not read (G). The fetch method fix is confirmed there.

Duplicate-route rule replaced after the full-context review: a reading that names the controller's own file as its application yields to another program's placement (placedEndpoints in source-analysis.ts); analyzeSourceFiles now runs programs and one mergedEvidence function states each fact's cross-program rule, so StatedEndpoint and the owner flag are gone. The changed FastifyAdapter test fails on the owner rule and passes now; nestjs/nest endpoints are identical under both rules (279, 274 ordered).

Full-context review, pending Alex: (1) the absent-base rule now exists in four scanners (TypeScript, React, Vue, Angular) and Angular's configOwners still uses depth only; collapse into one shared helper after TASK-501 lands; (2) move the symbol functions into source-symbols.ts; (3) done above; (4) build nativeChecker once per program; (5) rename typescript/src/http-checker.ts to native-checker.ts. It recommends keeping the owner fix cost, path-scoped middleware taking no place when every handler is a visible function, and the exclusion policy plus workspace/dist mapping plus config-declared entries as the next proposals.

Cleanup: every clone under the session scratchpad and the baseline worktree are removed.

Full repository check on 0fe4cb06 (HEAD 2833e50a plus only TASK-504 changes, the Angular session's hunks in entry-points/javascript.ts excluded), in a separate worktree with bun install --frozen-lockfile: bun run check exit 0, 723 pass, 45 skip, 0 fail. Its Biome warnings are in files or lines this task did not change.

Applied the three approved reshapes: one shared checker adapter per program passed to sourceOperations and sourceBuildEntries, symbols moved to source-symbols.ts, the adapter file renamed to native-checker.ts. Architecture: the scan watcher dropped the old path and created singletons; groma edit src-http-endpoints --combine native-checker, groma edit source-symbols --parent cli, groma edit typescript-src-index --combine source-symbols keep each file with its former owner. The export fix also records symbol scanner for the TypeScript and C# scanner entries (typescript-src-index, csharp-src-index); only that line of csharp-src-index.md is this task's, the C# session's description rewrite is excluded.

Separation rule relayed from Alex (core knows no scanner, scanners know no C4): this task changes no core file under src/, and no added scanner line names containers, components, systems or relationships.

Full repository check on e355d873 (HEAD 2833e50a plus only TASK-504 changes, including the approved reshapes and architecture updates), separate worktree with bun install --frozen-lockfile: bun run check exit 0, 723 pass, 45 skip, 0 fail; its Biome warnings are in code this task did not change. Results reported to Alex, who approved the reshapes; no other scanner work started.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Qualified the TypeScript scanner on ten public repositories (create-t3-turbo, immich, fresh, cloudflare/templates, nest, the MCP TypeScript SDK, shadcn/ui, Bluesky social-app, excalidraw, vscode) and fixed the verified defects: an extended config the checkout lacks is a warning instead of a failed scan (7 of 9 repositories failed before); the containing config owns a file; a NestJS route keeps the reading of the program that sees its application; export lists, export default of a name and destructured exports give symbols; no self import edge; calls to overloaded functions reach the implementation; @Controller({ path }), string enum constants, Express 5 optional wildcards and groups, and a Hono route() of a child from another file are read; a fetch with a string URL states GET or its literal method; package scripts with environment assignments, cross-env, run or watch and runtime options give entries; an index.html entry takes its folder's name. Behavior-preserving speed work makes five repositories 3 to 9 times faster and lets vscode finish in 287 s; the correct owner rule makes nest slower (13 s to 66 s) while resolving 22,944 calls instead of 1,054. After the full-context review, one merge function states each cross-program fact, one native checker adapter serves each program, and symbols live in source-symbols.ts. Verified: every new or changed test fails on the old code and passes now, nest endpoints are identical under the final placement rule, and bun run check on a commit of HEAD plus only this task passes (723 pass, 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
