# React scanner

The React scanner connects a directly supplied JSX callback prop to calls on
the component's destructured parameter. Enable it alongside the TypeScript scanner.
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

The private prototype package bundles TypeScript 6.0.3 and its standard-library
declarations. the TypeScript scanner's 7.1 SDK is unchanged. No consumer build
or installation script is required. Public naming and publication are separate
release decisions.

The scanner reads each selected project's `tsconfig.json` and owned TSX files
using its bundled TypeScript compiler. Project dependencies and React types do
not need to be installed. Invalid configuration and source syntax fail with a
diagnostic; missing external types do not prevent local callback extraction.
The scanner does not run application code or require successful type checking.

## Evidence and tooling

[React documents callback props](https://react.dev/learn/responding-to-events).
[TypeScript owns JSX parsing and checking](https://www.typescriptlang.org/docs/handbook/jsx.html),
project membership, imported component identities, and source symbols.
The adapter uses the maintained JavaScript compiler API pinned to 6.0.3;
[TypeScript 6.0](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
retains the established compiler API. The plugin does not recreate language
name or type resolution.

A component must resolve to a source function or a `const` arrow/function value
in the inventoried TSX files. Its first parameter must directly destructure the
callback prop. The JSX attribute must supply an identifier resolving directly
to a source function or `const` arrow/function value. Calls are matched to the
exact compiler symbol of that destructured parameter. Each concrete JSX
attribute has a separate binding; nested calls belong to their nearest function.

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
Next.js project declares by file location. Besides the components, it reads
`app/**/route.ts` and `.tsx` and `pages/api/**`, under the project root or `src`,
which another scanner may read as well.

| Construct | Reported |
| --- | --- |
| `fetch(url, init)` | Request; a literal `method` gives the method, no options means `GET`, and options the scanner cannot read leave it out |
| `axios.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options` | Request with that method |
| `axios(config)`, `axios.request(config)` | Request from a literal `url`; a literal `method`, else `GET`, and a computed one leaves the method out |
| `axios.create({ baseURL })` instances | Request whose path follows that base |
| `app/**/route.ts` | Endpoint per exported `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS` handler, at the route's directory path |
| `pages/api/**` | Endpoint for the default export, which answers every method, so `*` |

`fetch` counts only when the project does not declare it, and an `axios` client
counts only when its name comes from the `axios` import or from a `const` holding
`axios.create(...)`, so a `get` on any other object is never a request. A config
object built elsewhere, or one with a spread, states nothing certain.

The six [producer decisions](../evidence.md#producer-checklist) for this
ecosystem:

1. **Prefixes.** Only an `axios.create({ baseURL })` base, which precedes every
   path that instance requests. The scanner reports no endpoint, so no route
   prefix applies.
2. **Endpoints.** Only the route files above. A page, a layout, `middleware.ts`,
   and a component answer no request of their own, and `pages/api.tsx` is a page,
   not a route. A route file whose path holds a parallel route `@modal` or an
   intercepted route `(.)talks` reports nothing, because the served path is not
   the file path there. A Pages Router route whose default export is not a
   function in that file also reports nothing.
3. **Dynamic or unknown.** `` `/talks/${id}` `` fills one whole segment, so it is
   dynamic. `` `/talks/${id}-latest` ``, a path built from a parameter, and an
   unresolvable value are unknown. The query and fragment are dropped, computed
   or not.
4. **Local helpers.** Not supported: the URL is read at the client call, so a
   helper that forwards a path parameter reports unknown text, and its callers
   report nothing. Author those rows.
5. **Bases.** A root-relative literal path has no base. A `const` and an
   object-literal property assigned a literal are literal text; a class field is
   not, because a constructor can replace it. A value the scanner cannot see,
   such as an ambient declaration, `process.env.API_URL`, `import.meta.env` or a
   constant imported from a package, sets `configured`. A literal host, a
   parameter, and any other computed value report a leading unknown segment.
6. **File-location routes.** A route file's directory path is its served path,
   with `[id]` a parameter, `[...rest]` a catch-all and `[[...rest]]` an optional
   catch-all. A route group such as `(admin)` organizes files without serving a
   segment, so `app/api/(admin)/audit/route.ts` serves `/api/audit`. A Pages
   Router `index` file serves its directory, while a directory named `index` is an
   ordinary segment. An App Router endpoint names the exported handler for its
   method; a Pages Router endpoint names the function its default export
   designates. Every request names the function that runs the call.

## Limits

This revision qualifies the Backlog.md CleanupModal success callback. It does
not analyze hooks, state stores, routing, server components, class components,
component wrappers, callback forwarding, returned functions, mutable values,
DOM dispatch, or arbitrary callback expressions. JSX spreads and unsupported
direct bindings produce `unsupported-react-binding` diagnostics and no certain
claim. Components that cannot resolve to a supported source function do not
establish a callback interaction.

TSX and TypeScript edits use the existing watch lifecycle. Healthy scanners update the architecture while failed scanners keep their saved evidence. See [fresh-checkout validation](../fresh-checkout-validation.md) for
the executed artifact checks and remaining release gates.

## Nested projects

Run Groma from the repository root. The scanner finds package declarations in
tracked and unignored files, including nested apps and libraries. Dependencies,
dev dependencies, peer dependencies and optional dependencies identify candidates.
A candidate also needs a tracked or unignored `tsconfig.json` and TSX source
files belonging to that package, outside nested packages. Declaration files and
inactive fixtures with a `.fixture` suffix do not qualify. Packages with only
framework tooling dependencies are skipped. No matching project produces no evidence. Each compiler uses that project's configuration and local source;
imported source in sibling repository libraries keeps its original source path.
Readiness checks all selected projects. An invalid selected project fails this scanner's observation; other scanners
can still update the architecture.
Source and nested package/configuration changes use the shared scanner watch flow.
