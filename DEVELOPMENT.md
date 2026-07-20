# Groma Development

Groma is written in TypeScript, runs on Bun, and ships as one compiled single-file executable.
This document records the implementation choices: toolchain, commands, source boundaries,
tests, build targets, and CI.

For everything else: [MANIFESTO.md](MANIFESTO.md) governs product and architectural
principles, the canonical [`groma/`](groma/) workspace holds the detailed architecture, and
[ARCHITECTURE.md](ARCHITECTURE.md) is the cross-component tour.

## Toolchain

- Bun `1.3.14` is the package manager, runtime, test runner, and bundler.
- TypeScript provides strict static type checking. Bun runs TypeScript but does not replace
  the type checker.
- Prettier formats TypeScript and project configuration.
- `bun.lock` is committed. Clean and CI installs use `bun ci`, which fails when the package
  manifest and lockfile disagree.

Install dependencies:

```sh
bun ci
```

## Commands

```sh
bun run dev           # run the TypeScript CLI entry point
bun run typecheck     # strict TypeScript validation (CLI and web client configs)
bun run test          # Bun tests
bun run web:css       # generate the embedded web stylesheet from the Tailwind source
bun run format        # format source, scripts, and configuration
bun run format:check  # verify formatting without writing
bun run check:boundaries # enforce architectural dependency directions
bun run build         # compile the native standalone executable to dist/groma
bun run package       # package every baseline target with a checksum manifest
bun run smoke         # verify one native artifact and the public init -> scan -> read workflow
bun run verify:1a     # build and black-box verify the complete native 1A workflow
bun run check         # run every required local verification gate
```

The embedded web surface is compiled into the executable: `src/web/client/index.html` and its
React modules are bundled by Bun's full-stack compile, and `bun run web:css` turns the Tailwind
source `src/web/client/styles.css` into the gitignored `styles.generated.css` the page links.
Run `bun run web:css` once before `bun run dev web` or the web typecheck; `bun run build` and
`bun run check` run it automatically.

The compiled executable does not load `.env`, `bunfig.toml`, `tsconfig.json`, or
`package.json` at runtime. Any configuration Groma needs must arrive through supported
application and host capabilities, never through ambient build-tool files.

## Change Review

Before a pull request is opened, two independent `gpt-5.6-terra` agents at `xhigh` and one
local Claude pass review the complete change. Justified findings are fixed before the PR is
created. The ready PR then receives one awaited automatic Codex review. If that review finds
issues, fix the justified ones and require green CI after the fix; do not wait for the
automatic follow-up Codex review, even if the PR shows a new 👀 reaction. This keeps review
bounded at three local passes and one online pass.

## Source Boundaries

The repository is one build workspace. Most source boundaries are private dependency
directions; `groma/plugin-sdk` is the one deliberately supported subpath for plugin packages.
Package acquisition and publication are separate Host concerns.

| Boundary             | Responsibility                                                                         | May depend on                            |
| -------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| `src/core`           | Technology-neutral graph, transaction, query, observation, event, and plugin contracts | Nothing outside Core                     |
| `src/plugin-sdk`     | Public blind-scanner authoring contracts                                               | Core                                     |
| `src/standard-model` | The official minimal blueprint model and its invariants                                | Core                                     |
| `src/persistence`    | Official local-resource, Markdown, journal, and later projection providers             | Core and the standard model              |
| `src/application`    | Presentation-neutral semantic operations                                               | Core, model, and capability contracts    |
| `src/host`           | Official composition, lifecycle, and process integration                               | All registered capabilities and surfaces |
| `src/cli`            | CLI parsing and terminal presentation                                                  | Host, application operations, and web    |
| `src/web`            | The embedded loopback web surface: server routes and bundled browser client            | Application and host surface contracts   |

The rules behind the table:

- Core must never import Bun APIs, filesystem or Markdown implementations, CLI, HTTP, React,
  or any other surface technology.
- Application operations must never reach into provider implementations directly.
- The SDK may expose Core plugin contracts, but Core never depends on the SDK façade.
- The host is the composition root.

`bun run check:boundaries` enforces this. It parses TypeScript imports, exports, dynamic
imports, import types, and `require` calls. Production Core files may import only other Core
files. Tests may import `bun:test`, but test code still cannot cross architectural layers.
Unresolved relative imports fail the check rather than being ignored.

Directory names broadly follow the canonical root and component terminology. One-time
migration seed keys are not authoritative source names: they are preserved as namespaced
`groma.md/seed-key` metadata and can be inspected through the public bounded
`blueprint export`. Use the canonical workspace for detailed architecture and
`ARCHITECTURE.md` for navigation. The plugin SDK is a public package subpath today; splitting
it into an independently acquired package belongs to the later package workflow.

## Test Layout

