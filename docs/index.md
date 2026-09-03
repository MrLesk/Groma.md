# Groma documentation

Groma keeps architecture in Git as Markdown you can read and one C4 world you
can walk. Solid boxes exist. Ghosts are next. Groma writes architecture
records as a strict OKF v0.2 application profile. `groma init` opens a guided
setup for the project name and storage root. It uses the visible `groma/`
directory by default or the hidden `.groma/` directory when selected. Running
it again edits the current project name, keeps the chosen root, and refreshes
Groma's managed agent instructions. Setup can install Backlog.md when it is
missing. When the architecture has no observed components, setup can run the
first scan and open either viewer. The resulting `project.md` belongs to the
project owner.

Without a terminal, pass both values explicitly:

```bash
groma init "Shop" --directory groma
```

## See

`groma scan` updates Markdown from this repo and prints `ok`. A viewer
shows the world. `groma view` opens the terminal map (text without a
TTY). `groma web` serves the isometric web map in the browser and pins
live Backlog work on the element each task touched last. `groma export
<directory>` writes the current Web view as a read-only static site.
On a TTY, `groma instructions` opens the local guide screen. A named guide or
non-interactive use prints the human guide as plain text. Agent operating rules
stay separate: `groma agent-instructions [guide]` always prints plain Markdown.

- [Scanners](scanners/index.md)
- [Viewers](viewers/index.md)
- [Web viewer and live work](viewers/web/index.md)
- [Architecture Markdown contract](component-markdown.md)
- [Agent instructions for curating a scan](agent-instructions/index.md)

## Change and accept

Change the architecture through Groma. New parts are drafted as ghosts at
the path they will keep. Explanations stay on the element. `groma draft`,
`groma edit`, and `groma add relation` author ghosts, meaning, draft tags, scan
curation, and collaborations. `groma accept <id>` applies a ghost only after
a scan has matched it.

- [Product model](product-model.md)
- [Component Markdown contract](component-markdown.md)

## Product principles

- [Groma manifesto](../MANIFESTO.md)

## Contribute

- [Contributing guide](../CONTRIBUTING.md)
