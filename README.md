# Groma

Groma keeps a software architecture blueprint close to the code it describes. It stores the architecture as readable,
Git-native Markdown, presents it as an interactive C4 model, and can reconcile supported source changes back into that
model.

The result is architecture documentation that can evolve with the system instead of becoming a disconnected diagram. The
Markdown remains useful even if you stop using Groma.

## What Groma is for

Groma is designed for teams and coding agents that want to:

- describe people, systems, containers, components, and their relationships in ordinary Markdown;
- distinguish the architecture that exists from a planned architectural change;
- compare a plan with the observed system in a live, navigable C4 view; and
- review architectural changes alongside the code in Git.

## The C4 layers

C4 explains a software architecture by progressively revealing more detail:

- **System Context** shows the people and software systems involved and how they interact.
- **Container** opens one system to show the applications and data stores that make it work.
- **Component** opens one container to show its cohesive responsibilities and their collaborations.
- **Code** shows how a component is implemented in source code.

## How it works

Groma has three main flows:

1. **Scan:** Run the scanner to turn source code into a basic C4 model in local Markdown. Language and ecosystem plugins
   analyze the supported source and return scan results for the scanner to emit.
2. **View:** Explore the current architecture in terminal or web viewers.
3. **Plan:** Describe the intended architecture by adding blueprints for new components, then watch the plan become
   reality as agents implement the code.

See the [product model](docs/product-model.md), [viewer guide](docs/viewer.md), and
[scanner guide](docs/scanners/index.md) for the exact behavior.

## Try Groma

Install Groma and start it:

```sh
npm install groma.md
groma
```

Or start the web interface:

```sh
groma web
```

For product guides, technical references, and contributor resources, see the
[documentation index](docs/index.md).
