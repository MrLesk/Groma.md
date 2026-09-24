# Swift scanner

The Swift scanner reads source with SwiftParser and SwiftSyntax. Its package
includes the native worker and parser libraries. Scanning requires Git and
groma.md, but no Xcode, Swift SDK, package resolution, or application build.
Release builds target macOS 14 or later on Apple Silicon (arm64), Linux x64
and arm64, and Windows x64 and arm64. Linux packages are built on Ubuntu 24.04
and use the host's glibc and C++ system libraries. Intel Mac packages are not
part of groma.md's release targets.

Version 0.1.2 adds Linux and Windows packaging. The 0.1.0 and 0.1.1 packages
support only macOS; see the [validation record](validation.md) for release
and platform verification evidence.

Install the scanner from npm, then scan:

```sh
groma scanner add @groma/scanner-swift
groma scanner check
groma scan
```

groma.md records the selected exact version in the project's scanner settings.
On another checkout, `groma scanner install` restores that selection before
`groma scan`. Local package paths remain available for maintainer validation.

## Source inputs

Tracked and unignored `.swift` files are read at every repository depth,
including tests and generated sources such as `*.pb.swift`. `Package.swift` and
its `Package@swift-<version>.swift` variants are build declarations, and DocC
catalogs (`*.docc`) hold snippets that no build compiles, so neither is scanned
as application code. The package declares default
[exclusions](../index.md#excluding-source-evidence) for the `.build`, `Pods`
and `Carthage` folders. Excluded files are never read, so an excluded file cannot fail the scan. Source
changes and new Swift files trigger the existing shared watch session.

Xcode projects and Swift package manifests are not executed or evaluated.
Source files form one source group; directories, imports and extension names
do not define architecture boundaries or multi-file components.
Conditional compilation branches are parsed as source without selecting a
build configuration; only `#if false`, which no configuration compiles, is
left out. Macros are not expanded. Invalid syntax fails the whole Swift
observation with file and line diagnostics, and so does a file that is not
UTF-8. Syntax errors inside a block whose condition checks the compiler or
language version, as in `#if compiler(>=6.4)`, do not fail the scan: the
compiler skips such a block when it needs another version, so it may hold
syntax this parser does not know.

An `@main`, `@UIApplicationMain` or `@NSApplicationMain` type, and a
`main.swift` file, whose top-level code runs as its module's program, are
execution entries. SwiftPM names a target after its directory under `Sources`,
so an entry there takes that name; elsewhere the entry type names it, or the
directory holding `main.swift`. Each entry's source is its own file; target
membership is not analyzed.

## Evidence and outlines

The scanner reports types, functions, constructors, executable bodies and call
locations. Locations use the shared UTF-16 offset contract. Calls inside closures
belong to their closure operation, not to the enclosing function. A local
function, closure or type is named after the operation that declares it, as in
`Store.load.helper`, and names drop escaping backticks. Syntax alone
does not establish overload resolution, dynamic dispatch, dependency injection,
macro expansion or cross-language targets. Calls therefore have no certain
targets and do not produce derived architecture arrows.

Outlines list top-level types, functions and macro declarations, plus methods,
constructors and `deinit`. Extensions contribute methods to the named type
without combining source files; `extension Box<Int>` and `extension [Int]`
extend `Box` and `Array`. A type declared in an extension, as in
`extension Editor { struct Store {} }`, is listed as `Editor.Store` with its
methods, and so is a nested type that the same file extends; other nested types
stay part of their declaration. Declarations inside statements and closures are
not listed. Access maps as follows: `open/public` to public, `package/internal` and the
default to internal, `fileprivate/private` to private. Swift has no protected
access. Protocol requirements use the protocol's access; an extension's explicit
access supplies its members' default. Outlines do not resolve an extended type
declared in another file or module; its visibility uses the extension's source
modifier or the internal default.

Named operation bodies, `deinit` included, carry source ranges from their
declaration line and tokens for `groma lint`.
Lexically bound parameter and local variable names become numbered slots.
Operators, member names, argument labels, literals and unresolved names remain
distinct. Every parenthesis the source writes stays a token, so `(a + b) * c`
and `a + b * c` differ. Anonymous closures, property accessors and module initialization do
not carry comparable tokens.

In OKF, the result remains ordinary Code links and readable Markdown.
In C4, a parser is part of the scanner responsibility, not a new architecture
level. Core owns file membership, component identity and relationship meaning.

## Maintainer build and validation

Use Swift 6.3.3. macOS and Linux builds use its SwiftParser and SwiftSyntax host
libraries. macOS also uses Apple's linker and signing tools; Linux needs `ldd`
and `patchelf`. Windows installers omit parser development modules, so the
Windows build resolves the SwiftSyntax 603.0.2 commit pinned in `Package.swift`
and links its source into the worker through SwiftPM. This needs Git and network
access during packaging. Windows builds also use the toolchain's linker and
`llvm-readobj`, with the Windows SDK and Visual C++ build tools available on CI.

```sh
bun plugins/scanners/swift/build.ts /tmp/groma-scanner-swift
GROMA_TEST_SWIFT_PACKAGE=/tmp/groma-scanner-swift bun test test-bun/swift-scanner.test.ts
```

CI caches the test package by OS, CPU, toolchain and package inputs. An exact
match skips Swift setup and compilation; every repository check still runs.
Changed inputs rebuild the package. Release builds always compile it afresh.
For the same check locally, set `GROMA_TEST_SWIFT_PACKAGE` to the built package
when invoking `bun run check`. Each test copies it into its own temporary fixture.

The build records the exact compiler version in the package. macOS parser
libraries load from beside the worker. Linux packages include the required
Swift libraries and use relative library search paths. Windows packages contain
`worker.exe` and its required non-system DLLs. Runtime licenses and notices
are included beside the package license.

The release workflow builds Swift on the same five hosts as the other native
scanners. Each host runs the Swift evidence, outline, watch and installed-package
checks. Assembly retains every host's worker and runtime libraries in one npm
package; consumers select the executable for their operating system and CPU.

The [Firefox for iOS benchmark](validation.md) records the pinned real-project
evaluation. Automated tests use independent fixtures in `test/fixtures/`.
