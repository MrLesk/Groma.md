<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/lockup-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/assets/lockup.svg">
    <img src=".github/assets/lockup.svg" alt="groma.md" width="300">
  </picture>
</p>

<p align="center">
  <strong>Your architecture, alive.</strong><br>
  Built on C4. Stored in Open Knowledge Format.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/groma.md"><img src="https://img.shields.io/npm/v/groma.md?color=1D9E75&label=npm" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-1D9E75" alt="MIT license"></a>
  <a href="https://groma.md"><img src="https://img.shields.io/badge/docs-groma.md-1D9E75" alt="Documentation"></a>
</p>

**Groma is a live architecture map for your repository.** Keep it open while you and your coding agents work. It watches supported source files, adds newly discovered components, and updates the relationships it can automatically detect. With [Backlog.md](https://github.com/MrLesk/Backlog.md), it also shows tasks on the architecture they affect.

Groma uses the **[C4 model](https://c4model.com)** to organize systems, their applications and data stores (containers), and the components inside them. Actors and external systems show who uses the software and what sits outside its boundary.

**[Open Knowledge Format (OKF) 0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md)** keeps that knowledge readable, linked, and portable as ordinary Markdown in Git. Groma interprets those documents as an interactive architecture map.

Groma is **free, MIT-licensed, and local**. Its built-in scanner and viewers work offline after installation. The browser viewer uses a local server started by Groma. No hosted backend, database, account, or AI service is required.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/web-dark.gif">
    <source media="(prefers-color-scheme: light)" srcset=".github/assets/web-light.gif">
    <img src=".github/assets/web-light.png" alt="Groma's browser architecture map zoomed into the Web shell component" width="100%">
  </picture>
</p>

## What you can do

| When you need to… | Use Groma to… |
| --- | --- |
| Explore an unfamiliar codebase | Browse systems, containers, and components, then inspect the source behind them. |
| Explain how a feature works | Write relationships and named flows that readers can follow step by step. |
| Plan a change | Show proposed architecture as drafts beside existing components. |
| Follow work by people and agents | Watch source-driven map updates and see linked Backlog.md tasks in context. |
| Share architecture knowledge | Review Markdown changes in Git or export a read-only browser map. |

## Get started

**Recommended: Groma + Backlog.md.** Groma provides the architecture map. Backlog.md provides the tasks shown on it. Groma also works independently.

Install both tools, then initialize the repository:

```sh
npm i -g groma.md backlog.md
cd your-repo
groma init
```

macOS requires Apple Silicon. Intel Macs are not supported.

`groma init` starts by creating the Git repository when needed, then sets the project name and architecture folder. Interactive setup asks for those values; without a terminal, pass them explicitly as `groma init "Shop" --directory groma`. Both forms initialize Backlog.md when its CLI is available, including Backlog.md's AGENTS.md nudge. Existing Git and Backlog.md projects are kept unchanged. Accept the first scan and select the browser map when setup finishes.

The terminal setup offered by `groma view` and the browser setup page from `groma web` use the same repository initialization flow.

To open the map later:

```sh
groma web
```

The browser map uses port `4747` by default. Keep the process running while you work. Supported source changes trigger new scans; architecture Markdown changes update the map without a page reload.

**Using Groma alone:** install only `groma.md`, run `groma init`, and decline the optional Backlog.md installation. The architecture map works without task integration.

See the [setup guide](docs/index.md) for non-interactive initialization.

## Keep the map open while you work

### In the browser

Select a component to read what it does. Open **How it's built** to inspect its source files and supported code declarations. Follow a relationship to inspect its endpoints, or select a named flow to walk through its steps.

As you save supported code changes, Groma refreshes the source evidence and detected relationships. Newly discovered files can add components to the map. Changes made through Groma's authoring commands also appear in the open viewer.

The browser can edit supported description fields and group or combine selected components. Use the CLI for drafting software and creating relationships; the browser's creation controls are not complete.

[Browser guide](docs/viewers/web/index.md)

### In the terminal

```sh
groma view
```

The interactive terminal map also scans and watches the repository. Browse the hierarchy, inspect components, and see linked work without leaving your terminal.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/terminal-map-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/assets/terminal-map-light.svg">
    <img src=".github/assets/terminal-map-light.svg" alt="Groma's terminal architecture map inside a container" width="100%">
  </picture>
</p>

Run bare `groma` for the launcher. Use `groma view --plain` to read the saved architecture as text without starting a scan or a live viewer.

[Terminal guide](docs/viewers/tui/index.md)

## Turn source evidence into useful architecture

A scan gives you a starting point, not a finished explanation of the system. New source files begin as individual components. People and agents read the code, choose useful boundaries, name responsibilities, and add explanations.

Use Groma's CLI to inspect records, rename elements, describe their purpose, and combine or group supported scan records. Settle component boundaries before adding explanations to records that need to be moved or combined.

**Later scans preserve authored explanations and curated file membership.** They refresh supported source evidence without replacing your descriptions. Review those explanations as the code changes.

Use Groma's commands for Groma-owned architecture files rather than editing them directly. The [curation guide](docs/agent-instructions/index.md) explains the supported operations and their limits.

## Explain relationships and follow named flows

**Detected relationships** come from supported source analysis. They are evidence for particular code connections, not proof of every runtime interaction or business responsibility.

**Authored relationships** describe interactions that you or an agent have checked. Code-to-code relationship commands use exact repository-relative source files, not component IDs. For example, after both files have component owners:

```sh
groma add relation src/checkout-client.ts src/payment-endpoint.ts \
  --description "Requests payment authorization" \
  --technology "HTTPS"
```

Actor and external-system relationships can use their architecture IDs.

**Named flows** explain a scenario through existing relationships. Each flow has ordered steps describing what happens from one endpoint to the next. In the browser, select a step or use Previous and Next to follow its path and inspect the components involved.

[Relationships and flows](docs/component-markdown.md) · [Authoring guide](docs/agent-instructions/index.md)

## Plan changes beside existing architecture

Draft systems, containers, components, and relationships before they are implemented. Draft elements appear with dashed outlines beside the architecture that already exists. A draft can also identify existing elements that a change will touch.

A scanned match does not automatically accept a draft. Accept a drafted software element explicitly with `groma accept <id>` after a scan has matched its code. Planned relationships also require explicit acceptance.

[Draft lifecycle](docs/product-model.md#drafts)

## See Backlog.md work in context

With Backlog.md installed and initialized, Groma connects tasks to architecture through their recorded modified files and exact architecture references.

In the browser, task pins show where a task last touched the mapped architecture. Selecting a task highlights its affected elements and opens its details, acceptance criteria, and available file diffs. Component details also show linked tasks. The terminal map marks linked In Progress work.

**Keep task links current as you work.** Groma does not guess which task caused a file change. People and agents record changed paths and affected architecture IDs through Backlog.md's CLI. Groma reads that task information; it never edits tasks itself.

[Live work guide](docs/viewers/web/index.md) · [Task-linking instructions](docs/agent-instructions/index.md#backlog-task-links)

## Groma is agent-ready

People and coding agents use the same CLI. AI is optional, but Groma gives agents a clear, plain-text interface for scanning, reading, and authoring architecture.

`groma init` registers Groma in the repository's `AGENTS.md` or `CLAUDE.md` instructions. `groma agent-instructions` prints the curation guide, and every command explains its arguments through `--help`. Agents can inspect the current architecture, annotate responsibilities, combine scan records, add relationships and flows, create drafts, and keep Backlog.md links current without editing Groma-owned Markdown directly.

```sh
groma agent-instructions
groma view --plain
```

Ask your coding agent:

```text
Read the current Groma architecture with `groma agent-instructions` and `groma view --plain`. Compare it with the source code, then annotate the architecture so it reflects the code: combine records that share a responsibility, add missing overviews and relationships, and keep Backlog.md task links current. Use Groma's CLI for architecture changes, then summarize what you changed.
```

For human guides, run `groma instructions`.

## Keep your knowledge in Markdown

Architecture lives in the selected `groma/` or `.groma/` folder as an **OKF 0.2 bundle**. Each architecture element has its own Markdown document. Linked records describe relationships, flows, and drafts.

**C4 defines the architecture structure. OKF keeps its knowledge portable.** Groma's application profile connects the two, adding the identity and interpretation needed for the map. The documents remain readable without Groma, and Git lets you review architecture changes alongside code changes.

[Architecture Markdown contract](docs/component-markdown.md)

### Browse earlier architecture

The browser's revision menu opens read-only architecture from earlier commits that changed the selected Groma folder. Supported snapshots show the architecture and source measurements from that revision, not today's live task activity.

## Share a snapshot

```sh
groma export ./site
```

Export a read-only browser map with architecture, flows, source inspection, and mapped task information. The exported site does not need a running Groma server. It does not include editing or Git revision history.

**Review the output before sharing it.** Exports can include source code, task details, and diffs. Anyone with access to the exported files can read that information. Hosting and access control are your responsibility.

[Static export guide](docs/viewers/web/index.md#static-publication)

## Supported languages and frameworks

| Language or framework | Status |
| --- | --- |
| TypeScript | ✅ Available |
| C#/.NET | ⏳ Coming soon |
| Java | ⏳ Coming soon |
| Your favorite language or framework | [Submit an issue with your request](https://github.com/MrLesk/Groma.md/issues) |

**TypeScript support is built in**, including supported `.ts` and `.tsx` source files. Declaration, test, and spec files are excluded by default. Additional languages and frameworks will arrive as scanner plugins.

Automatic relationship detection currently covers supported cases where code supplies a named function as a callback. Other interactions can be authored through Groma.

See [TypeScript support](docs/scanners/typescript/index.md) and the [relationship inference rule](docs/relationship-inference.md#current-inference-rule) for details.

## Experimental status

Groma is experimental. Expect rough edges, and review the first scan before treating it as your architecture.

Report missing source evidence, incorrect results, or command problems in [Issues](https://github.com/MrLesk/Groma.md/issues).

## Documentation and contributing

- [Documentation index](docs/index.md)
- [Product model](docs/product-model.md)
- [Scanner plugins](docs/scanners/creating-a-plugin.md)
- [Contributing guide](CONTRIBUTING.md)
- [Groma manifesto](MANIFESTO.md)

## License

Groma is free and open source under the [MIT license](LICENSE).
