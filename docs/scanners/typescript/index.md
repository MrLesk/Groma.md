# TypeScript scanner

The TypeScript scanner plugin implements Groma's scanner-plugin interface.
It receives this repository's root and returns the shared scan-result model.

It must not require Groma-specific types, comments, or IDs in application
source.

The [TypeScript scanner contract](contract.md) will name the supported source
shapes when an approved example exists.
