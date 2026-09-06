---
id: TASK-313
title: Read compiled web assets through Bun file embedding
status: Done
assignee:
  - '@alex'
created_date: '2026-09-06 19:37'
updated_date: '2026-09-06 20:10'
labels: []
dependencies: []
references:
  - web-shell
  - build
  - page
  - web-server
  - smoke-compiled-build
  - typescript-scanner
modified_files:
  - src/viewers/web/chrome/credits.ts
  - scripts/build.ts
  - src/viewers/web/page.ts
  - src/viewers/web/startup/page.ts
  - scripts/smoke-compiled-build.ts
  - CONTRIBUTING.md
  - src/viewers/web/runtime.ts
  - src/viewers/web/compiled-marker.txt
  - src/viewers/web/compiled-asset.ts
  - plugins/scanners/typescript/src/source-analysis.ts
  - groma/systems/groma/containers/web-viewer/components/web-server.md
type: bug
ordinal: 351000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A compiled `groma web` binary fails to open an already-initialized project. Loading the map page reads Groma's package.json from `/$bunfs/package.json`, which is not present, so the setup screen shows "Could not open architecture". Credits and other compiled assets must use Bun's documented embedding (JSON module import for the manifest; readable embedded files for dependency credit metadata) so the map can open outside the source checkout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A compiled Groma binary opens the web map for an initialized project instead of failing on a missing `/$bunfs/package.json`.
- [x] #2 The compiled web map still lists runtime and development library credits from the packed dependency manifests.
- [x] #3 Standalone binary smoke covers becoming ready on an initialized web map, not only --version and --help.
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
1. Import Groma package.json as JSON in credits. Resolve packed dependency files from a Bun type:file marker whose directory is `/$bunfs/root`.
2. Embed lockup as a text import and the backlog mark as a file import. Pre-bundle the browser renderer at compile time and read it from that same bunfs root so compiled web does not call Bun.build.
3. TypeScript's async API reads `/$bunfs/package.json` when spawning tsgo. Skip the worker when there are no files; pass the project's native `tsc` when present; otherwise read source text in a compiled binary.
4. Smoke compiled `groma web` on the empty-project fixture plus one TypeScript file until `/ready` is 204 and `/world.json` is 200.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Compiled `groma web` failed first because credits joined `import.meta.dir` with package.json (`/$bunfs/package.json`). After JSON-importing the manifest, the same path still appeared: TypeScript 7's async API calls getExePath, which reads `../package.json` from bunfs (`/$bunfs/root` + `..`). Bunfs native executables cannot be posix_spawned, so the compiled scanner uses the project's `@typescript/typescript-<os>-<cpu>` tsc when that file exists, otherwise source-text symbols without spawning tsgo. Bytecode `import.meta.dir` is the source path, not bunfs; a `type: file` marker is the reliable packed-root.

Validation: `bun run check` passed (existing complexity warnings only). `bun scripts/smoke-compiled-build.ts dist/groma 0.1.0` passed. Compiled map HTML for the empty-project fixture was `200` with title `groma.md`, `id="credits"`, and `commander` present.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Compiled `groma web` opens an initialized project's map instead of failing on `/$bunfs/package.json`. Credits use a JSON manifest import and packed dependency files; the browser renderer is pre-bundled; TypeScript scanning no longer spawns tsgo from bunfs. Verified with `bun run check`, compiled-binary smoke (`/ready` 204 and `/world.json` 200), and a compiled map page that includes credits.
<!-- SECTION:FINAL_SUMMARY:END -->
