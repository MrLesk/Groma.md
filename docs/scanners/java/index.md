# Java scanner

The Java scanner carries its own Java compiler runtime and uses `JavacTask`
and `Trees` to read source. A fresh Maven or Gradle checkout needs no
installed JDK, Maven, Gradle, dependency cache, generated sources, or
application build.

From an initialized project:

```sh
groma scanner add @groma/scanner-java
groma scan
```

For local development, a maintainer with JDK 25 builds the package with
`bun plugins/scanners/java/build.ts`, then adds the resulting
`plugins/scanners/java/dist/package` directory to Groma. The package contains
bundled JavaScript, a precompiled worker JAR and a platform-specific compiler
runtime. The runtime includes its upstream license notices;
`THIRD-PARTY-NOTICES.txt` carries the license texts of the bundled npm
packages, including the MIT-licensed `good-enough-parser`.

## Source inputs

Tracked and unignored `pom.xml` files identify Maven projects. Each POM supplies
literal source settings and properties: main source directory, language release,
encoding and artifact name. Defaults are `src/main/java`, the bundled compiler's
language version and UTF-8. POM-only aggregators supply no source observation.

The scanner does not evaluate Maven, parent POMs, profiles, build plugins,
annotation processors or dependency declarations. It does not load project
JARs or generated outputs. Custom build-added roots are outside the supported
source loader. Unsupported language versions fail the scan; invalid syntax
fails it with every syntax error listed.

Missing external types do not fail the source scan. Their "cannot find symbol"
and "package does not exist" compiler errors form one
`JAVA_MISSING_EXTERNAL_TYPES` info diagnostic with the number of unresolved
references, an example location and the five most frequently missing packages.
In the `groma scan` report, that reference count is part of the message; the
`×N` diagnostic count for this code is 1. javac cannot tell a missing dependency
from any other unresolved name, so the count includes every unresolved name,
such as a typo. Other compiler errors are reported as warnings with their javac
code.

## Gradle projects

Tracked and unignored `build.gradle`, `build.gradle.kts`, `settings.gradle` and
`settings.gradle.kts` files identify Gradle projects. The scanner reads Groovy
and Kotlin scripts with the bundled `good-enough-parser` library. It never runs
Gradle, downloads a Gradle distribution or plugins, or executes build logic.

Every directory with a build or settings script is a project; a directory with
`pom.xml` is read as a Maven project instead. Literal `include` paths in a
settings script add projects at Gradle's default directories: `:libs:core` is
`libs/core` below the settings script. A literal `rootProject.name` names the
project beside the settings script; other projects use their directory name.

Each project's own build script supplies:

- Main Java source directories. `srcDir` and `srcDirs(...)` add to
  `src/main/java`; `srcDirs = [...]` and `setSrcDirs(...)` replace it. Literal
  values are strings, bracketed lists and `file`, `files`, `listOf` or `setOf`
  calls of strings. Without such a declaration, the project uses
  `src/main/java`.
- The Java language version, from `options.release`, else
  `sourceCompatibility`, else the toolchain `languageVersion`. Literal values
  are numbers, strings, `JavaVersion.VERSION_17` and
  `JavaLanguageVersion.of(17)`. Without one, the bundled compiler's version
  applies.

Gradle sources are read as UTF-8.

A declaration whose value only a Gradle run could resolve produces a
`JAVA_GRADLE_UNRESOLVED` warning with its script and line. Examples are
variables, project properties, version catalogs, string templates and computed
lists, and these declarations inside `subprojects`, `allprojects` or
`project(':path')` blocks. Settings that assign `projectDir` or `buildFileName`
also produce it, even with a literal value; those projects keep Gradle's default
directory and build script name. Literal values of the same declaration and
other literal declarations still apply: an adding declaration keeps
`src/main/java`, while a replacing `srcDirs = [...]` keeps only its literal
entries. A project left without Java sources supplies no observation, but its
warnings still reach the scan report. The scanner does not read convention
plugins, `buildSrc` logic, `gradle.properties` or declared source encodings.

## Source outline

Components list the declarations of their Java files under the
[shared outline contract](../creating-a-plugin.md#source-outline). The worker
parses each requested file with the bundled compiler's parser, as UTF-8 and
without a classpath or type resolution. A syntax error drops the declarations
that follow it, and a file the parser rejects at its first token, such as one
starting with a byte order mark or holding binary content, outlines nothing.

- Top-level classes, interfaces, enums, records and annotation types are
  types. Package declarations are transparent. Java has no top-level functions:
  a compact source file of top-level methods outlines as one `internal` type
  named after the file, at line 1, holding those methods.
- A type's members are the methods and constructors in its body: static,
  abstract, default and private interface methods, interface and annotation
  element signatures, and compact record constructors. Each overload is listed
  separately, and constructors are named after the type.
- Fields, initializer blocks, nested types, anonymous classes and enum
  constant bodies are not listed.

A line is the line of the declared name. Visibility follows the Java modifier:
`public`, `protected` or `private`. Without one, interface and annotation
members are `public`, a record's compact constructor takes the record's own
access, enum constructors are `private`, and other members and top-level types
are `internal` (package access).

A type is an entry when a Code link names it, such as `Orders`, the form the
scan uses for a file's only type. A member is an entry when a Code link names
it with its type, such as `Orders.place`.

## Evidence

The worker inventories authored main sources, declarations and operations.
Static, private, final, explicit constructor and supported direct receiver calls
can name exact local implementations. Calls affected by attribution errors,
unknown virtual dispatch or missing external code stay unresolved. Method
references do not imply invocation. Spring declarations do not prove dependency
injection or runtime collaborations.

The shared relationship rule selects concrete callback bindings. Ordinary Java
calls do not become architecture arrows. Core owns curated source membership
and relationship selection. Build settings and compiler facts are temporary
evidence, not new OKF records or C4 elements. Markdown readers retain ordinary
Code links and reviewed responsibilities.

Run `bun test test-bun/java-scanner.test.ts` with the maintainer JDK to test
local resolution and uncertainty. `bun test test-bun/java-gradle.test.ts` covers
Gradle project, source directory and version reading without a JDK. The packaged
fresh-checkout test runs with no JDK on PATH. See
[fresh-checkout validation](../fresh-checkout-validation.md).
