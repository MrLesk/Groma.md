# Rust scanner research and production requirements

Research date: 7 September 2026. Repository baseline:
`0e1252c92a90ef87b30d4fb5cfa56e768d436fea`. Implementation task: TASK-228.5.

## Decision

Keep Groma's existing multi-scanner collection and reconciliation. Distribute
Rust analysis as a self-contained optional native sidecar with a bundled ESM
adapter. Do not require users to compile the scanner or install a JavaScript
runtime to use a globally installed Groma binary.

The implemented source-only prototype establishes that delivery model, Cargo
placement, conservative canonical calls, one named callback rule, and mixed-map
preservation. It does **not** establish production-quality Rust semantics.
For production, investigate a pinned rust-analyzer-backed engine rather than
progressively reimplementing Rust name resolution and type checking in the
prototype. Treat richer analysis and project-code execution as separate choices.

The evidence for this distinction is concrete: ripgrep's structural scan is fast,
but only 81 of 5,722 emitted call observations resolve. Building many more
handwritten special cases before testing a semantic engine would optimize the
wrong part of the product. This is a design recommendation, not a measured
comparison between rust-analyzer and syn.

## 1. What Groma requires

The governing sources are the [plugin contract](../creating-a-plugin.md),
[evidence semantics](../evidence.md), [SDK](../../../packages/scanner/src/index.ts),
[registry](../../../src/scanner/registry.ts),
[reconciler](../../../src/scan-reconciler.ts),
[relationship inference](../../relationship-inference.md), and
[Markdown contract](../../component-markdown.md). The general product document
contains older scanning descriptions; current implementation and the dedicated
inference documentation govern the prototype's relationship behavior.

A plugin exports `id`, `matchesFile`, and `scan(repositoryRoot)`. It returns one
complete observation or `undefined` when no supported root exists. Atomic file
inventory, declared symbols, scopes, placements, temporary source relationships,
optional operations/invocations, and deterministic diagnostics are sufficient.
Every emitted endpoint must refer to an entity in that observation. The adapter
uses the existing strict SDK parser rather than trusting arbitrary native JSON.

Scanners must not read architecture descriptions to guess edges, group files
into C4 components, assign architecture IDs, or write architecture Markdown.
Evidence IDs are observation-local; canonical operation identity survives alias
spelling within that observation. Input paths are repository-relative. A failed
or interrupted scan is not evidence that previously known architecture vanished.

The registry already loads embedded TypeScript plus configured optional scanners.
It awaits all results with `Promise.allSettled`, surfaces failure only after
workers finish, and reconciles the successful batch once. This supports multiple
technologies without a new merge service. The Rust branch changes no registry,
reconciler, viewer, or relationship-selection implementation.

Core preserves curated file membership and descriptions. Unknown files seed
singleton components under provisional scopes. A package placement anchor is
not an assertion that a Cargo library is independently deployed. In C4, containers
are running applications or data stores, not arbitrary build packages; final
runtime boundaries remain curated architecture knowledge. Operations and calls
stay temporary supporting evidence, not a fifth C4 level. Persisted statements
and links remain readable ordinary Markdown/OKF; Groma owns inference policy.
See the authoritative [C4 container definition][c4].

### Source facts are not automatic collaborations

The current inference rule selects a supplied **named** callback with a concrete
binding, known canonical targets, no unresolved alternative, and one provider
owner distinct from the invoker. It does not promote every direct call or import.
The prototype preserves this rule, including active wrappers as executable
intermediaries and re-exports as identity-preserving aliases.

A syntax resolver can report an exact free-function provider within its declared
scope without proving execution, architectural significance, or complete program
validity. Conversely, a precisely identified trait declaration is not necessarily
the concrete method implementation. Neither count nor type compatibility should
be converted into a numerical confidence score or a fabricated business purpose.

## 2. Rust analysis options

