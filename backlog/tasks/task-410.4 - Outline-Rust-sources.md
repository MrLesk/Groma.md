---
id: TASK-410.4
title: Outline Rust sources
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 19:38'
updated_date: '2026-09-18 17:48'
labels: []
dependencies: []
references:
  - src-main
  - rust-src-index
  - native-src-outline
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
  - test/fixtures/rust-outline/src/scopes.rs
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

Review-fix round (Codex and Grok cold reviews at cf8e7975):
7. Fix: same-named types in different inline modules share one members bucket (Codex must-fix outline.rs:106, codex-all #1, Grok outline.rs:99-109). Items keep their inline module path; a declared type is identified by module path plus name. An impl's self type path is read relative to its module (self and super step within the file) and resolves to the innermost enclosing module that declares it, so a use super::* module still reaches the outer type. A path the file does not declare (including crate:: paths) names a type from elsewhere and gets one entry per written path, so explicit different paths stay apart.
8. Fix: #[cfg(test)] on an individual trait or impl method is still listed (Codex should-fix outline.rs:118). Apply the test gate to members too.
9. Fix: #[cfg(not(test))] items are dropped (Grok outline.rs:154-159). Evaluate the cfg predicate with test off and every other option unknown; leave an item out only when the predicate cannot hold outside tests. Update docs/scanners/rust/index.md.
10. Skip: Grok's claim that #[cfg(feature = "test")] is dropped does not reproduce (the value is a string token, not the test identifier); a probe lists it.
11. Regression fixture test/fixtures/rust-outline/src/scopes.rs with a focused test calling the Rust plugin's readCodeStructure; verify with Clippy, the Rust suite and an isolated bun run check.

12. Cold review of the fix: an unresolved path is keyed by its rest after the self and super steps, so impl self::Ext and impl Ext share one entry; crate paths are not resolved because a file parsed alone does not know its module path (documented); a second declaration with the same module path and name, such as under another cfg condition, adds no row; the test rule is two-valued: a cfg condition requires test when it is test itself or an all(...) with such an argument.
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

Review-fix round (Codex and Grok at cf8e7975):
- Fixed: same-named types in different inline modules shared one members bucket, so a::Item received b::Item's methods and b::Item stayed empty (probe reproduced). top_level() now keeps each item's inline module path (Scoped); a declared type is keyed by module path plus name. impl_owner() reads the impl's self type path from the block's module: self and super step through the file's modules, and the path is looked up from the module outward, so a use super::* module still reaches its parent's type. A path the file does not declare, such as crate::left::Remote, is keyed as written, so different explicit paths stay apart and identical ones still share one entry.
- Fixed: #[cfg(test)] on a single impl or trait method was listed (probe reproduced). members() applies the same test gate.
- Fixed: #[cfg(not(test))] items were dropped (probe reproduced). gated_by_test() now evaluates the cfg predicate with test off and every other option unknown, and leaves an item out only when the predicate is false: test and all(test, unix) are left out; not(test) and any(test, feature = "tools") are listed.
- Skipped: Grok's claim that #[cfg(feature = "test")] items are dropped does not reproduce; "test" there is a string token, and a probe listed the item.
- Regression test: test/fixtures/rust-outline/src/scopes.rs and a focused test in test-bun/rust-scanner.test.ts calling the Rust plugin's readCodeStructure. It fails at HEAD without the fix and passes with it.
- docs/scanners/rust/index.md states the module and cfg rules; docs/scanners/rust/validation.md lists the case and the 18 September focused run.
Verification: cargo clippy --locked -D warnings clean; focused Rust suite 9 pass, 34 expects; isolated worktree with this diff and GROMA_TEST_RUST: bun run check exit 0 (Node 16/16; Bun 522 pass, 24 skip, 0 fail); Biome's warning and infos are in files outside this task.

Cold review of the fix, applied:
- Unresolved impl paths are keyed by the path after its self and super steps (owner_key), so impl self::Ext beside impl Ext gives one Ext row again. crate paths stay unresolved, since the worker does not know whether a file is a crate root (that needs the Cargo targets, more than a two-line change); docs/scanners/rust/index.md states that impl crate::a::Item gets its own entry even in a crate root that declares a::Item.
- push_type skips a key already listed, so #[cfg(unix)] and #[cfg(windows)] struct Handle give one row that receives the impl methods.
- The cfg rule is now two-valued (requires_test): test itself, or all(...) with such an argument. The three-valued decided_by logic is gone; not(test) and any(test, ...) items are still listed.
- The fixture gained the Handle pair and impl Ext beside impl self::Ext.
Re-verification: cargo clippy --locked -D warnings clean; focused Rust suite 9 pass, 34 expects; isolated worktree at HEAD d0abfc0e plus this diff with GROMA_TEST_RUST: bun run check exit 0 (Node 16/16; Bun 528 pass, 26 skip, 0 fail); Biome's one warning is outside this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Rust scanner now implements readCodeStructure, so components list the declarations of their Rust files in the web and terminal maps. The native worker parses each requested file on its own with the Rust 2021 grammar, needing no Cargo project or crate graph, and lists items in the file and in inline mod blocks: fn items and closures bound directly to a const or static as functions; structs, enums, unions and traits as types, with the fns of every impl block for them and, for traits, their signatures and default methods. An impl block joins the type its path names, read from the block's inline module: self and super step through the file's modules and the rest is looked up from that module outward. A type declared elsewhere gets one public entry per path at its first impl block; crate paths are not resolved, because a file parsed alone does not know its module path. Visibility maps pub, pub(crate)/pub(super)/pub(in path) and no pub to public, internal and private, with trait-definition methods taking the trait's visibility and trait impl methods public. Items and methods whose cfg condition requires test, nested functions, aliases, associated constants, blanket impls and macro bodies are not listed.

docs/scanners/rust/index.md describes the outline; the Rust validation page lists the new case.

Verified by a test on test/fixtures/rust-outline, which has no Cargo.toml and holds one component whose Code mixes a TypeScript file and a Rust file, exercised through core readCodeStructure; a live terminal-map check of the How tab; Clippy with warnings denied; and an isolated bun run check.

Review round (Codex and Grok): same-named types in different inline modules no longer share one members bucket, a type declared twice in one module under different cfg conditions is listed once, cfg(test) methods are left out, and cfg(not(test)) items are listed. Verified by a focused test on test/fixtures/rust-outline/src/scopes.rs that fails at HEAD without the fix, Clippy, and an isolated bun run check.
<!-- SECTION:FINAL_SUMMARY:END -->
