# Groma Development

Groma is implemented in TypeScript on Bun and distributed as a compiled single-file
executable. This document records implementation choices. [MANIFESTO.md](MANIFESTO.md)
governs product and architectural principles, the canonical [`groma/`](groma/) workspace
is the detailed architectural source of truth, and [ARCHITECTURE.md](ARCHITECTURE.md) is
the compact cross-component navigator rather than a second component ledger.

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
bun run check:targets # cross-compile every baseline target and run the host-compatible one
bun run build         # compile the native standalone executable to dist/groma
bun run smoke         # verify one native artifact, public help, and package loading safety
bun run verify:1a     # build and black-box verify the complete native 1A workflow
bun run verify:1b     # build and black-box verify the complete native 1B foundation
bun run verify:self-blueprint # verify the canonical architecture through the compiled public CLI
bun run check         # run every required local verification gate
```

The compiled executable disables runtime loading of `.env`, `bunfig.toml`,
`tsconfig.json`, and `package.json`. Configuration needed by Groma must enter through
supported application and host capabilities rather than ambient build-tool files.

## Plugin author starting point

Create a minimal local package without copying repository fixtures or private modules:

```sh
groma package scaffold ./plugins/example \
  --name example-package \
  --plugin example.plugin \
  --provides example.capability/v1
