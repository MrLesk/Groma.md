# Groma documentation

Groma keeps architecture in Git as Markdown you can read and one C4 world you
can walk. Solid boxes exist. Ghosts are next. Groma writes architecture
records; the project profile in `groma/README.md` belongs to the project owner.

## See

`groma scan` updates Markdown from this repo and prints `ok`. A viewer
shows the world. `groma view` opens the terminal map (text without a
TTY). `groma web` serves the isometric web map in the browser and pins
live Backlog work on the element each task touched last. `groma
instructions` prints the shipped workflow guide.

- [Scanners](scanners/index.md)
- [Viewers](viewers/index.md)
- [Web viewer and live work](viewers/web/index.md)
- [Agent instructions for curating a scan](agent-instructions/index.md)

## Change and accept

Change the architecture through Groma. Required changes and new parts become
plan ghosts. Explanations stay on the observed element. `groma create`,
`groma edit`, and `groma relate` author ghosts, observed meaning, scan
curation, and collaborations. `groma accept <id>` applies a ghost only after
a scan has matched it.

- [Product model](product-model.md)
- [Component Markdown contract](component-markdown.md)

## Product principles

- [Groma manifesto](../MANIFESTO.md)

## Contribute

- [Contributing guide](../CONTRIBUTING.md)
