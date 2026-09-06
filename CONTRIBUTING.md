# Contributing to Groma

Thank you for helping build Groma. This guide takes you from a fresh checkout to a verified change.

## Start with the product

Read the [Groma manifesto](MANIFESTO.md) to understand the product principles, then use the
[documentation index](docs/index.md) to find the contract or product flow relevant to your change. Architecture Markdown
is the source of truth for what Groma represents and shows. It follows Groma's strict OKF v0.2 architecture profile;
the [component Markdown contract](docs/component-markdown.md) defines its reserved files, metadata, body, and
relationships.

Keep each contribution focused on one approved outcome and one supported example. Every pull request must be linked to
one Backlog.md task, including documentation-only pull requests. Create or identify the task before opening the PR and
include its ID in the PR title or description. Small documentation corrections may still be made directly when they do
not need a pull request.

## Set up the repository

Groma requires Bun 1.4.1 or newer and Node.js 20.19 or newer. Published macOS binaries are Apple Silicon only; Intel Macs are not a supported architecture.

```sh
bun install
bun run check
```

Groma is written in TypeScript. Bun runs the CLI and both viewers. Tests under `test/` run on Node through `tsx`
(`bun run test:node`); tests under `test-bun/` run with `bun test` (`bun run test:viewer`). `bun run check` is the single
repository check: it runs Biome, typechecks the code, and runs both test suites. Every test loads architecture from
fixtures under `test/fixtures/`, never from the live `groma/` tree.

Biome applies its recommended lint rules and reports cognitive complexity above 15. Existing complexity warnings identify
cleanup work; do not add new ones. Biome formatting and import assist are disabled, so keep the surrounding file style
when making changes.

`bun install` applies the checked-in Parcel Watcher patch. It makes native binding imports explicit so Bun can embed
them in a single-file bytecode executable; development and compiled builds use the same package loader. When updating
Parcel, review the patch against its platform packages and run `bun test test-bun/parcel-bytecode.test.ts`. This test
receives native file events in both source mode and a compiled executable with no accompanying source or dependencies.

## Repository structure

The repository uses Bun workspaces. The directory names describe responsibility:

- `packages/` contains shared contracts and reusable support code. For example, `@groma/scanner` defines the scanner
  contract and observation format, while `@groma/work-source` defines the work-source contract.
- `plugins/` contains packages that implement those contracts for a specific integration. Language scanners live under
  `plugins/scanners/`, and work-source adapters live under `plugins/work-sources/`.
- A plugin is a package with an extension role; it is not a different package format. Plugin packages depend on shared
  package contracts. Some are embedded in the main application, while others can be configured and loaded separately.
- Not every conceptual plugin is under `plugins/`. The TUI and web viewers are shipped with the main application under
  `src/viewers/`; their plugin boundary describes their role, not their directory.

## Build and release versions

Build a single-file executable with Bun 1.4.1 bytecode:

```sh
bun run build
./dist/groma --version
```

Windows produces `dist/groma.exe`. Pass an output path after `bun run build` to choose a different location.
The CLI, welcome screen, and web credits statically import `package.json` as JSON. Web lockup and mark files use Bun file and text imports. The compiled executable embeds the browser renderer and dependency credit files, so it does not read those from the source checkout or run a bundler at runtime. Compiled TypeScript scanning uses the project's native `tsc` when `@typescript/typescript-<os>-<cpu>` is installed; otherwise it reads source text without spawning TypeScript's worker, which cannot run from the embedded filesystem.

Release CI sets `package.json.version` directly from the release tag, without its leading `v`, in the disposable build
checkout before running `bun run build`. A build for tag `v0.2.0` therefore already reports `0.2.0`.

The build accepts `GROMA_BUILD_TARGET` and `GROMA_BUILD_OUTFILE` for cross-target release jobs. It embeds the shipped
instruction guide, web assets, package metadata, and dependency credit metadata into each executable, so the binary
does not need the source checkout at runtime. All binary builds and npm package manifests must use the prepared version.
The tagged release workflow publishes platform packages before the `groma.md` wrapper, verifies installation on the
supported runner platforms, and commits the released version to `main` only after those checks succeed. macOS ships
`groma.md-darwin-arm64` only. The npm wrapper reports Intel Macs as an unsupported architecture. The root
`groma.md` manifest is public; the workflow stages its Node wrapper around the compiled binaries so
the workspace-only development dependencies are not part of the published package.

## Before starting a feature

Describe every new supported product flow as a Gherkin scenario before implementation. The scenario is the semantic
authority: it names the user action and observable outcome without specifying terminal keystrokes or implementation
details. Do not create Gherkin scenarios solely to test UI rendering.

Confirm that the actor, entry point, observable result, and approved example are clear before changing code.

## Open a pull request

Before requesting review:

- Link exactly one Backlog task and keep the PR focused on that task. Split unrelated work into separate tasks and PRs.
- Describe the actor, entry point, and observable result. For a new supported product flow, add its Gherkin scenario
  before implementation.
- Keep Backlog traceability current while working: record each changed repository file and, when architecture is
  affected, each exact element `id` on the task as soon as it changes. Use the `backlog` CLI; do not edit task
  Markdown directly.
- Update canonical architecture or product documentation when the represented contract changes. Use Groma commands for
  Groma-owned architecture files instead of editing those files with generic tools.
- Do not add unrequested compatibility behavior, fallbacks, recovery paths, speculative abstractions, or unrelated
  cleanup.
- Test business logic and invariants rather than decorative UI details, exact labels, colors, borders, or architecture
  prose. Keep architecture fixtures under `test/fixtures/`.
- Run `bun run check` after code changes. For terminal changes, run the approved scenario in a PTY when the task
  requires it. Documentation-only PRs may skip the code test suite.
- Review the final diff for unrelated files and state the checks you ran, any checks you could not run, and any known
  limitations in the PR description.

## Make the change

- Follow the nearest existing implementation pattern and keep the path from entry point to result easy to explain.
- Update canonical Markdown when the represented architecture or product contract changes.
- Keep C4 identity and ownership in the nested `groma` mapping, standard OKF metadata at the top level, and long overview
  prose in the Markdown body. Do not add a duplicate level-one heading.
- Add focused lower-level tests for implementation rules that do not belong in a product-flow scenario.
- Do not add compatibility behavior, fallbacks, or speculative abstractions without an explicit product requirement.
- For Backlog-tracked work, record each changed file and each affected element `id` on the task as you go, before
  changing the next file. [AGENTS.md](AGENTS.md) describes that loop under Backlog change tracking.

## Verify the result

Run the checks relevant to the change:

```sh
bun run check
```

`bun src/typescript-scanner.ts` prints the C4 candidates the scanner reads from this repository's import graph
without writing Markdown; `--glob` replaces the files it reads and `--ignore` adds to the files it skips.

For a terminal feature, finish by running its approved scenario through the real TUI in a PTY when the task requires a
terminal walkthrough.

Before handing off the change, review the diff, remove unnecessary complexity, and report which checks passed or could
not be run.
