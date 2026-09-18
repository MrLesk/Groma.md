---
id: TASK-410
title: Show source outlines for every official scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:37'
updated_date: '2026-09-18 17:42'
labels: []
dependencies: []
references:
  - scanner-src-index
  - src-structure
  - screen
  - tui-navigation
  - organisms-details
  - source-read
  - source-control
  - src-view-host
modified_files:
  - packages/scanner/src/index.ts
  - docs/scanners/creating-a-plugin.md
  - plugins/scanners/typescript/src/structure.ts
  - src/viewers/tui/panes/details.ts
  - src/viewers/tui/navigation-details.ts
  - src/viewers/web/organisms/code-lists.ts
  - src/viewers/source/structure.ts
  - test-bun/tui-source.test.ts
  - test-bun/navigation.test.ts
  - test/fixtures/mixed-scanner-outline/groma/index.md
  - test/fixtures/mixed-scanner-outline/groma/project.md
  - test/fixtures/mixed-scanner-outline/groma/scanners.json
  - test/fixtures/mixed-scanner-outline/groma/systems/shop/system.md
  - >-
    test/fixtures/mixed-scanner-outline/groma/systems/shop/containers/api/container.md
  - >-
    test/fixtures/mixed-scanner-outline/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/mixed-scanner-outline/plugins/alpha/package.json
  - test/fixtures/mixed-scanner-outline/plugins/alpha/index.js
  - test/fixtures/mixed-scanner-outline/plugins/beta/package.json
  - test/fixtures/mixed-scanner-outline/plugins/beta/index.js
  - test-bun/code-outline.test.ts
  - src/viewers/web/source/control.ts
  - test/fixtures/typescript-outline/outline.ts
  - test/fixtures/typescript-outline/tsconfig.json
  - docs/viewers/web/index.md
  - src/viewers/tui/navigation.ts
  - src/viewers/tui/terminal-viewer.ts
