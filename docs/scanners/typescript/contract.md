# TypeScript scanner contract

The TypeScript scanner plugin is the generic TypeScript plugin. A Nest or
Next plugin would be a later mapping. It must not require Groma-specific
types, comments, IDs, or renames in application source.

`groma scan` folds this mapping's candidates through core. The plugin does
not import Groma core and does not read `groma/` Markdown. It prints C4
candidates core consumes, plus relationships the standalone dump needs.

```sh
bun src/typescript-scanner.ts
bun src/typescript-scanner.ts --glob '**/*.ts' --ignore 'test/**'
```

## How it starts

1. `git ls-files` (cached and untracked, excluding `.gitignore`).
2. Keep files that match the glob list. Default: `**/*.ts`, `**/*.tsx`.
3. Drop files that match the ignore list. Default: `*.d.ts` and `*.test.*`
   / `*.spec.*`. Extra `--ignore` patterns are appended.
4. Read those files and build the import graph.

## How it becomes C4

- One system, named from `package.json` `name` when that file exists.
- The `package.json` `bin` file is the CLI container when it is TypeScript.
  Otherwise the unimported file with the most project imports is the CLI.
- A CLI import is a sibling container only when nothing else imports it
  and it has its own project imports. A file two or more already-identified
  containers import, that has its own project imports, is a shared hub
  container.
- Remaining files are components of the nearest container. Each file has
  one parent. `index.ts` takes the parent directory name.
- Paint modules (`atoms` / `molecules` / `organisms`, `draw*`, `paint.ts`)
  and shared type leaves are omitted. Unused roots are omitted.
- Relationships are import edges between containers. `starts` only when
  CLI is the sole importer. Every other edge is `uses`.

Every scanner plugin uses the same two knobs: globs and ignore.
