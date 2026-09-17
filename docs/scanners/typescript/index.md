# TypeScript scanner

The TypeScript scanner reports supported `.ts` and `.tsx` files without requiring Groma comments, IDs, or types in application code.

It uses `git ls-files`, the configured globs, and `.gitignore` to select files. Declaration, test, and spec files are excluded by default. The compiler resolves used imports, including aliases and package exports, to selected repository source. External dependencies do not become source entries.

Each file remains one atomic evidence entry with every recognized exported function, class, interface, type, enum, or variable declared in that file. Scanned package `bin` entries and files with no incoming source imports are candidate module roots below the package root. Imported helpers do not become additional roots because they have dependencies or multiple callers. A package can have several candidates, with or without `bin` metadata. If no candidate exists, the first scanned file supplies one root. Import distance assigns other files to the nearest root, with common directories as the deterministic fallback. The import graph remains internal analysis data.

These source roots and file memberships are evidence, not confirmed application boundaries: imports alone cannot identify separate processes, deployed applications, or shared-library ownership. Core preserves curated multi-file components and their C4 ownership, and creates a singleton only for a previously unknown file.


## Operations and callback wiring

Each nested `tsconfig.json` and its referenced configurations supplies compiler
options for its included files. Configurations with no matching inputs contribute
no files; other configuration errors still stop the scan. The nearest containing configuration owns a file;
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

## Compared operations

`groma lint` and scan findings compare TypeScript operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range and body tokens to:

- function declarations and named function expressions;
- methods with an identifier name and a body, in classes and object literals;
- arrow functions and function expressions assigned to a `const`, `let`, or
  `var` variable, or to a property of an object literal.

Functions written as properties or method shorthand of an object literal passed
directly to a function call, `new`, or a decorator are anonymous callbacks, as
are other unnamed arrow functions and function expressions.

These named operations are not compared yet:

- constructors and `get` or `set` accessors;
- methods whose name is not an identifier, such as `#run()`, `'run'()`, or
  `[key]()`;
- functions assigned to class fields, such as `onClick = () => {}`.
