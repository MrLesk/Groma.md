# Scanners

`groma scan` reads this repository, sends the result to Groma core, and
prints `ok` plus a short summary. It does not print the architecture. Core
writes or refreshes Markdown. The command runs once and exits. The summary
reads `created N, refreshed N, matched N`: created counts new observed
files, refreshed counts observed matches, matched counts ghost matches.
`groma scan` needs a git work tree, `groma/observed/README.md`,
`groma/missing/README.md`, and the `groma/plans/` directory, where each
plan directory holds its own `README.md`.

`groma scan --watch` stays open and folds each settled change to the
plugin file set. It does not scan at start. A change settles after 150 ms
without further changes; each fold prints `ok` plus the summary, and a
failed fold prints its error on stderr. SIGINT or SIGTERM stops the watch.

```text
groma scan → plugin result → core writes Markdown → ok
groma scan --watch → the same loop, once per settled source change
```

The plugin result is a list of candidates. Each has a kind, a name, a
responsibility, the parent candidate's name for containers and
components, and Code references. A Code reference is the scanner, an
exact repository-relative file, and an optional symbol. That result does
not contain architecture IDs and is not the user-facing output. The
TypeScript plugin sends empty responsibilities and no people or
relationships.

Core matches a candidate to an existing `code` reference (by scanner and
file, even when the symbol changed), else to the kebab-case of its name.
A plan that restates an observed ID takes the match. An observed match
replaces the document's `code` list with the candidate's references and
keeps the body. A ghost match attaches `code` to the planned document and
leaves it planned. Anything else becomes a new observed file. After the
first write, scans never rewrite the body. A scan never turns a ghost into
observed architecture. `groma accept` needs that match and runs one scan
itself when the ghost has no `code` yet. `groma view` and `groma web` run
the same watch in-process and republish the map after each fold.

See [Creating a scanner plugin](creating-a-plugin.md) for the shared
interface. TypeScript is the generic TypeScript plugin, not the model.
A Nest or Next plugin would be a later mapping. Core never reads
`package.json` or other language project files.

## Scanner plugins

- [TypeScript](typescript/index.md)
- [.NET/C#](dotnet-csharp/index.md) (not built yet)
