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
function-pointer and callback value flow, closure and async-block bodies,
macro-expanded call bodies and generated sources are not extracted.

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
