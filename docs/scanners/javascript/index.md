# JavaScript scanner

The JavaScript scanner reads tracked and unignored `.js`, `.mjs`, `.cjs` and
`.jsx` files, covering ECMAScript modules, CommonJS modules and browser scripts.
It does not require Node.js, installed packages, a bundler, a project build or a
`tsconfig.json`. Discovery matches JavaScript source directly, even without a
package manifest.

```sh
bun plugins/scanners/javascript/build.ts
```

From the project being scanned:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/javascript/dist/package
groma scan
```

The package bundles the TypeScript 6.0.3 compiler, whose parser reads
JavaScript, including JSX in `.js` and `.jsx` files, and includes its license
notices. Every file is parsed on its own, so no project configuration, module
resolution or other file changes what a file reports. The compiler's declaration
libraries are not shipped: only a compiler program reads them, and this scanner
creates none. Syntax the bundled parser cannot read is reported as written, so a
future language proposal may be outside the supported analysis.

## Excluded files

Minified output is not authored source, so it is left out of the scan and the
source outline:

- a name that states minified output, such as `jquery-ui.min.js`;
- text whose lines average 500 characters or more, the shape of a bundle a build
  produced under an ordinary name such as `vendor.js`.

The shared Git boundary omits ignored files and dependency or build directories
such as `node_modules`, `vendor`, `dist` and `build`. Core applies the source
exclusions configured in `scanners.json`.

Test sources are treated like any other JavaScript source, as in the PHP and
Swift scanners: a project excludes them explicitly in `scanners.json`. The
TypeScript scanner instead omits `test` directories and `.test` and `.spec` names
by default.

Discovery counts any `.js`, `.mjs`, `.cjs` or `.jsx` name, minified files
included, because it reads file names without opening them. A repository whose
only JavaScript is minified can therefore be recommended this scanner, and
readiness then reports that no authored JavaScript source was found.

TypeScript sources belong to the [TypeScript scanner](../typescript/index.md)
and single-file components to the [Vue scanner](../vue/index.md). This scanner
reads neither, and it needs no evidence from any other scanner.

## Evidence

The scanner reports one repository source root, exact JavaScript paths, and the
top-level functions and classes each file declares. Functions, function literals
and methods with a body produce operation evidence with UTF-16 source offsets.
Code outside every function is the module's own work, so a browser script's
top-level calls keep an operation to belong to, without inventing a function.

Calls remain unresolved. One parsed file proves no call target: an imported name,
a `require` result and a method on a value are all decided elsewhere, so core
derives no relationship from JavaScript calls. Declared HTTP facts are not read
yet.

The repository source root is initial placement evidence, not a claim that every
JavaScript file belongs to one C4 runtime boundary. Core owns architecture
identity and curation, and repeated scans preserve one physical owner and the
authored architecture. JavaScript edits and new files refresh through the shared
scanner watcher.

## Source outline

The web and terminal maps list a JavaScript file's declarations under the
[shared outline rules](../creating-a-plugin.md#source-outline). The scanner
parses the file alone and lists what it declares at the top level:

- functions, and arrow functions or function expressions assigned directly to a
  `const`, `let` or `var` name;
- classes, with every method and the constructor as members.

Fields, accessors, and declarations inside a function, method or block are not
listed. A declaration is marked as an entry when the component's Code names it,
such as `OrderService` or `subtotal`.

Visibility follows how the file publishes a name:

| Value | JavaScript |
| --- | --- |
| `public` | An `export`, a name in the file's own `export { name }` list or `export default name`, a name a CommonJS `module.exports` or `exports.name` assignment publishes, and every top-level declaration of a file that states no module boundary, because those names are globals |
| `private` | Every other top-level declaration, and a `#name` member |

A `.mjs` or `.cjs` file is a module whatever it contains, so its unpublished
declarations stay private. A `.js` file is a module when it states an `import`,
an `export` or a CommonJS export; otherwise it is a browser script whose
declarations any other script on the page may use. Members are `public` unless
their name is private.

## Compared operations

`groma lint` and scan findings compare JavaScript operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range and body tokens to:

- function declarations and named function expressions;
- methods with an identifier name and a body, in classes and object literals;
- arrow functions and function expressions assigned to a `const`, `let` or `var`
  variable, or to a property of an object literal.

Token spellings match the [TypeScript scanner](../typescript/index.md#compared-operations),
so the same body in a `.js` file and in a `.ts` file compares equal. An
operation's own name stays visible in its body, so two recursive functions with
different names are not identical copies.

Functions written as properties or method shorthand of an object literal passed
directly to a function call or `new` are anonymous callbacks, as are other
unnamed arrow functions and function expressions. Module code is not compared.

These named operations are not compared, as in TypeScript:

- constructors and `get` or `set` accessors;
- methods whose name is not an identifier, such as `#run()`, `'run'()` or
  `[key]()`;
- functions assigned to class fields, such as `onClick = () => {}`.

## Validation

Independent fixtures cover ECMAScript modules, CommonJS, JSX, browser scripts,
minified files excluded by name and by line length, exact source positions,
unresolved calls, the source outline with its visibility rules, one body that
tokenizes identically in JavaScript and in TypeScript, and identical and
near-duplicate bodies found by `groma lint`. The fresh-checkout package check
removes language tools from PATH and blocks JavaScript network access.
See [local qualification](validation.md).
