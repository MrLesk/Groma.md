# Angular scanner

The Angular scanner adds explicit component source units and concrete
external-template output bindings to the TypeScript scanner evidence. Enable it alongside the Java scanner for the
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

The scanner reads each selected project's `tsconfig.json`, source entry points
and external templates. The package supplies the compiler tools; project
`node_modules`, application compilation and dependency installation are not
required. Application code is never executed.

## Compiler tooling

The package pins `@angular/compiler` and `@angular/compiler-cli` to 21.2.17
and its own TypeScript to 5.9.3. Angular 21.2 supports TypeScript 5.9;
see the [official compatibility table](https://angular.dev/reference/versions).
The TypeScript scanner uses its own 7.1 SDK. The package build resolves every
compiler TypeScript import to the scanner's 5.9.3 installation before bundling,
so workspace dependency hoisting cannot substitute Groma's compiler.

Angular's template parser and selector matcher read template syntax. TypeScript
resolves local class, property and handler identities. The adapter recognizes
literal `@Component` metadata, direct standalone imports and Angular output
API imports from source, even when the Angular package is absent.

## Supported evidence

Literal `templateUrl`, `styleUrl`, and `styleUrls` declarations associate a
component class with its directly named local template and stylesheet files.
Core uses that source unit to create one component, or attach new unowned files
to its existing owner. All member paths appear in Code details. Inline content
does not create files; ordinary imports, neighboring files, global styles, and
transitive stylesheet imports do not become companion files. Shared companions
and conflicting curated ownership follow the core source-unit review rules.

A direct method call in an external template can bind a single resolved
source output property to a source method with a body. TypeScript locates
`emit()` calls on that exact property declaration. An emit inside an arrow
callback belongs to that callback, not to the surrounding method.

The observation includes the emitting operation, handler operation, emit
position, and HTML event attribute position. Positions are zero-based UTF-16
offsets; binding and invocation lines are one-based. Named bindings use the
existing shared supplied-callback rule. Ordinary TypeScript evidence can remain
unresolved while Angular establishes the concrete binding.

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

## Coverage limits

This revision qualifies the CompanyMergeDialog output-to-parent-handler flow.
It does not establish injected service receivers, routing, HTTP matching,
automatic Spring wiring, inline-template bindings, arbitrary handler
expressions, output mutation, or exhaustive Angular runtime behavior.
Unresolved or unsupported event bindings produce
`unsupported-angular-binding` diagnostics rather than relationships.
DOM events and dependency-library outputs have no supported source output
provider in this rule. Missing external types and unsupported bindings remain
uncertain. Invalid TypeScript or template syntax fails the observation. Source
scanning does not perform Angular application type checking. Nonliteral
component metadata, module-based scopes and indirect imports are outside the
supported binding extraction.

Independent fixture tests load the built package and cover concrete callback
endpoints, complementary TypeScript evidence, curated ownership, HTML-triggered
rescan, failure preservation, and the source outline. See [fresh-checkout validation](../fresh-checkout-validation.md) for the
real-project result and remaining release gates.

## Nested projects

Run Groma from the repository root. The scanner finds package declarations in
tracked and unignored files, including nested apps and libraries. Dependencies,
dev dependencies, peer dependencies and optional dependencies identify candidates.
A candidate also needs a tracked or unignored `tsconfig.json` and TypeScript source
files belonging to that package, outside nested packages. Declaration files and
inactive fixtures with a `.fixture` suffix do not qualify. Packages with only
framework tooling dependencies are skipped. No matching project produces no evidence. Each compiler uses that project's configuration and local source;
imported source in sibling repository libraries keeps its original source path.
Readiness checks all selected projects. An invalid selected project fails this scanner's observation; other scanners
can still update the architecture.
Source and nested package/configuration changes use the shared scanner watch flow.
