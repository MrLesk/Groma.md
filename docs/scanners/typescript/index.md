# TypeScript scanner

The TypeScript scanner plugin implements Groma's scanner-plugin interface.
It is the generic TypeScript mapping. It must not require Groma-specific
types, comments, or IDs in application source.

`bun src/typescript-scanner.ts` prints a standalone import graph.
`--glob` and `--ignore` configure which files it reads. `.gitignore`
is honored through `git ls-files`. `groma scan` folds the candidates.

The [TypeScript scanner contract](contract.md) names the mapping.
