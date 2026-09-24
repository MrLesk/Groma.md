# Vue scanner

The Vue scanner adds single-file component (SFC) event bindings to groma.md's
TypeScript scanner evidence. Its bundled compiler tools read local source
without project dependencies. The scanner uses each selected project's
`tsconfig.json`, or the nearest one above that package; it does not execute
application code.

```sh
bun install --frozen-lockfile --ignore-scripts
bun plugins/scanners/vue/build.ts
```

In the project being scanned:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/vue/dist/package
groma scan
```

The package bundles Vue language-core, Volar TypeScript, Vue compiler-dom and
its own TypeScript 6.0, the last release with the classic compiler API these
tools use; the package manifest pins the exact versions. Compiler-sfc
provides build-time declarations only. The build
pins compiler imports to that TypeScript installation. The separate TypeScript scanner uses the native TypeScript 7 SDK. Compiler libraries and Vue helper declarations
ship in the package; no consumer build or installation script is required.

[Vue language tools](https://github.com/vuejs/language-tools) supply project
configuration, SFC parsing, template code generation and original-source
mappings. [Volar](https://github.com/volarjs/volar.js) integrates the generated
code with the TypeScript checker, which resolves component imports and handler
function identities. The scanner translates these facts into the existing
supplied-callback evidence contract; it has no separate name or type resolver.

The package declares the default
[include and exclude lists](../index.md#selecting-source-files). It includes
`.vue` components, their JavaScript and TypeScript sources and stylesheets,
HTML pages, `tsconfig*.json` configs, and the `package.json`, `project.json` and
`nx.json` files the entry reader reads. It excludes `node_modules`, `dist`,
`build` and `coverage` folders. The scan and the readiness check read only the
files groma.md hands them, even when the project's `tsconfig.json` includes
more; a source they read can still import another file as compiler context, and
an external `src` block outside the files is left out of its component.

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
parent's `onChange` function. A static imported SFC must assign `defineEmits`
to a constant and declare the event in a type literal, function type, or
literal runtime array. A call to that same symbol must supply a declared
literal event name inside a source function or directly in an inline template
event expression. The parent template must bind the event directly to one
source function declaration or constant function expression. Imported
TypeScript functions use the same rule.
See [Vue component events](https://vuejs.org/guide/components/events).

The observation records the emitting function or child template, literal emit
call, concrete parent template attribute and supplied handler. All positions
refer to the original physical source, as zero-based UTF-16 offsets; lines are one-based. The nearest
function owns a nested emit call. Repeated scans are deterministic.

Unresolved, dynamic or unsupported bindings produce `unsupported-vue-binding`
diagnostics and no certain relationship. This revision does not support
Options API events, dynamic components, dynamic event names, handler
expressions or modifiers, state stores, or arbitrary event mutation. Nuxt
server routes and shared HTTP client calls are observed separately. Compiler
syntax/template errors fail the scan and preserve the previous complete map.
Missing generated TypeScript config bases and missing declared source roots
produce warnings while available source is scanned. Other invalid configuration
fails readiness. Missing Vue types do not erase local `defineEmits` evidence.

Vue contributes `vue` Code provenance for selected source files. Shared core
keeps one physical-file owner, interprets complementary and conflicting
observations, and writes readable relationship rows. A change to a file the
include list names triggers a rescan.

In OKF, the result is ordinary source links and relationship Markdown. An SFC
is source evidence; it does not automatically define a C4 responsibility or
add a containment level. groma.md's existing ownership and relationship model
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
| `$fetch` and `useFetch` with a `baseURL` option | Request whose path follows that base |
| `axios.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options`, `.postForm`, `.putForm`, `.patchForm` | Request with that method; form helpers use their matching HTTP method |
| `axios(config)`, `axios.request(config)` | Request from the config's `url`; its `method`, else the client's, else `GET` |
| `axios.create(config)` instances | Request whose path follows the config's `baseURL`, and whose method defaults to the config's |
| `server/api/**` | Endpoint at `/api/...`, with the method its file name states |
| `server/routes/**` | Endpoint at the path after `server/routes`, with the method its file name states |

`fetch` counts when it is the runtime's, the default export of `node-fetch`, or
a named `undici` import,
as on the React page. `$fetch` and `useFetch` must resolve to a declaration
outside the project source, such as an installed package's types, so a project's
own `useFetch` composable, whose body decides the URL, is never read as Nuxt's;
a project scanned without its dependencies installed therefore reports no
`$fetch` or `useFetch` request. They read their `baseURL` option as axios reads
a request's own, except that, as ofetch does, they keep a URL whose text already
starts with a literal base followed by `/`, `?` or its end; where that boundary
falls on a computed part, the path starts unknown. Everything else, from the
axios clients and their `defaults` to the options, the `fetch` inputs and the
bases, follows the rules of the [React
scanner](../react/index.md#http-endpoints-and-requests).

The endpoints need the project to declare `nuxt`: another server that happens to
live in `server/` serves paths of its own, which these locations would misstate.

The [producer decisions](../evidence.md#producer-checklist) for this ecosystem:

1. **Prefixes.** A server route under `server/api` serves below `/api`, which its
   endpoint path states; one under `server/routes` serves from the root. On the
   client side, only a `baseURL`, as the options and axios clients above state it,
   precedes a path.
2. **Endpoints.** Only the server route files above, and only in a project that
   declares `nuxt`. `server/middleware/**`, `server/plugins/**`, a component, and
   a page answer no request of their own. Nuxt serves every route file, so each
   reports its endpoint, whatever its default export is.
3. **Dynamic or unknown.** `` `/talks/${id}` `` fills one whole segment, so it is
   dynamic. `` `/talks/${id}-latest` ``, a path built from a parameter, and an
   unresolvable value are unknown. The query and fragment are dropped, computed or
   not. A method the scanner cannot read leaves the fact without one, rather than
   claiming `GET`.
4. **Local helpers.** Not supported: the URL is read at the client call, so a
   helper that forwards a path parameter reports unknown text, and its callers
   report nothing. Author those rows.
5. **Bases.** The [React
   scanner's](../react/index.md#http-endpoints-and-requests) decision 5 holds
   unchanged.
6. **File-location routes.** A route file's path after `server/` is its served
   path, read as Nitro names its routes: a route group directory such as
   `(admin)` serves no segment, an environment suffix such as `.prod` and then a
   `.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options`, `.connect`
   or `.trace` method suffix leave the path, a final `index` serves its
   directory, and placeholders read as decision 7 describes. A file without a
   method suffix answers every method. `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`,
   `.cts`, `.jsx` and `.tsx` route files count. The endpoint names the function
   the default export designates: a default-exported function, or a function the
   file declares, as a function or a variable holding one, that the default
   export names or passes to a wrapper such as `defineEventHandler`. When it
   designates no such function, the endpoint names the file's module operation.
   A request in a file's own top-level code, which is what `<script setup>` runs
   on setup, names that file's module operation, so the row starts at the
   component.
7. **Constrained segments.** Nitro constrains no segment, and segments follow
   the names it registers. A segment that starts with a placeholder, such as
   `[id]` or `[id]-latest`, is a parameter that accepts any text, named `*` when
   no name can spell it. Text before a placeholder makes the whole segment
   literal, so `hello-[name]` serves only `/hello-:name`. `[...]` and
   `[...slug]`, whose name is word characters, are catch-alls, while
   `[...file-path]` is a parameter. A segment the scanner cannot state, such as
   a catch-all before the last segment, becomes a constrained optional catch-all
   in place of itself and the rest of the path.
8. **Registration order.** None: Nuxt prefers the most specific route, whatever
   order its files are in.

## Compared operations

`groma lint` and scan findings compare the functions in the `<script>` and
`<script setup>` blocks of a single-file component under the
[shared rule](../../architecture-findings.md#compared-operations). The Vue,
JavaScript and TypeScript scanners share one rule and one tokenizer, so the
operations the [TypeScript scanner](../typescript/index.md#compared-operations)
compares, those it does not compare yet, and the tokens it keeps apply here too,
and one body compares equal in a component script and in a module.

In a component, the source range is in the `.vue` file's own lines. The
functions a `<script setup>` block exposes to its template are compared.
`setup()` on the argument of `defineComponent({ ... })` is an anonymous callback,
while the methods under its `methods` property are compared. Top-level statements
of a block are initializer code, and template expressions are not compared
operations. A direct template emit has a source operation named `(template)`
only for the event relationship.
Scripts the component keeps in a separate file are TypeScript modules, which the
TypeScript scanner compares.

## Nested projects

Run groma.md from the repository root. The scanner finds package declarations
among its files, including nested apps and libraries. Dependencies, dev
dependencies, peer dependencies and optional dependencies identify candidates.
A candidate also needs a `tsconfig.json` among its files in the package or an
ancestor, and Vue source files belonging to that package, outside nested
Vue projects. Declaration files and inactive fixtures with a `.fixture` suffix
do not qualify. Packages with only framework tooling dependencies are skipped.
No matching project produces no evidence. Each compiler uses the nearest configuration and local source;
imported source in sibling repository libraries keeps its original source path.
Readiness checks all selected projects. An invalid selected project fails this scanner's observation; other scanners
can still update the architecture.
