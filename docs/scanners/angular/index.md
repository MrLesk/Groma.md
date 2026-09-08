# Angular scanner

The Angular scanner adds concrete external-template output bindings to the
embedded TypeScript evidence. Enable it alongside the Java scanner for the
supported Maven and Angular application. All enabled scanners must complete
before Groma updates the map.

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

Prepare the application's ordinary dependencies using its package manager.
The scanner reads the root `tsconfig.json`, its configured source entry points,
and the Angular resources reachable from that program. It does not install
dependencies, compile application output, or run application code.

## Compiler tooling

The package pins `@angular/compiler` and `@angular/compiler-cli` to 21.2.17
and its own TypeScript to 5.9.3. Angular 21.2 supports TypeScript 5.9;
see the [official compatibility table](https://angular.dev/reference/versions).
Groma keeps its embedded TypeScript 7.1 SDK. The package build resolves every
compiler TypeScript import to the scanner's 5.9.3 installation before bundling,
so workspace dependency hoisting cannot substitute Groma's compiler.

The adapter uses `NgtscProgram`, its template type checker, and the compiler's
template and TypeScript symbols. These version-specific compiler APIs are
pinned with the package. Angular owns template parsing, directive matching,
output binding, and handler resolution; the adapter does not recreate them.
See [Angular template type checking](https://angular.dev/tools/cli/template-typecheck).

## Supported evidence

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
participate in the existing watch lifecycle. Repeat scans retain authored
architecture, and compiler errors leave the previous complete map in place.

In OKF, the result remains ordinary Code links and readable relationship rows.
In C4, an Angular component is source evidence, not a new architecture level
or an automatic architecture component. Core owns relationship interpretation;
the plugin does not write architecture or introduce metadata.

## Coverage limits

This revision qualifies the CompanyMergeDialog output-to-parent-handler flow.
It does not establish injected service receivers, routing, HTTP matching,
automatic Spring wiring, inline-template bindings, arbitrary handler
expressions, output mutation, or exhaustive Angular runtime behavior.
Unresolved or unsupported event bindings produce
`unsupported-angular-binding` diagnostics rather than relationships.
DOM events and dependency-library outputs have no supported source output
provider in this rule. Compiler errors fail the scan instead of yielding a
partial observation.

Independent fixture tests load the built package and cover concrete callback
endpoints, complementary TypeScript evidence, curated ownership, HTML-triggered
rescan, and failure preservation. See [validation](validation.md) for the
real-project result and remaining release gates.
