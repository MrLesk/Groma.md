# React scanner

The React scanner connects a callback that a JSX element supplies as a prop to
the component's calls of that prop. Enable it alongside the TypeScript scanner.
Core selects relationships from the combined evidence and keeps one owner per
physical source file.

## Build and install

```sh
bun install --frozen-lockfile --ignore-scripts
bun plugins/scanners/react/build.ts
```

From the project being scanned:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/react/dist/package
groma scanner check
groma scan
```

The private prototype package bundles TypeScript 6.0 and its standard-library
declarations. The TypeScript scanner keeps its native TypeScript 7 SDK. No consumer build
or installation script is required. Public naming and publication are separate
release decisions.

The scanner reads each selected package's nearest `tsconfig.json` and owned TSX
files using its bundled TypeScript compiler. It reads only the files groma.md
hands it, never declaration files as sources, and a syntax error only fails the
scan in a file it reads. The package declares the default
[include and exclude lists](../index.md#selecting-source-files): it includes
`.ts` and `.tsx` sources, `tsconfig*.json` configs, and the `package.json`, HTML,
`project.json` and `nx.json` files the entry reader reads, and excludes `.test`
and `.spec` files, the root `test` folder, and `node_modules`, `dist`, `build`
and `coverage` folders. Project dependencies and
React types do not need to be installed. A solution `tsconfig.json` that names no source of its
own compiles through the first config it references that compiles one of its
components. An extended config a fresh
checkout lacks, such as an uninstalled package or a generated file, leaves the
config's own settings and reports a `react-missing-config-base` warning.
Invalid configuration and source syntax fail with a diagnostic; missing external
types do not prevent local callback extraction.
The scanner does not run application code or require successful type checking.

## Evidence and tooling

[React documents callback props](https://react.dev/learn/responding-to-events).
[TypeScript owns JSX parsing and checking](https://www.typescriptlang.org/docs/handbook/jsx.html),
project membership, imported component identities, and source symbols.
The adapter uses the classic compiler API of its bundled
[TypeScript 6.0](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html),
the last release that retains it. The plugin does not recreate language
name or type resolution.

A component, and a handler the JSX attribute names, must resolve to a source
function in the files the scanner reads, or to a `const` holding one. React's
`useCallback`, `memo` and `forwardRef` hand back the function they are given, so
a `const` holding such a call holds that function; they count only when imported
from `react`, by name or through its module object. A handler may also be a
function written in place, and a TypeScript module may hold it; that module then
joins the scanner's files. The component reads the callback prop from its first
parameter, by destructuring it, with or without a default, or as a property of
that parameter, such as `props.onSave()`. Calls are matched to the exact
compiler symbol of the destructured prop or the props parameter. Each concrete
JSX attribute has a separate binding; nested calls belong to their nearest
function, method or accessor.

In a project whose tsconfig sets `moduleSuffixes`, as React Native projects do,
the compiler resolves each import for one platform. A file named for a platform,
by one of those suffixes or `.web`, such as `Menu.web.tsx`, binds only to
components of its own platform, or to a shared file beside which its platform
has no file of its own.

Operation, call, and attribute positions are original zero-based UTF-16 offsets;
lines are one-based. The named prop supplies the existing `member` field.
Ordinary TypeScript can remain unresolved while React supplies this binding.
No compiler objects or raw graph are persisted.

In OKF, the result remains readable Code links and relationship rows. In C4,
React components remain source evidence, not automatic architecture components
or a new containment level. Core owns interpretation and curated ownership.

## Source outline

The scanner outlines the TSX files in a component's Code with the TypeScript
rules of the [source outline contract](../creating-a-plugin.md#source-outline):
top-level functions and types (classes, interfaces, enums), including namespace
contents, and each type's constructors and methods. A function component is a
top-level function or a function literal bound directly to a top-level name;
wrapped values such as `memo(...)` and `forwardRef(...)` are not listed, so a
file whose only component is a `memo(...)` value has no declarations and is left
out of the outline, while its Code file still appears. A class component is a
type with its methods. Every declaration has its line and
visibility, and `entry` marks the names the Code links give. The package's own
TypeScript parses each file alone, without `tsconfig.json`, dependencies or
compilation.

Core outlines each file once. For a source that the TypeScript scanner also
owns, the scanner with the lowest id among the file's Code links outlines it,
here React, with the symbols of all those links.

## HTTP endpoints and requests

The scanner reports [HTTP facts](../evidence.md#http-endpoints-and-requests) for
the clients it recognizes in the TSX files it reads, and for the endpoints a
Next.js project declares by file location. In a project that declares `next`, it
also reads `app/**/route.ts` and `.tsx` and `pages/api/**`, including route files
the tsconfig leaves out, such as a `.well-known` directory, which another scanner
may read as well. Next.js reads each of `app` and `pages` from the project root,
or from `src` only when the root has none, so a `src/app` beside a root `app`
serves nothing.

| Construct | Reported |
| --- | --- |
| `fetch(url, init)`, including a `node-fetch` default import or a named `undici` import | Request; a literal `method` gives the method, no options means `GET`, and options the scanner cannot read leave it out |
| `axios.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options`, `.postForm`, `.putForm`, `.patchForm` | Request with that method; form helpers use their matching HTTP method |
| `axios(config)`, `axios.request(config)` | Request from the config's `url`; its `method`, else the client's, else `GET` |
| `axios.create(config)` instances | Request whose path follows the config's `baseURL`, and whose method defaults to the config's |
| `app/**/route.ts` | Endpoint per exported `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS` handler, including names in an export list, at the route's directory path |
| `pages/api/**` | Endpoint for the default export, which answers every method, so `*` |

`fetch` counts when it is the runtime's, which the project neither declares nor
imports, the default export of `node-fetch`, or a named `undici` import, so a `fetch` the project exports
from its own module is that function. An `axios` client counts only when its
name is the `axios` default import, or a variable the project never assigns
again holding `require('axios')` or `axios.create(...)` called on it, so
`isAxiosError`, a named `post` import and a `get` on any other object are never
requests. Options are read as values are, as decision 5 describes, so a changed,
duplicated or computed option is never taken for the literal it once held. An
option object the scanner cannot read leaves the method out instead of claiming
`GET`, and for axios leaves the base unknown too. A `fetch` input that is not a
URL, such as a `Request`, carries a method of its own, so the fact states none.
A request's own `baseURL`, in its config or in the configuration argument of a
shorthand, which a `post`, `put` or `patch` takes third, replaces the client's.
A base joins a relative path with one slash, and an absolute URL replaces it.

A client's `defaults` count too: exactly one assignment to `defaults.baseURL` or
`defaults.method` anywhere in the project sets it, and more than one, or any other
change to `defaults` itself or to those two properties, hides both. An instance
without a base of its own copies the default client's when it is created, which
the scan cannot order, so a base assigned to `axios.defaults` leaves the
instance's unknown. These are accepted risks: the one assignment is taken to run
before every request, although a test file or a function that runs only
sometimes may make it, and interceptors, code a client is handed to, a re-exported
default client, an alias such as `const alias = api`, and a destructured
`defaults` are not read.

The [producer decisions](../evidence.md#producer-checklist) for this ecosystem:

1. **Prefixes.** An endpoint's path is its route file's directory path, as
   decision 6 describes; no other prefix applies. On the client side, only an
   `axios.create({ baseURL })` base precedes a path.
2. **Endpoints.** Only the route files above, and only in a project that
   declares `next`. A page, a layout, `middleware.ts`, and a component answer no
   request of their own, and `pages/api.tsx` is a page, not a route. A route file
   whose path holds a parallel route `@modal` or an intercepted route `(.)talks`
   reports nothing, because the served path is not the file path there, and a
   private folder such as `_lib` is not routed. An export whose value is a
   literal, such as a configuration object, serves nothing.
3. **Dynamic or unknown.** `` `/talks/${id}` `` fills one whole segment, so it is
   dynamic. `` `/talks/${id}-latest` ``, a path built from a parameter, and an
   unresolvable value are unknown. The query and fragment are dropped, computed
   or not.
4. **Local helpers.** Not supported: the URL is read at the client call, so a
   helper that forwards a path parameter reports unknown text, and its callers
   report nothing. Author those rows.
5. **Bases.** A root-relative literal path has no base. A variable with a
   literal initializer that the project never assigns again is literal text. So
   is a property of an object literal such a variable holds: the last property
   with its name, while the literal has no spread, computed key or accessor, and
   no code in the project assigns or deletes that property or an object above
   it, hands one of them to other code, or calls a method through them, and no
   module object holding it, such as a namespace import, a re-exported namespace
   or a dynamic import's result, is used other than to read one export by name.
   A value the scanner cannot see, such as an ambient declaration,
   `process.env.API_URL`, `import.meta.env` or a constant imported from a
   package, sets `configured`. A field read through `this` holds the value of
   its one plain assignment, whether its declaration, its constructor or any
   code that writes it, so `resourceUrl = API_URL + '/api/speakers'` reads as
   that configured base and path; a field the sources never assign, such as one
   a framework injects, is the client's own base setting and sets `configured`,
   and a field assigned more than once, by a subclass too, or with a value the
   scanner cannot read, is unknown. Text that continues a configured value's
   last segment instead of starting with `/` is unknown. A literal host, also
   when literal pieces only state it together, a parameter, a value a call
   returns, and any other computed value report a leading unknown segment.
6. **File-location routes.** A route file's directory path is its served path,
   with `[id]` a parameter, `[...rest]` a catch-all and `[[...rest]]` an optional
   catch-all. A route group such as `(admin)` organizes files without serving a
   segment, so `app/api/(admin)/audit/route.ts` serves `/api/audit`. A Pages
   Router `index` file serves its directory, while a directory named `index` is an
   ordinary segment. An App Router endpoint names the exported handler for its
   method, and a Pages Router endpoint the function its default export
   designates. A handler the file does not define as a function, such as a
   wrapper's result or an imported handler, is served by the file's module code,
   which the endpoint then names. Every request names the function that runs the
   call, or the module code outside every function.
7. **Constrained segments.** None: `[id]`, `[...rest]` and `[[...rest]]` accept
   any text.
8. **Registration order.** None: Next.js prefers the most specific route,
   whatever order its files are in.

## Limits

The scanner does not analyze state stores, routing, server components, class
components, hooks other than `useCallback`, wrappers other than `memo` and
`forwardRef`, callback forwarding, returned functions, mutable values, DOM
dispatch, or callback expressions other than a function written in place. A prop the component calls
that receives anything other than a supported direct binding, and a JSX spread on
a component that calls a prop from its first parameter, produce `unsupported-react-binding`
diagnostics and no certain claim. A prop the component never calls is no
interaction of that component, and declared types, installed or not, decide
neither result. Components that cannot resolve to a supported source function do not
establish a callback interaction.

A change to a file the include list names triggers a rescan. Healthy scanners update the architecture while failed scanners keep their saved evidence. See [fresh-checkout validation](../fresh-checkout-validation.md) for
the executed artifact checks and remaining release gates.

## Nested projects

Run groma.md from the repository root. The scanner finds package declarations
among its files, including nested apps and libraries. Dependencies, dev
dependencies, peer dependencies and optional dependencies identify candidates.
A candidate also needs a `tsconfig.json` among its files in its directory or a
repository ancestor, and TSX source files belonging to that package, outside
nested packages. Declaration files and inactive fixtures with a `.fixture` suffix
do not qualify. Packages with only framework tooling dependencies are skipped. No
matching project produces no evidence, and neither does a package whose config
compiles none of its components, such as one holding only excluded tests. Each compiler uses the nearest config of
its package; imported source in sibling repository libraries keeps its original
source path. A file belongs to the nearest React package that contains it, so a
package whose config also compiles a nested package leaves that package's files
to it, while components and handlers still resolve across both.
Readiness checks all selected projects. An invalid selected project fails this scanner's observation; other scanners
can still update the architecture.
