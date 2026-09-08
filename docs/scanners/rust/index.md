# Rust

The Rust scanner uses pinned rust-analyzer HIR 0.0.301 to load Cargo projects
and identify source functions and call targets. HIR is the engine's semantic
model: it supplies module membership, name resolution, and type information.
The adapter does not implement another Rust resolver.

The current delivery is a private local package for review. No public Rust
scanner version or platform matrix is qualified here. The exercised platform
is macOS arm64. See [validation](validation.md) for the supported real example
and recorded checks.

## Prepare and use

Install the project's Rust toolchain, including Cargo, rustc, and matching
standard library sources. The verified setup uses Rust 1.91.1:

```sh
rustup component add rust-src
cargo fetch --manifest-path Cargo.toml
```

Dependency preparation is explicit. The scanner runs Cargo metadata offline
with a locked dependency graph; it does not fetch packages or install tools.
It does not run project build scripts or procedural macros.

A maintainer builds the scanner package with Bun and Rust 1.91 or newer:

```sh
bun plugins/scanners/rust/build.ts
```

Register the resulting local package from an initialized target repository:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/rust/dist/package
groma scanner check
groma scan
```

The package contains a native worker and a bundled JavaScript adapter. Its
consumer needs Cargo, rustc, and rust-src, but no separate rust-analyzer
executable, Bun, or Node runtime. Groma loads the adapter through its existing
plugin interface. Package availability remains separate from project readiness
in the [common setup journey](../setup.md).

The default input is the repository's root Cargo.toml. To select one original
Cargo manifest inside a repository, write `.groma-rust.json`:

```json
{"manifest":"crates/globset/Cargo.toml"}
```

A package manifest selects its library and binary targets. A workspace manifest
selects member library and binary targets. The original Cargo workspace remains
intact, and rust-analyzer may read dependencies to resolve the selected source.
Only files belonging to selected modules are emitted. Test, example, benchmark,
and build-script targets are outside the extraction scope.

## Evidence and uncertainty

The supported example uses default Cargo features and the host target. The
scanner emits physical source files, source functions, UTF-16 declaration/call
positions, direct calls, and inherent method calls. Re-exports resolve to their
implementation; an executable wrapper remains a separate operation. Targets
outside the selected source inventory remain unresolved.

Trait dispatch, function-pointer and callback value flow, closure and async-block
bodies, macro-expanded call bodies, and generated sources are not extracted.
Procedural macros and build-script output are disabled. Declarative macros may
participate in the engine's name resolution; this does not make expanded call
bodies part of the observation. A call with unsupported dispatch has no certain
provider. There is no supplied-callback inference in this version.

One physical file may belong to several compilation contexts. If rust-analyzer
reports more than one module context for a file, the scanner emits that file
once, omits its declarations and call claims, and reports
`rust-unsupported-compilation-contexts`. Calls targeting omitted declarations
also remain unresolved. It never selects the first context or unions conflicting
targets. The minimal reviewed example is one package whose library and binary
both include the same source module.

Cross-package `#[path]` loading is not supported by the pinned engine in the
observed example. An engine module-loading error fails the scan; no source-root
workaround is applied. Invalid Rust syntax also fails the scan. Other unresolved
semantics remain uncertain evidence. `complete: true` means the declared
extraction finished, not that Cargo compiled the application or all Rust runtime
behavior was discovered.

The existing selected-manifest scope provides initial placement only. Build
targets and compilation contexts are not new C4 boxes or OKF concepts.
Ordinary Markdown readers retain the same readable Code links. Groma core owns
the single curated source owner and the common relationship policy; the plugin
does not store a compiler graph, infer deployment boundaries, or write
architecture Markdown. Direct calls do not automatically become map arrows.

## Design sources

The [rust-analyzer architecture guide](https://rust-analyzer.github.io/book/contributing/architecture.html)
defines the semantic model and its crate-context boundary. The pinned
[HIR API](https://docs.rs/ra_ap_hir/0.0.301/ra_ap_hir/) and
[Cargo loader](https://docs.rs/ra_ap_load-cargo/0.0.301/ra_ap_load_cargo/)
supply the implementation boundary. Using those language tools keeps the
resolution decision valid across projects; this delivery only qualifies the
one selected example, not every Rust workspace.
