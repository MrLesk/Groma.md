# Discover project scanners

Run discovery from a Git repository, before or after Groma initialization:

```sh
groma scanner discover
groma scanner discover --json
```

Discovery prints one page of its findings, recommendations, configured
scanners, and coverage limits, with `--max-count`, `--skip`, and `--count` as in
the other plain commands; `--json` stays complete.

Discovery reads project declarations, preserves their repository-relative
evidence paths, and matches rules from official plugin manifests and selected
installed third-party plugin manifests. It
does not install or execute plugins, run project builds, change scanner
selection, or write architecture. Rerun it after adding a nested application
to see the additional support needed alongside the existing selection.

## Supported declarations

Discovery reads tracked and unignored untracked files at every repository
depth. These rules are declared by the current official plugins:

| Declaration | Discovery evidence |
| --- | --- |
| `package.json` | `typescript`, `@angular/core`, `vue`, and `react` in dependency sections, with their declared version or range |
| `tsconfig.json` | TypeScript project configuration; it does not declare the compiler version |
| `pom.xml` | Maven project and literal `java.version`, `maven.compiler.release`, or `maven.compiler.source` values; `org.springframework.boot` is a framework clue |
| `build.gradle`, `build.gradle.kts` | Gradle build script and the first literal `JavaLanguageVersion.of(...)` or `JavaVersion.VERSION_...` value, when present; Java sources are not verified |
| `*.csproj` | C# project and literal `TargetFramework` or `TargetFrameworks` values |
| `pyproject.toml` | Python project configuration and literal `project.requires-python`, when present |
| `setup.py`, `setup.cfg`, `requirements.txt` | Python project or dependency declaration |
| `*.php` | PHP source; no Composer manifest is required |
| `*.swift` | Swift source; no package manifest is required |
| `*.js`, `*.mjs`, `*.cjs`, `*.jsx` | JavaScript source; no package manifest is required |
| `go.mod` | Go module and its `go` version directive |
| `Cargo.toml` | Cargo package or workspace, with a literal package `rust-version` when present |

A file-presence rule whose patterns are all extension globs, such as `*.php`
and `*.swift`, reports one line per technology with the number of matching
files and the first path:

```text
php	version unresolved	PHP source files: 21 files; first plugins/php/src/plugin.php
```

Every other rule prints one line per matching file for exact names such as
`tsconfig.json` or `setup.py`, and one per declaration for a parsed project
file such as `*.csproj` or `package.json`. The `--json` result always lists
every finding.

Dependency and generated directories are excluded by path segment:
`node_modules`, `vendor`, `target`, `dist`, `build`, `obj`, `.gradle`,
`.angular`, `coverage`, and `generated`. Git metadata and Groma architecture
directories are also excluded. A project deliberately placed under one of
these names is outside this discovery scope. In an initialized project, discovery
also honors the shared `exclude` patterns in Groma's `scanners.json`.

Discovery does not evaluate Maven/MSBuild properties, inherited settings,
profiles, Gradle scripts, or Cargo workspace inheritance. Literal XML tags
are lightweight clues, not an evaluated compiler project. Unresolved
versions remain visible in their finding rows. Malformed JSON/TOML declarations
and unsupported technologies produce separate coverage limits.
Installed project tooling provides semantic confirmation later. These rules
do not promise to identify every language or framework in a repository.

A framework dependency is not proof of runtime use. For example, finding
Spring Boot does not mean that the Java scanner understands Spring wiring.
Discovery reports that framework coverage separately.

## Official candidates and availability

Each plugin owns `groma.scanner.discovery` in its `package.json`: supported
technologies, detection rules, and optional release compatibility. Its package
name, version, and description use the standard manifest fields.

The official selection in
[`src/scanner/modules/official-catalog.ts`](../../src/scanner/modules/official-catalog.ts)
imports those manifests. The existing Groma build embeds their data; it does
not execute the optional plugins or contact a registry for discovery. Updating
an existing plugin's metadata and rebuilding Groma updates its recommendations.
Adding an official plugin requires adding its manifest to the selection.
There is no separately maintained technology detector or compatibility table.

Every detected official technology offers Install. Detection neither contacts npm
nor claims that a development manifest is a published release. Installation reads
published package metadata, chooses the newest stable release satisfying the
Groma API requirement and this computer's OS/CPU, then records the exact version.
Missing language versions, prereleases, version ranges, Go minimum directives and
.NET framework names do not disable installation. The scanner validates its
actual projects when it runs.

Third-party authors use the same [metadata contract](creating-a-plugin.md#discovery-metadata).
Users can add an unlisted package by name. Groma does not search for third-party
packages remotely; installed third-party metadata participates in project matching.
Settings suppress equivalent official recommendations when a selected plugin
covers those technologies. A plugin without discovery metadata remains runnable
and has unknown project matching.

The discovery result distinguishes:

- `configured`: keep the project's existing selection, even when its package is missing.
- `installable`: offer the recommended package; resolve its published version during installation.
- `incompatible`: an installed plugin requires a different Groma API version.
  Its code is not loaded; update Groma or explicitly change the plugin version.

Dependency findings retain declared and installed versions as diagnostic evidence.
They do not decide whether a language or framework can be scanned. Compiler and
project tooling own that decision.

One candidate covers all findings for its technology. The catalog currently
offers one official candidate per supported technology, so there is no ranking
or numerical confidence score. Existing configured scanners remain selected
even when no matching declaration is found. The JSON result exposes findings,
inventory, recommendations, and coverage limits for the installation workflow.

Angular is complementary to the TypeScript scanner even when both inspect the
same files. Angular's compiler compatibility and its own compatible TypeScript
tooling are separate from the TypeScript scanner's 7.1 SDK. Discovery proposes both scanners when applicable; it does not replace
TypeScript to avoid shared file coverage.

Vue and React add complementary framework evidence when TypeScript is also selected.
Their dependency declarations do not prove complete framework runtime analysis.

Discovery and scanner selection are operational configuration. They do not
create OKF concepts, C4 elements, or architecture boundaries. Ordinary Markdown
and OKF readers keep the same architecture records and links; Groma's scanner
module management owns interpretation of this discovery result.
