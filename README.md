# Groma

Groma is this repo's architecture in Git: Markdown you can read, one C4 world
you can walk. Solid boxes exist. Ghosts are next. A generated picture of the
same repo is already out of date.

The architecture Markdown remains useful even if you stop using Groma. It is
an OKF v0.2 bundle with Groma's explicit architecture profile. People and
agents change architecture records through Groma. The project profile in
`groma/project.md` is user-owned and editable from the web map.

## Product promise

A scan succeeds when a person can recognize the resulting architecture well
enough to navigate and improve it. Later scans refresh Code references and
must not rewrite curated prose.

A plan succeeds when the next parts, and required changes to existing parts,
are visible as ghosts on the same world, and can be accepted without inventing
a second identity.

## What you do

Groma is the only writer of architecture element and revision files under
`groma/`.

Run bare `groma` in a terminal to open the repository launcher. Move through
its actions with Up and Down, then press Enter to run one or open Instructions.
The Instructions screen keeps the same repository context, starts on Overview,
and lets you choose a shipped guide or return with Backspace. Piped `groma` and
`groma --plain` print the same repository context and actions without waiting
for input. The interactive launcher keeps less common syntax behind an
Advanced commands row. Enter opens a read-only command table where `<name>`
marks a required parameter, `[option]` an optional one, and `…` additional
options. Up and Down select a command, the table keeps that row visible, and a
short explanation appears below it. J and K scroll the explanation one line;
Page Up and Page Down move it one page. The repository context, Back row,
plugin readiness, and footer stay fixed. Enter returns from the selected Back
row; Backspace always returns. Plain output includes those references without
requiring interaction.
A named guide such as `groma instructions authoring` also stays plain text.
These are human guides. `groma agent-instructions [guide]` separately prints
agent operating rules as Markdown; its default guide is `curation`.

Run `groma init` once to register the repository for coding agents. It adds one
managed Groma nudge to each distinct root `AGENTS.md` or `CLAUDE.md` that
already exists, or creates only `AGENTS.md` when neither exists. Repeated runs
reconcile that block without changing the surrounding instructions. This setup
runs only through `groma init`, never as part of `groma web`.

1. Open a viewer: see the world. `groma web` scans this repo and opens the
   browser map. On a TTY, `groma view` scans and opens the terminal map;
   without a TTY, with `--plain`, or with a target, it prints the existing
   world instead. Both live viewers continue with the same watch as `groma
   scan --watch`. Architecture Markdown changes update the map without
   scanning.
2. Publish the browser map without exposing Groma or the repository as a
   server. `groma export <directory>` scans this repo and writes a read-only
   static site with the current architecture, mapped Backlog work, task diffs,
   and architecture-owned source inspection. Add `--watch` to replace the
   static snapshot when local source, architecture, or Backlog work changes.
3. `groma scan`: scan this repo. Core updates Markdown. The command
   prints `ok` and a short summary, not the architecture. TypeScript is
   built in; C# solution and project scans require a .NET 10 SDK.
4. Change the architecture through Groma. New parts and required changes
   become plan ghosts: `groma create <name> --plan <plan-id> --kind <kind>
   --overview <markdown>` (plus `--parent <id>` for a container or component,
   and optional `--description <text>`) authors a new part. `groma edit <id>
   --plan <plan-id>` restates an existing one. Long explanations of an
   existing part stay in that observed document's body: `groma edit <id>
   --overview <markdown>`. The optional concise OKF description is edited
   separately with `--description <text>`.
5. `groma accept <id>`: apply the ghost once a scan has matched it. If
   none has, accept scans first and fails when the scan still does not
   match. A scan never accepts a ghost on its own.

Both maps show live Backlog work when the global Backlog.md CLI is available.
Groma embeds the Backlog work-source plugin, but architecture, viewers, and
exports continue without task data when the CLI is absent. The Welcome reports
that state and the current `bun i -g backlog.md` install command. The terminal map marks the assignees of
each task in progress on the elements the task references. The web map
stands one pin per assignee and task, or one generic pin for an unassigned
task, on the element the task touched last. Its Live work island filters the
pins and chips by the configured Backlog statuses, opens a task's details
from its pin or chip, and outlines the elements the task touches.

## The C4 layers

- **System Context** shows the actors and software systems involved and how
  they interact.
- **Container** opens one system to show the applications and data stores
  that make it work.
- **Component** opens one container to show its cohesive responsibilities
  and their collaborations.
- Component details show the scanner, exact file, and optional symbol behind
  that component. Code is not a separate viewer level.

The terminal map walks these levels one at a time; the web map shows all
of them on one sheet.

See the [documentation index](docs/index.md) and the
[product model](docs/product-model.md) for the exact rules.

## Try Groma

From this repository:

```sh
bun install
bun src/cli.ts view
```

`bun src/cli.ts web` opens the browser map at http://localhost:4747.
`bun src/cli.ts export ./groma-site` writes the same current map as static
files that can be served by any static host.
