# Groma Development

Groma is implemented in TypeScript on Bun and distributed as a compiled single-file
executable. This document records implementation choices; product and architectural
decisions remain governed by [MANIFESTO.md](MANIFESTO.md) and
[ARCHITECTURE.md](ARCHITECTURE.md).

## Toolchain

- Bun `1.3.14` is the package manager, runtime, test runner, and bundler.
- TypeScript performs strict static type checking. Bun runs TypeScript but does not
  replace the type checker.
- Prettier formats TypeScript and project configuration.
- `bun.lock` is committed. Clean and CI installs use `bun ci`, which fails when the
  package manifest and lockfile disagree.

Install dependencies:

```sh
bun ci
```

## Commands

```sh
bun run dev           # run the TypeScript CLI entry point
bun run typecheck     # strict TypeScript validation
bun run test          # Bun tests
bun run format        # format source, scripts, and configuration
bun run format:check  # verify formatting without writing
bun run build         # compile the native standalone executable to dist/groma
bun run smoke         # exercise version and help on the compiled executable
```

The compiled executable disables runtime loading of `.env`, `bunfig.toml`,
`tsconfig.json`, and `package.json`. Configuration needed by Groma must enter through
supported application and host capabilities rather than ambient build-tool files.

## Source Boundaries

The initial repository uses internal source boundaries rather than separate
publishable packages. These are dependency directions, not public package contracts.

| Boundary | Responsibility | May depend on |
| --- | --- | --- |
| `src/core` | Technology-neutral graph, transaction, query, observation, event, and plugin contracts | Nothing outside Core |
| `src/standard-model` | The official minimal blueprint model and its invariants | Core |
| `src/persistence` | Official local-resource, Markdown, journal, and later projection providers | Core and the standard model |
| `src/application` | Presentation-neutral semantic operations | Core, model, and capability contracts |
| `src/host` | Official composition, lifecycle, and process integration | All registered capabilities and surfaces |
| `src/cli` | CLI parsing and terminal presentation | Host and application operations |

Core must never import Bun APIs, filesystem or Markdown implementations, CLI, HTTP,
React, or any other surface technology. Application operations must never reach into
provider implementations directly. The host is the composition root.

The directory names follow the architectural groups and seed terminology in
`ARCHITECTURE.md`. They can be split into distributable packages only when an actual
plugin or public API boundary requires it.

## Iteration 1A Build Targets

One binary is produced per target; “single-file” describes the runtime artifact, not
one universal binary for every operating system.

| Bun target | Iteration 1A commitment | Current validation |
| --- | --- | --- |
| Native `bun-darwin-arm64` | Supported on Apple Silicon macOS | Compiled and smoke-tested locally in GROM-5 |
| `bun-linux-x64-baseline` | Supported on baseline x64 glibc Linux before 1A closes | Cross-compilation is available; runnable CI validation belongs to GROM-6 |

Build the Linux target explicitly:

```sh
bun run build -- --target=bun-linux-x64-baseline
```

Windows, Intel macOS, Linux arm64, and musl targets are not promised for 1A. Adding a
target requires compilation and runtime smoke coverage, not only a successful
cross-compile.

## Deliberately Deferred

The approved web stack is Bun's embedded HTTP server and Bun's React bundler. Neither
HTTP nor React is installed or started in Iteration 1A. The application service begins
in Iteration 4, the web viewer in Iteration 4, and web editing in Iteration 5.

Iteration 1A also does not implement scanning, reconciliation, disposable projection,
dynamic plugin loading, plans, or Git history views.
