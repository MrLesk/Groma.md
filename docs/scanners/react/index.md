# React scanner

The React scanner connects a directly supplied JSX callback prop to calls on
the component's destructured parameter. Enable it alongside the TypeScript scanner.
Core selects relationships from the combined evidence and keeps one owner per
physical source file.

## Build and install

```sh
bun install --frozen-lockfile --ignore-scripts
bun plugins/scanners/react/build.ts
```

From the project being scanned:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/react/dist/package
groma scanner check
groma scan
```

The private prototype package bundles TypeScript 6.0.3 and its standard-library
declarations. the TypeScript scanner's 7.1 SDK is unchanged. No consumer build
or installation script is required. Public naming and publication are separate
release decisions.

The scanner reads each selected project's `tsconfig.json` and owned TSX files
using its bundled TypeScript compiler. Project dependencies and React types do
not need to be installed. Invalid configuration and source syntax fail with a
diagnostic; missing external types do not prevent local callback extraction.
The scanner does not run application code or require successful type checking.

## Evidence and tooling

[React documents callback props](https://react.dev/learn/responding-to-events).
[TypeScript owns JSX parsing and checking](https://www.typescriptlang.org/docs/handbook/jsx.html),
project membership, imported component identities, and source symbols.
The adapter uses the maintained JavaScript compiler API pinned to 6.0.3;
[TypeScript 6.0](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
retains the established compiler API. The plugin does not recreate language
name or type resolution.

A component must resolve to a source function or a `const` arrow/function value
in the inventoried TSX files. Its first parameter must directly destructure the
callback prop. The JSX attribute must supply an identifier resolving directly
to a source function or `const` arrow/function value. Calls are matched to the
exact compiler symbol of that destructured parameter. Each concrete JSX
attribute has a separate binding; nested calls belong to their nearest function.

Operation, call, and attribute positions are original zero-based UTF-16 offsets;
lines are one-based. The named prop supplies the existing `member` field.
Ordinary TypeScript can remain unresolved while React supplies this binding.
No compiler objects or raw graph are persisted.

In OKF, the result remains readable Code links and relationship rows. In C4,
React components remain source evidence, not automatic architecture components
or a new containment level. Core owns interpretation and curated ownership.

## Limits

This revision qualifies the Backlog.md CleanupModal success callback. It does
not analyze hooks, state stores, routing, server components, class components,
component wrappers, callback forwarding, returned functions, mutable values,
DOM dispatch, or arbitrary callback expressions. JSX spreads and unsupported
direct bindings produce `unsupported-react-binding` diagnostics and no certain
claim. Components that cannot resolve to a supported source function do not
establish a callback interaction.

TSX and TypeScript edits use the existing watch lifecycle. Healthy scanners update the architecture while failed scanners keep their saved evidence. See [fresh-checkout validation](../fresh-checkout-validation.md) for
the executed artifact checks and remaining release gates.

## Nested projects

Run Groma from the repository root. The scanner finds package declarations in
tracked and unignored files, including nested apps and libraries. Dependencies,
dev dependencies, peer dependencies and optional dependencies identify candidates.
A candidate also needs a tracked or unignored `tsconfig.json` and TSX source
files belonging to that package, outside nested packages. Declaration files and
inactive fixtures with a `.fixture` suffix do not qualify. Packages with only
framework tooling dependencies are skipped. No matching project produces no evidence. Each compiler uses that project's configuration and local source;
imported source in sibling repository libraries keeps its original source path.
Readiness checks all selected projects. An invalid selected project fails this scanner's observation; other scanners
can still update the architecture.
Source and nested package/configuration changes use the shared scanner watch flow.
