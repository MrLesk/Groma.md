# TypeScript scanner

The TypeScript scanner reports supported `.ts` and `.tsx` files without requiring Groma comments, IDs, or types in application code.

It uses `git ls-files`, the configured globs, and `.gitignore` to select files. Declaration, test, and spec files are excluded by default. The compiler resolves used imports, including aliases and package exports, to selected repository source. External dependencies do not become source entries.

Each file remains one atomic evidence entry with every recognized exported function, class, interface, type, enum, or variable declared in that file. Package bins and import structure identify module roots below the package root. Import distance assigns files to the nearest module root, with common directories as the deterministic fallback. The import graph remains internal analysis data.

These source roots and file memberships are evidence, not C4 ownership. Core preserves curated multi-file components and creates a singleton only for a previously unknown file.


## Operations and callback wiring

Each nested `tsconfig.json` and its referenced configurations supplies compiler
options for its included files. The nearest containing configuration owns a file;
a referenced configuration wins a tie with its entry configuration. Source files
outside configured sets still receive source analysis with the default compiler
options. Physical source files and operations remain single entries. Compiler contexts
contribute all invocation claims so core can detect conflicting resolutions. The compiler resolves operation
aliases across re-exports before core applies file ownership, and it
retains executable wrappers as separate operations. Supported concrete object
arguments and parameter forwarding identify supplied named callbacks. Unknown
values, unsupported member origins, and bounded paths remain unresolved.

The scanner reports [shared operation evidence](../evidence.md), not C4
relationships. Core owns the [supplied-operation rule](../../relationship-inference.md#current-inference-rule)
and writes selected interactions. Direct call evidence is not automatically
selected. Jelly was compared offline and is not required to run this scanner.

Changes to nested TypeScript configurations or package manifests refresh the
scanner through the same watch runtime as source edits.
