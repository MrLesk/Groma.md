# Groma

Groma is this repo's architecture in Git: Markdown you can read, one C4 world
you can walk. Solid boxes exist. Ghosts are next. A generated picture of the
same repo is already out of date.

The Markdown remains useful even if you stop using Groma. People and agents
still change it through Groma, not by editing those files by hand.

## Product promise

A scan succeeds when a person can recognize the resulting architecture well
enough to navigate and improve it. Later scans refresh Code references and
must not rewrite curated prose.

A plan succeeds when the next parts — and required changes to existing parts —
are visible as ghosts on the same world, and can be accepted without inventing
a second identity.

## What you do

Groma is the only writer of files under `groma/`.

1. Open a viewer — see the world. `groma view` starts the TUI plugin. It
   does not scan.
2. `groma scan` — scan this repo. Core updates Markdown. The command
   prints `ok` and a short summary, not the architecture.
3. Change the architecture through Groma. New parts and required changes
   become plan ghosts. Explanations of an existing part stay on that
   observed document.
4. `groma accept <id>` — accept that ghost if a scan has matched it.
   Otherwise the command fails. A scan never accepts a ghost on its own.

## The C4 layers

- **System Context** shows the people and software systems involved and how
  they interact.
- **Container** opens one system to show the applications and data stores
  that make it work.
- **Component** opens one container to show its cohesive responsibilities
  and their collaborations.
- Component details show the scanner, exact file, and optional symbol behind
  that component. Code is not a separate viewer level.

See the [documentation index](docs/index.md) and the
[product model](docs/product-model.md) for the exact rules.

## Try Groma

From this repository:

```sh
groma view
```
