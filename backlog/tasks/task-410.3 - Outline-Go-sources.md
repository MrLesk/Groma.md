---
id: TASK-410.3
title: Outline Go sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:37'
updated_date: '2026-09-17 11:12'
labels: []
dependencies: []
references:
  - worker-main
  - outline
  - go-src-index
  - framework-package
modified_files:
  - plugins/scanners/go/worker/contract.go
  - plugins/scanners/go/worker/outline.go
  - plugins/scanners/go/worker/main.go
  - plugins/scanners/go/src/adapter.ts
  - plugins/scanners/go/src/index.ts
  - test/fixtures/go-outline/go.mod
  - test/fixtures/go-outline/store.go
  - test/fixtures/go-outline/remote.go
  - test/fixtures/go-outline/web/app.ts
  - test/fixtures/go-outline/web/tsconfig.json
  - test/fixtures/go-outline/groma/index.md
  - test/fixtures/go-outline/groma/project.md
  - test/fixtures/go-outline/groma/systems/library/system.md
  - >-
    test/fixtures/go-outline/groma/systems/library/containers/service/container.md
  - >-
    test/fixtures/go-outline/groma/systems/library/containers/service/components/catalog.md
  - test-bun/go-scanner.test.ts
  - docs/scanners/go/index.md
  - plugins/scanners/go/build.ts
parent_task_id: TASK-410
type: feature
ordinal: 459000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Go components show only files. The Go worker already uses Go language tooling that exposes syntax trees.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Go-owned files show their types with receiver methods and top-level functions, each with name, line and exported or unexported visibility.
- [x] #2 Independent fixtures cover the outline, including files the scanner owns alongside another scanner.
- [x] #3 The Go scanner documentation describes the outline.
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
1. Go worker: 'worker outline <root>' reads the SourceReference[] JSON on stdin, parses each referenced file with go/parser only (no type checking, no go command), and prints CodeFile[] (logic in outline.go, JSON types in contract.go, dispatch in main.go). Files without declarations are omitted.
2. Rules per docs/scanners/creating-a-plugin.md#source-outline: top-level defined types (type X struct{}, type X int; never type X = Y) are 'type', with interface method signatures as members; top-level functions and function literals assigned directly to a package-level var are 'function'. Receiver methods (pointer and generic receivers) are members of the file's entry for their type: the type's declaration when this file declares it, otherwise an entry at the first method with visibility from the type name. Declarations in source order, members in source order. Visibility: exported names public, others internal. entry is true when the reference symbols contain the name.
3. Adapter (plugins/scanners/go/src): readCodeStructure runs the worker (settings.worker or the packaged worker) with the references on stdin; index.ts exposes it through the project scanner.
4. Fixture test/fixtures/go-outline: a Go module covering the rules, plus a TypeScript file and a groma/ architecture whose component Code holds Go files and the TypeScript file.
5. Tests (GROMA_TEST_GO) in test-bun/go-scanner.test.ts: outline rules on the Go files; core readCodeStructure on a temp copy with the Go scanner (temp-built worker) and the TypeScript scanner returns every file's outline in Code order.
6. docs/scanners/go/index.md: Source outline section.
7. Verify with go vet, the Go tests and the isolated bun run check with GROMA_TEST_GO.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented per plan. The Go worker gains 'outline <root>': it reads SourceReference[] JSON on stdin, parses each file with go/parser (SkipObjectResolution) and prints CodeFile[]. outline.go lists non-alias type specs (interface method names as members), top-level functions and function literals bound directly to a package-level var; a second pass attaches receiver methods (T, *T, T[P], *T[P, Q]) to the file's type entry or creates one at the first method; entries are sorted by source position. Visibility from ast.IsExported (public/internal); entry from the reference symbols. The adapter's readGoCodeStructure passes the references on stdin (run() gained an optional input) and uses settings.worker or the packaged worker; index.ts exposes it through projectScanner.
Judgment call to confirm: blank '_' names (for example func _() in generated stringer files) are not listed.
Verification: GROMA_TEST_GO bun test test-bun/go-scanner.test.ts 6 pass; the outline test checks kinds, names, visibility, member order (a method before its type), alias/wrapped/blank exclusions, entry lines and entry flags; the mixed test runs core readCodeStructure with the Go scanner (temp-built worker) and the TypeScript scanner and gets store.go, web/app.ts, remote.go in Code order. tui-test on a temp copy of test/fixtures/go-outline (groma view, open Service, Details, Tab to How) shows store.go with Store (Close, Read), Reader (Read, Close), Count, List (first), Normalize, NewStore, remote (fetch), decorate, then web/app.ts render(), then remote.go remote. go vet passes. Isolated worktree GROMA_TEST_GO bun run check passed (Biome 1 pre-existing warning in untouched files; node 16 pass; bun 383 pass, 16 skip, 0 fail).
Note: the gitignored packaged worker at plugins/scanners/go/dist is a local build; this repository's own map needs bun plugins/scanners/go/build.ts before it can outline Go files. The scan watcher created an untracked singleton component 'outline' for the new worker file; it is referenced but not curated here.

Cold review fixes: (1) a blank receiver method such as func (T) _() was listed as member '_' and, for a type declared in another file, created an entry; method() now returns early for blank names like add(). The fixture adds func (s *Store) _() and func (Archive) _() with Archive in remote.go; the pre-fix worker printed Store members Close,Read,_ and an Archive entry, and the updated test rejects both. (2) The outline test now summarizes each member as [name, visibility] (first is internal) and checks the Close member line. Accepted cleanups: the source-order sort key moved from contract.go into outline.go (placed), the fixture uses Pair[K comparable, V any] with a *Pair[K, V] receiver, the worker error prefix is GO_WORKER_FAILED, and run() takes { env, input } (build.ts updated). The coordinator will rebuild the gitignored local Go worker and curate the watcher-made components.
Re-verification: GROMA_TEST_GO bun test test-bun/go-scanner.test.ts 6 pass (33 expects); go vet passes; isolated worktree GROMA_TEST_GO bun run check passed (Biome 1 pre-existing warning in untouched files; node 16 pass; bun 384 pass, 17 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Go scanner now implements readCodeStructure. The worker's outline mode parses each referenced Go file with go/parser only and lists defined types (interface method signatures as members), top-level functions and function literals bound to a package-level variable; receiver methods join their type's entry, or an entry at the first method when another file declares the type; exported names are public and others internal; aliases and blank names are not listed. docs/scanners/go/index.md describes the outline. Verified with a Go outline fixture test (kinds, names, member visibility, lines, exclusions), a core readCodeStructure test on a component whose Code mixes Go and TypeScript files, a terminal-map check of the How tab, and an isolated GROMA_TEST_GO bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
