---
id: TASK-410
title: Show source outlines for every official scanner
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-16 19:37'
updated_date: '2026-09-17 06:31'
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
type: feature
ordinal: 456000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web and terminal maps list the classes and methods behind a component only when the scanner that owns its Code implements the optional `readCodeStructure` outline (`packages/scanner/src/index.ts`). Only the TypeScript scanner implements it. Components owned by the Angular, React, Vue, Java, C#, Go, Rust, Python and PHP scanners show bare files. In the callforpapers repository this hides every Java method and every Angular-owned TypeScript method. Each official scanner already parses source into a syntax tree, so an outline needs no project dependencies or type resolution. The current outline contract uses TypeScript visibility words (export/internal, public/protected/private); languages with other visibility rules need an agreed mapping.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every official scanner returns an outline for the files it owns: types with their methods and top-level functions, each with name, line and visibility.
- [ ] #2 Outlines come from parsing source only and need no project dependencies, builds or project tool execution.
- [x] #3 A component whose Code mixes files from several scanners shows the outline of every file in the web and terminal maps.
- [x] #4 The scanner plugin contract documents the outline as part of every official scanner and defines how language visibility maps to it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Acceptance criteria have objective verification evidence.
- [x] #2 Relevant checks pass and changes remain task-scoped.
- [x] #3 Public contracts or documentation are updated when behavior changes.
- [ ] #4 Implementation Plan reflects the final approach; correction history and verification are recorded in Implementation Notes.
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
<!-- SECTION:NOTES:END -->
