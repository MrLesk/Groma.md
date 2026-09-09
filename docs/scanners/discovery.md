# Discover project scanners

Run discovery from a Git repository, before or after Groma initialization:

```sh
groma scanner discover
groma scanner discover --json
```

Discovery reads project declarations, preserves their repository-relative
evidence paths, and compares them with Groma's official scanner catalog. It
does not install or execute plugins, run project builds, change scanner
selection, or write architecture. Rerun it after adding a nested application
to see the additional support needed alongside the existing selection.

## Supported declarations

Discovery reads tracked and unignored untracked files at every repository
depth. These rules are deliberately limited:

| Declaration | Discovery evidence |
| --- | --- |
| `package.json` | `typescript`, `@angular/core`, `vue`, and `react` in dependency sections, with their declared version or range |
| `tsconfig.json` | TypeScript project configuration; it does not declare the compiler version |
| `pom.xml` | Maven project and literal `java.version`, `maven.compiler.release`, or `maven.compiler.source` values; `org.springframework.boot` is a framework clue |
| `*.csproj` | C# project and literal `TargetFramework` or `TargetFrameworks` values |
| `go.mod` | Go module and its `go` version directive |
| `Cargo.toml` | Cargo package or workspace, with a literal package `rust-version` when present |

Dependency and generated directories are excluded by path segment:
`node_modules`, `vendor`, `target`, `dist`, `build`, `bin`, `obj`, `.gradle`,
`.angular`, `coverage`, and `generated`. Git metadata and Groma architecture
directories are also excluded. A project deliberately placed under one of
these names is outside this discovery scope.

Discovery does not evaluate Maven/MSBuild properties, inherited settings,
profiles, Gradle scripts, or Cargo workspace inheritance. Literal XML tags
are lightweight clues, not an evaluated compiler project. Unresolved
versions and malformed JSON/TOML declarations remain coverage limits.
Installed project tooling provides semantic confirmation later. These rules
do not promise to identify every language or framework in a repository.

A framework dependency is not proof of runtime use. For example, finding
Spring Boot does not mean that the Java scanner understands Spring wiring.
Discovery reports that framework coverage separately.

## Official candidates and availability

The maintained catalog in
[`src/scanner/modules/catalog.ts`](../../src/scanner/modules/catalog.ts)
contains TypeScript, Java, Angular, Vue, React, C#, Go, and Rust. Optional packages without
a verified release have no install source or invented package version.
Their `unavailable` state means they are relevant candidates, not ready for
installation. Release work must supply the exact published version, Groma
version range, and verified technology support before an installation can be
offered.

The result distinguishes:

- `embedded`: retained TypeScript support shipped with Groma.
- `configured`: existing selection retained, including missing packages.
  Availability comes from the scanner inventory; it does not verify tooling
  or compatibility of a local package.
- `installable`: a catalogued release matches Groma and all confirmed
  technology versions. `installSource` holds the exact package/version.
- `unavailable`: no verified release is catalogued.
- `incompatible`: Groma or a declared technology version is outside the
  release's support range.
- `uncertain`: a release exists, but version compatibility cannot be established
  from an exact declaration or an installed package. Unresolved ranges,
  expressions, or missing versions need project-tooling confirmation.

For Angular, Vue, React, and TypeScript dependencies, discovery also resolves the installed
package manifest using normal package resolution from the declaring application.
It reads the installed version without executing package code, preserves the
original declared range, and records the package manifest as version evidence.
An installed version must match both the declaration and the catalog's support
range. An absent dependency remains unresolved; discovery does not install it.

One candidate covers all findings for its technology. The catalog currently
offers one official candidate per supported technology, so there is no ranking
or numerical confidence score. Existing configured scanners remain selected
even when no matching declaration is found. The JSON result exposes findings,
inventory, recommendations, and coverage limits for the installation workflow.

Angular is complementary to embedded TypeScript even when both inspect the
same files. Angular's compiler compatibility and its own compatible TypeScript
tooling are separate from Groma's embedded TypeScript 7.1 SDK. Discovery retains
TypeScript and proposes the separate Angular candidate; it does not replace
TypeScript to avoid shared file coverage.

Vue and React also add complementary framework evidence while embedded
TypeScript stays enabled. Their dependency declarations do not prove complete
framework runtime analysis. The catalog's `@groma/scanner-vue` and
`@groma/scanner-react` names are unpublished placeholders until the public
namespace, exact release versions, and supported versions are verified.

Discovery and scanner selection are operational configuration. They do not
create OKF concepts, C4 elements, or architecture boundaries. Ordinary Markdown
and OKF readers keep the same architecture records and links; Groma's scanner
module management owns interpretation of this discovery result.
