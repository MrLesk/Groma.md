# Contributing to Groma

Thank you for helping build Groma. This guide takes you from a fresh checkout to a verified change.

## Start with the product

Read the [Groma manifesto](MANIFESTO.md) to understand the product principles, then use the
[documentation index](docs/index.md) to find the contract or product flow relevant to your change. Architecture Markdown
is the source of truth for what Groma represents and shows. It follows Groma's strict OKF v0.2 architecture profile;
the [component Markdown contract](docs/component-markdown.md) defines its reserved files, metadata, body, and
relationships.

Keep each contribution focused on one approved outcome and one supported example. Use Backlog.md for tracked product or
code work; small documentation corrections can be made directly.

## Set up the repository

Groma requires Bun 1.4.1 or newer and Node.js 20.19 or newer.

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

## Before starting a feature

Describe every new supported product flow as a Gherkin scenario before implementation. The scenario is the semantic
authority: it names the user action and observable outcome without specifying terminal keystrokes or implementation
details. Do not create Gherkin scenarios solely to test UI rendering.

Confirm that the actor, entry point, observable result, and approved example are clear before changing code.

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