| Engine | Useful capability | Main cost or limitation | Decision |
| --- | --- | --- | --- |
| `syn` AST | Full Rust syntax trees, declarations and source positions in a small native tool | No compiler type inference, Cargo project model, or general symbol resolution | Implemented structural prototype; not the final semantic engine |
| Tree-sitter | Incremental, error-tolerant syntax parsing | Syntax parsing does not identify concrete trait receivers or perform compiler binding | Consider for a source-preview experience, not as a semantic shortcut |
| rust-analyzer | Crate-aware names, types, references, macro infrastructure, incremental queries | Project/toolchain loading and explicit execution policy; Rust APIs require pinning | Preferred production semantic research direction |
| SCIP / `scip-rust` | Portable definition/reference indexing backed by rust-analyzer | A symbol index is not Groma callback provenance or a business collaboration graph | Possible evidence source; evaluate rather than assume complete call analysis |
| `rustc_driver` / compiler IR | Analysis of the configured compiler program | Compiler integration, toolchain coupling, build requirements and project execution | Not the default globally installed MVP path |

These capabilities are documented by [syn][syn], [Tree-sitter][treesitter],
[rust-analyzer][ra-architecture], [SCIP Rust][scip], and
[the compiler driver guide][driver]. Only syn was implemented and benchmarked
here; no comparative performance claim is made for the other engines.

Rust-analyzer's internal semantic model accepts files plus a crate graph; Cargo
and filesystem loading are outside that core. Its higher-level interfaces expose
semantic queries and incremental snapshots, while the IDE Rust API is explicitly
unstable and LSP is the stable interface. A pinned native sidecar using a narrow
library facade could batch Groma's queries efficiently. LSP reduces library API
coupling, but a request for every reference can introduce transport overhead.
Measure these choices on the same labeled examples before choosing an adapter.
[Architecture and API boundaries][ra-architecture] describe the distinction.

The current `scip-code/scip-rust` documentation describes a thin wrapper over
`rust-analyzer scip` and lists Cargo, rustc, and rust-analyzer prerequisites.
Do not assume an older standalone indexer or a Docker image solves Groma's global
installation problem. Even with SCIP, Groma needs explicit extraction for named
callback bindings, receiver alternatives, and framework communication semantics.
[Current SCIP Rust documentation][scip]

## 3. Rust-specific requirements

### Cargo packages, targets, and configuration

A repository, workspace, package, crate target, source file, and runtime container
are different identities. One package can define a library and several binaries;
shared source may appear in more than one target. Workspaces add inherited
metadata, renamed local dependencies, explicit/excluded members, and implicitly
included path packages. Cargo's [workspace][workspaces], [target][targets], and
[dependency][dependencies] rules should be authoritative for semantic loading.
The prototype supports an explicit subset and does not claim Cargo equivalence.

For production, identify analysis by at least manifest/package identity, target
kind/name, edition, target triple, selected features/cfg, and toolchain. A source
file stays one physical inventory item even when analysis has several target
instances. Tests, examples, benchmarks, build scripts, and proc-macro targets need
separate declared treatment, not accidental inclusion through recursive `.rs`
globs. Do not make every crate or generic instantiation a separate map component.

Features are not one universal configuration. Optional dependencies, target
conditions, and `default-features` change what is present. An all-features union
may differ from every deployment the user actually runs. A production result
must disclose its selected profile and unresolved conditions; the source-only
prototype instead marks conditional facts uncertain. [Cargo features][features]
and [conditional compilation][cfg] define the relevant mechanisms.

### Modules and canonical identity

Resolve `crate`, `self`, `super`, external crate aliases, nested modules,
`mod.rs`, inline modules, `#[path]`, grouped imports, and re-exports before
identifying providers. Do not search all functions by final name. The prototype's
path-attribute regression cases were checked against rustc: a child module of a
`#[path]`-loaded file resolves relative to its containing directory rather than
an invented directory named after that file. This is a concrete reason to test
Rust module rules instead of adapting a TypeScript import heuristic.
See [module filenames and path attributes][modules] and [use declarations][use].

A `pub use implementation::run as execute` remains the implementation operation.
A new `fn execute() { implementation::run() }` is a real intermediary. Local
bindings, block imports, macro-introduced names, and raw identifiers can change
resolution. The prototype conservatively abstains for unsupported local scope
constructs instead of selecting the only matching declaration it happens to see.

