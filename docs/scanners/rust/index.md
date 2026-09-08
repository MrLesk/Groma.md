# Rust

**Status: source-only prototype for review, not a production Rust semantic scanner.**
The native engine and its optional ESM adapter run through Groma's existing
scanner registry. No new reconciliation or architecture storage format is added.

The [research report](research.md) covers the production design, alternatives,
installation, Rust-specific semantics, mixed-language behavior, and release gates.
[Validation data](validation.json) records the measurements, versions, and limits.
[Codex validation](codex-validation.md) records the full-workspace shared-source
failure, a separately labeled 145-member control, and real mixed-map checks.

## Review the prototype

Build from the Groma checkout using Bun 1.4.1 and Rust 1.90.0:

```sh
bun install --frozen-lockfile
bun plugins/scanners/rust/build.ts
bun test --timeout 30000 plugins/scanners/rust/test/
bun run check
bun run build
bun plugins/scanners/rust/smoke-compiled.ts
```

The last command tests the actual standalone Groma binary on Linux, with only
Git and Groma on its consumer PATH. It registers the staged Rust package, scans a
mixed repository, and verifies Rust callback and authored cross-language
relationships. Node, npm, Bun, Cargo, and rustc are absent from that PATH.
Git remains a prerequisite of the existing Groma/TypeScript source inventory.
The Rust executable itself is also tested with an empty PATH.

In an initialized target repository:

```sh
groma scanner add /absolute/path/to/Groma.md/plugins/scanners/rust/dist
groma scanner list
groma scan
```

`dist/` is a self-contained, platform-specific package, not a published release.
Building it requires development dependencies; scanning with it does not.
Only Linux x64 with the build environment's glibc has been exercised.

## What it extracts

The engine reads Cargo manifests and Rust syntax directly. It reports atomic
source files, declarations, package placement anchors, temporary module/import
facts, direct free-function calls, canonical providers through supported
re-exports, and a narrowly defined supplied named function-pointer callback.
Method calls without type information stay unresolved.

```rust
pub struct Hooks { pub opened: fn() }
pub fn run(hooks: Hooks) { (hooks.opened)(); }
pub fn boot() { run(Hooks { opened: provider::open }); }
```

For this supported shape, the callback invocation belongs to `run`, its provider
is `provider::open`, and the binding is the call in `boot`. Core may derive
`Invokes supplied opened callback` when the existing ownership rule permits it.
Passing a callback without invoking it is not an interaction.

Ordinary imports and direct calls do **not** automatically become map arrows.
That is the existing [shared inference policy](../../relationship-inference.md),
not a Rust-specific filter. No automatic Rust/TypeScript HTTP, Tauri IPC, or Wasm
interaction matching is implemented. An authored relationship between their
owned source files is preserved alongside both scanners' results.

## Input and limits

The supported structural input is a Cargo package or explicit workspace members
using edition 2018, 2021, or 2024, with library/binary targets and ordinary Rust
source files. Root Cargo discovery takes precedence; otherwise nested Cargo
roots are discovered outside generated/dependency directories. Workspace member
globs and explicit local path dependencies are supported within the selected
source set. This is not a complete reimplementation of Cargo workspace resolution.

For predictable selection in a monorepo, create `.groma-rust.json` at its root:

```json
{
  "manifests": ["backend/Cargo.toml"],
  "maxFiles": 10000,
  "maxBytes": 268435456
}
```

Select a workspace root when its members inherit workspace metadata. `maxFiles`
counts cached input files, including manifests, rather than only emitted `.rs`
files. Individual files are limited to 2 MiB; module and resolution traversals
are bounded. The adapter limits execution to 120 seconds and output to 64 MiB.
Exceeding a hard limit or encountering invalid required input fails the complete
observation; it never emits a truncated success for reconciliation.

Feature/target conditions are not evaluated. Conditional declarations retain
uncertainty; `cfg_attr` module selection and absent conditional modules can be
omitted with diagnostics. Build-script output and macro-generated source are not
expanded. Test/example/benchmark targets, edition 2015, non-Cargo build systems,
semantic method/trait resolution, and general callback value flow are unsupported.
The watch matcher assumes `.rs` source filenames and matches manifests and this
configuration; it deliberately ignores generated/dependency directories.

Diagnostics are present in the native JSON observation. The current core scan
summary does not surface the full Rust coverage report; improving that visibility
is a production prerequisite. `complete: true` means the declared extraction
finished, not that all possible Rust behavior was discovered.

## Measurements

On pinned ripgrep 14.1.1, three fresh release processes scanned 78 files in
0.15–0.17 seconds at approximately 32 MiB native RSS. Of 5,722 call observations,
81 resolved and 5,641 remained unresolved. There were no supported named callback
bindings in that source snapshot. This demonstrates fast inventory and honest
limits, **not production semantic coverage or an architecture-quality score**.

The full [validation record](validation.json) distinguishes native measurements,
synthetic scaling, mixed-map tests, compiled delivery, and an initially observed
intermittent watcher teardown error during repository checks.
