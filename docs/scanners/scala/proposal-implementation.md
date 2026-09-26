# Scala scanner implementation plan

This plan turns [proposal.md](proposal.md) into a build sequence. It is not
implemented behavior. The first version scans sbt 2 builds whose projects use
Scala 3.9. It loads each build once, parses `Compile` sources with a bundled
scalameta worker, and returns a `ScanObservation`. It does not compile the
application or resolve library dependencies.

Follow the Java scanner’s host and worker split in
[architecture.md](../java/architecture.md). Keep scanner output as temporary
evidence. sbt builds and projects are observation roots, not OKF documents and
not C4 elements.

Pin the exact sbt 2 release and the exact Scala 3.9 release in
`plugins/scanners/scala/versions.ts` on the day implementation starts. Every
maintainer build, fixture, and test reads those two constants. The rest of
this plan says “the pinned sbt 2” and “the pinned Scala 3.9”.

## What “done” means

A maintainer runs `bun plugins/scanners/scala/build.ts` and
`groma scanner add plugins/scanners/scala/dist/package` against a fixture that
has `build.sbt`, `project/build.properties`, and `src/main/scala`. `groma scan`
then shows:

- one `sbt-build` root and one `sbt-project` root per Scala 3.9 project
- top-level classes, traits, objects, enums, and package-level defs
- an outline whose visibility follows Scala 3 modifiers
- operations with syntactic body tokens
- a same-file call resolved only when the simple name is unique in that file
- tests, generated sources, Scala 2 projects, and sbt 1 builds left out, with
  the diagnostics the proposal names

`bun run check` passes, including the Scala suite below.

## Layout

```text
plugins/scanners/scala/
  versions.ts
  package.json
  build.ts
  src/index.ts
  src/adapter.ts
  src/process.ts
  src/model.ts
  src/cache.ts
  src/sbt.ts
  sbt/src/main/scala/md/groma/scanner/GromaPlugin.scala
  scala/src/main/scala/md/groma/scanner/
    Main.scala
    Parse.scala
    Symbols.scala
    Outline.scala
    Operations.scala
    Tokens.scala
    Calls.scala
    Json.scala
```

The host stays TypeScript and implements `ScannerPlugin`. The sbt plugin and
the parser worker are separate Scala 3.9 programs. They do not share a
classpath. Each prints JSON; the host owns observation assembly.

`projectScanner` runs once per directory that contains `build.sbt`. One
observation for that build already contains the build root and every Scala
3.9 project root. Subprojects are not separate `projectScanner` units, because
that would start sbt again for each of them.

## Model the host and sbt share

`gromaModel` prints one JSON object to stdout and nothing else. Diagnostics
from sbt stay on stderr.

```json
{
  "buildRoot": "/abs/path",
  "projects": [
    {
      "id": "api",
      "name": "api",
      "base": "/abs/path/api",
      "scalaVersion": "3.9.0",
      "unmanagedSourceDirectories": ["/abs/path/api/src/main/scala"],
      "hasManagedSources": false
    }
  ]
}
```

`id` is the sbt project id. `name` is the setting `name`. Paths are absolute.
`unmanagedSourceDirectories` is `Compile / unmanagedSourceDirectories`.
`hasManagedSources` is true when `Compile / managedSourceDirectories` is
non-empty.

The host then keeps a repository-relative `.scala` file when all of these
hold:

- the file is among the paths core passed in
- the file is under one unmanaged directory of a project whose `scalaVersion`
  starts with `3.9`
- the file’s directory is that project’s base, or nested under it

A project on any other Scala version adds `SCALA_VERSION_UNSUPPORTED` and
contributes no files. The rest of the build continues. A project with
`hasManagedSources` adds one info diagnostic,
`SCALA_GENERATED_SOURCES_SKIPPED`, and the host still does not read those
directories.

## Step 1 — Scaffold and pure model selection

Create the package and the file-selection function before any Scala compiler
or sbt launcher exists.

Actions:

1. Add `plugins/scanners/scala/package.json` with id `scala`, the include and
   exclude lists from the proposal, and a `file` discovery rule on
   `**/build.sbt`. Depend on `@groma/scanner`.
2. Add `versions.ts` with the pinned sbt and Scala versions.
3. Add `src/model.ts`:
   - parse the `gromaModel` JSON
   - find build roots as directories of `build.sbt` files in the core file list
   - a nested `build.sbt` is its own build; its files are not also members of
     the parent build
   - apply the keep rules above
   - read `project/build.properties` when that file is in the build’s file
     list; `sbt.version` outside `2.` yields `SCALA_SBT_UNSUPPORTED` and an
     empty project list for that build; a missing key is allowed
