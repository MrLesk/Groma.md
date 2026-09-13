# Scanner artifact qualification record

This is a historical record of local artifact checks performed on 9 September 2026.
Automated tests cover domain behavior. Package installation, configuration,
release smoke checks, and consumer qualification scripts are outside the test suite.

## Executed local qualification

On 9 September 2026 all five private `0.1.0` artifacts passed on macOS arm64
with compiled Groma SHA-256
`91d3652d05721cbe0b0bb89525dc3485b30162d779bacc766458a22dd98e2338`.
The callforpapers run used JDK 25.0.1, Maven 3.9.15, Node 24.13.0 and Bun 1.4.1.
Its project dependencies remained Angular 21.2.19 and TypeScript 5.9.3; the
scanner bundle contains Angular compiler/compiler-cli 21.2.17 and TypeScript
5.9.3 alongside the TypeScript scanner's 7.1 SDK.

C# used the project's SDK 9.0.317 and the installed .NET 10.0.11 worker runtime;
the worker was built with SDK 10.0.400 and Roslyn 5.9.0. Go used Go 1.27.1 with
`golang.org/x/tools` 0.49.0. Rust used Rust/Cargo 1.91.1 with `rust-src` and
rust-analyzer HIR 0.0.301.

| Packed candidate | SHA-256 |
| --- | --- |
| Java | `7e6e746aea9161b51b0946c76f09bb03776c5b5a97289da0c45312267f878cfa` |
| Angular | `a82553d84fabdf4a71c6ec7b8d9980612c32225029731aa7c94a83ee58ad054b` |
| C# | `461ac232b154c99c614a17b3224c988cf5d1f66d0eacfbc03dc2b73af9640613` |
| Go | `e0832254751df91fcedf5222b1a088e59d7e16f87525dbc0dd9ed4256d52303a` |
| Rust | `4c945603bd7f4d1e13a9fcc44a1ecbeb2b23ff7dee9cfb7858a3c2a8075b3a54` |

After the checks, all 3,168 callforpapers source files matched the prepared
acceptance copy byte-for-byte. The three native examples had no tracked-file
differences. These results establish local artifact installation and consumer
behavior only. Public installation, the other four target executions, and
release review remain open gates.
