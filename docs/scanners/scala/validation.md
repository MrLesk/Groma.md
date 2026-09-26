# Scala scanner validation on a real codebase

Use your **groma.md checkout** as the dev CLI and the **packaged** Scala scanner
at `plugins/scanners/scala/dist/package` against a real sbt application—not this
repository’s TypeScript tree.

## What you are wiring up

Two pieces:

1. **Dev Groma** — CLI from the groma.md repo (`bun src/cli.ts` or built
   `./dist/groma`).
2. **Packaged Scala scanner** — not the raw `plugins/scanners/scala` workspace
   folder; the runnable tree at `plugins/scanners/scala/dist/package` (worker JAR,
   `gromaModel` sbt plugin, sbt launcher, bundled JRE). See
   [index.md](index.md) and [proposal-implementation.md](proposal-implementation.md).

The target codebase does **not** need a system JDK or sbt for scanning; the
scanner bundles those. Your **machine** needs JDK and sbt only to **build** the
scanner package once (or after Scala plugin changes).

## 1. Prepare the dev CLI (groma.md repo)

From the groma.md repository root:

```sh
bun install
```

Use whichever dev entry you set up:

```sh
# Source mode (typical dev)
alias groma-dev='bun /path/to/groma.md/src/cli.ts'

# Or compiled binary (closer to release)
bun run build
/path/to/groma.md/dist/groma --version
```

Use `groma-dev` (or `./dist/groma`) everywhere below instead of a globally
installed `groma`.

## 2. Build the Scala scanner package (maintainer step)

On your branch, with **JDK** and **sbt** available (`JAVA_HOME` / `SBT_HOME` if
needed):

```sh
cd /path/to/groma.md
bun plugins/scanners/scala/build.ts
```

That should print a path ending in `plugins/scanners/scala/dist/package`. After
**TypeScript-only** scanner changes, a lighter rebuild may suffice on your
branch; if `scanner check` reports missing JARs or runtime, rerun the full
`build.ts`.

Optional sanity in groma.md:

```sh
bun test test-bun/scala-*.test.ts
```

Or run `bun run check` for the full repository gate.

## 3. Pick the real Scala project

The scanner only fully observes builds that match [index.md](index.md):

| Requirement | Effect if wrong |
| --- | --- |
| **sbt 2** (`project/build.properties` → `sbt.version=2.x`, or launcher default on 2.x) | `SCALA_SBT_UNSUPPORTED`, no Scala observation |
| **`scalaVersion` on 3.9.x** per kept project | `SCALA_VERSION_UNSUPPORTED`, that subproject skipped |
| Sources under **Compile unmanaged** dirs (usually `src/main/scala`) | Test trees and generated managed dirs are not read |

Quick preflight without Groma:

```sh
cd /path/to/your-scala-app
cat project/build.properties
```

Confirm sbt 2 and Scala 3.9.x in `build.sbt` or project settings.

The groma.md repo itself is not a good application target: application Scala
lives in fixtures such as `test/fixtures/scala-sbt-single/` and under
`plugins/scanners/scala/{worker,sbt}/`. Use an external repo, or copy a fixture
to a temp directory for a controlled smoke test.

## 4. Initialize Groma in the target repo

In the Scala project root (where `.git` and `build.sbt` live):

```sh
cd /path/to/your-scala-app
groma-dev init 'My Scala service' --directory groma
```

Use `--directory .groma` if you prefer a hidden layout.

Discovery (optional):

```sh
groma-dev scanner discover --json
```

## 5. Add the local Scala scanner (not npm)

Use an **absolute** path to the packaged scanner (local paths are supported for
dev; see [setup.md](../setup.md)):

```sh
groma-dev scanner add /path/to/groma.md/plugins/scanners/scala/dist/package
```

That writes `groma/scanners.json` (or `.groma/scanners.json`) with a local
source. Add other scanners only if that repo also needs them.

Verify before scan:

```sh
groma-dev scanner list
groma-dev scanner check
```

Readiness errors such as `SCALA_WORKER_MISSING`, `SCALA_SBT_LAUNCHER_MISSING`,
or `SCALA_RUNTIME_MISSING` mean the package build was incomplete or you pointed
at the workspace root instead of `dist/package`.

## 6. Run the scan and inspect results

```sh
groma-dev scan
groma-dev view --plain
groma-dev view src/main/scala/SomeFile.scala
groma-dev web
```

Expect roughly:

- One **sbt-build** root per directory with its own `build.sbt`
- One **sbt-project** root per kept Scala 3.9 module
- Symbols, outlines, operations, and same-file calls per the shared scanner
  rules

**First scan** on a machine may download the pinned sbt 2 release into Groma’s
scanner cache (network). The sbt model is **cached** from build-definition
files; edits under `src/` alone do not invalidate it. Change `build.sbt` or
`project/*`, or clear the cache, when iterating on source roots.

Watch diagnostics (table in [index.md](index.md)): `SCALA_SBT_FAILED`,
`SCALA_SOURCE_INVALID`, version and sbt warnings, and so on.

## 7. Iteration loop

| Change | What to do |
| --- | --- |
| Scala **host** TypeScript in `plugins/scanners/scala/src/` | Rebuild package (`build.ts` or partial step), then `groma-dev scan` (same local path in `scanners.json`) |
| **Worker / sbt plugin** Scala | Full `bun plugins/scanners/scala/build.ts` |
| **Groma core** CLI | Rescan with updated `groma-dev` or rebuilt `dist/groma` |
| Wrong roots / missing modules | Fix `scalaVersion`, sbt version, or `Compile / scalaSource`; rescan after build-def changes |

For a stable team setup you can commit a **relative** path in `scanners.json`
to a vendored copy of `dist/package` inside the Scala repo; for solo dev, an
absolute path to your groma checkout is fine.

## 8. Suggested acceptance checklist on the real repo

1. `scanner check` → `scala` **ready**
2. `scan` completes without `SCALA_SBT_FAILED` for your main module(s)
3. Component count and file list match what you expect from `src/main/scala`
   (not `src/test`)
4. Spot-check a few types and a known same-file call with `groma-dev view`
5. Optional: `groma-dev scan --watch`, edit a `.scala` file, confirm the map
   updates
