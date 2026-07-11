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
bun run check:boundaries # enforce architectural dependency directions
bun run check:targets # cross-compile every supported target and run the host-compatible one
bun run build         # compile the native standalone executable to dist/groma
bun run smoke         # verify one native artifact and exercise version and help
bun run check         # run every required local verification gate
```

The compiled executable disables runtime loading of `.env`, `bunfig.toml`,
`tsconfig.json`, and `package.json`. Configuration needed by Groma must enter through
supported application and host capabilities rather than ambient build-tool files.

## Source Boundaries

The initial repository uses internal source boundaries rather than separate
publishable packages. These are dependency directions, not public package contracts.

| Boundary             | Responsibility                                                                         | May depend on                            |
| -------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| `src/core`           | Technology-neutral graph, transaction, query, observation, event, and plugin contracts | Nothing outside Core                     |
| `src/standard-model` | The official minimal blueprint model and its invariants                                | Core                                     |
| `src/persistence`    | Official local-resource, Markdown, journal, and later projection providers             | Core and the standard model              |
| `src/application`    | Presentation-neutral semantic operations                                               | Core, model, and capability contracts    |
| `src/host`           | Official composition, lifecycle, and process integration                               | All registered capabilities and surfaces |
| `src/cli`            | CLI parsing and terminal presentation                                                  | Host and application operations          |

Core must never import Bun APIs, filesystem or Markdown implementations, CLI, HTTP,
React, or any other surface technology. Application operations must never reach into
provider implementations directly. The host is the composition root.

`bun run check:boundaries` parses TypeScript imports, exports, dynamic imports, import
types, and `require` calls. Production Core files may import only other Core files.
Tests may import `bun:test`, but test code still cannot cross architectural layers.
Unresolved relative imports fail the check rather than being ignored.

The directory names follow the root component domains and seed terminology in
`ARCHITECTURE.md`. They can be split into distributable packages only when an actual
plugin or public API boundary requires it.

## Iteration 1A Build Targets

One binary is produced per target; “single-file” describes the runtime artifact, not
one universal binary for every operating system.

| Bun target                 | Iteration 1A commitment               | CI verification                                         |
| -------------------------- | ------------------------------------- | ------------------------------------------------------- |
| `bun-darwin-arm64`         | Supported on Apple Silicon macOS      | Cross-compiled and checked as one Mach-O artifact       |
| `bun-linux-x64-baseline`   | Supported on baseline x64 glibc Linux | Cross-compiled and smoke-tested on the Linux CI host    |
| `bun-windows-x64-baseline` | Supported on baseline x64 Windows     | Cross-compiled and checked as one `.exe` artifact       |
| `bun-windows-arm64`        | Supported on ARM64 Windows            | Cross-compiled and checked as one ARM64 `.exe` artifact |

Build the Linux target explicitly:

```sh
bun run build -- --target=bun-linux-x64-baseline
```

Build the Windows target explicitly. Bun's standalone-executable contract uses the
`.exe` suffix for Windows outputs, and Groma writes `dist/groma.exe` explicitly:

```sh
bun run build -- --target=bun-windows-x64-baseline
bun run build -- --target=bun-windows-arm64
```

Intel macOS, Linux arm64, and musl targets are not promised for 1A. Adding a target
requires compilation and runtime smoke coverage, not only a successful cross-compile.

## Continuous Verification

GitHub Actions runs on every pull request and every push to `main`. The required
quality job starts from a clean checkout, installs with `bun ci`, and invokes the same
`bun run check` command used locally. A second job uses one Linux runner to
cross-compile all four promised 1A targets. It verifies the exact single-file output
for every target and executes version and help only for the Linux binary that the host
can run.

`bun run check:targets` uses the same rule locally: it cross-compiles every target and
smoke-tests the target matching the current operating system and architecture. A
successful cross-compile is not described as native runtime verification for a
different operating system.

The workflow pins release commits for `actions/checkout` and `oven-sh/setup-bun` while
retaining their release tags as comments for review. Setup Bun reads the exact Bun
version from `package.json`.

When verification fails, run `bun run check` first. Its fail-fast order is formatting,
types, architectural boundaries, tests, build, and binary smoke behavior. Run the
named subcommand directly after identifying the failing gate.

## Deliberately Deferred

The approved web stack is Bun's embedded HTTP server and Bun's React bundler. Neither
HTTP nor React is installed or started in Iteration 1A. The application service begins
in Iteration 4, the web viewer in Iteration 4, and web editing in Iteration 5.

Iteration 1A also does not implement scanning, reconciliation, disposable projection,
dynamic plugin loading, plans, or Git history views.
