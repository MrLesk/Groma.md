# TypeScript scanner contract

The TypeScript scanner plugin is the generic TypeScript plugin. A Nest or
Next plugin would be a later mapping. It must not require Groma-specific
types, comments, IDs, or renames in application source.

`groma scan` folds this mapping's candidates through core. The plugin does
not import Groma core and does not read `groma/` Markdown. It prints C4
candidates core consumes, plus relationships the standalone dump needs.
The relationships never reach core or Markdown; `groma scan` folds only
the candidates. Every responsibility is empty, so a new document gets its
heading and no prose until someone writes it.

```sh
bun src/typescript-scanner.ts
bun src/typescript-scanner.ts --glob '**/*.ts' --ignore 'test/**'
```

The approved example is [expected.txt](expected.txt). Its first line is
the command that produced it, run from this repository's root.

## How it starts

1. `git ls-files` (cached and untracked, excluding `.gitignore`).
2. Keep files that match the glob list. Default: `**/*.ts`, `**/*.tsx`.
   `--glob` replaces the default globs.
3. Drop files that match the ignore list. Default: `**/*.d.ts`,
   `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx`.
   Extra `--ignore` patterns are appended.
4. Read those files and build the import graph. Only relative import
   specifiers become edges, resolved by exact path or by adding `.ts`,
   `.tsx`, `.js`, `/index.ts`, or `/index.tsx`; a relative import written
   with a `.js` suffix does not resolve to the `.ts` file. Bare specifiers
   are ignored. A file's symbol is its first `export function`,
   `export async function`, or `export class`, and is absent otherwise.

## How it becomes C4

- One system, named from `package.json` `name`, else from the repository
  directory name.
- Every `package.json` `bin` file that is in the scanned file set is a CLI
  container. Otherwise the unimported file with the most project imports
  is the CLI.
- A CLI import is a sibling container only when nothing else imports it
  and it has its own project imports. A file two or more already-identified
  containers import, that has its own project imports, is a shared hub
  container.
- Remaining files are components of the nearest container. Nearest means
  the fewest import hops to a container; with none, a container whose
  directory (two or more levels deep) contains the file; otherwise the
  file is omitted. Each file has one parent.
- Names are the file stem, kebab-cased, with the first word capitalised.
  `index.ts` takes the parent directory name. A `bin` file is `Cli`. A
  duplicate container name is qualified with its directory name.
- Omitted: files under an `atoms`, `molecules`, or `organisms` directory,
  files named `paint.ts`, files whose first exported symbol starts with
  `draw`, files named `types.ts`, and leaves without project imports that
  two or more directories import.
- Relationships are import edges between containers. `starts` only when
  CLI is the sole importer. Every other edge is `uses`.

The glob and ignore knobs apply to the standalone program; `groma scan`
uses the defaults.
