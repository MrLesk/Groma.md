# Publish official scanners

Official scanners and the author contract remain in this repository. The shared
release workflow stages runnable packages, publishes them to npm, and then
builds Groma with the exact published discovery metadata. The package manifests
own names, versions, detection rules and Groma API requirements. Changed packages require new
versions; npm versions cannot be replaced. The workflow reuses exact versions
already published and publishes only missing versions. Bump every package whose
contents changed before starting a release.

Repository validation and the five platform scanner builds start together.
Each platform builds its independent scanners concurrently. Scanner publication
waits for validation and every platform build to succeed. The contract publishes
first, then the scanner packages publish concurrently. C# publishes its platform
runtime packages before its adapter. Each concurrent group
finishes all started work before reporting any failures or advancing.

Groma builds then run in parallel across the five platforms, after scanner
publication makes their exact metadata available from npm. Release downloads and
platform npm packages publish in parallel after those builds. The main npm
wrapper waits for every platform package; the version update on main waits for
both the wrapper and release downloads.

Prepare a draft GitHub release and review its version, target commit and changelog
with the maintainer before publishing it. Publishing the GitHub release starts
the shared workflow for both scanner packages and the main Groma CLI.
To release changed scanners without a new Groma version, run the same workflow
manually with `publish_scanners` enabled. Leave it disabled for a build-only run.

The author contract is `@groma/scanner`. Official packages use
`@groma/scanner-<id>`; the main CLI remains `groma.md`. Initial scanner versions
are `0.1.0` and require Groma `^0.3.0`. The manifests own
`groma.scanner.discovery.compatibility`; verify it against the supported examples
before each release. Keep package versions coordinated with `@groma/scanner`
where it is a runtime dependency.

Language-version declarations do not restrict installation. Plugins validate
source inputs using their bundled analysis tools. Consumers do not prepare
project dependencies or install a language SDK.
Record the compiler versions exercised by release examples as validation evidence,
not as exact language-version requirements in discovery metadata.

The scanner build targets are macOS arm64, Linux x64 and arm64, and Windows x64
and arm64. Building an artifact and manually exercising it are separate claims:
record each explicitly.
Go, Rust and TypeScript packages include native workers. Java includes a
compiler runtime built with `jlink`; C# installs a host-specific self-contained
.NET runtime through an exact optional dependency.
Those assets are assembled per platform. Python includes CPython and its
standard library through Pyodide WebAssembly assets. Framework packages carry
their compiler libraries and TypeScript declarations. PHP bundles a JavaScript
parser and does not need a PHP runtime. Official packages scan supported
fresh checkouts without project dependencies or language tools on PATH.

For a local host build with Java, Go, Rust and .NET available:

```sh
bun install --frozen-lockfile --ignore-scripts
dotnet restore plugins/scanners/csharp/dotnet/Groma.CSharpScanner.csproj --locked-mode
bun scripts/scanner-release.ts stage /tmp/scanner-packages
```

This stages the contract and nine scanner packages without publishing them.
Maintainer builds may download scanner build dependencies and runtime packs.
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
request approval in the browser. Then configure trusted publishing once for each package with npm 11.15.0 or later:

```sh
npm trust github @groma/scanner --repository MrLesk/Groma.md --file release.yml --allow-publish
```

Repeat the command with each `@groma/scanner-<id>` name and each
`@groma/scanner-csharp-<platform>-<architecture>` runtime package. The package must already
exist, and npm requests two-factor approval for the trust change. Later GitHub
releases use the same workflow and publish automatically.
Do not put credentials or two-factor codes in repository files.

```sh
bun scripts/scanner-release.ts publish /tmp/scanner-release
```

The command refuses private or incomplete scanner release metadata. It publishes
the contract first, followed by the scanners concurrently. After successful publication,
the workflow installs their metadata into the build checkout before compiling:

```sh
bun scripts/scanner-release.ts catalog /tmp/scanner-release
bun run build
```

The catalog command reads each exact version back from npm and fails if it is
not published. It embeds those published detection rules into the build checkout.
At installation time, Groma resolves a suitable release from npm again; it never
uses a development manifest version as proof of availability. Publishing
never silently changes an existing project's recorded scanner selection.

A newly accepted npm upload may take time to appear in registry reads. If the
catalog step reports a missing version immediately after successful publication,
confirm that exact version is visible with `npm view <package>@<version> version`,
then rerun the failed workflow jobs. Keep the existing release and package versions.

Record exact public package versions, built targets, manually exercised targets,
and the fresh-install and second-checkout restore results in the release task.
The existing Java/Angular/TypeScript acceptance project is `../callforpapers`;
use a disposable source-only copy and record its revision and scanner versions.
Each release host runs the packaged fresh-checkout suite before uploading:

```sh
GROMA_TEST_PACKAGES=/tmp/scanner-packages bun test --timeout 60000 test-bun/scanner-fresh-checkout.test.ts
```

The suite relocates each package. For C#, it packs and installs the adapter and
host runtime as separate tarballs and checks their upload sizes. It scans an independent fixture with an empty
home and only Git on PATH, checks useful local facts, repeats the scan and
compares source bytes. The JavaScript harness rejects network fetches.
This is evidence for the exercised host, not a claim of testing every target.
See [fresh-checkout validation](fresh-checkout-validation.md).
