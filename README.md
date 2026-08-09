# Groma

Groma scans supported source code into a recognizable first architecture, lets people and coding agents refine its
meaning, and refreshes source observations without erasing those refinements. It stores the architecture as readable,
Git-native Markdown and presents it as an interactive C4 model.

The result is architecture documentation that can evolve with the system instead of becoming a disconnected diagram. The
Markdown remains useful even if you stop using Groma.

## Product promise

A scan succeeds when a person can recognize the resulting architecture well enough to navigate and improve it. After
that curation, Groma core uses later scan results to update the high-level code references in component frontmatter while
preserving the authored Markdown body. The viewer is part of this loop: architecture must be visible before it can be
planned or reviewed.

## What Groma is for

Groma is designed for teams and coding agents that want to:

- Start an unfamiliar project from a source-backed architecture they can recognize and correct.
- Describe people, systems, containers, components, and their relationships in ordinary Markdown.
- Preserve human and agent annotations while source observations change.
- Distinguish observed, missing, and planned architecture.
- Compare plans with the observed system in a navigable terminal C4 view.
- Review architectural changes alongside the code in Git.

## The C4 layers

C4 explains a software architecture by progressively revealing more detail:

- **System Context** shows the people and software systems involved and how they interact.
- **Container** opens one system to show the applications and data stores that make it work.
- **Component** opens one container to show its cohesive responsibilities and their collaborations.
- Component details show the scanner, exact file, and optional symbol behind that component; Code is not a separate
  viewer level.

## How it works

Groma has three main flows:

1. **Scan:** Run scanners to produce a recognizable architecture from supported source shapes. Groma core reconciles
   their results into components. Each component may list high-level Code references in frontmatter using the scanner,
   exact source file, and optional symbol. Multiple scanners may contribute to the same component.
2. **View:** Ask Groma core for observed, missing, and planned architecture, then explore its fixed-world projection in
   the terminal viewer. The viewer never reads Markdown directly.
3. **Plan:** Describe the intended architecture by adding blueprints for new components, then watch the plan become
   reality as agents implement the code.

See the [product model](docs/product-model.md), [viewer guide](docs/viewer.md), and
[scanner guide](docs/scanners/index.md) for the exact behavior.

## Try Groma

Install Groma and start it:

```sh
npm install groma.md
groma view
```

For product guides, technical references, and contributor resources, see the
[documentation index](docs/index.md).