Tests live in a `tests/` directory inside the boundary they verify, for example
`src/core/tests/` and `src/cli/tests/`. Tooling tests live in `scripts/tests/`. Bun discovers
`*.test.ts` recursively, and keeping tests inside their owning boundary lets the architecture
checker enforce the same dependency direction without cluttering production module roots.

Release-level black-box verification lives in `tests/iteration-1a/` because it exercises the
compiled artifact across every source boundary without importing product implementation APIs. The
compiled smoke also proves `init -> scan -> component list` on a small TypeScript fixture.

Add deeper fixture or golden-output directories only when a test suite demonstrates the need.

## Build Targets

One binary is produced per target; "single-file" describes the runtime artifact, not one
universal binary for every operating system. `bun run package` retains all four artifacts under
stable target-specific names and writes their SHA-256 digests to `dist/SHA256SUMS`. Successful Bun
cross-compilation and a non-empty artifact prove packaging for each target. They do not claim native
runtime verification for an artifact the current runner cannot execute.

| Bun target                 | Preview artifact          | Runtime proof                          |
| -------------------------- | ------------------------- | -------------------------------------- |
| `bun-darwin-arm64`         | `groma-darwin-arm64`      | Matching Apple Silicon macOS host      |
| `bun-linux-x64-baseline`   | `groma-linux-x64`         | Matching baseline x64 glibc Linux host |
| `bun-windows-x64-baseline` | `groma-windows-x64.exe`   | Matching x64 Windows host              |
| `bun-windows-arm64`        | `groma-windows-arm64.exe` | Matching ARM64 Windows host            |

Build the Linux target explicitly:

```sh
bun run build -- --target=bun-linux-x64-baseline
```

Build the Windows targets explicitly. Bun's standalone-executable contract uses the `.exe`
suffix for Windows outputs, and Groma writes `dist/groma.exe` explicitly:

```sh
bun run build -- --target=bun-windows-x64-baseline
bun run build -- --target=bun-windows-arm64
```

Intel macOS, Linux arm64, and musl targets are not packaging baselines. Adding a
target requires cross-compiled artifact verification. Runtime behavior is recorded separately
and only for a compatible CI or local host.

## Continuous Verification

GitHub Actions runs on every pull request and every push to `main`:

1. The required quality job starts from a clean checkout, installs with `bun ci`, and runs the
   same `bun run check` used locally.
2. A second job uses one Linux runner to package all four baseline targets with checksums. For the
   Linux artifact the host can actually run, it then executes the compiled smoke and Iteration 1A
   workflow, including the deterministic local visual fixture.
3. A bounded third job builds the native Windows executable on Windows and runs version, help,
   and scan smoke checks against the real process.

`bun run package` applies the same rule locally: it cross-compiles every target and black-box tests
the one matching the current operating system and architecture through the compiled smoke and
Iteration 1A workflow. The compiled child process is executed directly — Bun remains only the
development harness that builds and drives it. The visual fixture composes the same overview and
HTML presentation path with a file presenter so verification never launches a browser. A successful
cross-compile is not native runtime verification for a different operating system; when no baseline
target matches the local host, the command says so instead of claiming it ran the complete workflow.
Packaging intentionally leaves only the target-named artifacts. Run `bun run build` before the
default `bun run smoke` when a generic native `dist/groma` or `dist/groma.exe` is needed.

The workflow pins release commits for `actions/checkout` and `oven-sh/setup-bun`, keeping
their release tags as comments for review. Setup Bun reads the exact Bun version from
`package.json`.

When verification fails, run `bun run check` first. Its fail-fast order is formatting, types,
architectural boundaries, unit tests, then `verify:1a` (standalone build, smoke, and the complete
black-box/crash-recovery suite). Once you know which gate fails, run its named subcommand directly.

## Compiled Verification

`bun run verify:1a` covers initialization,
recursive component, relationship, bounded-query, expected-revision, identity-continuity,
restart, deterministic-output, malformed-state, negative-invariant, and crash-recovery
contract.

The Iteration 1A suite compiles a separate verification-only entry with an explicit host fault
injector. Real child processes are terminated at every prepared, committing, replacement,
settlement, and deletion durability boundary. Recovery must always expose the complete old or
complete new graph, and must accept a later valid mutation. This fault control does not exist
in the production entry point or production executable.

## Deliberately Deferred

In an interactive terminal, bare `groma` opens the disposable local visual artifact without an
HTTP server or React. `groma web` serves the embedded interactive web surface from the compiled
binary — Bun's embedded HTTP server with a bundled React and Tailwind client — bound to the
loopback interface, exposing only bounded reads through shared application operations.

The bounded scan, reconciliation, and local visual loop is implemented. Plans, Git history views,
browser editing, and replacing bare `groma` with the web surface remain later work.
