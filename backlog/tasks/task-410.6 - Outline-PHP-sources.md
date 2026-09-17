---
id: TASK-410.6
title: Outline PHP sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-17 11:13'
labels: []
dependencies: []
references:
  - evidence
  - php-src-index
modified_files:
  - plugins/scanners/php/src/syntax.ts
  - plugins/scanners/php/src/evidence.ts
  - plugins/scanners/php/src/outline.ts
  - plugins/scanners/php/src/index.ts
  - test/fixtures/php-outline/groma/systems/shop/system.md
  - test/fixtures/php-outline/groma/systems/shop/containers/api/container.md
  - >-
    test/fixtures/php-outline/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/php-outline/web/orders.ts
  - test/fixtures/php-outline/app/helpers.php
  - test/fixtures/php-outline/app/Orders.php
  - test-bun/php-scanner.test.ts
  - docs/scanners/php/index.md
parent_task_id: TASK-410
type: feature
ordinal: 462000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PHP components show only files. The PHP scanner already parses declarations without project dependencies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PHP-owned files show classes, interfaces, traits and enums with methods, and top-level functions, each with name, line and visibility.
- [x] #2 Independent fixtures cover the outline, including files the scanner owns alongside another scanner.
- [x] #3 The PHP scanner documentation describes the outline.
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
1. plugins/scanners/php/src/syntax.ts owns the php-parser configuration (parsePhp), the class-like typeKinds set and the one scan symbol naming rule (symbolName: Ns\name, Type::method); evidence.ts and outline.ts both use them.
2. plugins/scanners/php/src/outline.ts: readCodeStructure(root, references) reads each referenced file, parses it with the bundled php-parser and lists program statements and the statements of braced or unbraced namespace blocks: function as function, including a function declared directly inside if (!function_exists('name')) { ... } when the guard names it; an expression statement assigning a closure or arrow function directly to a variable as function named $variable (entry false: closures have no scan symbol); class, interface, trait and enum as type. Type members are every method in the body (static, abstract and interface signatures included; constructors keep __construct); properties, constants, enum cases and trait use statements are not listed. Line is the name's line. Visibility: top-level public; members private or protected from their modifier, otherwise public. entry compares symbolName names. Files without declarations are omitted; parse errors fail the request like the scan.
3. plugins/scanners/php/src/index.ts: expose readCodeStructure.
4. Fixture test/fixtures/php-outline: one component whose Code holds two PHP files (unbraced namespace with types; braced namespaces with a function, a top-level closure, a matching function_exists guard and two non-matching conditional functions) and a TypeScript file, with PHP references naming a function, a type and a method symbol.
5. test-bun/php-scanner.test.ts: build and add the PHP scanner and the TypeScript scanner, assert the scan reports the fixture's Code symbols, call core readCodeStructure, and assert every file in Code order and the PHP declarations, members, lines, visibility and entry.
6. docs/scanners/php/index.md: Source outline section.
7. Isolated bun run check; self specification and quality review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: plugins/scanners/php/src/outline.ts implements readCodeStructure; plugins/scanners/php/src/index.ts exposes it. The php-parser configuration moved to syntax.ts (parsePhp) so scan evidence and the outline parse identically. Program statements and the statements of braced or unbraced namespace blocks are top-level; functions and closures or arrow functions assigned directly to a variable (named $variable) are functions; classes, interfaces, traits and enums are types whose members are every method. Top-level visibility is public; members follow private/protected modifiers, otherwise public. entry compares the scan's namespace-qualified symbol names (Ns\Type, Ns\Type::method), because core writes those names into Code references.
Decision: declarations inside control-flow blocks such as if (!function_exists(...)) are not top-level under the contract and are not listed; documented.
Verification: bun test test-bun/php-scanner.test.ts, 5 pass. The outline test adds the packaged PHP scanner and the TypeScript scanner to a copy of test/fixtures/php-outline, calls core readCodeStructure (the path the web and terminal maps use) and gets app/helpers.php, web/orders.ts, app/Orders.php in Code order, with the expected PHP kinds, names, lines, visibility, members and entries. Isolated bun run check with only this task's changes: exit 0 (tsc clean; node 16 pass; bun 378 pass, 20 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).

Cold review applied (coordinator decisions): one naming rule and typeKinds set in syntax.ts used by evidence.ts and outline.ts; the outline test now asserts the scan reports the fixture's three Code symbols; a function declared directly inside if (!function_exists('name')) { ... } whose guard names it is listed (coordinator decision; contract table note routed by the coordinator), with a mismatched guard and a PHP_VERSION_ID condition as unlisted counterparts; closures get entry false; renamed declaration to declarationsOf and outline to symbol; lineOf takes Syntax and field reads are widened only in field and list; docs say trait use statements and describe the guard. The earlier note that conditional declarations are not listed is superseded.
Re-verification: bun test test-bun/php-scanner.test.ts 5 pass; isolated bun run check exit 0 (tsc clean; node 16 pass; bun 379 pass, 23 skip, 0 fail; Biome findings only in untouched build.ts, vue-scanner.test.ts, iso-map.test.ts).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The PHP scanner now implements readCodeStructure, so PHP-owned files show their top-level functions (including function_exists-guarded ones and closures assigned to variables) and their classes, interfaces, traits and enums with every method, each with name, line, visibility and entry. Top-level namespace blocks are transparent; members follow private/protected, otherwise public. Scan evidence and the outline share one parser configuration and one symbol naming rule in syntax.ts, so entries match the scan's qualified names. The PHP scanner page documents the outline. Verified by a test that reads the outline through core for a component whose Code mixes two PHP files and a TypeScript file (files in Code order, exact PHP declarations, and the scan reporting the Code symbols), and by an isolated bun run check (exit 0).
<!-- SECTION:FINAL_SUMMARY:END -->
