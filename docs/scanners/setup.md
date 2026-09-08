# Select scanners and check project readiness

`groma init` reviews scanner support before its first scan. The terminal shows
project declarations, evidence locations, package availability, and coverage
gaps, then offers the installable packages in one selection. The browser saves
project settings first, then shows the same proposal with package checkboxes
before scanning. Existing scanner selections and embedded TypeScript are
retained. Clear a new package selection to decline it.

Run the journey again after project technologies change:

```sh
groma scanner setup
```

Only selected additions are installed through the existing exact-version
installer. `scanners.json` in the selected architecture directory records their
exact package versions. Disable an existing scanner explicitly with
`groma scanner remove <id>`.

## Package availability and project readiness

`groma scanner discover` reads declarations and reports official candidates;
it does not run plugins or install anything. An unavailable candidate has no
verified release and cannot be selected for installation. The current optional
catalog entries remain unavailable until their releases are qualified.

`groma scanner list` reports whether each configured package is built in,
found, or missing without executing it. `groma scanner check` separately loads
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
the project's dependencies or Groma's embedded TypeScript SDK.

Groma does not install a JDK, .NET SDK, or project dependencies. Follow the
reported project-tool instructions explicitly, then run `groma scanner check`
again. A failed enabled scanner prevents architecture reconciliation; Groma
does not present the other scanners' partial result as a completed update.

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
