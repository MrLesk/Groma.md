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

## HTTP endpoints and requests

The scanner reports the [HTTP facts](../evidence.md#http-endpoints-and-requests)
that core joins into derived relationships. It reads annotations and client calls
from source, because project dependencies are never loaded.

Endpoints, from classes only:

- Spring MVC and WebFlux annotated controllers: `@RestController` or
  `@Controller` with `@GetMapping`, `@PostMapping`, `@PutMapping`,
  `@DeleteMapping`, `@PatchMapping`, or `@RequestMapping` with `method =`,
  under the class-level `@RequestMapping` prefix. A mapping without a method
  serves every method.
- JAX-RS resources: `@Path` on the class with `@GET`, `@POST`, `@PUT`,
  `@DELETE`, `@PATCH`, `@HEAD` or `@OPTIONS` on a method, under the class path
  and the method's own `@Path`.

Requests:

- declarative clients: a `@FeignClient` interface, with its `path` and `url`
  attributes, and a Spring HTTP interface with `@HttpExchange`, `@GetExchange`,
  `@PostExchange`, `@PutExchange`, `@DeleteExchange` or `@PatchExchange`. Such
  a method has no body, so its request declares the operation itself.
- `RestTemplate`: `getForObject`, `getForEntity`, `postForObject`,
  `postForEntity`, `postForLocation`, `put`, `delete`, `patchForObject`,
  `headForHeaders`, `optionsForAllow`, and `exchange` or `execute` with an
  `HttpMethod` argument.
- `RestClient` and `WebClient`: the fluent `get()`, `post()`, `put()`,
  `delete()`, `patch()`, `head()`, `options()` or `method(HttpMethod.X)`,
  followed by `uri(...)`.
- `java.net.http.HttpClient`: an `HttpRequest.newBuilder` chain with `uri(...)`
  and `GET()`, `POST(...)`, `PUT(...)`, `DELETE()`, `HEAD()` or
  `method("...")`. A chain that names no method sends GET, as the builder does.

An imperative client is recognized by the declared type name of its receiver in
the same file, so a field, a local variable and `new RestTemplate()` all count,
while a client another call returns does not. A name the file declares with two
types is dropped, because the receiver is then unknown. Literal routes and URLs
and constants the sources declare become facts, and a `{name}` placeholder in a
client URL fills one whole segment.

Nothing is reported for a functional WebFlux `RouterFunction`, a JAX-RS `@Path`
interface whose implementing class carries no annotation of its own, a prefix
whose constant the sources do not declare, a controller or resource class that
declares no prefix and extends another class, a mapping whose `method` attribute
does not resolve, a builder chain whose `method(...)` value is not literal, a
segment mixing text with a parameter such as `v{version}/talks`, and filters,
interceptors and security matchers such as `/api/**`.

The [producer checklist](../evidence.md#producer-checklist) for Java:

1. **Which prefixes belong in the path.** The class-level `@RequestMapping` or
   `@Path` prefix, a Feign client's `path`, and an HTTP interface's
   `@HttpExchange` value or `url`. A prefix the scanner cannot resolve reports
   nothing for that class, and so does a class that declares no prefix and
   extends another class, whose base may hold one.
2. **Whether the construct is an endpoint.** Only a controller or resource
   class serves. An interface never does, so `@FeignClient` and `@HttpExchange`
   interfaces report requests even though they carry the same mapping
   annotations. A security matcher, filter or interceptor is not an endpoint.
3. **Dynamic or unknown.** `TALKS + "/" + id` and a declarative `{id}` fill one
   whole segment, so they are dynamic. `TALKS + "/find-" + term` is unknown, as
   is a URL a call computes as a whole.
4. **The local helper.** Not supported. A request is reported where the client
   call is, so `getForObject(buildUrl(suffix), ...)` reports a leading unknown
   segment and `buildUrl` itself reports nothing.
5. **The base.** Every supported client resolves a relative or root-relative
   URL against the base it is configured with, so those requests set
   `configured`, as does a path that follows an unresolved field such as an
   injected base URL. `URI.create("https://api.example.com/api/talks")` and a
   URL computed as a whole report a leading `unknown` segment.
6. **Which operation a file-location route names.** Java declares no routes by
   file location, so the scanner names no operation that way.

## Compared operations

`groma lint` and scan findings compare Java operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range and body tokens to every method and constructor with a
body, including the methods of a local class.

Lambdas and the methods of an anonymous class body, including an enum constant
body, are anonymous callbacks. Static and instance initializer blocks and field
initializers are initializer code. Neither carries tokens.

Parameters and the names declared in the body, such as locals, loop, catch and
pattern variables and a local class's fields, become slots in declaration
order, so renaming a local does not change the tokens. Field, type and method
names stay as written, including a called name a local shadows and the
operation's own name in a recursive call, as do literals, operators, `.member`
and `::member` names, array index operands and control keywords. Declared types
are tokens too, so bodies differing only in `int` and `long`, or `List` and
`ArrayList`, are not identical.

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
