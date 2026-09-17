# Rust scanner

The Rust scanner carries a native rust-analyzer HIR worker. HIR is the engine's
model for source names, modules and types. A source checkout needs no Cargo,
rustc, rust-src, downloaded crates or application build.

```sh
groma scanner add @groma/scanner-rust
groma scan
```

Maintainers build with Bun and Rust using `bun plugins/scanners/rust/build.ts`.
The resulting package contains the native worker, bundled adapter and licenses.
Scanner consumers do not build the worker or install a separate language runtime.

## Project inputs

The adapter reads tracked and unignored `Cargo.toml` files with a TOML parser.
Workspace members and exclusions, package names, editions, library/binary paths,
local workspace dependencies and declared default features supply a source
crate graph. It passes that graph directly to rust-analyzer's `ProjectJson`
API. The engine loads modules and resolves source names. Cargo metadata,
rustc, build scripts and procedural macros are never executed.

By default each workspace is scanned once. A package selects its library and
binary targets; a workspace selects its members. `settings.manifest` on the
existing Rust scanner entry selects one manifest relative to the repository.
Test, example, benchmark and build-script targets are outside this extraction.
External crates and standard-library types remain unresolved. This source
loader does not evaluate custom target configurations or build-generated flags.

## Evidence and uncertainty

The scanner emits module source files, functions, exact UTF-16 positions and
calls. Locally resolvable re-exports and inherent methods retain their source
targets. Executable wrappers remain separate operations. Trait dispatch,
function-pointer and callback value flow, calls in closure and async-block
bodies, macro-expanded call bodies and generated sources are not extracted.

A physical file shared by multiple module contexts appears once, with no guessed
declarations or targets and a `rust-unsupported-compilation-contexts` diagnostic.
Invalid syntax or an engine module-loading error fails the observation.
Unresolved external semantics do not fail the source scan. A completed scan
does not claim that the application compiles.

Crates and compiler contexts are temporary evidence, not new OKF concepts or
C4 levels. Core owns curated file membership and relationship policy. Markdown
readers retain readable Code links and responsibilities. Ordinary Rust calls
do not automatically become architecture relationships.

The [rust-analyzer project JSON format](https://rust-analyzer.github.io/book/non_cargo_based_projects.html)
provides the source graph interface. See
[fresh-checkout validation](../fresh-checkout-validation.md) for exercised flows.

## Source outline

Components list the declarations of their Rust files under the
[shared outline contract](../creating-a-plugin.md#source-outline). The worker
parses each requested file on its own with the Rust 2021 grammar, so the
outline needs no Cargo project or crate graph. It lists items directly in the
file and in inline `mod` blocks:

- `fn` items, and closures written directly as a `const` or `static` value, are
  functions.
- Structs, enums, unions and traits are types. A trait's members are its method
  signatures and default methods. A type's members are the `fn` items of every
  `impl` block for it in the file, including associated functions without
  `self`.

An `impl` block for a type declared in another file adds one `public` entry for
that type, at the type name in its first `impl` block. `impl` blocks for a
generic parameter, such as `impl<T> Store for T`, or for a type that is not a
path, such as a reference or a tuple, are not listed. Functions nested in
functions, other constants and statics, associated constants and types, type
and trait aliases, and items inside macros are not listed either. An item is
also left out when one of its `cfg` attributes mentions `test`, which covers an
inline `#[cfg(test)] mod tests`, the code the scan leaves out as well. The
condition is not evaluated, so `#[cfg(not(test))]` items are left out too,
although the scan does read them. A declaration's line is its name's line.

Visibility comes from the item's own `pub`; an enclosing module does not
narrow it. Methods in a trait definition take the trait's visibility, and
methods in a trait `impl` are `public`.

A declaration is an entry when a Code link names it by its bare name, such as
`place_order` or `load`, the form the scan uses for functions and methods.

## Compared operations

`groma lint` and scan findings compare Rust operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range and body tokens to every function with a body:

- free functions, including `fn` items nested in another function body;
- methods and associated functions in `impl` blocks;
- trait methods with a default body.

Closures and async blocks are anonymous callbacks; their tokens belong to the
function that contains them. These functions are not compared:

- functions produced by macros;
- functions under inactive `cfg` conditions, such as `#[cfg(test)]`;
- functions in a file with several compilation contexts.

Macro arguments are raw token trees. A name inside them takes the slot of the
latest local binding with that name. Names inside format strings, such as
`format!("{count}")`, stay text.

The standard library is not loaded, so rust-analyzer cannot tell an unresolved
name in a pattern from a new binding. An identifier pattern that starts with an
uppercase letter, such as `None` or a glob-imported `Less`, stays text,
because Rust names enum variants and constants that way.