4. Add `src/process.ts` by copying the Java `execFile` helper’s contract:
   stdin, timeout, 64 MiB stdout buffer.
5. Add `src/index.ts` that exports a plugin whose `scan` accepts an injected
   model loader. The default loader is a function the later steps replace
   with sbt. Tests pass a fixture JSON loader so this step never starts sbt.

Done when `test-bun/scala-model.test.ts` passes with no JDK and no sbt.

## Step 2 — Parser worker

The worker is a Scala 3.9 program shaded into `worker.jar`. scalameta is the
only parse library, constructed with its Scala 3.9 dialect. There is no
dialect argument.

Invocation, matching the Java worker’s two modes:

```text
java -jar worker.jar scan <directory>
java -jar worker.jar outline <directory>
```

Stdin is one repository-relative path per line, resolved against the
directory. `scan` prints a partial observation: `files`, `operations`,
`invocations`, and parse diagnostics. The host adds `schemaVersion`,
`scanner`, `roots`, and the version diagnostics. `outline` prints
`[{ file, declarations }]` without `entry`; the host sets `entry` from Code
links, as `readJavaOutline` does.

Split the sources so each file stays under 500 lines:

| File | Responsibility |
| --- | --- |
| `Main.scala` | Arguments, stdin paths, encode stdout, exit 2 on an internal failure |
| `Parse.scala` | Parse one file; on failure return no tree and the first error line |
| `Symbols.scala` | Top-level symbols from a successful tree |
| `Outline.scala` | Outline declarations from the same tree |
| `Operations.scala` | Operations for named bodies |
| `Tokens.scala` | Syntactic slots for one body |
| `Calls.scala` | Same-file invocations |
| `Json.scala` | Encode the partial observation |

`build.ts` in this step only needs to assemble `worker.jar` and a `jlink`
runtime sufficient to run it. sbt packaging comes in step 4.

### Symbols

From each successfully parsed file, record top-level declarations only.
Packages and package objects are transparent: declarations directly inside
them are top-level. A declaration inside a class, trait, object, enum, or
method is nested and is not a file symbol.

| Tree | Symbol `kind` | `name` |
| --- | --- | --- |
| `class`, `case class`, `trait` | `class` or `trait` | simple name |
| `object` | `object` | simple name |
| `enum` | `enum` | simple name |
| package-level `def` | `def` | simple name |
| named package-level `given` | `def` | the given’s name |

Skip fields, `val`, `var`, type aliases, `export`, and anonymous givens.

### Outline

Use the same trees. Map them onto the shared outline contract:

| Scala | Outline |
| --- | --- |
| Package-level `def`, named `given`, and a function value assigned with `val name = ...` or `def` | `kind: function` |
| `class`, `case class`, `trait`, `object`, `enum` | `kind: type` |
| Methods in the type body, the primary constructor, and named givens in the body | `members` |
| Extension methods written directly in a type body | members of that type |
| Extension methods written at package level | top-level `function` entries, one per method |
| Enum cases, fields, type aliases, nested types | omitted |

The primary constructor’s member name is the type name. Secondary
constructors use `this`. Each overload is its own member. The line is the
line of the declared name, including a name that follows a parameter clause
or an annotation.

Visibility:

| Modifier | Outline |
| --- | --- |
| none | `public` |
| `private`, `private[this]` | `private` |
| `protected` | `protected` |
| `private[SomeName]` other than `this` | `internal` |
| `protected[SomeName]` | `protected` |

Code links match bare names. The host marks `entry` when the reference’s
symbols include that bare name. A type link does not mark its members.

### Operations and tokens

Create an operation for every `def`, secondary constructor, named `given`,
and function-valued `val` that has a body or an expression body, including
locals. The operation `name` is the simple name, qualified by the enclosing
type when there is one (`Orders.place`), so a later outline row can match the
suffix. `position` is the zero-based UTF-16 offset of the declaration start,
excluding leading trivia. `startLine` and `endLine` cover the whole
definition.

Leave tokens off:

- lambdas and anonymous function values
- anonymous givens
- `val` and `var` initializers that are not functions
- abstract methods and declarations without a body

Tokens walk the body in source order. A scope stack collects parameters and
names declared by `val`, `var`, and `def` in that body, in declaration order.
A name token becomes `$1`, `$2`, … where the innermost scope binds it.
Field names, method names, type names, imports, literals, operators, and
keywords stay as written. Optional-brace `end` markers stay as keywords.
Renaming a local changes nothing in the token list; renaming a field does.

### Calls

