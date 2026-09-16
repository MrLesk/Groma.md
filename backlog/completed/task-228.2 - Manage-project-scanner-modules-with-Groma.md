---
id: TASK-228.2
title: Manage project scanner modules with Groma
status: Done
assignee:
  - '@codex'
created_date: '2026-08-31 18:09'
updated_date: '2026-08-31 20:12'
labels: []
dependencies:
  - TASK-228.1
references:
  - scanner-modules
  - scan-lifecycle
  - scanner
  - c-scanner
modified_files:
  - src/scanner/modules/config.ts
  - src/scanner/modules/package.ts
  - src/scanner/modules/inventory.ts
  - plugins/scanners/csharp/package.json
  - package.json
  - src/scanner/registry.ts
  - src/scanner.ts
  - src/view-host.ts
  - src/viewers/web/server.ts
  - src/viewers/web/export.ts
  - test/scan-watch.test.ts
  - src/scanner/cli.ts
  - test-bun/scanner-modules.test.ts
  - docs/scanners/creating-a-plugin.md
  - docs/scanners/index.md
  - docs/scanners/dotnet-csharp/index.md
  - >-
    groma/observed/systems/groma/containers/scanner/components/scanner-modules.md
  - groma/observed/systems/groma/containers/scanner/components/scan-lifecycle.md
  - groma/observed/systems/groma/containers/scanner/container.md
  - groma/observed/systems/groma/containers/scanner/components/c-scanner.md
  - bun.lock
  - src/cli.ts
parent_task_id: TASK-228
priority: high
type: feature
ordinal: 246000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A developer uses groma scanner commands in a project to add an npm or local TypeScript scanner module. Groma owns the installation cache and the explicit project configuration, so the self-contained Groma binary remains the only runtime users install. Running scan never performs hidden network installation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 groma scanner add accepts an exact npm package source or a local path, validates the scanner manifest, and records it in project configuration only after installation succeeds.
- [x] #2 groma scanner install restores configured npm scanners into a Groma-owned cache; local scanner paths remain direct project inputs.
- [x] #3 groma scanner list uses one derived inventory and reports each configured scanner as built-in, found, or missing.
- [x] #4 groma scanner remove removes the project configuration entry without deleting a cache that another project may use.
- [x] #5 scan fails before scanner execution with a direct install instruction when an enabled scanner is missing, and never installs from the network implicitly.
- [x] #6 Groma does not search PATH, global packages, unrelated node_modules, or unconfigured cache entries for scanners.
- [x] #7 The behavior is covered without publishing packages, adding CI, or changing the standalone binary build.
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
1. Add one scanner-module domain that stores explicit project entries as {id, source} in groma/scanners.json, reads the minimal groma.scanner {id, entry} package manifest, and derives the built-in/found/missing inventory without importing plugin code.
2. Install exact npm package@version sources into a shared ~/.groma/cache/scanners/<source-hash> directory by running the current Groma executable in Bun CLI mode with lifecycle scripts disabled; validate the installed manifest before writing project configuration. Resolve local ./ paths directly and never copy them into the cache.
3. Keep TypeScript embedded, then preflight every configured optional scanner before importing any plugin. Dynamically import only configured found entries, validate the ScannerPlugin runtime shape, and give scan/watch one loaded registry with no global or node_modules discovery.
4. Add groma scanner add, install, list, and remove as thin CLI commands over the shared inventory and configuration operations; keep cache entries when project configuration is removed.
5. Cover npm and local lifecycles, missing preflight, non-discovery, and scan/watch behavior with parallel-safe fixtures; update scanner author docs and observed Scanner architecture, then run focused/full checks and the required reviews.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented explicit scanner configuration, manifest validation, exact npm installation through the current executable in Bun CLI mode, local-path resolution, derived inventory, missing preflight, dynamic registry loading, and async scan/watch registry reuse. Focused scanner-module tests pass 3/3, including a real local npm registry, cache restoration, local loading, removal without cache deletion, missing-before-import, and non-discovery of unrelated node_modules.

Connected the scanner commands to the main CLI after TASK-230 released the shared file. Focused verification now passes 5/5 across scanner module lifecycle, CLI behavior, missing preflight, npm cache restoration, non-discovery, and watch behavior. TypeScript and diff checks pass.

Full `bun run check` passed on the verification rerun: Biome completed with only existing warnings, TypeScript passed, Node passed 94/94, and Bun passed 218/218. The first run had one unrelated concurrent live-view timeout; that exact test passed 1/1 in isolation and 3/3 in its file during the successful full rerun.

Cold simplicity review passed with no blocking findings. Applied both deletion suggestions: removed the unused resolved package root field and removed optional-plugin manifest metadata from the embedded TypeScript package. TypeScript remains grouped under plugins/scanners but cannot be configured because it is always built in.

Specification review fixes: a configured package with a missing entry file now derives `missing`, the CLI test verifies list readiness plus the direct scan recovery instruction, the scanner overview now describes separate initial-scan and watch registries accurately, and remove prints `ok` only after success. Focused tests pass 5/5 with 32 assertions. The exact concurrent Node watch command passes 3/3, and the post-fix full `bun run check` passes 94/94 Node and 218/218 Bun.

Applied the full-context complexity review recommendations: scan-time resolution options now cannot contain the install-only registry setting, and configured module readiness is a discriminated found/missing union so a found module always has an entry. TypeScript and focused tests pass after the refinement. The last complete post-spec full run passed 94/94 Node and 218/218 Bun; later shared-load reruns hit unrelated watcher timeouts, while all three failed live-view cases passed 3/3 in isolation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added explicit project scanner module management through `groma scanner add|install|list|remove`. Exact npm packages install into a shared Groma cache with scripts disabled; local packages remain direct inputs; configuration is written only after validation. Scan and watch embed TypeScript, preflight every configured optional module before import, and never perform hidden discovery or network installation. C# is now optional through its package manifest. Updated scanner documentation and observed architecture. Verified with focused scanner/watch tests (5/5), TypeScript, import-graph counts, specification/quality/complexity reviews, and a complete `bun run check` pass of 94 Node plus 218 Bun tests.
<!-- SECTION:FINAL_SUMMARY:END -->
