# TypeScript scanner

The TypeScript scanner reports supported `.ts` and `.tsx` files without requiring Groma comments, IDs, or types in application code.

It uses `git ls-files`, the configured globs, and `.gitignore` to select files. Declaration, test, and spec files are excluded by default. Relative imports form a source graph; bare package imports do not.

Each file remains one atomic evidence entry with every recognized exported function, class, interface, type, enum, or variable declared in that file. Package bins and import structure identify scopes. Import distance assigns files to the nearest scope, with common directories as the deterministic fallback. Cross-scope imports remain temporary source evidence.

These scopes and placements are evidence, not C4 ownership. Core preserves curated multi-file components and creates a singleton only for a previously unknown file.


## Operations and callback wiring

One compiler program covers the selected source set. It resolves operation
aliases across relative re-exports before core applies file ownership, and it
retains executable wrappers as separate operations. Supported concrete object
arguments and parameter forwarding identify supplied named callbacks. Unknown
values, unsupported member origins, and bounded paths remain unresolved.

The scanner reports [shared operation evidence](../evidence.md), not C4
relationships. Core owns the [supplied-operation rule](../../relationship-inference.md#current-inference-rule)
and writes selected interactions. Direct call evidence is not automatically
selected. Jelly was compared offline and is not required to run this scanner.