Resolve a call only when the callee is a bare name (`place(order)`, not
`orders.place(order)`), the name is a `def` or function value declared in the
same file, and that simple name occurs once in the file. Record the
invocation with `unresolved: false` and that operation as the only target.

Leave the call unresolved, with empty targets, when any of these hold:

- the callee is a selection (`receiver.method`)
- the simple name is declared more than once in the file
- the name is not declared in the file, even if another file in the project
  declares it once
- the call is `apply`, an infix operator call, a constructor, or an extension
  application

One parse error removes that file’s symbols, operations, and calls. The
worker adds `SCALA_SOURCE_INVALID` with the file and the first error line.
Sibling files in the same project are unchanged.

Done when `test-bun/scala-parser.test.ts` and
`test-bun/scala-outline.test.ts` pass. Those tests build `worker.jar` and
talk to it on stdin. They do not start sbt.

## Step 3 — Host scan over an injected model

Wire `scan`, `readCodeStructure`, and `listSourceFiles` to the worker while
the model still comes from the injected loader.

Actions:

1. `src/adapter.ts` resolves `dist/worker.jar` and the bundled JRE the same
   way the Java adapter resolves its runtime. `checkReadiness` checks those
   two files and does not start sbt.
2. `scan` loads the model, filters files, skips a build whose sbt version
   gate failed, runs the worker once per remaining build, then attaches:
   - scanner id `scala`, technology `scala`, engine `scalameta`, engine
     version from the scalameta package the worker was built with
   - root `{ id: "sbt-build", kind: "sbt-build", name, file: "build.sbt" }`
   - one `{ kind: "sbt-project", parent: "sbt-build" }` per kept project
   - file `roots` pointing at the project id
   - the version and generated-source diagnostics
3. Reuse `projectScanner`, `relocateObservation`, and `combineObservations`
   so two build directories in one repository become one observation.
4. `readCodeStructure` calls outline mode for the files the caller named. It
   does not load sbt. It always parses as Scala 3.9.
5. `listSourceFiles` uses the same model loader and the same keep rules, and
   returns candidates before exclusions. A loader failure throws. The listing
   does not parse Scala.

Done when the model and parser tests still pass, and a host test scans a
temporary copy of a fixture by injecting JSON that names a custom source
directory. That test proves the host, not sbt, drops `src/test/scala` and
keeps the custom directory.

## Step 4 — sbt plugin and launcher

Replace the injected loader with a real sbt run.

Actions:

1. `sbt/src/main/scala/md/groma/scanner/GromaPlugin.scala` is an sbt 2
   `AutoPlugin` that appends a command `gromaModel`. Confirm the command and
   `Project.extract` signatures against the pinned sbt 2 API before writing
   them. The command evaluates, for every project reference:
   - project id, `name`, `baseDirectory`
   - `scalaVersion`
   - `Compile / unmanagedSourceDirectories`
   - whether `Compile / managedSourceDirectories` is non-empty
   It prints the JSON document and returns the state unchanged. It does not
   call `compile`, `update`, `test`, or `run`.
2. Compile that plugin to `dist/groma-sbt.jar` with the pinned sbt 2 on the
   compile classpath.
3. Vendor the official `sbt-launch.jar` for that same sbt 2 release into
   `dist/`. The launcher is configured to that release only.
4. `src/sbt.ts` starts the bundled JRE:

   ```text
   java -jar sbt-launch.jar \
     -Dsbt.global.base=<scanner-owned base> \
     -Dsbt.boot.directory=<scanner boot cache> \
     --batch --supershell=false \
     gromaModel
   ```

   The global base contains one plugin file that adds `groma-sbt.jar` from
   its local path. It is not the user’s `~/.sbt`. The boot directory is under
   the Groma scanner cache. `settings.offline: true` passes sbt’s offline
   flag.
5. On a non-zero exit, throw `SCALA_SBT_FAILED` with the build directory and
   the first stderr line. That build contributes no observation. Another
   build in the same repository still scans.
6. `checkReadiness` also requires `sbt-launch.jar` and `groma-sbt.jar`. It
   still does not start sbt.

The first successful run may download the pinned sbt 2 into the boot cache
and will compile the meta-build under `project/target`. It does not write
application class files.

Done when a fixture with no extra plugins prints a model whose unmanaged
directory is `src/main/scala`, and a fixture that sets
`Compile / scalaSource` prints that directory instead.

## Step 5 — Cache

Cache the model JSON on disk under the Groma scanner cache, keyed by the
absolute build root plus a hash of the build-definition files.

Hash these when they are among the scanner’s files:

