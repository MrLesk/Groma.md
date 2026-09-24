# Angular scanner

The Angular scanner adds explicit component source units and concrete
template output bindings to the TypeScript scanner evidence. Enable it alongside the Java scanner for the
supported Maven and Angular application. Healthy scanners update the map; failed scanners retain their saved evidence.

## Build and install

From the Groma checkout:

```sh
bun install --frozen-lockfile --ignore-scripts
bun plugins/scanners/angular/build.ts
```

From the project being scanned:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/angular/dist/package
groma scan
```

The package contains a bundled ESM entry and TypeScript standard-library
declarations. Consumers do not run a package build or installation script.
The prototype package name is not a public publication commitment.

The scanner reads each selected project's TypeScript configs, sources and
templates. The package supplies the compiler tools; project `node_modules`,
application compilation and dependency installation are not required.
Application code is never executed.

## Compiler tooling

The package pins `@angular/compiler` to 21.2.17 and its own TypeScript to
5.9.3. Angular 21.2 supports TypeScript 5.9; see the
[official compatibility table](https://angular.dev/reference/versions). A config
setting this TypeScript cannot read, such as an option from a newer TypeScript
or an extended config the checkout lacks, produces an `angular-unreadable-config`
warning; the rest of the config applies.
The TypeScript scanner uses its own 7.1 SDK. The package build resolves every
compiler TypeScript import to the scanner's 5.9.3 installation before bundling,
so workspace dependency hoisting cannot substitute Groma's compiler.

Angular's template parser and selector matcher read template syntax. TypeScript
resolves local class, property and handler identities. The adapter recognizes
literal `@Component` and `@Directive` metadata, standalone imports and Angular
output API imports from source, even when the Angular package is absent.

## Supported evidence

Literal `templateUrl`, `styleUrl`, and `styleUrls` declarations associate a
component class with its directly named local template and stylesheet files,
with or without a selector. Core uses that source unit to create one component,
or attach new unowned files to its existing owner. All member paths appear in
Code details. A named file the checkout lacks is left out of the unit with an
`angular-missing-resource` warning. Inline content does not create files;
ordinary imports, neighboring files, global styles, and transitive stylesheet
imports do not become companion files. Shared companions and conflicting
curated ownership follow the core source-unit review rules.

A direct method call in a template, external or inline, can bind a single
resolved source output property to a source method with a body. The element
must match source components or directives that the parent imports directly,
through a spread, or in a constant array, and exactly one of them must declare
the output with `@Output()` or `output()`. TypeScript locates `emit()` and
`EventEmitter` `next()` calls on that exact property declaration. An emit
inside an arrow callback belongs to that callback, not to the surrounding
method. An emit in an event handler of the child's own template is template
code, an operation of its own at that handler in the template's file.

The observation includes the emitting operation, handler operation, emit
position, and event attribute position. An inline template keeps the positions
of its class file. Positions are zero-based UTF-16 offsets; binding and
invocation lines are one-based. Named bindings use the existing shared
supplied-callback rule. Ordinary TypeScript evidence can remain unresolved
while Angular establishes the concrete binding.

Angular reports `angular` Code provenance for its source contribution.
The exact source path keeps one curated owner across both scanners. HTML edits
participate in the existing watch lifecycle, as do CSS, SCSS, Sass, Less, and Stylus
source edits. Repeat scans retain authored
architecture, and compiler errors leave the previous complete map in place.

In OKF, the result remains ordinary Code links and readable relationship rows.
In C4, an Angular declaration supplies source-unit evidence, not a new
architecture level. Core owns component ownership and relationship interpretation;
the plugin does not write architecture or introduce metadata.

## Source outline

The scanner outlines the TypeScript files in a component's Code with the
TypeScript rules of the [source outline contract](../creating-a-plugin.md#source-outline):
top-level functions and types (classes, interfaces, enums), including namespace
contents, and each type's constructors and methods. Every declaration has its
line and visibility, and `entry` marks the names the Code links give. Templates
and stylesheets have no outline. The package's own TypeScript parses each file
alone, without `tsconfig.json`, dependencies or compilation.

Core outlines each file once. For a source that the TypeScript scanner also
owns, the scanner with the lowest id among the file's Code links outlines it,
here Angular, with the symbols of all those links.

## HTTP endpoints and requests

The scanner reports [HTTP facts](../evidence.md#http-endpoints-and-requests) for
Angular's `HttpClient` and `httpResource`. An Angular application is a client:
it serves no endpoint.

| Construct | Reported |
| --- | --- |
| `get`, `post`, `put`, `patch`, `delete`, `head`, `options` | Request with that method and the URL the first argument states |
| `request(method, url)` | Request with that literal method; a computed method leaves the method out |
| `httpResource(() => url)` | GET request for the URL the function returns |
| `httpResource(() => ({ url, method }))` | Request with the stated method, GET without one |

The receiver must hold the injected client: a constructor parameter property, a
field, or a local whose declared type is `HttpClient`, or one that
`inject(HttpClient)` supplies, with `HttpClient` imported from
`@angular/common/http`. Both names are recognized from source, without the
Angular packages installed, so a `get` method on any other object is never a
request. `request(new HttpRequest(...))`, `jsonp`, and a client this scan never
sees injected report nothing.

The [producer decisions](../evidence.md#producer-checklist) for this
ecosystem:

1. **Prefixes.** None to add: the scanner reports no endpoint, and a request's
   path is the URL its own call states, after the base rule below.
2. **Endpoints.** None. Angular's router routes navigate inside the browser, and
   interceptors and guards answer no request; reporting either would claim an
   answer nothing serves and could hide the file that really serves the path.
3. **Dynamic or unknown.** `` `/talks/${id}` `` fills one whole segment, so it
   is dynamic. `` `/talks/${id}-latest` ``, a path built from an unresolved
   value, and a URL the scanner cannot read at the call are unknown. The query
   and fragment are dropped, computed or not.
4. **Local helpers.** Not supported: the URL is read at the client call, so a
   helper that forwards a path parameter reports unknown text, and its callers
   report nothing. Author those rows.
5. **Bases.** The [React
   scanner's](../react/index.md#http-endpoints-and-requests) decision 5 holds
   unchanged, so an environment object holding `/api` reports `/api/talks`, and
   a field read through `this` holds its one assignment, so `this.resourceUrl`
   with `resourceUrl = API_ROOT + '/api/speakers'` reads as that configured base
   and path, while an injected field is the service's own base setting. A
   literal environment base is the value in the source file, which an Angular
   build's `fileReplacements` can swap for another environment, so the reported
   path is the development one.
6. **File-location routes.** None: every request names the function, method or
   constructor that runs the call. A field initializer runs in the class's
   constructor, and an `httpResource` request belongs to the arrow function that
   returns it. A call outside any of them reports nothing.
7. **Constrained segments.** None: the scanner reports no endpoint, so it reads
   no route pattern.
8. **Registration order.** None: without endpoints there is no route order to
   report.

## Coverage limits

This revision qualifies the CompanyMergeDialog output-to-parent-handler flow
and ten public Angular repositories. It does not establish injected service
receivers, routing, HTTP matching, automatic Spring wiring, arbitrary handler
expressions, `model()` two-way bindings, output mutation, or exhaustive Angular
runtime behavior.
Unresolved or unsupported event bindings produce
`unsupported-angular-binding` diagnostics rather than relationships.
DOM events and dependency-library outputs have no supported source output
provider in this rule. Missing external types and unsupported bindings remain
uncertain. Invalid TypeScript or template syntax fails the observation. Source
scanning does not perform Angular application type checking. Nonliteral
component metadata, module-based scopes and imports computed at runtime are
outside the supported binding extraction.

Independent fixture tests load the built package and cover concrete callback
endpoints, complementary TypeScript evidence, curated ownership, HTML-triggered
rescan, failure preservation, the source outline, and the HTTP requests. See [fresh-checkout validation](../fresh-checkout-validation.md) for the
real-project result and remaining release gates.

## Projects

Run Groma from the repository root. The scanner finds package declarations in
tracked and unignored files, including nested apps and libraries. Dependencies,
dev dependencies, peer dependencies and optional dependencies identify candidates.
A candidate also needs a tracked or unignored `tsconfig.json` in its directory or
below it, as an Nx workspace keeps one in each project while declaring Angular
once at its root, and TypeScript source files belonging to that package, outside
nested candidates. Declaration files and inactive fixtures with a `.fixture`
suffix do not qualify. Packages with only framework tooling dependencies are
skipped. No matching project produces no evidence.

A project compiles its own TypeScript sources, leaving out `*.spec.ts` and
`*.test.ts` specs and files the shared `exclude` patterns name. As in the
[TypeScript scanner](../typescript/index.md), each source compiles with the
deepest config that includes it, following the references of a solution config
that lists no files of its own; a source no config includes compiles with default
options. Imported source in sibling repository libraries keeps its original source
path and supplies child directives and values, but only its own project reports it.
Readiness reads every selected project's configs; invalid configuration or source
syntax fails this scanner's observation, and other scanners can still update the
architecture. Source and nested package/configuration changes use the shared
scanner watch flow.
