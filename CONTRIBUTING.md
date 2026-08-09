# Contributing to Groma

Thank you for helping build Groma. This guide takes you from a fresh checkout to a verified change.

## Start with the product

Read the [Groma manifesto](MANIFESTO.md) to understand the product principles, then use the
[documentation index](docs/index.md) to find the contract or product flow relevant to your change. Architecture Markdown
is the source of truth for what Groma represents and shows.

Keep each contribution focused on one approved outcome and one supported example. Use Backlog.md for tracked product or
code work; small documentation corrections can be made directly.

## Set up the repository

Groma uses Bun and requires Node.js 20.19 or newer.

```sh
bun install
bun run check
```

Start the web viewer with `bun run viewer`. The command prints the local URL to open.

## Before starting a feature

Describe every new supported product flow as a Gherkin scenario before implementation. The scenario is the semantic
authority: it names the user action and observable outcome without specifying DOM interactions, terminal keystrokes, or
implementation details. Do not create Gherkin scenarios solely to test UI rendering. When web and terminal viewers
provide the same behavior, they share the same scenario.

Confirm that the actor, entry point, observable result, and approved example are clear before changing code.

## Make the change

- Follow the nearest existing implementation pattern and keep the path from entry point to result easy to explain.
- Update canonical Markdown when the represented architecture or product contract changes.
- Add focused lower-level tests for implementation rules that do not belong in a product-flow scenario.
- Do not add compatibility behavior, fallbacks, or speculative abstractions without an explicit product requirement.

## Verify the result

Run the checks relevant to the change:

```sh
bun run check
bun run test:viewer:browser
bun run test:release-gate
```

For a feature, finish by running its Gherkin scenario through the applicable Playwright BDD drivers and confirming the
same semantic outcome on every supported surface. The terminal driver must exercise the real TUI through a PTY. Any
browser-hosted terminal is test infrastructure, not a user-visible Groma surface.

Before handing off the change, review the diff, remove unnecessary complexity, and report which checks passed or could
not be run.
