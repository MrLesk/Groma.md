# React scanner

The React scanner connects a directly supplied JSX callback prop to calls on
the component's destructured parameter. Enable it alongside embedded TypeScript.
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
declarations. Groma's embedded TypeScript 7.1 is unchanged. No consumer build
or installation script is required. Public naming and publication are separate
release decisions.

Install the application's declared dependencies and React types with its
package manager and lockfile. The scanner reads the root `tsconfig.json` through
the TypeScript compiler and inventories its owned TSX source files. Missing
React dependencies, invalid configuration, syntax errors, and semantic errors
in those TSX files fail preparation with instructions. It does not claim to
type-check unrelated server source files. It does not run application code.

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

TSX and TypeScript edits use the existing watch lifecycle. All enabled scanners
must complete before architecture changes. See [validation](validation.md) for
the executed artifact checks and remaining release gates.