```

The portable `./` destination stays inside the current workspace, must not already
exist, and is returned unchanged for `groma package add`. The generated `package.json`
exposes `bun test`; make the public `groma` package available in the authoring workspace,
then run that script to exercise `groma/plugin-sdk/conformance`. Before a registry release,
a source checkout can supply exactly those public package exports without changing the
scaffold metadata:

```sh
cd ./plugins/example
bun add --dev --no-save groma@file:/path/to/groma
bun test
```

The TypeScript entry is self-contained at runtime: its sole authoring import is type-only and erased before the
trusted exact-byte Host loader evaluates it. Run `groma init`, `groma package add`, and
the explicit trust-gated `groma package enable` to exercise the same local workflow the
Host uses at startup.

## Source Boundaries

The repository remains one build workspace. Most source boundaries are private
dependency directions; `groma/plugin-sdk` is the deliberate supported subpath for
plugin packages. Package acquisition and publication are separate Host concerns.

| Boundary             | Responsibility                                                                         | May depend on                            |
| -------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| `src/core`           | Technology-neutral graph, transaction, query, observation, event, and plugin contracts | Nothing outside Core                     |
| `src/plugin-sdk`     | Public plugin-author contracts, package compatibility, and conformance                 | Core                                     |
| `src/standard-model` | The official minimal blueprint model and its invariants                                | Core                                     |
| `src/persistence`    | Official local-resource, Markdown, journal, and later projection providers             | Core and the standard model              |
| `src/application`    | Presentation-neutral semantic operations                                               | Core, model, and capability contracts    |
| `src/host`           | Official composition, lifecycle, and process integration                               | All registered capabilities and surfaces |
| `src/cli`            | CLI parsing and terminal presentation                                                  | Host and application operations          |

Core must never import Bun APIs, filesystem or Markdown implementations, CLI, HTTP,
React, or any other surface technology. Application operations must never reach into
provider implementations directly. The SDK may expose Core plugin contracts, but
Core never depends on the SDK façade. The host is the composition root.

`bun run check:boundaries` parses TypeScript imports, exports, dynamic imports, import
types, and `require` calls. Production Core files may import only other Core files.
Tests may import `bun:test`, but test code still cannot cross architectural layers.
Unresolved relative imports fail the check rather than being ignored.

Directory names broadly follow the canonical root and component terminology. One-time
migration seed keys are not authoritative source names: they are preserved as namespaced
`groma.md/seed-key` metadata and can be inspected through the public bounded
`blueprint export`. Use the canonical workspace for detailed architecture and
`ARCHITECTURE.md` for navigation. The plugin SDK is a public package subpath today;
splitting its source into an independently acquired package belongs to the later package
workflow.

## Test Layout

Tests live in a `tests/` directory inside the boundary they verify, for example
`src/core/tests/` and `src/cli/tests/`. Tooling tests live in `scripts/tests/`. Bun
discovers `*.test.ts` recursively, and keeping tests inside their owning boundary lets
the architecture checker enforce the same dependency direction without cluttering
production module roots. Release-level black-box verification lives in
`tests/iteration-1a/` and `tests/iteration-1b/` because it exercises the compiled artifact
across every source boundary without importing a product implementation API. The Iteration
1B foundation verifier covers configuration, public operations, projection repair,
complete export, trusted-package compatibility failure, stale cursors, interruption, and
canonical-byte preservation. The self-blueprint verifier copies canonical state and
exercises only the compiled public CLI, including a disposable projection rebuild,
explicit root orientation, and byte-identical canonical proof. Add deeper fixture or
golden-output directories only when a test suite demonstrates that need.

## Iteration 1B Build Targets

One binary is produced per target; “single-file” describes the runtime artifact, not
one universal binary for every operating system. The target matrix proves
cross-compilation, one exact artifact, and the executable format and architecture shown
below. It does not claim native runtime verification for an artifact that the current
runner cannot execute.

| Bun target                 | Packaged baseline artifact          | Matrix proof                                                   |
| -------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `bun-darwin-arm64`         | Apple Silicon macOS executable      | One Mach-O arm64 artifact; runtime only on a matching host     |
| `bun-linux-x64-baseline`   | Baseline x64 glibc Linux executable | One ELF x86-64 artifact; full 1B workflow on the Linux CI host |
| `bun-windows-x64-baseline` | Baseline x64 Windows executable     | One PE x86-64 artifact; runtime only on a matching host        |
| `bun-windows-arm64`        | ARM64 Windows executable            | One PE arm64 artifact; runtime only on a matching host         |

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

Intel macOS, Linux arm64, and musl targets are not Iteration 1B packaging baselines.
Adding a target requires cross-compiled artifact verification. Runtime behavior is
recorded separately and only for a compatible CI or local host.

## Continuous Verification

GitHub Actions runs on every pull request and every push to `main`. The required
quality job starts from a clean checkout, installs with `bun ci`, and invokes the same
`bun run check` command used locally. A second job uses one Linux runner to
cross-compile all four Iteration 1B baseline targets. It verifies the exact single-file
output and format-specific architecture header for every target. For the Linux artifact
that the host can run, it then executes version, help, package loading safety, the
complete non-crash 1A workflow, the Iteration 1B foundation verifier, and the
self-blueprint verifier. A bounded third job builds the native Windows executable on
Windows and runs version, help, and package safety smoke checks against the real process;
that smoke job is not described as the complete Iteration 1B workflow.

`bun run check:targets` uses the same rule locally: it cross-compiles every target and
black-box tests the target matching the current operating system and architecture through
the complete Iteration 1B workflow. The compiled child process is executed directly and
does not use a separately installed Bun runtime; Bun remains only the development harness
that builds and drives it. A successful cross-compile is not native runtime verification
for a different operating system. When no baseline target matches the local host, the
command reports cross-compilation-only verification instead of claiming that it ran the
complete workflow. After verifying the serial matrix, the command restores a native artifact
so `bun run smoke` can run immediately.

The workflow pins release commits for `actions/checkout` and `oven-sh/setup-bun` while
retaining their release tags as comments for review. Setup Bun reads the exact Bun
version from `package.json`.

When verification fails, run `bun run check` first. Its fail-fast order is formatting,
types, architectural boundaries, unit tests, then the single `verify:1b` completion
workflow: standalone build and smoke behavior, the complete Iteration 1A black-box and
crash-recovery suite, the Iteration 1B foundation verifier, and the canonical
self-blueprint verifier through the compiled public CLI. Run the named subcommand directly
after identifying the failing gate.

## Iteration 1B Completion Verification

`bun run verify:1b` is the clean-checkout completion command. It compiles the native
single-file `groma` executable once, checks its public and trusted-package loading
surfaces, and retains the complete Iteration 1A workflow through the earlier black-box
suite. `bun run verify:1a` remains available as the compatibility command for the
initialization, recursive component, relationship, bounded-query, expected-revision,
identity-continuity, restart, deterministic-output, malformed-state, negative-invariant,
and crash-recovery contract.

The Iteration 1A suite compiles a separate verification-only entry with an explicit host
fault injector. Real child processes terminate at every prepared, committing,
replacement, settlement, and deletion durability boundary. Recovery always exposes
the complete old or complete new graph and must accept a later valid mutation. This
fault control is not present in the production entry point or production executable.

The additional Iteration 1B verifiers drive only the production executable and filesystem
fixtures. They prove configuration, recognition metadata, trusted dynamic packages,
built-in capability-backed bounded reads, deterministic complete paged export, projection
rebuild and corrupt-cache repair, stale-cursor rejection, incompatible capability
rejection before plugin start, interrupted-read recovery, and the canonical
self-blueprint. Read-only and failure cases compare the complete canonical `groma/`
bytes.

Iteration 1B delivers a reconstructable projection index and the bounded terminal
overview. It does not deliver the local visual artifact, visual navigation, or rendering;
“projection” here is disposable query infrastructure, not a second semantic model or a
completed visual surface.

## Deliberately Deferred

The approved web stack is Bun's embedded HTTP server and Bun's React bundler. Neither
HTTP nor React is installed or started in Iteration 1B or required for the disposable
local artifact that Iteration 2 proves. Iteration 4 introduces the application service
and complete web viewing and editing together.

Iteration 2 remains responsible for scanning, observation and evidence, binding,
reconciliation, the `groma scan` command, and local visual navigation and rendering.
Iteration 1B makes no automatic architecture-generation claim. Plans and Git history
views also remain later work.
