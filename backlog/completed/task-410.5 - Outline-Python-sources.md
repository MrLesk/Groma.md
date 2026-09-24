---
id: TASK-410.5
title: Outline Python sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-17 06:52'
labels: []
dependencies: []
references:
  - runtime
  - src-index
modified_files:
  - plugins/scanners/python/worker/scan.py
  - plugins/scanners/python/worker/runtime.ts
  - plugins/scanners/python/src/index.ts
  - test/fixtures/python-outline/app/orders.py.fixture
  - test/fixtures/python-outline/web/orders.ts
  - test/fixtures/python-outline/groma/index.md
  - test/fixtures/python-outline/groma/project.md
  - test/fixtures/python-outline/groma/systems/shop/system.md
  - test/fixtures/python-outline/groma/systems/shop/containers/api/container.md
  - >-
    test/fixtures/python-outline/groma/systems/shop/containers/api/components/orders.md
  - test-bun/python-scanner.test.ts
  - docs/scanners/python/index.md
parent_task_id: TASK-410
type: feature
ordinal: 461000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Python components show only files. The Python worker already uses the standard Python parser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Python-owned files show classes with methods and top-level functions, each with name, line and visibility.
- [x] #2 Independent fixtures cover the outline, including files the scanner owns alongside another scanner.
- [x] #3 The Python scanner documentation describes the outline.
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
1. plugins/scanners/python/worker/scan.py: add outline(references). For each reference, parse the file with the standard ast parser (shared read_source helper with scan) and list direct module-body statements only: def and async def as function; a lambda assigned directly to a module-level name (Assign or AnnAssign target) as function; class as type. Type members are the def and async def statements directly in the class body, including static and class methods and __init__, each listed separately; property accessors (@property, @cached_property, @functools.cached_property, @x.getter/setter/deleter), nested classes and lambdas assigned to class attributes are not listed. Type aliases, wrapped values and other assignments are never listed. line is the def or class line (lambda: the target name's line); visibility follows the Python row; entry compares the bare name for top-level declarations and Class.method for members, the form the scan uses. Files without declarations are omitted.
2. plugins/scanners/python/src/index.ts: run() takes the worker data; readCodeStructure(root, references) sends only the references. plugins/scanners/python/worker/runtime.ts derives the copied files from the references and calls outline(references) instead of scan(files).
3. Fixture test/fixtures/python-outline: groma architecture with one component whose Code holds a TypeScript file and a Python file linked by a top-level and a dotted member symbol, plus the .py.fixture source covering the rules above.
4. Test in test-bun/python-scanner.test.ts: build the package, add it and the TypeScript scanner, call core readCodeStructure for the component, and assert both files are outlined in Code order and the Python declarations, members, lines, visibility and entry.
5. docs/scanners/python/index.md: Source outline section.
6. Isolated bun run check; self spec and quality review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Flow: core readCodeStructure (src/viewers/source/structure.ts) calls the Python adapter's readCodeStructure(root, references), which starts the Pyodide worker with only the referenced files and the references. worker/runtime.ts then calls outline(references) instead of scan(files). outline() parses each file with ast (shared read_source helper) and lists direct module-body statements, returning CodeFile[] without files that have no declarations.
Decisions: only direct module and class body statements count (the contract makes only namespace, package and module blocks transparent, so defs inside module-level if or try are not listed). Property accessors (@property, @x.getter/setter/deleter) are excluded as the contract's accessors; other decorated defs, including staticmethod, classmethod and cached_property, are members. Lambdas assigned by Assign or AnnAssign to a module-level name are functions; lambdas on class attributes are fields. Lines are the def or class line (the target name's line for lambdas). entry is name in the reference's symbols (bare name, as the contract says; scan symbols for methods are dotted, so a dotted Code symbol does not mark a member).
Verification: bun test test-bun/python-scanner.test.ts 6 pass; the new test adds the built Python package and the TypeScript scanner to a copy of test/fixtures/python-outline and asserts core returns both Code files in order plus every Python declaration, member, line, visibility and entry. Live tui-test on a copy (groma view, Enter, d, Tab): How lists web/orders.ts with showOrder() and app/orders.py with place_order() entry, _audit() private, ship(), notify(), OrderService with __init__, create, load, _protect protected, __hide private, __len__, fetch, and _Draft private with submit. Isolated bun run check passed (1 existing Biome warning in plugins/scanners/php/build.ts, tsc clean, node 16 pass, bun 376 pass, 20 skip, 0 fail).

Cold review: must-fix applied, member entry now compares Class.method (the scan's method symbol form) and top-level entry the bare name; the fixture Code gained OrderService.fetch and the test asserts that member's entry. docs/scanners/python/index.md states the rule; docs/scanners/creating-a-plugin.md was left to the coordinator. Optional findings applied: readCodeStructure sends only references and the runtime derives the files from them; @cached_property and @functools.cached_property are properties and not listed (decorators named on the page); doc wording (same ast parser, other top-level names starting with _ are private); renamed accessor to is_property_accessor and request to call; fixture dropped Amount = float and the staticmethod and gained a cached_property. Re-verification: bun test test-bun/python-scanner.test.ts 6 pass; isolated bun run check passed (1 existing Biome warning in plugins/scanners/php/build.ts, tsc clean, node 16 pass, bun 378 pass, 20 skip, 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Python scanner now implements readCodeStructure: the Pyodide worker parses the referenced files with ast and lists module-level functions (including lambdas bound directly to a name) and classes with their def members (static and class methods and __init__ included, properties excluded), each with name, line, name-based Python visibility and entry (bare name for top-level, Class.method for members). Components whose Code mixes Python with another scanner now show the Python outline in the web and terminal maps. docs/scanners/python/index.md describes the outline. Verified by a test on test/fixtures/python-outline (TypeScript and Python files in one component, through core readCodeStructure), a live terminal-map check of the How tab, and an isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
