---
id: TASK-424.4
title: Report comparable operation bodies from the Rust scanner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-16 20:42'
updated_date: '2026-09-17 06:53'
labels: []
dependencies: []
references:
  - src-main
modified_files:
  - plugins/scanners/rust/native/src/tokens.rs
  - plugins/scanners/rust/native/src/scan.rs
  - plugins/scanners/rust/native/src/main.rs
  - test/fixtures/rust-duplicates/Cargo.toml
  - test/fixtures/rust-duplicates/src/lib.rs
  - test/fixtures/rust-duplicates/src/readiness.rs
  - test/fixtures/rust-duplicates/src/scheduling.rs
  - test/fixtures/rust-duplicates/src/invoice.rs
  - test/fixtures/rust-duplicates/src/quote.rs
  - test/fixtures/rust-duplicates/src/callbacks.rs
  - test-bun/rust-scanner.test.ts
  - docs/scanners/rust/index.md
  - docs/scanners/rust/validation.md
  - test/fixtures/rust-duplicates/src/labels.rs
  - test/fixtures/rust-duplicates/src/ordering.rs
parent_task_id: TASK-424
type: feature
ordinal: 494000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
groma lint cannot find duplicate logic in Rust because the Rust scanner reports operations without source ranges or body tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Rust scanner reports source ranges and binding-normalized tokens for Rust operation bodies, omitting anonymous callbacks, initializers and very small bodies as the shared rule requires.
- [x] #2 Independent fixtures show identical and near-duplicate bodies found by groma lint, and renamed local names still matching.
- [x] #3 The scanner documentation states which operations are compared.
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
1. Native worker: add native/src/tokens.rs. For one ast::Fn it binds parameter patterns to the first slots (Semantics::to_def on IdentPat). It then walks the body tokens in source order and turns bindings, and single-segment path expressions that resolve to a hir::Local, into $n slots. Identifier patterns starting with an uppercase letter stay text. Names inside macro token trees take the latest slot bound under that name. Grouping and separator punctuation is dropped, as in the TypeScript tokenizer. '.' joins the member name after it, and two dots in a token tree become '..'. An argument-list '(' becomes 'call'. Every other token keeps its text.
2. native/src/scan.rs declarations(): attach startLine, endLine (inclusive, 1-based) and tokens to every function with a body: free functions, methods, associated functions, trait default methods and nested fn items. Closures and async blocks count toward the enclosing function; const/static initializers are never Rust operations. No size filter; core applies both minimums.
3. Fixture test/fixtures/rust-duplicates contains:
   - a renamed identical pair, one side an associated function;
   - a near-duplicate pair;
   - a renamed pair using ranges inside macro arguments;
   - swapped glob-imported Ordering arms;
   - a tiny identical pair;
   - identical closures in one function and in const initializers.
   An opt-in native test in test-bun/rust-scanner.test.ts runs groma lint with the built package and asserts exactly the identical and near-duplicate findings.
4. docs/scanners/rust/index.md: a Compared operations section in the TypeScript page's shape (compared list, exclusions, Rust-only notes). docs/scanners/rust/validation.md: working reproduce path, coverage and dated counts.
5. Build the worker, run cargo clippy -D warnings and the opt-in Rust suite, then bun run check with GROMA_TEST_RUST in an isolated worktree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: native/src/tokens.rs tokenizes each function body. Parameters take the first slots. IdentPat bindings (Semantics::to_def) and single-segment path expressions that resolve to hir::Local become $n slots. Path resolution runs only for names already bound in the walk. Names in macro token trees take the latest binding's slot by text: macro arguments are raw token trees, and std macros are not loaded anyway. Grouping and separator punctuation is dropped. '.' joins the next member name, and a member name is never resolved. An ArgList '(' becomes 'call'. scan.rs adds startLine, endLine and tokens to every function with a body, with no size filter. It shares new first_token_start/position/line helpers with call extraction; invocation lines are unchanged.

Corrections:
- A first version also updated the name map on reads. Only bindings update it now.
- Known limitation: a binding is registered before its initializer is read. So in 'let label = vec![label.to_string(), label.to_string()]' the macro-argument reads take the new binding's slot. The scratch output is 'let $1 = vec ! $1 .to_string $1 .to_string $1', where the reads should be $0. This is the same in every copy.
- Cold review, must fix: rust-analyzer lowers unresolved pattern names as bindings because no standard library is loaded. So glob-imported Less/Greater arms became slots, and swapped arms tokenized identically. Identifier patterns starting with an uppercase letter now stay text, which also covers None. The fixture's ordering.rs pins this.
- Cold review, accepted: the '.' flag leaked across dropped tokens. In token trees '..' is two DOT tokens, so '&s[..n]' lost its slot and '&s[n..]' joined the next token after the macro. The flag is now taken at the start of push, and a dot directly after a dot emits '..'. The fixture's labels.rs renamed pair pins both. Scratch output: 'let $2 = format ! "{}{}" & $0 .. $1 & $0 $1 .. $2 .len call'.
- Cold review, accepted: renames (DROPPED, slot_by_name, after_dot, body_tokens, elements, first_token_start); reworded DROPPED and macro comments; the Rust page restructured to the TypeScript page's shape and moved to the end so it no longer splits Evidence and uncertainty; validation paragraph reflowed with dated counts.
- #[cfg(test)] functions are not operations: to_def returns None for them (checked on a scratch crate).

Verification (final):
- cargo clippy --locked -D warnings is clean.
- bun plugins/scanners/rust/build.ts built the package.
- GROMA_TEST_RUST=dist/bin/darwin-arm64/groma-rust-scanner bun test test-bun/rust-scanner.test.ts: 5 pass, 28 expects. The new test asserts that every operation has tokens. groma lint reports exactly these findings:
  - invoice/quote (similar);
  - labels.rs:1 and :6 (exact);
  - readiness:3 and scheduling:6 (exact).
  Swapped Ordering arms, the 4-token copies and the identical closures are absent.
- Isolated worktree at HEAD 506bc51a plus this diff: bun run check with GROMA_TEST_RUST exited 0 (Node 16/16; Bun 382 pass, 16 skip, 0 fail). Biome's 1 warning and 2 infos are in files outside this task.
- Shared files (src/architecture-findings.ts, docs/architecture-findings.md) are unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Rust scanner now reports a source range and binding-normalized body tokens for every function with a body: free and nested fn items, methods, associated functions and trait default methods. groma lint can now find duplicate and near-duplicate Rust logic.

The native worker's new tokens.rs uses rust-analyzer locals for slots. Uppercase pattern names stay text, since the standard library is not loaded. Macro arguments reuse the latest binding slot by name. Grouping punctuation is dropped, as in the TypeScript tokenizer. Closures, async blocks and initializers are never compared on their own, and core applies both size minimums.

docs/scanners/rust/index.md lists which operations are compared, and the validation doc has a working reproduce command.

Verified with Clippy, the opt-in Rust suite (5 pass) and an isolated bun run check with GROMA_TEST_RUST (exit 0). The suite includes a groma lint fixture covering exact, renamed, macro-range and near-duplicate findings, and the absence of swapped enum arms, tiny copies and closures.
<!-- SECTION:FINAL_SUMMARY:END -->