type: feature
ordinal: 456000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web and terminal maps list the classes and methods behind a component only when the scanner that owns its Code implements the optional `readCodeStructure` outline (`packages/scanner/src/index.ts`). Only the TypeScript scanner implements it. Components owned by the Angular, React, Vue, Java, C#, Go, Rust, Python and PHP scanners show bare files. In the callforpapers repository this hides every Java method and every Angular-owned TypeScript method. Each official scanner already parses source into a syntax tree, so an outline needs no project dependencies or type resolution. The current outline contract uses TypeScript visibility words (export/internal, public/protected/private); languages with other visibility rules need an agreed mapping.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every official scanner returns an outline for the files it owns: types with their methods and top-level functions, each with name, line and visibility.
- [x] #2 Outlines come from parsing source only and need no project dependencies, builds or project tool execution.
- [x] #3 A component whose Code mixes files from several scanners shows the outline of every file in the web and terminal maps.
- [x] #4 The scanner plugin contract documents the outline as part of every official scanner and defines how language visibility maps to it.
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
Contract slice (AC #3, #4); the nine subtasks deliver each scanner's outline.
1. Replace the TypeScript-shaped outline types in packages/scanner/src/index.ts with one language-neutral shape: CodeSymbol { name, line, visibility, entry }, CodeFunction (kind 'function'), CodeType (kind 'type', members: CodeSymbol[]), and CodeVisibility 'public' | 'protected' | 'internal' | 'private'.
2. Document the outline in docs/scanners/creating-a-plugin.md as required for official scanners: what counts as top-level (namespace, package and module blocks are transparent), function and type declarations (aliases never), members (every method, signature, overload and constructor), methods declared apart from their type, and a per-language visibility table for TypeScript/Angular/React/Vue, Java, C#, Go, Rust, Python and PHP. Point docs/viewers/web/index.md at that contract.
3. Make the TypeScript scanner (plugins/scanners/typescript/src/structure.ts) the reference: classes, interfaces and enums as type; constructors, methods and interface method signatures as members; declarations inside namespace and module blocks; non-exported top-level declarations private unless the file's own export list or export default names them.
4. Update consumers (TUI details pane and declaration stops, web code list) to the new fields.
5. AC #3: return readCodeStructure results in the component's Code order (the terminal cursor follows outline order), and let the web details pane request an outline for any component with Code, not only one with a typescript-owned file. Cover both with a minimal two-scanner fixture, and cover the TypeScript reference rules with a small fixture.
6. Run bun run check (isolated when other work in progress breaks the shared tree); verify the web and terminal maps on the fixture; self-review specification and quality.

7. Parent closeout: state the four rules the per-language reviews exposed (the entry symbol spelling, one scanner per owned file, PHP's function_exists guard, named function types) in the contract and the scanner types, then record outline evidence for every official scanner, building the opt-in Go, Rust and C# workers to run their outline tests.

Review-fix round (external reviews of cf8e7975):
8. Fix: terminal How cursor stops keyed by file:line collapse when declarations share a line (for example `interface Reader { read(): void }`), so Down never leaves the first one. Key each stop by its file and its position among the file's outline rows; Enter looks up the stop's line. Regression test in test-bun/tui-source.test.ts.
9. Fix: the ViewerState.codeStructure and ViewerOptions.readStructure comments still say TypeScript files; describe the scanner-neutral outline.
10. Fix: docs/scanners/creating-a-plugin.md states rules C# and Swift do not follow: C# top-level statements (and the local functions and lambdas they declare) are not listed, and a Swift extension of a type declared elsewhere takes the extension's access. State both on the shared page.
11. Not in this lane: TypeScript outline findings (quoted method names, two TypeScript outline engines) belong to TASK-410.7; per-language outline findings (Java comment name lookup, Rust same-name types and cfg filter, PHP namespaced function_exists guard, C# argv request) belong to the scanner lanes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Contract: CodeFile { file, declarations }; declaration kind 'function' (top-level function or function value bound to a top-level name) or 'type' (top-level class, interface, struct, record, enum, trait or other named type, with members = methods and constructors this file declares on it, in source order). Every declaration and member has name, line (1-based line of the name), visibility and entry (the reference's symbols contain the name). Visibility is 'public' | 'protected' | 'internal' | 'private' with a per-language table in docs/scanners/creating-a-plugin.md. Four values are the smallest scale that keeps Java package access, C# internal, Go unexported and Rust pub(crate) distinct from both public and private. TypeScript now reports non-exported top-level declarations as private, classes as type, and lists constructors.
AC #3 defects reproduced with test/fixtures/mixed-scanner-outline (two local scanners, Code order beta then alpha): (1) the shared outline came back in scanner order, so the terminal cursor walked declarations out of visible order; (2) the web details pane never requested an outline for a component without a typescript-owned file. Both fixed; test-bun/code-outline.test.ts fails without each fix and passes with it.
Verification: bun test test-bun/code-outline.test.ts (2 pass). Browser on a fixture copy (groma web, ?component=orders&tab=how): src/orders.beta shows beta() public, then src/orders.alpha shows alpha() public. tui-test on the same copy: How lists both files in Code order; Down Down Enter opens src/orders.alpha:1, Escape Up Enter opens src/orders.beta:1. Live TypeScript outline of src/scanner/registry.ts lists ScannerFailure as type with its constructor, and non-exported functions as private.
bun run check in the shared tree failed only on TASK-415's in-progress test types; in an isolated worktree with only this change it passed (lint 1 existing warning in test-bun/iso-map.test.ts, tsc clean, node 16 pass, bun 362 pass 17 skip 0 fail).
Open: docs/viewers/web/index.md (How it's built paragraph) still says 'named TypeScript structure' and 'exported and module-private top-level callables; named classes group their public, protected, and private methods'. It holds another task's uncommitted edit, so it was not changed here.

Cold review corrections (coordinator decisions), applied: namespace, package and module blocks are transparent for top-level; type covers classes, interfaces, structs, records, enums, traits, protocols and Go defined types, never aliases; members include static, bodiless, overload and interface method signatures but not property signatures; only function literals assigned directly to a top-level name are functions; methods declared apart from a type declared in another file get public visibility, except Go (from the name); TypeScript export lists and export default name make a declaration public, re-exports do not. The TypeScript reference now outlines interfaces, enums, namespace contents and export-list visibility (test/fixtures/typescript-outline, third test in test-bun/code-outline.test.ts). Also: renamed the shared base to CodeSymbol, typed code-list visibility as CodeVisibility, deleted the unreachable outline-only file loop in code-lists.ts, commented that terminal stops rely on Code order, and dropped the mixed fixture's placeholder source files and temp copy (a null revision only reads).
From TASK-422: core no longer distinguishes an omitted sourceUnits from an empty array, so the omit-versus-empty guidance was removed from docs/scanners/creating-a-plugin.md and from the ScanObservation.sourceUnits comment in packages/scanner/src/index.ts.
docs/viewers/web/index.md How it's built paragraph now describes the scanner-neutral outline and links the contract (edited after TASK-419 committed).
Verification after corrections: bun test test-bun/code-outline.test.ts 3 pass. Isolated worktree bun run check: exit 0 (existing lint findings only in untouched files), tsc clean, node 16 pass, bun 371 pass 17 skip 0 fail.

Parent closeout.

Contract clarifications from the per-language reviews, added to docs/scanners/creating-a-plugin.md and the types in packages/scanner/src/index.ts:
1. entry is true when the reference's symbols name the symbol in the spelling that scanner's Code links use: a member qualified by its type, or its bare name. Members are Type.member in Java, C# and Python, and Namespace\Type::method in PHP beside a top-level Namespace\name; every other scanner matches bare names. A link naming a type never marks its members.
2. When several configured scanners own a file, Groma requests its outline from the lowest scanner id only, and that reference holds the symbols of every Code link for the file (outlineRequests in src/viewers/source/structure.ts).
3. PHP also counts a function declared directly inside if (!function_exists('name')) as top-level.
4. A named type whose form is a function, a C# delegate or a Go type X func(...), is a type with no members.

AC #1. All ten official scanners (typescript, java, angular, vue, react, csharp, go, rust, python, php) implement readCodeStructure. Verified in a detached worktree at fb4ea929 holding only this change. The unconditional outline tests pass through core readCodeStructure or the plugin adapter and assert kind, name, line and visibility: java-outline, python-scanner, php-scanner, angular-scanner, react-scanner, vue-scanner and code-outline (the ten outline test files ran 42 pass, 0 fail; the 13 skips are the opt-in native cases). Those three were then built and run: GROMA_TEST_GO go-scanner.test.ts 6 pass, including "Go outlines defined types with their receiver methods and top-level functions"; plugins/scanners/rust/build.ts then GROMA_TEST_RUST rust-scanner.test.ts 6 pass and 30 assertions, including the Rust outline over all 13 declarations; scripts/package-csharp-scanner.ts then GROMA_TEST_CSHARP_PACKAGE csharp-outline.test.ts 1 pass. Direct outline runs recorded the fields those two tests do not assert: the C# fixture returns OrderService with eleven members at their lines under public, protected, internal and private, the delegate OrderPlaced as a type with no members, and both Place overloads marked as entries by the single link OrderService.Place; a Go probe returns type Handler func(id int) error as a type with no members beside a struct with its receiver method and a top-level function; a TypeScript probe returns a class with its constructor and methods plus exported and file-private top-level functions with lines and visibility. Java and C# emit no kind 'function' because neither language has top-level functions. No JavaScript scanner exists yet; TASK-418 owns it and its criteria require the outline.

AC #2. Each outline path parses source with a scanner-owned parser and needs no project dependency, build or project tool execution: java runs the bundled JDK on worker.jar over a file list on stdin and calls task.parse() with -proc:none, so no attribution or bytecode is needed; csharp runs the packaged self-contained worker, which parses with CSharpSyntaxTree.ParseText and returns before reading any project input; go and rust run their prebuilt workers over a JSON reference list (parser.ParseFile with SkipObjectResolution, ast::SourceFile::parse per file) and both skip the go.mod and Cargo readiness checks their scan paths need; python copies only the referenced files into its bundled Pyodide filesystem and calls ast.parse, importing no project module; php parses with the bundled php-parser and needs neither Composer nor a php binary; angular, react and vue call ts.createSourceFile on the TypeScript copied into their own bundle, never createProgram, and vue adds the bundled @vue/language-core SFC parse. The typescript scanner uses its own pinned TypeScript async project API, so it was probed directly: it outlines a file whose declared dependency is not installed with no node_modules present, and also a file the project tsconfig excludes.

Verification: isolated worktree bun run check exit 0 (biome 1 warning and 2 infos, all in untouched files; tsc clean; node 16 pass; bun 436 pass, 25 skip, 0 fail).

Non-blocking follow-ups on test coverage, not required by an acceptance criterion: csharp-outline.test.ts asserts only kind and entry, so C# members, lines, visibilities and the delegate rest on the recorded run; the Go fixture has no type X func(...) case; the TypeScript reference test omits line and entry.

Cold review corrections to the contract wording: entry names the symbol in the spelling that scanner's Code links use, PHP members are Namespace\Type::method beside a top-level Namespace\name, the function_exists guard counts only the function it names, a file's outline goes to the lowest scanner id among its Code links (including a scanner without the hook, which then leaves the file without an outline), and a named function type has an empty members list. Re-verified in a detached worktree at fa5ac2d8 holding only this change: bun run check exit 0 (biome 1 warning and 2 infos in untouched files, tsc clean, node 16 pass, bun 457 pass 0 fail).

Review-fix round (external reviews of cf8e7975).
Fixed: terminal How cursor stops were keyed file:line, so declarations sharing a line (for example `interface Reader { read(): void }`) collapsed into one stop and Down never passed the first. panes/details.ts now exports outlineSymbols (each declaration followed by a type's members) and outlineRowKey (file plus the symbol's position among its file's outline rows); navigation-details.ts builds its stops (OutlineStop, outlineStopKeys) from the same list, and Enter opens the stop's own line. Regression test "declarations sharing a line are separate cursor stops" (test-bun/tui-source.test.ts) fails at cf8e7975 and passes now; tests that asserted the old key text now assert the line Enter opens.
Fixed: the ViewerState.codeStructure and ViewerOptions.readStructure comments now describe the scanner-neutral outline.
Fixed (docs): creating-a-plugin.md states that C# top-level statements, with their local functions and lambdas, are not listed, and that Swift extensions are methods declared apart from their type: the entry sits at the first of the declaration and its extensions, and for a type declared elsewhere takes the first extension's access (internal by default).
Cold review: shared outlineSymbols between pane and navigation so the highlight and the stops cannot count rows differently, renamed to OutlineStop/outlineStopKeys, and added the Swift entry-line note.
Verification: tui-test on a scratch copy of mixed-scanner-outline whose alpha outline has Reader and read on line 1 and next on line 2: Down x4 then Enter opens src/orders.alpha:2; Esc, Up, Enter opens :1; a pane probe showed the highlighted row follows each stop. Isolated worktree bun run check exit 0 (biome 1 warning and 2 infos in untouched files, tsc clean, node 16 pass, bun 516 pass 32 skip 0 fail).
Out of lane, reported to the orchestrator: TypeScript outline findings (TASK-410.7), Java comment name lookup, Rust same-name types and cfg filter, PHP namespaced guard, C# argv request, Swift operation start line.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every official scanner returns a source outline through readCodeStructure, and the plugin contract now states the rules the per-language reviews exposed: the entry symbol spelling each scanner writes, one scanner per owned file, PHP's function_exists guard, and named function types as memberless types. Verified in a detached worktree holding only this change: the unconditional outline tests pass and the opt-in Go, Rust and C# outline suites pass after building their workers, direct outline runs recorded the C#, Go and TypeScript fields those tests leave unasserted, probes confirmed the outline needs no installed project dependencies or project tool, and bun run check exits 0.

Review-fix round: the terminal How cursor now keys each outline row by its position in the file, shared by the pane and navigation, so declarations sharing a line are separate stops and each opens its own line (regression test plus tui-test); outline comments are scanner-neutral; and the plugin contract states the C# top-level statement and Swift extension rules. Isolated bun run check exits 0.
<!-- SECTION:FINAL_SUMMARY:END -->
