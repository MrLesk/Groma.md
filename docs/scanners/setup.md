# Project scanner settings

Open **Scanners** from the Groma splash screen (`s`), the terminal map
(`Shift+S`), or the web toolbar. `groma scanner settings` opens the same terminal
screen; without a terminal it prints the shared settings snapshot as JSON.

Each row shows project matches, package availability and readiness. **Add scanner**
accepts an exact npm package version, Git source or local package path. **Install**
uses a confirmed recommendation. **Restore** restores that selection's package;
for a missing local package, restore its directory. **Remove** changes this
project's selection and keeps saved architecture. **Check again** runs preparation
checks and a scan. **Update** requires an explicit version source for the same npm
package or Git repository. Local packages run directly from their selected path.
Terminal controls are shown in the footer; web update details are in each row.

A warning means no available selection matches detected source projects. A quiet
hint means some detected technology support is missing or needs checking. Actual
scanner failures show their error. No detected source project is neutral, so a
project used only to read saved or hand-written architecture needs no scanners.
Unknown metadata or compatibility remains unknown; a match never promises complete
architecture coverage. Official and third-party plugins use the same rules.

The live session watches relevant source declarations through the scanner adapter,
including with no scanner selected so new projects can appear in settings. Only
installed project selections without known metadata incompatibilities execute scans.
An incompatible Groma or project technology version blocks the plugin before its
code is loaded, including preparation checks. Settings show the reason; other
eligible scanners can still run. An empty observation set does not
write architecture. Missing packages do not prevent available scanners from
running. Partial scans keep Code and relationships from absent scanners, including
relationships that need several scanners. An active scanner failure prevents that
batch from replacing the last result. Package changes and shared exclusions update
subscriptions without restarting. Architecture and Backlog updates have separate
subscriptions.

## Initialization and command-line setup

`groma init` reviews scanner support before its first scan. The terminal shows
project declarations, evidence locations, package availability, and coverage
gaps, then offers the installable packages in one selection. The browser saves
project settings first, then shows the same proposal with package checkboxes
before scanning. Existing scanner selections are retained. Clear a new package selection to decline it.

Run the journey again after project technologies change:

```sh
groma scanner setup
```

Only selected additions are installed through the existing exact-version
installer. `scanners.json` in the selected architecture directory records their
exact package versions. Disable an existing scanner explicitly with
`groma scanner remove <id>`.

## Package availability and project readiness

`groma scanner discover` reads declarations and reports project matches and official candidates;
it does not run plugins or install anything. An unavailable candidate has no
verified release and cannot be selected for installation. The current optional
catalog entries remain unavailable until their releases are qualified.

`groma scanner list` reports whether each configured package is found or missing without executing it. `groma scanner check` separately loads
enabled plugins and runs their preparation checks:

- `ready`: the plugin's preparation check passed; the scan can still report a
  compilation or analysis error.
- `blocked`: a package, project tool, or preparation step is missing. The
  plugin's concrete instructions are printed and the command fails.
- `unchecked`: the plugin has no preparation hook. It remains enabled and its
  scan establishes whether the project is supported.

Java checks its packaged worker, the project JDK, and the prepared offline Maven
model. C# checks its worker, selected SDK, runtime, and project input. Angular
uses its bundled compiler and compatible TypeScript tooling to check the
project configuration and Angular compilation. This tooling does not replace
the project's dependencies or the TypeScript scanner's SDK.

Groma does not install a JDK, .NET SDK, or project dependencies. Follow the
reported project-tool instructions explicitly, then run `groma scanner check`
again. A failed active scanner prevents that batch from reaching architecture
reconciliation. Missing or unselected packages contribute no observation and do
not prevent other installed selections from running.

## Noninteractive use

Without a terminal, initialization and `groma scanner setup` report the
proposal and readiness without asking for input or installing packages.
`groma scanner setup --no-interactive` requests this behavior explicitly.
Discovery can also run before initialization in an existing Git repository:

```sh
groma scanner discover --json
groma init 'My project' --directory groma
groma scanner setup --no-interactive
```

Install a chosen, qualified release explicitly with
`groma scanner add <package>@<exact-version>`. Use the exact source provided by
the verified release; the catalog does not invent published versions. For a
project whose scanner configuration is already committed, CI restores and
checks it with:

```sh
groma scanner install
groma scanner check
groma scan
```

Local scanner paths remain available for development through `scanner add`;
they do not establish that an official public release exists.

Scanner selection and readiness are operational configuration, not OKF
concepts or C4 elements. Ordinary Markdown and OKF readers keep the same
architecture records and links. Groma's existing scanner module management
owns package selection; each language plugin owns preparation requirements.