- `build.sbt`
- `project/build.properties`
- `project/plugins.sbt`
- every other `*.sbt` and `*.scala` file directly under `project/`

A change under `src/` does not change the key. `listSourceFiles` and `scan`
share the cache, so a scan after a listing does not start sbt again when the
definition is unchanged.

Done when a unit test changes a source file and sees a cache hit, then
changes `build.sbt` and sees a cache miss. The test can stub the loader; it
does not need a second real sbt run.

## Step 6 — Package, catalog, and the listing exception

`build.ts` writes `dist/package` with:

- bundled `src/index.js`
- `worker.jar`, `groma-sbt.jar`, `sbt-launch.jar`
- the platform JRE
- `package.json` whose scanner entry points at `./src/index.js`
- `LICENSE` and third-party notices for scalameta and the sbt launcher

Register the manifest in `src/scanner/modules/official-catalog.ts` only after
the suite below is green.

Update these docs in the same change:

- `docs/scanners/scala/index.md` — user-facing page: how to add the scanner,
  the sbt 2 and Scala 3.9 assumption, what a scan reports, and the diagnostics
- `docs/scanners/creating-a-plugin.md` — one listing-table row: the Scala
  scanner runs sbt to learn `Compile` directories and does not parse source
  in that listing
- `docs/scanners/discovery.md` — `build.sbt` row
- `docs/scanners/fresh-checkout-validation.md` — this scanner may fetch the
  pinned sbt 2 once; it still must not need a preinstalled JDK, a
  preinstalled sbt, or an application `update`
- `README.md` — Scala row pointing at the user page

## Test suite

Tests are `test.concurrent` under `bun:test`. Each test copies its fixture
into its own temp directory and deletes it afterward. Fixtures live in
`test/fixtures/` and are minimum sbt builds: the pinned `sbt.version`, the
pinned `scalaVersion`, and the smallest Scala 3.9 source that exhibits the
rule. They use ordinary names such as `shop` and `Orders`. They do not copy
this repository’s architecture.

Parser and outline tests build `worker.jar` and skip sbt. Model tests skip
both. Only `scala-sbt.test.ts` starts sbt, and it points
`sbt.boot.directory` at a shared CI cache so the pinned release downloads
once per machine.

### `test-bun/scala-model.test.ts`

No process spawn. Covers host selection, which is where sbt’s answers meet
Groma’s file list.

| Test | Fixture input | Proves |
| --- | --- | --- |
| Keeps `Compile` sources | Model dirs `src/main/scala`; candidates include main and test files | The test file is absent and the main file is kept |
| Honors a custom directory | Model dir `modules/api/scala` | That file is kept and `src/main/scala` is not assumed |
| Drops files outside the core list | Model lists a path the candidate list does not contain | The path is absent |
| Splits nested builds | `build.sbt` and `modules/extra/build.sbt` | Each build’s file set excludes the other |
| Rejects sbt 1 | `sbt.version=1.10.0` | `SCALA_SBT_UNSUPPORTED`, no projects |
| Allows a missing sbt version | `build.properties` without `sbt.version` | Selection continues |
| Skips a non-3.9 project | One project `3.9`, one `2.13` | Only the 3.9 project’s files remain, plus `SCALA_VERSION_UNSUPPORTED` |
| Reports generated sources | `hasManagedSources: true` | `SCALA_GENERATED_SOURCES_SKIPPED`, and no managed path is kept |
| Cache key | Hash helper | A `src` edit keeps the key; a `build.sbt` edit changes it |

### `test-bun/scala-parser.test.ts`

Worker `scan` mode. Fixture `test/fixtures/scala-parse`: one directory of
`.scala` files, no `build.sbt`. The test passes the file list on stdin.

| Test | Scala-specific rule |
| --- | --- |
| Top-level inventory | A file with `package`, `class`, `trait`, `object`, `enum`, `case class`, and a package-level `def` yields those symbols and no field or nested class |
| Package object | Declarations inside `package object shop` are top-level symbols |
| Significant indentation | A class written with `:` and `end Orders` still yields `Orders` and its method |
| Operations | A method, a secondary `def this`, a named `given`, and `val run = (n: Int) => n` are operations; a lambda that is an argument, an anonymous `given`, and `val n = 1` are not |
| Tokens | Two methods that differ only by a parameter name produce the same tokens; the same methods differing by a field name do not |
| Same-file call | `place` calls `price` once in the file; the invocation targets `price` and `unresolved` is false |
| Duplicate name | Two `def price` in one file; a call to `price` is unresolved |
| Selection | `order.price()` is unresolved even though `def price` exists in the file |
| Other file | `api/Calls.scala` calls `price`, and `api/Pricing.scala` is the only `price`; the call stays unresolved |
| `apply` and infix | `Box(1)` and `n + 1` stay unresolved |
| Extension | A package-level `extension (s: String) def quoted` is a top-level `def` symbol and an operation; a call written as `"a".quoted` stays unresolved |
| Parse error | `Broken.scala` has a syntax error and `Ok.scala` does not; `Broken` has no symbols, `Ok` does, and one `SCALA_SOURCE_INVALID` names `Broken.scala` |
| Stable output | Two scans of the same stdin are deep-equal |

