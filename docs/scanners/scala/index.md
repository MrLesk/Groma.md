# Scala scanner

The Scala scanner reads Scala 3.9 source with Scalameta and learns compile
directories from sbt 2 builds. A fresh checkout needs no installed JDK, sbt, or
application `compile`/`update`. The first model load may download the pinned
sbt 2 release into the Groma scanner cache.

From an initialized project:

```sh
groma scanner add @groma/scanner-scala
groma scan
```

For local development, a maintainer with sbt and a JDK builds the package with
`bun plugins/scanners/scala/build.ts`, then adds the resulting
`plugins/scanners/scala/dist/package` directory to groma.md. See
[validation on a real codebase](validation.md) for the full dev CLI and local
package workflow. The package
contains bundled JavaScript, the Scalameta worker JAR, the `gromaModel` sbt
plugin, the vendored sbt launcher, a platform JRE, and `ivy-local` metadata
for the plugin. `THIRD-PARTY-NOTICES.txt` lists bundled npm packages,
Scalameta, and the sbt launcher.

## Supported builds

The scanner supports **sbt 2** only. `project/build.properties` must declare
`sbt.version` on the 2.x line, or may omit `sbt.version` and rely on the
launcher default. sbt 1 builds produce `SCALA_SBT_UNSUPPORTED` and contribute
no source observation.

Each `build.sbt` among the scanner's files identifies one sbt build. The
scanner runs the bundled sbt launcher with a private global plugin that adds
the `gromaModel` command. That command evaluates project settings and prints
JSON: project id, name, base directory, `scalaVersion`, `Compile /
unmanagedSourceDirectories`, and whether managed compile sources exist. It does
not run `compile`, `update`, `test`, or `run`.

Only projects whose `scalaVersion` starts with `3.9` are scanned. Other
projects in the same build receive `SCALA_VERSION_UNSUPPORTED` and supply no
files. When managed compile source directories are present, the scanner adds
`SCALA_GENERATED_SOURCES_SKIPPED` and does not read generated paths.

The model JSON is cached under the Groma scanner cache, keyed by the build root
and a hash of build-definition files (`build.sbt`, `project/build.properties`,
`project/plugins.sbt`, and other `*.sbt` / `*.scala` files directly under
`project/`). Edits under `src/` do not invalidate the cache.

## Source inputs

The package declares the default
[include and exclude lists](../index.md#selecting-source-files). It includes
`**/*.scala`, `**/build.sbt`, `**/project/*.scala`, `**/project/*.sbt`, and
`**/project/build.properties`, and excludes `target/`, `project/target/`,
`.bloop/`, and `.metals/`.

Of its `.scala` files, the scanner reads only those under each kept project's
`Compile` unmanaged source directories (default `src/main/scala`, or a custom
`Compile / scalaSource`). Test trees such as `src/test/scala` are not read.

Multi-project builds produce one `sbt-build` root and one `sbt-project` root
per kept project. Nested build directories (each with its own `build.sbt`) are
scanned separately.

## Parse and call rules

The worker parses each selected file as Scala 3.9 with Scalameta. A parse error
on one file removes that file's symbols, operations, and calls and adds
`SCALA_SOURCE_INVALID` with the first error line; sibling files in the same
build are unchanged.

Same-file call resolution follows the shared scanner rules: a bare-name call
resolves only when the callee is a `def` or function value declared once in the
same file. Selections, duplicates, cross-file names, `apply`, infix, and
constructor calls stay unresolved.

## Source outline

`readCodeStructure` uses outline mode on named files. It does not load sbt and
always parses as Scala 3.9. See the
[shared outline contract](../creating-a-plugin.md#source-outline).

## Source file listing

`listSourceFiles` uses the same sbt model and the same keep rules as `scan`, and
returns candidates before exclusions. It does not parse Scala. A listing failure
does not fail a scan.

## Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SCALA_SBT_UNSUPPORTED` | warning | `sbt.version` is outside the supported sbt 2 line |
| `SCALA_VERSION_UNSUPPORTED` | warning | Project `scalaVersion` is not on the Scala 3.9 line |
| `SCALA_GENERATED_SOURCES_SKIPPED` | info | Managed compile sources are not read |
| `SCALA_SOURCE_INVALID` | warning | Scalameta could not parse a source file |
| `SCALA_SBT_FAILED` | (scan) | sbt model load failed; that build contributes no observation |

Readiness errors (`SCALA_WORKER_MISSING`, `SCALA_SBT_PLUGIN_MISSING`,
`SCALA_SBT_LAUNCHER_MISSING`, `SCALA_RUNTIME_MISSING`) appear when packaged
artifacts or the bundled JRE are absent.
