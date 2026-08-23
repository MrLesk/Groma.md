# Groma documentation

Groma is this repo's architecture in Git: Markdown you can read, one C4 world
you can walk. Solid boxes exist. Ghosts are next. Groma is the only writer of
the files under `groma/`.

## See

`groma scan` updates Markdown from this repo and prints `ok`. A viewer
shows the world. `groma view` opens the terminal map (text without a
TTY). `groma web` serves the isometric web map in the browser and pins
live Backlog work on the element each task touched last. `groma
instructions` prints the shipped workflow guide.

- [Scanners](scanners/index.md)
- [Viewers](viewers/index.md)
- [Web viewer and live work](viewers/web/index.md)
- [Observed architecture](../groma/observed/README.md)

## Change and accept

Change the architecture through Groma. Required changes and new parts become
plan ghosts. Explanations stay on the observed element. `groma create` and
`groma edit` author ghosts and explanations. `groma accept <id>` applies a
ghost only after a scan has matched it.

- [Product model](product-model.md)
- [Plans](../groma/plans/README.md)
- [Component Markdown contract](../groma/README.md)

## Product principles

- [Groma manifesto](../MANIFESTO.md)

## Contribute

- [Contributing guide](../CONTRIBUTING.md)