### `test-bun/scala-outline.test.ts`

Worker `outline` mode, then the host’s `entry` marking. One fixture,
`test/fixtures/scala-outline`, held as source files the outline command
reads directly.

Assert the declaration tree for one file that contains:

- a public `class Orders` with a public method, a `private` method, a
  `protected` method, and a `private[shop]` method
- a `case class Receipt` whose primary constructor uses the type’s access
  and whose secondary constructor is `this`
- an `enum Status` with a method and a case; the case is absent
- a package-level `def ship` and a package-level extension method
- a `class` nested inside `Orders`; it is absent
- a `val total` and a `type Id`; both are absent

A second assertion checks `entry`: a symbol list of `Orders` and `place`
marks the type and that member, and does not mark the other members. The
member is matched by the bare name `place`.

A third assertion runs through `readCodeStructure` on a tiny git fixture
with a Code link, the same way `java-outline.test.ts` loads an annotated
architecture, so the outline the map reads is the host’s result and not only
the worker JSON.

### `test-bun/scala-sbt.test.ts`

These tests start the pinned sbt 2. Keep the file small.

| Test | Fixture | Proves |
| --- | --- | --- |
| Single project | `scala-sbt-single`: default `src/main/scala`, one class that calls a same-file def | Roots are the build and that project; the test file under `src/test/scala` is absent; the call is resolved |
| Multi-project | `scala-sbt-multi`: root build and `api` / `worker` projects | Two `sbt-project` roots share the build parent; a file from each project is present |
| Custom source root | `Compile / scalaSource := baseDirectory.value / "modules"` | The file under `modules/` is in the observation |
| Version gate | Second project sets `scalaVersion := "2.13.15"` | That project’s file is absent and `SCALA_VERSION_UNSUPPORTED` is present |
| sbt 1 gate | `sbt.version=1.10.0` | The scan throws or returns no observation for that build, with `SCALA_SBT_UNSUPPORTED`, and does not require the sbt 1 launcher to succeed |
| Listing matches scan | Same fixture as the single project | `listSourceFiles` returns the `.scala` file the scan keeps, including one the default `src/main/scala` convention would miss when the custom-root fixture is used |
| Second build survives | A temp repo with a valid build and a second build whose `build.sbt` is not valid sbt | The valid build still contributes symbols; the broken build does not |

The sbt 1 case must fail in the host’s `build.properties` gate before the
launcher runs. Assert that by checking the error code and by using a model
loader spy in the unit test. The sbt integration test only needs to show the
plugin’s `scan` takes that path.

### What this suite deliberately skips

HTTP frameworks, Scala 2 syntax, sbt 1 builds, Gradle, Maven, Mill,
scala-cli, compiler attribution, and cross-file resolution. Those are later
versions in the proposal. A test for them would freeze behavior this version
does not have.

## Implementation order

1. Step 1 and `scala-model.test.ts`.
2. Step 2, `scala-parser.test.ts`, and `scala-outline.test.ts`.
3. Step 3 host wiring against the injected model.
4. Step 4 sbt plugin, then `scala-sbt.test.ts`.
5. Step 5 cache test inside `scala-model.test.ts`.
6. Step 6 packaging, catalog, and docs.
7. `bun run check`.

Steps 1 through 3 need a JDK only when the worker is compiled. They do not
need a network fetch. Step 4 is the first step that downloads sbt.

## Later versions

Leave these out of the steps above. Each one needs its own fixtures after a
3.9 sbt build has been scanned in real use.

1. Bundle the Scala 3.9 compiler, attribute with an empty library classpath,
   and tighten tokens and cross-file calls.
2. HTTP facts for http4s, Play routes, and tapir.
3. Gradle and Maven Scala builds. sbt 1 and other Scala versions stay behind
   the same evidence.

## Related documentation

- [Scala scanner proposal](proposal.md)
- [Java scanner architecture](../java/architecture.md)
- [Creating a scanner plugin](../creating-a-plugin.md)
- [Scanner evidence](../evidence.md)
