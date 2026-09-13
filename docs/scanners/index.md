# Scanners

`groma scan` loads explicitly configured scanner modules through one registry. It collects every complete language
observation before core writes architecture Markdown. If an enabled scanner is
missing or fails, reconciliation does not start.

```text
source → complete scanner observations → core reconciliation → Markdown
```

An observation contains atomic files and symbols, source roots with parent links,
file membership, optional operation evidence, and diagnostics. It identifies the
scanner separately from its technology and analysis engine. It contains no C4
components or architecture IDs. TypeScript uses imports and directories to infer
source groups. C# preserves solutions and Roslyn projects. Dependency graphs stay
inside scanners; they are not a shared relationships field.

Successful scanner diagnostics appear in `ScanSummary.scannerDiagnostics`, paired
with the originating scanner identity. The `groma scan` report shows each message's
scanner ID, severity, code, and optional file and line. Diagnostics explain analysis
limitations without failing the scan. They remain scan results and are not written
to architecture Markdown. Fatal scanner errors still prevent reconciliation.

Core keeps curated file membership authoritative. Files already assigned to one component stay together. Only an unknown file becomes a new singleton component under its inferred source root. A drafted name match receives Code but stays a draft until `groma accept`.

New component labels use the source filename, then directory context, and then
container context to distinguish repeated roles. If a hash is still needed,
it appears in the label as well as the ID. Allocation avoids existing IDs and
titles; scans preserve previously authored titles and identities.

Source watching belongs to one shared source runtime per watch session. The
first relevant change collects an initial observation from every enabled scanner.
Each scanner declares `watch.include` and `watch.exclude` patterns for source
and configuration changes, including newly created files. The shared runtime
matches paths against those declarations and groups nearby
changes and runs only matching scanners; overlapping subscriptions run together.
Changes received during analysis are queued, and scanner runs never overlap.

The session retains each scanner's latest successful observation in memory.
After a successful batch, it emits the complete combined evidence, including
unchanged scanners' observations. A failed scanner leaves pending work and
prevents publication; the next relevant source change also runs that pending
work. There is no automatic retry. Returning `undefined` removes that scanner's
previous observation. Closing a session releases its watcher and waits for
active analysis and publication.

The source runtime emits observations without accessing architecture records.
The Groma adapter sends them to core for reconciliation. In OKF, Code links and
relationship rows remain ordinary readable Markdown; this runtime adds no
stored metadata. In C4, it is part of the existing scan lifecycle responsibility,
not another architecture level. Core still owns architectural interpretation.

`groma scan --watch` publishes after source changes; its first batch establishes
the session baseline and updates architecture. Starting a watch does not scan
or require source analysis to succeed. `groma view` and `groma web` run one scan
before opening, then start a source watch session.
Source and architecture watch subscriptions are ready before viewer startup
completes, so the first edit can update the open map.

Optional modules are enabled only through `scanners.json` in the selected
`groma/` or `.groma/` directory, normally written by `groma scanner add`.
`groma scanner list` derives found and missing package availability without executing third-party code.
`groma scanner check` runs enabled plugins' project preparation checks.
Network installation happens only after explicit selection in setup,
`scanner add`, `scanner update`, or `scanner install`.

Bare `groma` shows scanner readiness beside the embedded Backlog work-source
readiness in one fixed bottom row. The complete scanner inventory and scanner
management syntax remain under Advanced commands.

## Scanner settings

Use the same `scanners.json` for scanner selection and settings. Add an
optional `settings` object to the relevant entry, preserving its installed
`source` and all other entries:

```json
{
  "scanners": [
    {
      "id": "csharp",
      "source": "./tools/csharp-scanner-package",
      "settings": { "input": "src/Library/Library.csproj" }
    },
    {
      "id": "rust",
      "source": "./tools/rust-scanner-package",
      "settings": { "manifest": "crates/library/Cargo.toml" }
    }
  ]
}
```

Each scanner documents its settings and defaults. Project paths are relative
to the repository root. Groma passes these settings to readiness checks and
scans; plugins do not read separate Groma configuration files. Compiler options
remain in native project files. Run a new scan or restart an active viewer or
watch session after changing settings. Scanner add and remove preserve settings
on retained entries. See the [plugin contract](creating-a-plugin.md#scanner-settings).

## Excluding source evidence

Add an optional shared `exclude` array to `scanners.json` inside the selected
`groma/` or `.groma/` directory. Keep any existing `scanners` entries:

```json
{
  "scanners": [],
  "exclude": ["/scripts/", "**/*.generated.ts", "!src/keep.generated.ts"]
}
```

Patterns use [Git ignore rules](https://git-scm.com/docs/gitignore), relative
to the repository root. Use `/` separators on every operating system.
Matching is case-sensitive. `/scripts/` excludes only the root scripts folder;
`scripts/` matches that folder name at any depth. `**/*.generated.ts` matches
that suffix at any depth. A later `!` pattern can undo an earlier match, but
cannot restore a file inside an excluded parent directory. `*`, `?`, character
ranges such as `[0-9]`, comments starting with `#`, and backslash escapes follow
the same Git ignore rules. In JSON, write a backslash as `\\`.

The list selects new evidence from every enabled scanner, including files
tracked by Git. Omitting `exclude` or using `[]` adds no exclusions. Each
scanner keeps its own language coverage and default exclusions; `!` does not
restore files omitted by those defaults. Compiler analysis can still read
excluded files as context, and a failed scanner still blocks the whole scan.

Run `groma scan` after editing the list. Restart an active viewer or
`groma scan --watch` to load the new configuration; excluded source paths no
longer trigger its scans. Scanner add, remove, and setup preserve the list.

Exclusions do not delete or hide components already stored on the map, and
do not change their ownership or authored Markdown. New excluded files do not
become components. Derived interactions refresh from the remaining evidence;
authored relationships remain intact.

## Scanners

- [Discover project technologies and official scanner candidates](discovery.md)
- [Select scanners and check project readiness](setup.md)
- [TypeScript](typescript/index.md)
- [C#/.NET](dotnet-csharp/index.md)
- [Shared contract](creating-a-plugin.md)

## Relationship inference design

The [inference design](../relationship-inference.md) records the accepted
direction for deriving architecture relationships from temporary scanner facts.
[Architecture findings](../architecture-findings.md) record duplicated and
similar operations as review questions, not map collaborations.
[Scanner evidence](evidence.md) defines the language-neutral semantics and
verified examples. Core writes selected derived interactions in Markdown; it
does not persist the raw analysis graph. The [plugin guide](creating-a-plugin.md)
defines the executable contract.
