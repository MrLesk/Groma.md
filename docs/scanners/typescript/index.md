# TypeScript scanner

The TypeScript scanner plugin implements Groma's scanner-plugin interface.
It is the generic TypeScript mapping. It must not require Groma-specific
types, comments, or IDs in application source.

`bun src/typescript-scanner.ts [root]` prints the C4 candidates it reads
from the import graph: an indented tree of system, containers, and
components with their file and first exported symbol, the relationships
between containers, and a count line. `root` is the repository to scan
and defaults to the current directory. `--glob` replaces the default
globs and `--ignore` adds to the default ignore list; both may repeat.
`.gitignore` is honored through `git ls-files`. `groma scan` folds the
candidates.

The [TypeScript scanner contract](contract.md) names the mapping.
