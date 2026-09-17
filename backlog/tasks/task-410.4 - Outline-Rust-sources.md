---
id: TASK-410.4
title: Outline Rust sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-17 18:40'
labels: []
dependencies: []
references:
  - src-main
  - rust-src-index
modified_files:
  - plugins/scanners/rust/native/src/outline.rs
  - plugins/scanners/rust/native/src/scan.rs
  - plugins/scanners/rust/native/src/main.rs
  - plugins/scanners/rust/src/index.ts
  - test/fixtures/rust-outline/groma/index.md
  - test/fixtures/rust-outline/groma/project.md
  - test/fixtures/rust-outline/groma/systems/shop/system.md
  - test/fixtures/rust-outline/groma/systems/shop/containers/api/container.md
  - >-
    test/fixtures/rust-outline/groma/systems/shop/containers/api/components/orders.md
  - test/fixtures/rust-outline/web/orders.ts
  - test/fixtures/rust-outline/src/orders.rs
  - test-bun/rust-scanner.test.ts
  - docs/scanners/rust/index.md
  - docs/scanners/rust/validation.md
  - plugins/scanners/rust/native/src/text.rs
parent_task_id: TASK-410
type: feature
ordinal: 460000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rust components show only files. The Rust scanner already carries semantic tooling that parses source.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Rust-owned files show structs, enums and traits with their impl methods, and top-level functions, each with name, line and visibility.
- [x] #2 Independent fixtures cover the outline, including files the scanner owns alongside another scanner.
- [x] #3 The Rust scanner documentation describes the outline.
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
1. native/src/outline.rs (new): for each reference {file, symbols}, parse the file alone with ra_ap_syntax as Rust 2021, so no Cargo and no crate graph are involved, and list top-level items in source order. Inline mod blocks are transparent.
   - fn items are functions.
   - A const or static whose value is directly a closure is a function.
   - struct, enum, union and trait are types. Type aliases, trait aliases, macros and nested items are not listed.
   - Type members: the fns in a trait definition (signatures and default methods), and every fn in an impl block whose self type is a path naming a type, keyed by its last segment. Impls for a generic parameter or for non-path types are not listed.
   - A type declared elsewhere gets one public entry per file, at the self type name of its first impl block.
   - Visibility: pub is public; pub(crate), pub(super) and pub(in path) are internal; no pub and pub(self) are private. Trait-definition methods take the trait's visibility; trait impl methods are public.
   - line is the name's line. entry is symbols.contains(name). Files without declarations are omitted.
2. native/src/main.rs: the 'outline' argument reads {root, references} and prints CodeFile[]; with no argument the worker scans as before. scan.rs shares its line helper.
3. src/index.ts: readCodeStructure runs the worker with 'outline' through a small shared run helper also used by the scan.
4. Fixture test/fixtures/rust-outline: groma architecture with one component whose Code holds a TypeScript file and a Rust file (with symbols), a Cargo package, and Rust source covering the rules. Opt-in native test in test-bun/rust-scanner.test.ts adds the built Rust package and the TypeScript scanner, calls core readCodeStructure and asserts Code order plus every Rust declaration, member, line, visibility and entry.
5. docs/scanners/rust/index.md: Source outline section.
6. Clippy, the Rust suite, an isolated bun run check with GROMA_TEST_RUST, and self spec and quality review.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Flow: core readCodeStructure (src/viewers/source/structure.ts) calls the Rust adapter's readCodeStructure(root, references). The adapter runs the native worker with the 'outline' argument through runWorker, a helper now shared with the scan, and sends {root, references} on stdin. main.rs dispatches to outline::outline. It parses each file alone with ra_ap_syntax (Edition2021), so there is no Cargo project, crate graph or sema. top_level() flattens inline mod blocks. Outline::declarations() lists items in source order:
- functions: fn items, and const/static whose value is directly a closure;
- types: struct, enum, union and trait.
Members are gathered per type name in source order and attached at the end, so an impl before its struct still joins it:
- trait definition fns take the trait's visibility;
- impl fns take their own visibility, or public in a trait impl.
An impl for a type not declared in the file adds one public entry at the self type name of its first impl block. impl_type() accepts only a path self type and rejects a name that is one of the impl's generic parameters, so blanket impls are skipped. Visibility maps pub to public, pub(crate), pub(super) and pub(in path) to internal, and none or pub(self) to private. entry compares the bare name, the scan's symbol form for functions and methods. Files without declarations are omitted. scan.rs only made line() pub(crate).

