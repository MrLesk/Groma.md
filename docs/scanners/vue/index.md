# Vue scanner

The Vue scanner adds single-file component (SFC) event bindings to Groma's
TypeScript scanner evidence. Its bundled compiler tools read local source
without project dependencies. The scanner reads each selected project's
`tsconfig.json`; it does not execute application code.

```sh
bun install --frozen-lockfile --ignore-scripts
bun plugins/scanners/vue/build.ts
```

In the project being scanned:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/vue/dist/package
groma scan
```

The package bundles Vue language-core 3.3.11, Volar TypeScript 2.4.28,
Vue compiler-dom 3.5.42 and its own TypeScript 5.9.3. Compiler-sfc 3.5.42
provides build-time declarations only. The build
pins compiler imports to that TypeScript installation. The separate TypeScript scanner uses its own 7.1 SDK. Compiler libraries and Vue helper declarations
ship in the package; no consumer build or installation script is required.

[Vue language tools](https://github.com/vuejs/language-tools) supply project
configuration, SFC parsing, template code generation and original-source
mappings. [Volar](https://github.com/volarjs/volar.js) integrates the generated
code with the TypeScript checker, which resolves component imports and handler
function identities. The scanner translates these facts into the existing
supplied-callback evidence contract; it has no separate name or type resolver.

## Supported interaction

### External source blocks

A `.vue` file can explicitly name local external script, template, and style
files with `src="./file"` or `src="../file"`, as described in the
[Vue SFC specification](https://vuejs.org/api/sfc-spec#src-imports).
The scanner reports those direct companions as one source unit. Core assigns
one component when ownership is unambiguous and preserves curated membership
on repeats. Code details expose the `.vue` file and every companion.
Imports from the script, global styles, transitive stylesheet imports, and
similarly named neighboring files do not extend that association.

Inline blocks create no extra files. External scripts cannot be combined with
`script setup`; Vue's [script setup restrictions](https://vuejs.org/api/sfc-script-setup#restrictions)
still apply. External block association does not add Options API or external
template event inference; the inline interaction rule below remains unchanged.
Edits to JavaScript, TypeScript, HTML, CSS, SCSS, Sass, Less, and Stylus companions
trigger the existing shared scanner refresh.

### Inline event bindings

The qualified example is Vue REPL's CodeMirror `change` event bound to the
parent's `onChange` function. A static imported SFC must use a typed
`defineEmits` declaration assigned to a constant. A call to that same symbol
must supply a declared literal event name inside a source function. The parent
template must bind the event directly to one source function declaration or
constant function expression. Imported TypeScript functions use the same rule.
See [Vue component events](https://vuejs.org/guide/components/events).

The observation records the emitting function, literal emit call, concrete
template attribute and supplied handler. All positions refer to the original
physical source, as zero-based UTF-16 offsets; lines are one-based. The nearest
function owns a nested emit call. Repeated scans are deterministic.

Unresolved, dynamic or unsupported bindings produce `unsupported-vue-binding`
diagnostics and no certain relationship. This revision does not support
Options API events, runtime `defineEmits` arrays, dynamic components, dynamic
event names, handler expressions or modifiers, state stores, routing, server
frameworks or arbitrary event mutation. Compiler syntax/template errors fail
the scan and preserve the previous complete map. Readiness errors explain
invalid configuration or source syntax. Typed event names are read from the
local `defineEmits` type literal; missing Vue types do not erase that evidence.

Vue contributes `vue` Code provenance for configured source files. Shared core
keeps one physical-file owner, interprets complementary and conflicting
observations, and writes readable relationship rows. `.vue` and TypeScript
edits participate in the existing scan watcher.

In OKF, the result is ordinary source links and relationship Markdown. An SFC
is source evidence; it does not automatically define a C4 responsibility or
add a containment level. Groma's existing ownership and relationship model
owns that interpretation. No new architecture metadata is added.

See [fresh-checkout validation](../fresh-checkout-validation.md) for the pinned project and executed release
checks. This prototype package name does not imply public publication.

## Source outline

The scanner outlines every script it owns in a component's Code with the
TypeScript rules of the [source outline contract](../creating-a-plugin.md#source-outline):
top-level functions and types (classes, interfaces, enums), including namespace
contents, and each type's constructors and methods. Every declaration has its
line and visibility, and `entry` marks the names the Code links give. Templates
and stylesheets have no outline.

A single-file component is read with the Vue single-file component parser: the
`<script>` and `<script setup>` blocks are outlined in source order, each in the
dialect its `lang` attribute names, and every declaration reports the line it
occupies in the `.vue` file. A `<script setup>` block exports nothing, because
its top-level bindings are the component's own API for its template, so its
top-level declarations are private; members keep their TypeScript visibility.
The package's own TypeScript parses each block alone, without `tsconfig.json`,
dependencies or compilation.

Core outlines each file once. For a script that the TypeScript scanner also
owns, the scanner with the lowest id among the file's Code links outlines it,
here TypeScript, with the symbols of all those links.

## HTTP endpoints and requests

The scanner reports [HTTP facts](../evidence.md#http-endpoints-and-requests) for
the clients it recognizes in the files it reads, single-file component scripts
included, and for the endpoints a Nuxt project declares by file location. A fact
from a `.vue` file names an operation in that file, at the line the call occupies
there.

| Construct | Reported |
| --- | --- |
| `fetch(url, options)`, `$fetch(url, options)`, `useFetch(url, options)` | Request; a literal `method` gives the method, no options means `GET`, and options the scanner cannot read leave it out |
| `axios.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options` | Request with that method |
| `axios(config)`, `axios.request(config)` | Request from a literal `url`; a literal `method`, else `GET`, and a computed one leaves the method out |
| `axios.create({ baseURL })` instances | Request whose path follows that base |
| `server/api/**` | Endpoint at `/api/...`, with the method its file name states |
| `server/routes/**` | Endpoint at the path after `server/routes`, with the method its file name states |

`fetch` counts unless the project declares a `fetch` of its own. `$fetch` and
`useFetch` must resolve to a declaration outside the project source, such as an
installed package's types, so a project's own `useFetch` composable, whose body
decides the URL, is never read as Nuxt's; a project scanned without its
dependencies installed therefore reports no `$fetch` or `useFetch` request. An
`axios` client counts only when its name comes from the `axios` import or from a
`const` holding `axios.create(...)`. A `get` on any other object is never a
request, and an options object the scanner cannot read, one with a spread, or one
whose property names are computed states nothing certain.

The endpoints need the project to declare `nuxt`: another server that happens to
live in `server/` serves paths of its own, which these locations would misstate.

The six [producer decisions](../evidence.md#producer-checklist) for this
ecosystem:

1. **Prefixes.** A server route under `server/api` serves below `/api`, which its
   endpoint path states; one under `server/routes` serves from the root. On the
   client side, only an `axios.create({ baseURL })` base precedes a path.
2. **Endpoints.** Only the server route files above, and only in a project that
   declares `nuxt`. `server/middleware/**`,
   `server/plugins/**`, a component, and a page answer no request of their own. A
   route whose default export is not a function, including one wrapped by
   something other than a single handler argument, reports nothing.
3. **Dynamic or unknown.** `` `/talks/${id}` `` fills one whole segment, so it is
   dynamic. `` `/talks/${id}-latest` ``, a path built from a parameter, and an
   unresolvable value are unknown. The query and fragment are dropped, computed or
   not. A method the scanner cannot read leaves the fact without one, rather than
   claiming `GET`.
4. **Local helpers.** Not supported: the URL is read at the client call, so a
   helper that forwards a path parameter reports unknown text, and its callers
   report nothing. Author those rows.
5. **Bases.** A root-relative literal path has no base. A variable with a
   literal initializer that the project never assigns again is literal text. So
   is a property of an object literal such a variable holds, while no code in the
   project assigns or deletes that property or an object above it, hands one of
   them to other code, or calls a method through them. A value the scanner cannot
   see, such as an ambient declaration, `process.env`, `import.meta.env` or a
   constant imported from a package, sets `configured`, and so does a field read
   through `this`, which holds the client's own base setting. Text that continues
   a configured value's last segment instead of starting with `/` is unknown. A
   literal host, also when literal pieces only state it together, a parameter, a
   value a call returns, and any other computed value report a leading unknown
   segment.
6. **File-location routes.** A route file's path after `server/` is its served
   path, with `[id]` a parameter, `[...slug]` a catch-all and an `index` file its
   directory. A `.get`, `.post`, `.put`, `.patch`, `.delete`, `.head` or
   `.options` suffix in the file name gives the method, and a file without one
   answers every method. The endpoint names the function the default export
   designates, including the one `defineEventHandler` receives. A request in a
   file's own top-level code, which is what `<script setup>` runs on setup, names
   that file's module operation, so the row starts at the component.

## Compared operations

`groma lint` and scan findings compare Vue operations under the
[shared rule](../../architecture-findings.md#compared-operations). In the
`<script>` and `<script setup>` blocks of a single-file component, the scanner
attaches a source range, in the `.vue` file's own lines, and body tokens to:

- function declarations and named function expressions, including the functions
  a `<script setup>` block exposes to its template;
- methods with an identifier name and a body, in classes and in object
  literals, such as the `methods` of an exported options object;
- constructors with a body;
- arrow functions and function expressions assigned to a variable or to a
  property of an object literal.

Unnamed arrow functions and function expressions are anonymous callbacks, as
are functions written directly on an object literal passed to a call, `new`, or
a decorator, also inside parentheses, `as`, `satisfies` or `!`: `setup()` on the
argument of `defineComponent({ ... })` is not compared, while the methods nested
under its `methods` property are. Top-level statements of a block are
initializer code, and template expressions are not operations. The scanner
reports every named body whatever its size, because core applies the minimum
body sizes.

The Vue, JavaScript and TypeScript scanners share one rule and one tokenizer, so
the named operations the [TypeScript scanner](../typescript/index.md#compared-operations)
lists as not compared yet, such as accessors and methods whose name is not an
identifier, are not compared here either, and the tokens that page lists stay
here too. One body therefore compares equal in a single-file component script
and in a module. Scripts the component keeps in a separate file are TypeScript
modules, which the TypeScript scanner compares.

## Nested projects

Run Groma from the repository root. The scanner finds package declarations in
tracked and unignored files, including nested apps and libraries. Dependencies,
dev dependencies, peer dependencies and optional dependencies identify candidates.
A candidate also needs a tracked or unignored `tsconfig.json` and Vue source
files belonging to that package, outside nested packages. Declaration files and
inactive fixtures with a `.fixture` suffix do not qualify. Packages with only
framework tooling dependencies are skipped. No matching project produces no evidence. Each compiler uses that project's configuration and local source;
imported source in sibling repository libraries keeps its original source path.
Readiness checks all selected projects. An invalid selected project fails this scanner's observation; other scanners
can still update the architecture.
Source and nested package/configuration changes use the shared scanner watch flow.
