# Scanners

`groma scan` loads explicitly configured scanner modules through one registry. It collects every complete language
observation before core writes architecture Markdown. Missing or failed scanners do not block successful observations. Their saved
Code references and derived relationships remain available.

```text
source → complete scanner observations → core reconciliation → Markdown
```

An observation contains atomic files and symbols, source roots with parent links,
file membership, optional execution-entry and operation evidence, and diagnostics. It identifies the
scanner separately from its technology and analysis engine. It contains no C4
components or architecture IDs. TypeScript uses imports and directories to infer
source groups. C# preserves solutions and Roslyn projects. Dependency graphs stay
inside scanners; they are not a shared relationships field.

Successful scanner diagnostics appear in `ScanSummary.scannerDiagnostics`, paired
with the originating scanner identity. The `groma scan` report prints the summary
counts, then one line per scanner ID and diagnostic code: severity, the diagnostic
count as `×N`, and the first listed diagnostic as an example, with its optional
file and line and the first line of its message. Diagnostics explain analysis limitations without
failing the scan. They remain scan results and are not written to architecture
Markdown. Import and execution failures appear separately in
`ScanSummary.scannerFailures`, with each scanner ID and its error. The report
prints every failure in full, including each syntax error that failed a scan.
Failed scanners contribute no fresh observation; healthy scanners still update the
architecture.

Core keeps curated file membership authoritative. Files already assigned to one component stay together. An explicit scanner source unit can associate unowned companion files with one component; other unknown files become singleton components. A drafted name match receives Code but stays a draft until `groma accept`.

The first scan with source files creates one system named from the project profile when no internal system is declared. This is groma.md's starting model; curation defines the actual system boundaries. Later scans reuse declared systems and never create additional systems from source roots. If several systems exist and a new file has no identifiable system, the scan reports the file as an error.

Source roots do not establish application boundaries. Core collects placement evidence across scanners before choosing a parent. Existing ownership or a matching declared boundary can identify a container. [Execution-entry evidence](evidence.md#execution-entries-and-container-placement) can establish an application container automatically. Core merges facts about the same physical entry, places its own unambiguous components, and leaves shared or uncertain sources directly under their known system. These components appear in an **Unidentified container** group. File counts and scanner order do not settle conflicting placement.

A rescan can complete a system-parented component's missing container placement. It preserves its ID, Code ownership, authored content, relationships and flows, rebasing Markdown links as its file moves. It never changes an existing container assignment or accepts a draft. No viewer-specific grouping or new stored metadata is needed.

New component titles use the source filename without its final extension.
Identifier casing such as `ProposalService` is preserved; filename separators
become spaces. Identity allocation uses directory and container context, then a
hash when needed, independently of that title. Components may share a title;
their IDs and exact Code references distinguish them. Repeated scans preserve
existing titles and identities, including human or agent curation.

Source watching belongs to one shared source runtime per watch session. The
first relevant change collects an initial observation from every enabled scanner.
Each scanner declares `watch.include` and `watch.exclude` patterns for source
and configuration changes, including newly created files. The shared runtime
matches paths against those declarations, outside each scanner's configured
exclusions, groups nearby changes and runs only matching scanners; overlapping
subscriptions run together.
Changes received during analysis are queued, and scanner runs never overlap.

The session retains each scanner's latest successful observation in memory.
Each batch emits successful evidence, including unchanged scanners' observations,
and all scanner failures. A failure removes that scanner's cached observation
and leaves pending work; the next relevant source change also runs that pending
work. There is no automatic retry. Returning `undefined` removes that scanner's
previous observation. Closing a session releases its watcher and waits for
active analysis and publication.

The source runtime emits observations without accessing architecture records.
The groma.md adapter sends them to core for reconciliation. In OKF, Code links and
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
`groma scanner check` checks source inputs and scanner-owned tools.
Network installation happens only after explicit selection in setup,
`scanner add`, `scanner update`, or `scanner install`.

Bare `groma` shows scanner readiness beside the embedded Backlog work-source
readiness in one fixed bottom row. The complete scanner inventory and scanner
management syntax remain under Advanced commands.

## Fresh checkouts

Each official scanner carries the tools needed for its supported source scan.
Installing project dependencies, building the application, or installing a
language SDK is not a prerequisite. Scanner installation supplies the engines;
scanning itself does not download or execute project tools.

Missing external types and generated code can limit individual call targets.
The scanner still reports source declarations and proven local interactions,
with unresolved facts left uncertain. This does not promise full application
compilation or every framework behavior. Syntax errors remain scan failures,
except in the [JavaScript scanner](javascript/index.md), which leaves a file it
cannot parse out of its evidence and warns.

This changes scanner execution, not the architecture model. In OKF, readers
still see ordinary Markdown, Code links and relationship rows. In C4, parsers
and runtimes belong to the existing scanner responsibility; dependencies do
not become new map elements. groma.md core continues to own architectural meaning.

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
to the repository root. groma.md passes these settings to readiness checks and
scans; plugins do not read separate groma.md configuration files. Compiler options
remain in native project files. Run a new scan or restart an active viewer or
watch session after changing settings. Scanner add and remove preserve settings
on retained entries. See the [plugin contract](creating-a-plugin.md#scanner-settings).

## Excluding source evidence

`scanners.json` inside the selected `groma/` or `.groma/` directory holds two
kinds of exclusion list: a global `exclude` array for every scanner, and an
`exclude` array on a scanner entry for that scanner alone:

```json
{
  "scanners": [
    { "id": "typescript", "source": "./plugins/typescript", "exclude": ["**/*.test.ts", "!/test/"] }
  ],
  "exclude": ["/scripts/", "/test/", "**/*.generated.ts", "!src/keep.generated.ts"]
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

The global list selects new evidence from every enabled scanner, including
files tracked by Git. A scanner's own list applies after it and to that scanner
alone, so it can add patterns, or restore with `!` a file the global list
excludes, as `!/test/` does for the TypeScript scanner above. A global `!`
pattern cannot restore a file a scanner's own list excludes; edit that scanner's
list instead. Adding a scanner with `groma scanner add`, setup, init or the web
writes the default exclusions its package declares into its entry, where they
are edited like any other pattern; updating a scanner keeps the entry's list.
Omitting `exclude` or using `[]` adds no exclusions. Only language coverage,
the files the language's own build compiles, stays built into a scanner; `!`
does not restore a file outside it. When a scanner lists source files and all of them are excluded for
it, groma.md skips its readiness check and scan. This keeps
excluded test projects from blocking a scan on incomplete fixture inputs.
When included sources remain, compiler analysis can still read excluded files
as context. A failed scanner keeps its saved evidence while successful scanners
publish their results.

Run `groma scan` after editing a list. Active viewers reload the configuration
on their own; restart `groma scan --watch` to load it. Excluded source paths no
longer trigger scans. Scanner add, update, remove and setup keep the existing
lists.

Exclusions do not delete or hide components already stored on the map, and
do not change their ownership or authored Markdown. New excluded files do not
become components. Derived interactions refresh from the remaining evidence;
authored relationships remain intact.

## Scanners

- [Discover project technologies and official scanner candidates](discovery.md)
- [Select scanners and check project readiness](setup.md)
- [TypeScript](typescript/index.md)
- [Python](python/index.md)
- [PHP](php/index.md)
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