### Traits, receivers, closures, and asynchronous execution

Production analysis needs receiver types, inherent versus trait methods,
autoderef/autoref, associated functions, trait defaults/overrides, qualified calls,
generic bounds, and dynamic trait objects. For `dyn Trait`, report supported
possible implementations with unknown alternatives; do not manufacture a unique
provider from a signature or method name. Rust's [trait][traits] and
[trait-object][traitobjects] semantics make a global name lookup insufficient.
The prototype records method calls but leaves their targets unresolved.

Passing a closure or function pointer is not proof of invocation. The implemented
callback example follows an immutable owned nongeneric synchronous struct
parameter with a named bare function-pointer field and a concrete struct-literal
argument. It rejects unsupported mutation, shadowing, generic/reference receivers,
opaque macros, struct spreads, and indirect values. Separate suppliers retain
separate bindings. It does not model arbitrary `Fn`, `FnMut`, `FnOnce`, mutable
fields, returned callbacks, or framework registration.

Asynchronous calls also need care: constructing a future, polling it, awaiting it,
and spawning a task are different events. The prototype does not attribute
nested closure or async-block bodies to an enclosing operation or infer callback
execution inside them. Production framework rules should distinguish scheduling
from execution and retain unknown dispatch. [Tokio's spawn contract][spawn] is
one concrete API worth testing, not a license to classify every function named
`spawn` the same way.

### Macros, generated code, FFI, and frameworks

Declarative macro expansion is more than parsing opaque tokens. Procedural macros
are executable programs, including custom derives and attributes. Build scripts
can generate files, supply cfg values, and depend on native tools; `include!` and
`OUT_DIR` can place architecture-relevant code outside the checked-in source.
A production engine must retain source/expansion provenance and report missing
expansion, not claim that generated code does not exist. [Procedural macros][macros]
and [build scripts][buildscripts] establish why this is an execution boundary.

Neither an FFI declaration nor a Wasm export proves which other application calls
it. Tauri command registration plus frontend invocation, or an Axum route plus a
TypeScript request, requires explicit binding evidence. [Tauri calls][tauri] and
[Axum routing][axum] are useful future fixtures. Names, equal route strings, shared
DTO types, and compatible signatures alone must not generate cross-runtime arrows.
No such framework recognizer is implemented in this branch.

## 4. Installation and execution policy

### What works in the prototype

The developer builds the scanner once. Its staged package contains a native
executable, bundled ESM including the shared observation parser, and licenses.
It has no runtime npm dependencies, workspace references, or installation hooks.
The adapter executes its own adjacent binary by absolute path, never `cargo run`
or a binary opportunistically found on the user's PATH. Failures do not trigger
an implicit compiler installation or fallback engine.

Users register that package through existing `groma scanner add <local-path>`.
The package is private and unpublished; there is no public Rust scanner version
users can install from npm yet. The source [C# adapter][csharp] builds its scanner
during scanning; that development pattern was deliberately not reused here.
The production goal is to build in release CI, not on every developer machine.

The Linux standalone smoke test copied the compiled Groma binary and staged
package into a separate directory with fresh home/cache directories. The consumer
PATH contained only Git and Groma. Both languages scanned and relationships
survived. This proves consumer independence from Node/npm/Bun executables and the
Rust toolchain for this profile. It does not prove independence from the OS native
runtime: the tested Linux binary still uses the build platform's native ABI.

### Production package delivery (proposal, not published)

Retain the existing exact-version command shape:
`groma scanner add @groma/scanner-rust@<released-version>`. The manager already
installs configured packages into its shared cache, and compiled Groma can perform
package installation through its embedded Bun runtime with scripts disabled.
It does not need a globally installed npm command. Scan/watch remain offline
consumers; only explicit add/install operations may acquire packages.
See [package installation][installer] and the [plugin guide](../creating-a-plugin.md).

Release either explicit platform packages or a small common package with exactly
pinned platform dependencies. Validate optional dependency selection before
choosing the latter; do not rely on a postinstall downloader. The supported matrix
must distinguish Linux glibc/musl and ABI floors, macOS x64/arm64, and Windows
architectures/runtime libraries. The branch stages the current host only and does
not claim that matrix is complete.

Require package/engine version reporting, provenance and checksum verification,
license notices, install concurrency and atomic publication, executable permission
checks, and clear unsupported-platform errors. Test paths containing spaces and
non-ASCII characters, offline restoration, proxies, and restricted permissions.
Scanner readiness must eventually verify the native payload, not merely find an
ESM entrypoint. A release should not advertise readiness and fail at the first scan.

### Semantic dependencies and trust (proposal)

Separate three experiences: a build-free structural preview, semantic analysis
with a declared crate/toolchain configuration, and explicitly trusted expansion.
A failed semantic scan must not silently become a weaker success that looks like
an equivalent map. Any mode change and lost coverage need to be visible.

For semantic discovery, a command such as `cargo metadata --format-version 1
--no-deps --locked --offline` can avoid dependency downloads and lockfile updates
when the selected project supports it. It can still fail with unavailable inputs;
it does not eliminate Cargo or all project-configuration trust. Consult the
[metadata command][metadata], rather than assuming `--no-deps` means a universal
sandbox or a complete source graph.

Reuse a verified project toolchain where available, or offer an explicitly
requested managed installation into isolated tool homes. Do not alter the user's
default Rust toolchain, shell profile, or global PATH. Record downloaded versions
and source, respect the project's pinned toolchain, and make removal/restoration
predictable. Universal automatic installation of native C libraries, SDKs, or OS
packages is not a realistic prerequisite for first-release support.

For a rust-analyzer integration, explicitly configure build-script/proc-macro
behavior and checking; do not inherit editor defaults. Its [configuration][ra-config]
exposes these controls. Enabling expansion can execute dependency/project code;
turning it off reduces coverage. Process separation and time limits alone are
not an OS security sandbox. Trusted expansion needs an explicit policy for code
execution, network, filesystem writes, resources, and cache provenance. The current
prototype does not implement a rust-analyzer mode or dependency installer.

## 5. Mixed Rust and TypeScript in one map

The supported flow is: load TypeScript and Rust, collect both complete
observations, resolve each through shared architecture ownership, and reconcile
once. The integration fixture proves that both inventories appear in the same
loaded architecture; an explicit Rust callback produces the existing derived
statement; a user combines two Rust files and edits their overview; repeated
scans preserve that ownership/prose and an authored frontend-to-backend HTTPS
relationship. Breaking Rust while adding a TypeScript file leaves all architecture
Markdown byte-for-byte unchanged.

This is one world/map, not a promise that every discovered root is automatically
placed under one C4 system or that the languages communicate. Runtime boundaries
should be curated. No language can authoritatively infer a cross-runtime edge
from the other language merely existing nearby.

Automatic protocol joining is a separate future example. A useful observation
would identify sending/receiving application, protocol, method/operation,
route/channel, configuration origin, source location, and unresolved alternatives.
Core would join compatible evidence and then apply an approved architecture rule.
The current SDK does not exchange that full protocol model. It would be wrong to
smuggle it into ordinary import edges or treat identical paths in different
services as proof of communication. Authored relationships provide the supported
solution until that cross-language example is implemented and reviewed.

## 6. Scope and large repositories

| Project family | Prototype status | Production position |
| --- | --- | --- |
| Cargo 2018/2021/2024 libraries and CLI applications | Structural inventory, supported direct calls and callback fixture | Initial semantic target after a rust-analyzer comparison |
| Explicit workspaces and selected local path dependencies | Supported subset, one file inventory with target-specific operations | Use authoritative Cargo discovery and configuration receipts |
| Tokio/Axum applications | Source can be inventoried; no route/task/service semantics | Add one pinned framework example at a time |
| Tauri, Wasm, no_std/embedded, native-FFI-heavy or proc-macro-heavy code | Only unexpanded source within current rules; no cross-runtime or toolchain assurance | Do not advertise full first-release support |
| Tests/examples/benches, Cargo's implicit member edge cases, edition 2015, non-Cargo/Bazel/kernel builds | Outside declared target scope | Explicit follow-up decisions, not silent general support |
| Large workspaces | Explicit manifest selection and deterministic failure bounds | Measure realistic end-to-end workloads before defining service levels |

Current safety bounds are 10,000 cached input files and 256 MiB input by default,
2 MiB per file, 200,000 discovery entries, module depth 128, resolution depth 64,
and adapter limits of 120 seconds/64 MiB output. Hard budget failures emit no
partial success; bounded unresolved resolution remains explicitly uncertain.
These are limits, not a proof that all input graphs fit a particular memory cap.
The scanner is not hardened against every hostile filesystem race, pathological
glob, or OS-specific path behavior.

The prototype is a complete rescan process, without an incremental database.
A production engine should cache source content and crate configurations, then
invalidate on source/manifest/lockfile/toolchain/target/feature changes. Semantic
watching must also account for `.cargo/config.toml`, generated inputs, and expansion
provenance. Keep outputs deterministic: a time budget should fail or retain
uncertainty, never select whichever relationships happened to finish first.
Measure full collection, interpretation, Markdown writes, and watch latency as
well as native analysis. Avoid adding a daemon before measurements justify it.

## 7. Reproducible validation and limitations

The complete machine-readable [validation record](validation.json) contains
hashes and runs. Build toolchain: Bun 1.4.1, Rust 1.90.0, syn 2.0.106, locked Cargo
dependencies. The benchmark runs release binaries in three fresh processes and
uses Linux `/usr/bin/time` for native peak RSS. Filesystem caches are not flushed;
results are not cold-cache or dedicated-hardware service-level measurements.

The external repository was actually cloned at ripgrep 14.1.1, commit
`4649aa9700619f94cf9c66876e9549d83420e16c`. No ripgrep build script, dependency
installation, or project executable was run. Its selected input produced 10
package scopes, 78 source files (1,476,919 bytes), 2,078 operations, 5,722 invocation
observations, and 187 temporary source relationships. Only 81 invocation sets
resolved; 5,641 remained unresolved. No supported named callback bindings were
found. The 187 source facts are **not** 187 derived architecture collaborations.

Native times were 0.17, 0.16, and 0.15 seconds; peak RSS was 32,316–32,444 KiB.
The executable was 2,845,288 bytes. Selected canonical-call witnesses were checked
against source, including the help/man documentation renderers calling the shared
markup function, flags parsing calling config argument loading, and globset's
path helper calls. This is a small source-witness review, not a labeled precision
or recall study. In particular, 81/5,722 is a resolution share of emitted syntax
observations, not coverage of every runtime call.

A synthetic 1,001-file fixture with 10,000 simple explicitly qualified calls took
0.17–0.19 seconds and 40,280–40,400 KiB native RSS, resolving all those deliberately
simple calls. That measures bounded traversal/serialization, not realistic trait,
macro, or dependency analysis. It must not be extrapolated to a production
thousand-crate monorepo.

Reproduce from the repository root after building the scanner:

```sh
git clone --depth 1 --branch 14.1.1 https://github.com/BurntSushi/ripgrep.git /tmp/ripgrep
test "$(git -C /tmp/ripgrep rev-parse HEAD)" = 4649aa9700619f94cf9c66876e9549d83420e16c
bun plugins/scanners/rust/benchmark.ts /tmp/ripgrep
bun plugins/scanners/rust/scale-fixture.ts
```

Focused validation passed 36 concurrent tests with 85 assertions. They include
canonical aliases and active wrappers, uncertain targets, callback direction and
separate bindings, Cargo/path rules, no build-script execution, empty-PATH native
execution, no partial output, mixed reconciliation, and curated/authored
preservation. Cargo formatting and Clippy with warnings denied passed.

The final `bun run check` passed: 110 Node tests and 355 existing Bun tests,
plus typechecking and lint checks. Six existing Biome warnings remain; none is in
new Rust plugin code. The plugin's 36 tests are a separate command, also included
in its CI workflow. An earlier complete check passed all assertions but reported
an unhandled watcher teardown error (`Unable to remove watcher: Invalid argument`).
An untouched baseline check and the final changed check both passed. The failure
was not reproduced on baseline, and its cause was not proven; existing watcher
code/tests were not changed to hide it.

The implementer reviewed the source, supported behavior, and simplification
opportunities. Separate independent-agent reviews were not available in this
execution environment and are not claimed. Review the branch before treating the
prototype as accepted. Only Linux x64 was run; package publishing, automatic npm
installation of a Rust release, cross-platform certification, rust-analyzer
integration, and broad framework coverage are not completed here.

## 8. Production acceptance gates

Before advertising production Rust support, require a pinned semantic-engine
comparison on reviewed examples, with wrong-provider counterexamples as important
as successful edges. Cover trait receivers, cfg variants, re-exports, native and
Wasm boundaries, macro-generated operations, closures, mutation and async dispatch.
Keep unresolved alternatives rather than pruning them into apparently exact calls.

Evaluate additional pinned real applications and a substantially larger workspace,
including a web server and a mixed Rust/TypeScript project. Record exact commands,
source selection, dependencies, engine/toolchain versions, end-to-end latency/RSS,
and sampled source witnesses. No such broad corpus claim follows from ripgrep and
the synthetic fixture alone.

Expose analysis mode, selected targets/features, missing expansion, skipped source,
counts of unresolved evidence, and fatal versus nonfatal diagnostics to users.
The native observation already reports limitations; the current core scan summary
does not surface a full coverage report. A production scanner must not look
complete to the user merely because the JSON contract says `complete: true`.

Finally, certify clean-machine installation and upgrades for each supported OS/ABI,
restore/offline behavior, executable and package integrity, cancellation/resource
bounds, non-destructive failure, and watch invalidation. Keep trust/expansion
consent explicit. Approval of a semantic extractor and approval of new
architecture-selection rules are separate release decisions.

## Primary sources

The external links below were checked during this research. Implementation claims
are tied to the local source, fixtures, and recorded measurements, not inferred
from the capabilities advertised by another engine.

[syn]: https://docs.rs/syn/2.0.106/syn/
[treesitter]: https://tree-sitter.github.io/tree-sitter/
[ra-architecture]: https://rust-analyzer.github.io/book/contributing/architecture.html
[ra-config]: https://rust-analyzer.github.io/book/configuration.html
[scip]: https://github.com/scip-code/scip-rust
[driver]: https://rustc-dev-guide.rust-lang.org/rustc-driver/intro.html
[workspaces]: https://doc.rust-lang.org/cargo/reference/workspaces.html
[targets]: https://doc.rust-lang.org/cargo/reference/cargo-targets.html
[dependencies]: https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html
[features]: https://doc.rust-lang.org/cargo/reference/features.html
[cfg]: https://doc.rust-lang.org/reference/conditional-compilation.html
[metadata]: https://doc.rust-lang.org/cargo/commands/cargo-metadata.html
[modules]: https://doc.rust-lang.org/reference/items/modules.html
[use]: https://doc.rust-lang.org/reference/items/use-declarations.html
[traits]: https://doc.rust-lang.org/reference/items/traits.html
[traitobjects]: https://doc.rust-lang.org/reference/types/trait-object.html
[macros]: https://doc.rust-lang.org/reference/procedural-macros.html
[buildscripts]: https://doc.rust-lang.org/cargo/reference/build-scripts.html
[spawn]: https://docs.rs/tokio/latest/tokio/task/fn.spawn.html
[tauri]: https://v2.tauri.app/develop/calling-rust/
[axum]: https://docs.rs/axum/latest/axum/struct.Router.html
[c4]: https://c4model.com/abstractions/container
[csharp]: ../../../plugins/scanners/csharp/src/adapter.ts
[installer]: ../../../src/scanner/modules/package.ts
