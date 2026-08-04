# Groma

Groma keeps a software architecture blueprint close to the code it describes. It stores the architecture as readable,
Git-native Markdown, presents it as an interactive C4 model, and can reconcile supported source changes back into that
model.

The result is architecture documentation that can evolve with the system instead of becoming a disconnected diagram. The
Markdown remains useful even if you stop using Groma.

## What Groma is for

Groma is designed for teams and coding agents that want to:

- Describe people, systems, containers, components, and their relationships in ordinary Markdown.
- Distinguish observed, missing, and planned architecture.
- Compare all plans with the observed system in a live, navigable C4 view.
- Review architectural changes alongside the code in Git.

## The C4 layers

C4 explains a software architecture by progressively revealing more detail:

- **System Context** shows the people and software systems involved and how they interact.
- **Container** opens one system to show the applications and data stores that make it work.
- **Component** opens one container to show its cohesive responsibilities and their collaborations.
- **Code** shows how a component is implemented in source code.

## How it works

Groma has three main flows:

1. **Scan:** Run a scanner to derive architectural information from supported source code. Groma core applies its domain
   rules to the scan result and decides what becomes observed architecture.
2. **View:** Explore observed, missing, and planned architecture in terminal or web viewers.
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
