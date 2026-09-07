# Rust scanner prototype

A native, source-only Rust scanner for Groma's existing optional scanner registry.
It does not run Cargo, rustc, build scripts, procedural macros, or project binaries
while scanning. It is a structural prototype, not a production semantic analyzer.

See the [review guide](../../../docs/scanners/rust/index.md),
[research and production requirements](../../../docs/scanners/rust/research.md), and
[recorded measurements](../../../docs/scanners/rust/validation.json).

## Build and verify

From the Groma repository root, with Bun 1.4.1 and Rust 1.90.0 installed:

```sh
bun install --frozen-lockfile
bun plugins/scanners/rust/build.ts
bun test --timeout 30000 plugins/scanners/rust/test/
cargo fmt --manifest-path plugins/scanners/rust/native/Cargo.toml --check
cargo clippy --locked --manifest-path plugins/scanners/rust/native/Cargo.toml -- -D warnings
bun run check
bun run build
bun plugins/scanners/rust/smoke-compiled.ts
```

The compiled smoke test and peak-RSS benchmark currently require Linux. The
staged package is `plugins/scanners/rust/dist/`; it contains bundled ESM, a native
executable, and license notices, with no runtime npm dependencies or install
scripts. The build needs the development toolchain; consumers of the staged
package do not. No npm package is published by this prototype.

To try it against another repository, run these commands there, using an absolute
path to the staged package:

```sh
groma scanner add /absolute/path/to/Groma.md/plugins/scanners/rust/dist
groma scanner list
groma scan
groma web
```

Initialize Groma in the target repository first if it has no architecture yet.
The embedded TypeScript scanner remains enabled. Use `groma scanner remove rust`
to disable Rust scanning without deleting the package.
