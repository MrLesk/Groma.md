# Java scanner prototype

**Status: opt-in research prototype, not a production release.** Tracked by TASK-324.
The scanner implements the existing Groma module contract. It inventories one
explicit Java compilation source set, resolves source symbols with `javac`, and
reports supported implementation calls while preserving unknown targets.

Read the [research and production plan](research.md) and [verification record](validation.md).
The implementation is in [`plugins/scanners/java`](../../../plugins/scanners/java/).

## What appears in Groma

Every selected source file receives one placement. Class, interface, enum,
record, annotation-type and nested declarations stay attached to their own file.
Packages and folders are evidence, not automatically curated C4 responsibilities.
This prototype uses one source-set scope; it does not claim that every Maven
module or Java package is an independently deployed container.

The worker returns temporary symbol-reference and operation evidence. **The
current core only derives concretely supplied named-callback interactions. This
prototype does not extract callback bindings, so its direct calls do not create
derived architecture relationship rows.** It deliberately does not change the
shared interpretation policy or invent `binding` fields to pass that policy.
Use normal Groma curation for authored architectural statements. A richer shared
rule and Java value-flow evidence need separate review before claiming an
automatic Spring application architecture mapper.

## Install and try the review build

There is no published Java scanner npm package from this work. The following
commands build the review package locally; building is a maintainer operation,
not something the installed scanner performs on a developer's project.
A build needs Bun 1.4.1 and JDK 21 with `javac`, `jar` and `jlink`.

```sh
# In this Groma checkout, on the review branch:
bun install --frozen-lockfile
bun plugins/scanners/java/build.ts --runtime
```

This stages a platform-specific package under
`plugins/scanners/java/dist/package`. Copying that directory to another machine
of the same supported OS/architecture preserves its self-contained runtime.
From an initialized Java repository:

```sh
groma scanner add /absolute/path/to/Groma.md/plugins/scanners/java/dist/package
groma scanner list
```

Create `groma-java.json` at the Java repository root:

```json
{
  "sourceRoots": ["src/main/java"],
  "release": 17,
  "classpath": [],
  "maxFiles": 5000
}
```

Then run:

```sh
groma scan
groma scan
groma web
```

An empty classpath works only when the selected files need no non-platform
binaries. Add each required JAR or compiled-classes directory as an explicit
classpath entry. Missing dependencies fail the scan; they are not silently
replaced with invented implementations. Source roots are repository-relative;
classpath entries may be repository-relative or absolute. Absolute paths are
useful for local Maven caches but are not portable configuration.

To test Groma's actual standalone executable and packaged runtime:

```sh
bun run build
bun scripts/smoke-java-scanner.ts dist/groma plugins/scanners/java/dist/package
```

The isolated-PATH smoke currently runs on Linux/macOS, not Windows. It retains
Git, which Groma still needs, but provides no external Java, Node, Bun, Maven or
Gradle executable. This proves package loading and scanning, not a published
npm-registry installation or a graphical browser review.

### Bring an existing JDK instead

```sh
bun plugins/scanners/java/build.ts
```

Without `--runtime`, the staged package contains the bundled ECMAScript adapter
and the precompiled worker JAR, but no Java runtime. The launcher searches in
this order: explicit test override, `GROMA_JAVA_HOME`, the package's bundled
runtime, `JAVA_HOME`, then `java` on PATH. Use a compiler-capable JDK 21 or newer,
not a JRE. For reproducible results, use the tested JDK version; accepting a
newer executable is not a certification of every newer JDK.

`GROMA_JAVA_HOME` is an explicit operator override even for a runtime-bundled
package. A broken explicit override fails rather than secretly picking another
Java installation. Scan/watch never downloads, installs, builds the worker,
runs package lifecycle scripts, or invokes a project build.

## Configuration and support boundary

`sourceRoots` selects **one compilation unit of work**: one language/API level,
one classpath, and mutually compatible source roots. Several source roots do not
mean support for an arbitrary multi-module reactor. Do not flatten modules with
different dependency versions or duplicate fully qualified class names into one
invocation. Main and test source sets should remain separate.

Only releases 8, 11, 17 and 21 are accepted. Compilation uses `--release`, not
only a syntax level; a Java 8 source set cannot accidentally bind to Java 21
platform APIs. Preview syntax, JPMS `module-info.java`, Android platform APIs,
Java 25 source level and non-Java JVM languages are outside this prototype.

Directory discovery is literal and recursive within the selected roots. It
rejects nested symlinks, source roots escaping the repository, unknown
configuration field names, newline-containing paths, and unsupported
module descriptors. It does not consult `.gitignore`, infer Maven profiles,
exclude generated/test directories automatically, or run code generators.
Overlapping roots are de-duplicated. Files explicitly selected from a generated
source directory are still inventory; only compiler-inserted synthetic trees
are suppressed. Unknown configuration *field names* are rejected; JSON itself
uses ordinary last-value behavior for repeated keys.

A missing manifest opts out. An explicitly configured empty source set, a missing
root, a compiler error, or a broken dependency fails without an observation.
This conservative empty-set policy means deleting the last Java source file
requires an explicit operator decision; it does not automatically delete old
architecture records.

Default limits are 5,000 selected files, a 1,024 MiB JVM heap, a 120-second worker
watchdog, and a 64 MiB captured-output bound. `maxFiles` can be set from 1 to
50,000. These are safety limits, not a claim that 50,000 files finish within the
time or memory bound. Exceeding a bound fails the whole scan, never selects the
first N files or manufactures a complete truncated graph. JVM heap is not peak
process RSS.

The adapter matches `.java`, `.jar`, and the manifest for Groma's watch loop.
Every rescan launches a fresh worker. Classpath changes outside the repository
and changes to Maven/Gradle settings are not watched by this prototype; refresh
the manifest/dependencies and run `groma scan` explicitly.

## Evidence semantics

Methods and explicit constructors with bodies, lambdas, class initializer
blocks and field initializers are operations. Abstract/native declarations and
compiler-inserted constructors, record accessors and implicit `super()` calls
are not fabricated as authored operations. Lambdas have separate caller
identities. A method reference is a deferred value, not an invocation.

Known targets require a source implementation plus a supported exact-dispatch
case: constructor, static/private/final method, method declared in a final
class, explicit `super` call, or a call directly on a non-anonymous `new` result.
Other virtual/interface calls retain empty targets and `unresolved: true`, even
when only one implementation is visible. External JAR/JDK methods likewise have
no source-owned operation target in this observation.

Used source symbols create temporary file references. An unused import does
not. References include type/member uses; they are not runtime communication.
No Spring/JPA wiring, service endpoints, reflection, lambda argument propagation,
method-reference invocation matching, or general points-to analysis is claimed.
Operation body tokens/ranges are omitted; Java does not yet contribute to the
core's duplicated-operation findings.

On any worker failure the adapter throws before core reconciliation. Existing
architecture stays intact, including authored descriptions and relationships.
A successful `complete: true` is scoped to this declared extraction, not a claim
that all runtime behavior has been found.
