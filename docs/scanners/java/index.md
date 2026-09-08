# Java scanner

The Java plugin uses Maven's effective project model and compile dependency
classpath, then the installed JDK's `JavacTask` and `Trees` compiler APIs. It
returns source inventory, declarations, source references and operation facts.
Core owns architecture placement, curated ownership and relationship selection.
Maven configuration is temporary evidence, not a new OKF record or C4 element.
The resulting architecture remains ordinary Markdown with exact source links.

The supported example is one root Maven module with Java 25 main sources, as
used by callforpapers. Maven 3.9.15 and JDK 25.0.1 were tested. Select the project
JDK through `JAVA_HOME` or PATH. The packaged worker is Java 21 bytecode, but
this does not claim source-project qualification for every release since 21.

## Install and prepare

Build locally, then install the package through Groma:

```sh
bun plugins/scanners/java/build.ts
# From the project to scan:
groma scanner add /absolute/path/to/plugins/scanners/java/dist/package
```

Use the project's Maven wrapper (`mvnw` or `mvnw.cmd`) when present. Otherwise,
install Maven and put `mvn` on PATH. Initialize the wrapper and resolve the
exporter plugins and project dependencies once with network access:

```sh
./mvnw --batch-mode --no-transfer-progress \
  org.apache.maven.plugins:maven-help-plugin:3.5.1:effective-pom \
  org.apache.maven.plugins:maven-dependency-plugin:3.9.0:build-classpath \
  -DincludeScope=compile
groma scan
```

On Windows use `.\mvnw.cmd` and enter the Maven arguments on one line. A project
without a wrapper uses `mvn` instead. Maven reads the project's `.mvn` settings,
parent POMs, active profiles and dependency management. No manual JAR list or
Groma-specific Java configuration is required. Normal scans run Maven offline;
Maven writes its temporary model and classpath outside the project. The wrapper
itself may bootstrap Maven if it has not been initialized. Build extensions and
wrapper scripts execute as normal project tooling.

The adapter's `checkJavaReadiness(repositoryRoot)` returns the Maven-derived
input, Java command and packaged worker path, or throws an actionable diagnostic.
Scanning reuses that result. This checks tooling and project inputs; successful
source attribution is established only when the scan completes. Shared guided
readiness presentation belongs to the scanner installation workflow.

## Evidence and limits

The effective POM supplies the main source directory, release, encoding, output
and generated-source directory. Maven resolves compile dependencies. The worker
analyzes authored main sources; existing generated annotation sources may supply
compiler context but are not added as architecture components. Annotation
processors and application code are not executed by the compiler worker.
Callforpapers scanned without generation or compilation preparation. A project
that needs generated types must prepare them through its documented build.

Static, private, final, explicit constructor and supported direct receiver calls
can name exact source implementations. Overridable receivers, external code and
generated implementations remain unresolved. Method references do not imply
invocation. Spring declarations do not prove injection or runtime collaborations.
The current core rule selects concrete callback bindings; this Java extractor
does not report those bindings, so ordinary Java calls do not create derived
architecture relationships. Authored interactions remain the way to express the
reviewed company-merge workflow.

Reactor builds, Gradle, JPMS module paths, test source sets, custom build-added
source roots, preview features and alternate compiler/toolchain selection are
outside this delivery. These limits are not claims about Java or Maven generally.
The scanner does not parse Java names or resolve dependencies itself.

## Package qualification

The package contains bundled ESM and a precompiled JAR, with no bundled JDK,
install script, Node requirement or platform-specific runtime payload. Consumers
supply Git, their project JDK and Maven or its wrapper.

Run the same consumer check on every release target with JDK 25 and Maven on PATH:

```sh
bun plugins/scanners/java/smoke.ts /absolute/path/to/compiled-groma /absolute/path/to/built-package
```

The check installs the built module, scans an independent Maven fixture, preserves
curated ownership through two scans, checks exported TypeScript Code details,
and proves a failed scan leaves the previous map unchanged. On Windows pass the compiled `groma.exe`; the adapter launches
`mvn.cmd` and `mvnw.cmd` through `cmd.exe`, including paths with spaces.

macOS arm64 passed locally. Linux x64/arm64 and Windows x64/arm64 consumer runs
remain release gates under TASK-326.7. A Windows command-construction test is
not a Windows execution result. No package has been published. See the
[validation record](validation.md).
