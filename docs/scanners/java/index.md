# Java scanner

The Java scanner carries its own Java compiler runtime and uses `JavacTask`
and `Trees` to read source. A fresh Maven checkout needs no installed JDK,
Maven, dependency cache, generated sources, or application build.

From an initialized project:

```sh
groma scanner add @groma/scanner-java
groma scan
```

For local development, a maintainer with JDK 25 builds the package with
`bun plugins/scanners/java/build.ts`, then adds the resulting
`plugins/scanners/java/dist/package` directory to Groma. The package contains
bundled JavaScript, a precompiled worker JAR and a platform-specific compiler
runtime. The runtime includes its upstream license notices.

## Source inputs

Tracked and unignored `pom.xml` files identify projects. Each POM supplies
literal source settings and properties: main source directory, language release,
encoding and artifact name. Defaults are `src/main/java`, the bundled compiler's
language version and UTF-8. POM-only aggregators supply no source observation.

The scanner does not evaluate Maven, parent POMs, profiles, build plugins,
annotation processors or dependency declarations. It does not load project
JARs or generated outputs. Custom build-added roots and Gradle are outside the
supported source loader. Unsupported language versions and invalid syntax fail
with a diagnostic; missing external types do not fail the source scan.

## Evidence

The worker inventories authored main sources, declarations and operations.
Static, private, final, explicit constructor and supported direct receiver calls
can name exact local implementations. Calls affected by attribution errors,
unknown virtual dispatch or missing external code stay unresolved. Method
references do not imply invocation. Spring declarations do not prove dependency
injection or runtime collaborations.

The shared relationship rule selects concrete callback bindings. Ordinary Java
calls do not become architecture arrows. Core owns curated source membership
and relationship selection. POM settings and compiler facts are temporary
evidence, not new OKF records or C4 elements. Markdown readers retain ordinary
Code links and reviewed responsibilities.

Run `bun test test-bun/java-scanner.test.ts` with the maintainer JDK to test
local resolution and uncertainty. The packaged fresh-checkout test runs with
no JDK on PATH. See [fresh-checkout validation](../fresh-checkout-validation.md).
