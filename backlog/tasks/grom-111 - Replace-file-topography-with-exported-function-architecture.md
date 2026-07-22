---
id: GROM-111
title: Replace file topography with exported-function architecture
status: Done
assignee:
  - '@codex'
created_date: '2026-07-22 01:03'
updated_date: '2026-07-22 01:42'
labels:
  - pivot
  - scanner
  - web
dependencies: []
references:
  - MANIFESTO.md
  - GROM-91
  - GROM-92
  - GROM-95
modified_files:
  - src/application/contracts.ts
  - src/application/observed-area-recognition.ts
  - src/application/operations.ts
  - src/application/reconciliation.ts
  - src/application/tests/observed-area-recognition.test.ts
  - src/cli/tests/scan.test.ts
  - src/core/observation.ts
  - src/host/default-bootstrap.ts
  - src/host/tests/reconciliation-local.test.ts
  - src/host/tests/typescript-bun-scanner.test.ts
  - src/host/typescript-bun-scanner.ts
  - src/persistence/local-transaction-journal.ts
  - src/web/client/api.ts
  - src/web/client/canvas.tsx
  - src/web/client/graph.ts
  - src/web/client/model.ts
  - src/web/client/spec.tsx
  - src/web/tests/model.test.ts
  - src/web/tests/snapshot-api.test.ts
priority: high
type: bug
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correct a foundational semantic mistake introduced by the full-code-topography pivot. Source files and incidental directories are extraction and provenance boundaries, not architectural entities, and must not become canonical components or visual nodes. For TypeScript/Bun evidence, defensibly exported callables are the meaningful element-level candidates. Their own source size, cognitive complexity, and imported dependencies belong to those callable candidates. Private helpers remain invisible but may contribute dependencies through a bounded, unambiguous local call graph; dynamic or ambiguous flows produce partial or no claim. This correction must preserve the shortest useful path from init through scan to the visual blueprint and must not silently erase curated meaning when retiring legacy scanner-created file artifacts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A fresh TypeScript/Bun scan never creates source-file or incidental source-directory component candidates, and the visual blueprint never uses a filename as a component name, node, complexity target, or topography insight; source paths remain provenance only.
- [x] #2 Each defensibly exported callable is observed as a stable element candidate under the nearest defensible declared package or source boundary, with identity based on its public export surface rather than its implementation filename; private local functions are not visible candidates.
- [x] #3 Source-line and cognitive-complexity measurements are computed and surfaced per exported callable, never as a sum or scalar for an entire file, using documented deterministic counting semantics and exact scanner provenance.
- [x] #4 Imported bindings are related to the exported callables that actually use them, including through a bounded unambiguous chain of local private helper calls; unused, side-effect-only, dynamic, mutated, or ambiguously resolved flows are not attributed by guess and make the affected evidence partial where appropriate.
- [x] #5 Workspace imports resolve to the exact observed exported callable when defensible, external imports resolve no more specifically than the observed external boundary, and a binding used by multiple exported callables produces independently supported relationships.
- [x] #6 Existing workspaces can rescan without retaining visible legacy file/directory artifacts, while curated or multiply supported meaning is never silently deleted; the migration or reconciliation behavior is deterministic and fail-closed.
- [x] #7 The complete groma init -> groma scan -> groma path is verified on a representative fixture and the Groma self-scan: overview remains bounded, focus reveals exported callables and their dependency topology, no filename nodes appear, and repeated unchanged scans are stable.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Refactor official.typescript parsing and emission so declared boundaries contain exported callable candidates, with deterministic per-callable source-line and cognitive-complexity signals; remove incidental directory/file candidates and file actions. 2. Reuse the existing fail-closed resolver to attribute imported bindings to the exported callables that use them, following only direct unambiguous private-helper calls and resolving exact workspace callables where defensible. 3. Carry source-line evidence through bounded application/web reads and replace resource-path grouping with bounded name indexes so filenames remain provenance only. 4. Bump the scanner semantic version and retire only legacy components that remain byte-for-byte evidence-owned, have no aliases or curated/multiple support, and whose complete incident evidence is retired in the same transaction. 5. Add focused scanner, reconciliation, API, and graph regressions; run full checks, a repeated Groma self-scan, and the compiled init -> scan -> visual path.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented official.typescript v2 around exported callable candidates. Files remain exact provenance only; private helpers are traversed only through a bounded, unambiguous local call graph. Added per-callable physical source lines and cognitive complexity, exact workspace-callable and conservative external-boundary dependency resolution, path-free bounded visual indexes, and fail-closed v1 artifact retirement that preserves curated or otherwise supported graph state.

Verification: bun run check (format, TypeScript, architecture boundaries, 527 tests, native build, smoke, Iteration 1A) passed. Two independent gpt-5.6-terra xhigh reviews and one Claude conceptual review completed; justified findings were fixed. Isolated Groma self-scan produced 152 components, 133 exported functions, 242 function-owned import edges, one LOC and complexity measurement for every function, zero filename-named components, and byte-identical repeated state. A fresh compiled-binary init -> scan -> groma run also passed and rescanned byte-identically.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced TypeScript file topography with exported-function architecture. Scanner v2 now emits exported callable elements with per-function source lines, cognitive complexity, and defensibly attributed imports; filenames remain provenance only. The renderer uses path-free bounded indexes, and safe migration retires only untouched v1 file artifacts. Full checks, independent reviews, self-scan migration, and fresh compiled-binary first-run verification all passed.
<!-- SECTION:FINAL_SUMMARY:END -->
