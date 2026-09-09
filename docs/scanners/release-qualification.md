# Official scanner release qualification

A built package is a release candidate. Public availability requires publishing
that exact version and verifying its installation. A passing local run does
not qualify another operating system or CPU.

The intended targets are Linux x64 and arm64, macOS arm64, and Windows x64 and
arm64. Intel macOS is outside this set. The current qualification record must
identify each platform actually executed and the native runtime requirements
of its packaged workers. Unexecuted jobs and skipped tests do not establish
support.

## Consumer checks

Use compiled Groma and disposable copies of the approved projects. Prepare each
project with its documented language tools before running the checks. The
scripts change source temporarily, restore it on exit, and retain the Groma
map and evidence directory. Do not point them at a working application checkout.

These commands exercise actual `npm pack` artifacts. A local registry serves
only those bytes to Groma's normal exact-version installer. It does not publish
packages or make the official catalog available. The checks require a fresh
scanner installation cache so a previous installation cannot substitute for
an artifact download. CI should use a fresh runner. The evidence includes the
package hash and confirms that its archive was downloaded.

First run the Java/Angular/embedded-TypeScript flow:

```sh
bun scripts/validate-callforpapers-artifacts.ts /path/to/compiled-groma \
  /path/to/disposable-prepared-callforpapers /path/to/evidence/callforpapers \
  /path/to/built-java-package /path/to/built-angular-package
```

The check discovers the three technologies, explicitly selects and installs
the exact Java and Angular versions, checks readiness, scans, and exports the
map. It combines the selected TypeScript/HTML pairs through Groma. It then
verifies one physical owner with complementary scanner references, retained
ownership after source and supported-template edits, repeat scans, failure
preservation, and discovery of an added Go project. The added project is used
only for discovery and is removed before export.

The selected output is `merged` in `CompanyMergeDialog`, bound to
`CompanyList.onMergeComplete`. Removing that binding changes the derived
interaction; the other callbacks between the same files remain. Restoring the
original template restores the interaction. This does not assert a Java/Angular
HTTP relationship or resolve Spring runtime receivers.

Then qualify the existing native-language examples:

```sh
bun scripts/validate-native-scanner-artifact.ts csharp /path/to/compiled-groma \
  /path/to/disposable-FluentValidation /path/to/built-csharp-package /path/to/evidence/csharp
bun scripts/validate-native-scanner-artifact.ts go /path/to/compiled-groma \
  /path/to/disposable-chi /path/to/built-go-package /path/to/evidence/go
bun scripts/validate-native-scanner-artifact.ts rust /path/to/compiled-groma \
  /path/to/disposable-ripgrep /path/to/built-rust-package /path/to/evidence/rust
```

| Example | Preparation and selected input |
| --- | --- |
| callforpapers, snapshot `1cb6783f3379664e3f176e72c5419064ce24dbfd` | Install its frozen pnpm lock; prepare its root Maven project with the goals in the [Java guide](java/index.md). |
| FluentValidation, commit `5365d9294812c8a5c5a7f4d7447c9a65b79a025b` | Install the SDK selected by `global.json` and .NET 10 for the worker. Restore `src/FluentValidation/FluentValidation.csproj`; select it in `groma.csharp.json`. |
| Chi, commit `71307f9b7e4e9527638bc951c42b782cd1560331` | Install Go 1.27.1 and run `go mod download` in the root module. |
| ripgrep, commit `4649aa9700619f94cf9c66876e9549d83420e16c` | Install Rust/Cargo 1.91.1 with `rust-src`; run `cargo fetch --locked`. Select `crates/globset/Cargo.toml` in `.groma-rust.json`. |

The native checks use the same installation, readiness, scan, curation, source
edit, repeat-scan, failure-preservation, and map-export path. They retain the
project commit and tool version in `validation.json`; `commands.json` records
successful commands and their output. The selected implementations are the
same supported examples documented in each scanner guide.

## Evidence and limits

For every executed target, retain the packed archives, their SHA-256 hashes,
compiled Groma hash, tool versions, command output, and exported maps. Review
the maps with a human. Compiler observations are not proof of all runtime
relationships. The [C#](dotnet-csharp/index.md), [Java](java/index.md),
[Angular](angular/index.md), [Go](go/index.md), and [Rust](rust/index.md) guides
define the supported inputs and unresolved evidence.

Discovery, installation, and release qualification belong to Groma's existing
scanner module management. They introduce no OKF record or C4 element. Ordinary
Markdown readers can still read the architecture responsibilities and Code
links; core retains ownership and interprets complementary scanner evidence.

Public package names, native artifact layout, and CI release structure must be
settled before publication. Catalogued versions must refer to qualified public
releases; local registry success is not that evidence.

## Executed local qualification

On 9 September 2026 all five private `0.1.0` artifacts passed on macOS arm64
with compiled Groma SHA-256
`91d3652d05721cbe0b0bb89525dc3485b30162d779bacc766458a22dd98e2338`.
The callforpapers run used JDK 25.0.1, Maven 3.9.15, Node 24.13.0 and Bun 1.4.1.
Its project dependencies remained Angular 21.2.19 and TypeScript 5.9.3; the
scanner bundle contains Angular compiler/compiler-cli 21.2.17 and TypeScript
5.9.3 alongside Groma's embedded TypeScript 7.1 SDK.

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