Verification:
- cargo clippy --locked -D warnings is clean. Targeted Biome is clean.
- bun plugins/scanners/rust/build.ts built the package.
- GROMA_TEST_RUST=dist/bin/darwin-arm64/groma-rust-scanner bun test test-bun/rust-scanner.test.ts: 6 pass, 30 expects. The new test uses test/fixtures/rust-outline, which has no Cargo.toml. It registers the built Rust package and the TypeScript scanner, calls core readCodeStructure for a component whose Code holds web/orders.ts and src/orders.rs, and asserts Code order plus every Rust declaration, member, line, visibility and entry.
- Live tui-test on a copy (groma view, Enter, d, Tab): How lists web/orders.ts with showOrder(), then src/orders.rs with place_order() entry, audit/ship/notify/hide/ON_PLACED, Order (new, load, refresh, save), Store (save, count), Status (is_open), Bits, purge, Report, Invoice (total, discount) and Printer (print).
- Isolated worktree at HEAD ddc8c722 plus this diff: bun run check with GROMA_TEST_RUST exited 0 (Node 16/16; Bun 390 pass, 19 skip, 0 fail). Biome's 1 warning and 2 infos are in files outside this task.

Open for the coordinator:
- Inline #[cfg(test)] mod tests blocks are transparent under the contract, so their test fns are listed as private functions.
- The parse edition is fixed at 2021.
- docs/scanners/rust/validation.md coverage and the dated count were updated for the outline case.

Cold review, must fix: cfg(test) items were outlined. top_level() now drops an item whose cfg attribute mentions the test identifier, before flattening inline mods, so gated mods, functions, types and impl blocks all disappear in one place. The fixture gained a gated pub fn, a gated impl for the external Invoice type and a gated mod tests with a struct and a test fn; the expected declarations are unchanged, which is the assertion. docs/scanners/rust/index.md states the rule.
Known deviation from that rule: an item under #[cfg(not(test))] is active in the scan but is dropped from the outline, because the filter only looks for the test identifier.
Cold review, accepted: both index paths now go through push_type; a comment says declared is a lookahead; shared renamed to member_visibility; declarations are typed (Symbol, TypeDeclaration, Declaration serialized by serde) and each type's members are collected in a second pass over the items, so no JSON patching or as_array_mut remains; the line and position helpers moved from scan.rs to a new text.rs, so the outline no longer reaches into scan.
Left as found (accepted finding 6): two same-named types in different inline modules still share one members bucket.
Re-verification: cargo clippy --locked -D warnings clean; GROMA_TEST_RUST=... bun test test-bun/rust-scanner.test.ts 6 pass, 30 expects; isolated worktree at HEAD 92af9300 plus this diff: bun run check exited 0 (Node 16/16; Bun 436 pass, 19 skip, 0 fail), with Biome's warning and infos in files outside this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Rust scanner now implements readCodeStructure, so components list the declarations of their Rust files in the web and terminal maps. The native worker parses each requested file on its own with the Rust 2021 grammar, needing no Cargo project or crate graph, and lists items in the file and in inline mod blocks: fn items and closures bound directly to a const or static as functions; structs, enums, unions and traits as types, with the fns of every impl block for them and, for traits, their signatures and default methods. A type declared in another file gets one public entry at its first impl block. Visibility maps pub, pub(crate)/pub(super)/pub(in path) and no pub to public, internal and private, with trait-definition methods taking the trait's visibility and trait impl methods public. cfg(test) items, nested functions, aliases, associated constants, blanket impls and macro bodies are not listed.

docs/scanners/rust/index.md describes the outline; the Rust validation page lists the new case.

Verified by a test on test/fixtures/rust-outline, which has no Cargo.toml and holds one component whose Code mixes a TypeScript file and a Rust file, exercised through core readCodeStructure; a live terminal-map check of the How tab; Clippy with warnings denied; and an isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
