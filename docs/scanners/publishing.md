# Publish official scanners

Official scanners and the author contract remain in this repository. The shared
release workflow stages runnable packages, publishes them to npm, and then
builds Groma with the exact published discovery metadata. The package manifests
own names, versions and technology compatibility. Changed packages require new
versions; npm versions cannot be replaced. The workflow reuses exact versions
already published and publishes only missing versions. Bump every package whose
contents changed before starting a release.

The author contract is `@groma/scanner`. Official packages use
`@groma/scanner-<id>`; the main CLI remains `groma.md`. Initial scanner versions
are `0.1.0` and require Groma `^0.3.0`. The manifests own
`groma.scanner.discovery.compatibility`; verify it against the supported examples
before each release. Keep package versions coordinated with `@groma/scanner`
where it is a runtime dependency.

Initial recommendation metadata lists the exact technology versions exercised
by the supported examples. It does not claim all versions between them work.
Rust and C# have no automatic version match in this release: the approved Rust
example has no `rust-version`, and C# discovery returns MSBuild framework labels,
not numeric compiler versions. Their candidates remain uncertain; an explicit
`groma scanner add @groma/scanner-rust@0.1.0` or
`groma scanner add @groma/scanner-csharp@0.1.0` uses the normal installation path.
Readiness checks still require the project tools documented by each scanner.

The scanner build targets are macOS arm64, Linux x64 and arm64, and Windows x64
and arm64. Building an artifact and manually exercising it are separate claims:
record each explicitly.
Go, Rust and TypeScript packages include workers in platform-specific directories. Java and
C# packages include their portable workers and require the documented project
JDK or .NET tools. Framework packages carry their compiler dependencies.

For a local host build with Java, Go, Rust and .NET available:

```sh
bun install --frozen-lockfile --ignore-scripts
dotnet restore plugins/scanners/csharp/dotnet/Groma.CSharpScanner.csproj --locked-mode
bun scripts/scanner-release.ts stage /tmp/scanner-packages
```

This stages the contract and eight scanner packages without contacting npm.
Use these folders with `groma scanner add` for focused local validation. For a
multi-platform release, collect the staged host directories, then assemble them:

```sh
bun scripts/scanner-release.ts assemble /tmp/scanner-host-artifacts /tmp/scanner-release
```

Publication is a separate, explicit operation using the maintainer's npm login
or the existing GitHub trusted publisher. Configure package publishing access
for `MrLesk/Groma.md`, workflow `release.yml`, before using CI publication.
For the first publication, run the Release workflow manually from the prepared
source branch. A manual run validates the repository and builds scanner artifacts
for all five targets; it does not publish. Download its `scanner-packages-*`
artifacts, assemble them, and publish with the maintainer's npm login. npm may
request approval in the browser. Then configure trusted publishing for each
package. Later GitHub releases use the same workflow and publish automatically.
Do not put credentials or two-factor codes in repository files.

```sh
bun scripts/scanner-release.ts publish /tmp/scanner-release
```

The command refuses private or incomplete scanner release metadata. It publishes
the contract first, followed by the scanners. After successful publication,
the workflow installs their metadata into the build checkout before compiling:

```sh
bun scripts/scanner-release.ts catalog /tmp/scanner-release
bun run build
```

The catalog command is a build-checkout operation, not evidence of publication.
Do not run it to advertise packages which have not been published. Publishing
never silently changes an existing project's recorded scanner selection.

Record exact public package versions, built targets, manually exercised targets,
and the fresh-install and second-checkout restore results in the release task.
The existing Java/Angular/TypeScript acceptance project is `../callforpapers`;
use a disposable prepared copy and record its revision and tool versions.
No automated package qualification or install-sanity suite is required.
