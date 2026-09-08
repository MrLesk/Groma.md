# Rust scanner validation

Validation date: 9 September 2026. Platform: macOS arm64. Toolchain:
Rust/Cargo 1.91.1 with rust-src, Bun 1.4.1, and rust-analyzer HIR 0.0.301
locked in the scanner's Cargo.lock.

## Engine choice and research reuse

The wrong-provider fixture contains a dependency crate named `worker`, a local
module imported with `use local::*`, and a call to `worker::run()`.
Cargo runs the program successfully with its assertion that the local result
is 2. The scanner identifies `app/src/local.rs` as the certain target.
The dependency's implementation is not selected.

The native adapter process, package layout, license-notice generation, and
registered-package curation/failure proof reuse useful work from
[the Rust prototype](https://github.com/MrLesk/Groma.md/tree/research/rust-scanner-prototype)
at `6d465f8909f00beb163128ae93f8e66a15c1b0e8`. The handwritten semantic
resolver is not included.

[The Codex experiment](https://github.com/MrLesk/Groma.md/tree/research/rust-codex-validation)
at `6e211e0` supplies the pinned-input and original-source-preservation
validation pattern and the shared-source counterexample. This implementation
uses one smaller library/binary fixture to establish the declared behavior:
`src/shared.rs` has two engine contexts, one physical file entry, and no
guessed operation/call provider. Both targets use existing placement scaffolding,
not target-specific C4 elements. The earlier reduced Codex workspace is not
counted as successful full-Codex support. Full Codex was not scanned here.

## Supported real project

The selected example is the original `crates/globset/Cargo.toml` in
[ripgrep 14.1.1](https://github.com/BurntSushi/ripgrep/tree/4649aa9700619f94cf9c66876e9549d83420e16c),
commit `4649aa9700619f94cf9c66876e9549d83420e16c`.
No Cargo manifest or source file was rewritten to make it load.
All 212 tracked regular files match the original checkout byte-for-byte;
Git submodule entries are excluded from that file comparison.

Dependencies were prepared with `cargo fetch --locked`. A disposable full
checkout selected the globset manifest through `.groma-rust.json`; the scanner
and compiled Groma then used the original workspace. The other ripgrep packages
were not included in the emitted inventory.

| Observation | Result |
| --- | ---: |
| Physical source files | 4 |
| Operations | 110 |
| Invocation records | 497 |
| Certain invocation records | 123 |
| Supplied callback bindings | 0 |
| Derived map relationships | 0 |

Two final observations were byte-identical. These counts describe the declared
extraction; they are not precision, recall, or complete runtime coverage.
Distinct nested calls can share a source start offset. The scanner retains
both, rather than deduplicating by start offset.

Selected source witnesses were checked against the emitted targets:

| Source call | Engine target |
| --- | --- |
| `GlobMatcher::is_match`, `crates/globset/src/glob.rs:121` | `Candidate::new` in `crates/globset/src/lib.rs` |
| `Candidate::new`, `crates/globset/src/lib.rs:543` | Host-selected `normalize_path` in `crates/globset/src/pathutil.rs` |
| `Candidate::new`, `crates/globset/src/lib.rs:544-545` | `file_name` and `file_name_ext` in `crates/globset/src/pathutil.rs` |

Compiled Groma produced one system, one existing manifest scope/container, and
four source components. The coordinator accepted the rendered map and exact
Rust source view under the user's delegated acceptance. This is a reviewed
scan result, not a claim that the file-shaped inventory is curated application
architecture. No arrows are expected from ordinary calls under core's existing
supplied-callback relationship policy.

## Reproduce the checks

Build the local package, then run the opt-in native suite:

```sh
bun plugins/scanners/rust/build.ts
GROMA_TEST_RUST="$PWD/plugins/scanners/rust/dist/bin/groma-rust-scanner" \
  bun test --timeout 60000 test-bun/rust-scanner.test.ts
cargo clippy --locked --manifest-path plugins/scanners/rust/native/Cargo.toml -- -D warnings
bun plugins/scanners/rust/smoke-compiled.ts /absolute/path/to/compiled/groma
```

The suite covers canonical aliases, inherent calls, uncertain trait/function
pointer dispatch, deferred closure bodies, distinct chained calls at one source
offset, the wrong-provider witness, shared-source identity, deterministic
output, curated ownership across repeat scans, actionable readiness, and failed
scan preservation. Each test owns its temporary fixture and runs concurrently.
Native tests are opt-in because a general repository checkout need not contain
a built Rust worker or project toolchain. The final focused run passed 6 tests
and 33 assertions. The complete repository check passed 110 Node tests and
396 Bun tests with 858 assertions, no failures, and no skipped Bun tests; the
native Rust and Go suites were enabled. Native Clippy with warnings denied,
targeted Biome, and TypeScript checks also passed.

The smoke command uses `npm pack` and extracts that actual artifact before
loading it into compiled Groma. It verifies `scanner check`, a successful
scan, curated repeat scans, and unchanged Markdown after malformed Rust fails.
Only macOS arm64 was exercised. Public publication and other platforms remain
TASK-326.7 release qualification work.

## Recorded artifact hashes

| Artifact | SHA-256 |
| --- | --- |
| Native macOS arm64 worker | `321f97ab9ca9b606d697a7d8bf9a98992c6b251cd681e1d810f384ba4ca0f5a5` |
| npm-packed local scanner | `4c945603bd7f4d1e13a9fcc44a1ecbeb2b23ff7dee9cfb7858a3c2a8075b3a54` |
| Compiled Groma used for smoke | `91d3652d05721cbe0b0bb89525dc3485b30162d779bacc766458a22dd98e2338` |
| Final globset observation | `ce5a79ff5c6d84349f0825348edf54cc2fce7fefc6d5417ae75020e876eeb617` |

The package is private and carries the prototype version `0.1.0`; this is not
evidence of a public npm release. Package generation includes dependency license
texts and the matching platform executable. License texts omitted from upstream
crate archives are included from their recorded upstream repositories.
