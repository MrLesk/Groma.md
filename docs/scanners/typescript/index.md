# TypeScript scanner

The TypeScript scanner reports supported `.ts` and `.tsx` files without requiring Groma comments, IDs, or types in application code.

It uses `git ls-files`, the configured globs, and `.gitignore` to select files. Declaration, test, and spec files are excluded by default. Relative imports form a source graph; bare package imports do not.

Each file remains one atomic evidence entry with every recognized exported function, class, interface, type, enum, or variable declared in that file. Package bins and import structure identify scopes. Import distance assigns files to the nearest scope, with common directories as the deterministic fallback. Cross-scope imports become source relationships.

These scopes and placements are evidence, not C4 ownership. Core preserves curated multi-file components and creates a singleton only for a previously unknown file.
