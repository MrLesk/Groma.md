# Scanners

`groma scan` loads the embedded TypeScript scanner and explicitly configured
scanner modules through one registry. It collects every complete language
observation before core writes architecture Markdown. If an enabled scanner is
missing or fails, reconciliation does not start.

```text
source → complete scanner observations → core reconciliation → Markdown
```

An observation contains atomic files and symbols, project scopes, inferred placements, temporary source relationships, optional operation evidence, and diagnostics. It contains no C4 components or architecture IDs. TypeScript uses imports and directories for placement. C# uses Roslyn projects.

Core keeps curated file membership authoritative. Files already assigned to one component stay together. Only an unknown file becomes a new singleton component under its inferred scope. A drafted name match receives Code but stays a draft until `groma accept`.

`groma scan --watch` repeats the same complete scan after a loaded scanner
matches a changed source path. `groma view` and `groma web` run one scan before
opening, then load one registry for their watch lifecycle. Source and
architecture watch subscriptions are ready before viewer startup completes,
so the first edit can update the open map.

Optional modules are enabled only through `scanners.json` in the selected
`groma/` or `.groma/` directory, normally written by `groma scanner add`.
`groma scanner list` derives built-in, found,
and missing package availability without executing third-party code.
`groma scanner check` runs enabled plugins' project preparation checks.
Network installation happens only after explicit selection in setup,
`scanner add`, or `scanner install`.

Bare `groma` shows scanner readiness beside the embedded Backlog work-source
readiness in one fixed bottom row. The complete scanner inventory and scanner
management syntax remain under Advanced commands.

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
