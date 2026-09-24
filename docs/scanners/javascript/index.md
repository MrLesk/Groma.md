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
creates none. A file the parser cannot read, such as one using a future language
proposal, keeps its place in the inventory but contributes no declarations,
operations, calls or HTTP facts, and gets a `JAVASCRIPT_SOURCE_INVALID` warning
at its first parse error; the rest of the scan proceeds. The source outline
still lists the declarations the parser recovers from such a file.
TypeScript-style type annotations, as in many Flow-typed files, still parse, and
octal literals and escapes that only strict mode rejects, such as `0755`, are not
parse errors.

## Excluded files

Minified output is not authored source, so it is left out of the scan and the
source outline:

- a name that states minified output, such as `jquery-ui.min.js`;
- text whose code lines average 500 characters or more after leading block
  comments, or one 400-character code line after such a banner, the shape of a
  bundle a build produced under an ordinary name such as `vendor.js`.

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
top-level functions and classes each file declares. Functions, function literals,
and methods and constructors with a body produce operation evidence with UTF-16
source offsets.
Code outside every function is the module's own work, so a browser script's
top-level calls keep an operation to belong to, without inventing a function.
Calls inside accessors belong to an anonymous accessor operation; accessors are
not compared for duplicate logic.

Calls remain unresolved. One parsed file proves no call target: an imported name,
a `require` result and a method on a value are all decided elsewhere, so core
derives no relationship from JavaScript calls. The HTTP facts below are the
exception: they state a route or a URL, which core can compare across files.

The repository source root is initial placement evidence, not a claim that every
JavaScript file belongs to one C4 runtime boundary. Core owns architecture
identity and curation, and repeated scans preserve one physical owner and the
authored architecture. JavaScript edits and new files refresh through the shared
scanner watcher.
Each literal local `node`, `bun`, `tsx` or `ts-node` command in an unquoted
`&&`-chained package script can supply an execution entry. Environment
assignments or `cross-env` may come before the runtime, and runtime options and
a `run` or `watch` subcommand before the script; the first remaining word must
name the script, so a preloaded module or `bun build` supplies none. An HTML
page's script supplies one too, named after the page, or after its folder for
an `index.html`.

## Source outline

The web and terminal maps list a JavaScript file's declarations under the
[shared outline rules](../creating-a-plugin.md#source-outline). The scanner
parses the file alone and lists what it declares at the top level:

- functions, and arrow functions or function expressions assigned directly to a
  `const`, `let` or `var` name;
- classes, including a named class expression assigned to `module.exports`,
  with every method and the constructor as members.

Fields, accessors, and declarations inside a function, method or block are not
listed. A declaration is marked as an entry when the component's Code names it,
such as `OrderService` or `subtotal`.

Visibility follows how the file publishes a name:

| Value | JavaScript |
| --- | --- |
| `public` | An `export`, a name in the file's own `export { name }` list or `export default name`, a name a CommonJS `module.exports` or `exports.name` assignment publishes, including through a chained assignment, and every top-level declaration of a file that states no module boundary, because those names are globals |
| `private` | Every other top-level declaration, and a `#name` member |

A `.mjs` or `.cjs` file is a module whatever it contains, so its unpublished
declarations stay private. A `.js` file is a module when it states an `import`,
an `export`, a CommonJS export or a `require` call; otherwise it is a browser script whose
declarations any other script on the page may use. Members are `public` unless
their name is private.

## Compared operations

`groma lint` and scan findings compare JavaScript operations under the
[shared rule](../../architecture-findings.md#compared-operations). The
JavaScript, Vue and TypeScript scanners share one rule and one tokenizer, so the
operations the [TypeScript scanner](../typescript/index.md#compared-operations)
compares, those it does not compare yet, and the tokens that page lists apply
here too. The same body in a `.js` file and in a `.ts` file therefore compares
equal.

## HTTP facts

The scanner reports the [HTTP endpoints and
requests](../evidence.md#http-endpoints-and-requests) a JavaScript file states,
and core joins them into relationships. Each file is parsed alone, and the
compiler resolves its names over that one file, so a construct counts only when
that file states it and a value from another file is one the scanner cannot see.

| Construct | Reported |
| --- | --- |
| `fetch(url, init)`, including a `node-fetch` default import or a named `undici` import | Request; a literal `method` gives the method, no options means `GET`, and options the scanner cannot read, or an input that is neither URL text nor typed as a primitive such as a string, for example a `Request`, leave it out |
| `axios.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options`, `.postForm`, `.putForm`, `.patchForm` | Request with that method; form helpers use their matching HTTP method |
| `axios(config)`, `axios.request(config)` | Request from the config's `url`; its `method`, else the client's, else `GET` |
| `axios.create(config)` instances | Request whose path follows the config's `baseURL`, and whose method defaults to the config's |
| `$.get`, `$.post`, `$.getJSON`, `$.getScript` | Request with that helper's method |
| `$.ajax(settings)` and `$.ajax(url, settings)` | Request from the settings' `method`, else `type`, else `GET`; settings the scanner cannot read leave the method out |
| `express()` and `express.Router()` | Endpoint per `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `all` call with a handler |
| `Fastify()` | The same calls, and `route({ method, url, handler })`, including a method array; `register(plugin, { prefix })` blocks its prefix |
| `new Hono()` | The same calls |
| `new Koa()` with `@koa/router` or `koa-router` | The same calls, `del` and `redirect(source, destination)` on a router `use` mounts through `routes()`, under its `new Router({ prefix })` or `router.prefix(...)` path |
| `Bun.serve({ routes })` | Endpoint per route: a function serves every method, an object one per method key |

A name is a client, application or router when this file imports or requires it
and never assigns it again, so `import express from 'express'`,
`const express = require('express')`, `const { Router } = require('express')`
and `require('express')()` are all recognized, and a parameter, local or loop
variable that shadows the import is not. jQuery and `fetch` are the exceptions a
browser script needs: a `$`, `jQuery` or `fetch` counts when the file imports it
or leaves it to the runtime, and not when the file declares that name itself. A
member name alone is never enough: `cache.get('/talks')` reports nothing. Values
and options follow the shared rules the framework scanners apply, as the [React
scanner](../react/index.md#http-endpoints-and-requests) states them, and the
routers follow the same reader as the [TypeScript
scanner](../typescript/index.md#http-endpoints-and-requests). A request's own
`baseURL` replaces the client's, and exactly one assignment in the file to
`defaults.baseURL` or `defaults.method` on `axios` or on an instance sets it,
while any other change to `defaults` hides both. Any application, router or
client an imported factory returns is not read.

The [producer decisions](../evidence.md#producer-checklist) for this ecosystem:

1. **Prefixes.** An endpoint path carries every prefix this file states:
   `app.use('/orders', router)`, Hono's `app.route('/api', api)` and a Koa
   `app.use(router.routes())` prepend their literal prefix, and mounts nest. A
   Koa router adds its own path from `new Router({ prefix })` or
   `router.prefix(...)`. An application instance serves from the root. A router
   this file never mounts, and a mount on a host the scanner does not recognize,
   report nothing; a mount under a computed prefix, a router whose own path is
   computed, or stated twice, a router from another file, and a Fastify plugin
   block their place, as decision 8 describes.
2. **Endpoints.** Only a route registration with its own handler is an endpoint.
   `app.use(express.json())` is middleware, `app.get('name')` with one argument
   reads a setting, and a `Bun.serve` route key that is not a method, such as
   `middleware`, names no handler. A `Bun.serve` route value serves every method
   only when the file proves it is a function; an imported value or a parameter
   claims none. Where a Koa router takes `get(name, path, handler)`, the route
   name is not a path segment, and the path that follows it is the endpoint.
3. **Dynamic or unknown.** A value filling one whole segment is dynamic, as in
   `` fetch(`/talks/${id}`) ``. A segment that mixes computed and literal text
   is unknown, as in `` fetch(`/api/talks/${id}-${slug}`) ``, and so is a URL
   the scanner cannot resolve, such as `fetch(buildUrl(id))`. Query strings and
   fragments are ignored.
4. **Local helpers.** Not supported. A request belongs to the operation that
   calls a recognized client, so a wrapper function reports the request and its
   callers report nothing.
5. **The base.** `fetch('/api/talks')` has no base. A value this file cannot see
   is configuration, so an imported or required constant, `process.env.API_URL`,
   and an `axios.create({ baseURL })` built from one set `configured`, as does a
   field read through `this` that the file never assigns, such as one a
   framework injects, which is the client's own base setting; a field the file
   assigns is unknown, because files the scan does not read may assign it too. A
   variable with a literal initializer that this file never assigns again
   resolves to its own literal text, unless a script, a file with no import,
   export, `require` or `exports`, declares it at the top level with `let` or
   `var`: another script can assign those globals. So does a property of an
   object literal such a variable holds: the last property with its name, while
   the literal has no spread, computed key or accessor, the file neither exports
   the variable nor is a script declaring it at the top level, and nothing in
   the file assigns or deletes that property or an object above it, hands one of
   them to other code, or calls a method through them. A literal scheme and
   host, also when literal pieces only state it together, text that continues a
   configured value's last segment instead of starting with `/`, a base the file
   computes, and an `axios.create` configuration the scanner cannot read become
   the leading unknown segment, which derives nothing. Every other name the file
   binds counts as computed, including a parameter, a destructured name and a
   `for (const base of bases)` variable.
6. **File-location routes.** These frameworks declare no route by file location,
   so every endpoint names the handler its route states: the function written in
   place, or the one this file declares under the name the route gives. When the
   handler comes from another file, the endpoint names the operation that
   registers the route.
7. **Constrained segments.** Route patterns are literal text, `:name`, `:name?`,
   Express 5's trailing optional group `{/:name}`, and a trailing `*`, `*name`,
   `(.*)` or `:name(.*)` catch-all, which needs at least one segment because a
   request path cannot tell `/files` from `/files/`; Hono's trailing `*` and
   Express 5's trailing `{/*name}` or `/{*name}` also match the path without it.
   A pattern parameter, such as `:id(\d+)`, and
   text mixed with a placeholder, such as `talk-:id`, are constrained
   parameters. A pattern that may span segments or that the scanner cannot
   state, such as a regular expression, another optional group or a catch-all
   that is not last, becomes a constrained optional catch-all in place of itself
   and the rest of the route, so no route is omitted; the whole segments before
   it stand.
8. **Registration order.** Express, Hono and Koa routers take the first
   registered match, so their endpoints carry `order`: the application, named by
   the file that creates it and the variable that holds it, such as
   `server/app.js#app`, and a position. Same-named local applications in one
   file also carry their declaration position to keep their order separate.
   The routing model has six rules:
   1. A registrar's entries are its registrations and the references that hand
      it off to other code, such as `registerRoutes(app)`. Serving it with
      `listen`, Node's `createServer(app)` or an imported `serve(app)` registers
      nothing, and neither does a route method called with fewer than two
      arguments, such as the setting read `app.get('env')`. A `use` that only
      adds middleware, which takes no place (rule 5), is no entry either, so
      `if (app.get('env') === 'development') app.use(logger)` leaves the order
      of the other entries known. The scanner never sees the files that import this one, which run
      after all of it and may add any route, so an export, `export default app`,
      `export const app` or an assignment to `module.exports` or `exports`,
      hands the registrar off at the end of its order; a circular require is the
      accepted exception.
   2. Entries that are all top-level statements run in source order, and the
      calls of a chain such as `router.get('/a', list).post('/a', save)` in the
      order they are written, a chain continuing through Express's `set`,
      `enable`, `disable` and `engine`. Otherwise, as for an entry inside a
      function or an `if`, the registrar's routes share one position.
   3. A mounted router's routes take the mount's place, and routers one call
      mounts, as in `app.use('/admin', users, audit)`, follow in the order it
      lists them. Hono's `route(path, child)` and a Koa router's `use` copy the
      routes the child has when they run, so a route registered later is not
      under them, and one whose order against the copy the scan cannot prove
      only blocks its path; `app.use(router.routes())` serves a Koa router's
      routes as they change.
   4. An entry the scan sees but cannot read takes its place as its readable
      prefix followed by a constrained optional catch-all, with method `*`
      unless the call states one, named by the registering operation: a route
      with a computed path, a mount under a computed prefix, a path mounted to
      something other than a recognized router or a function the scan sees,
      such as `app.use('/static', express.static('public'))`, a router the
      scan cannot follow, mounted with or without a path, such as
      `app.use(require('./routes'))`, a Koa router's `routes()` from another
      file, or a function imported from one, which the scanner cannot see, a
      route builder such as `app.route('/reports')`, Hono's `on`, `mount` and
      `basePath`, a Koa router whose own path is computed, a Koa `redirect`
      whose source is a route name, and a hand-off, which blocks from its
      registrar's root.
   5. Middleware takes no place: a package's handler, such as `express.json()`,
      and any handler before or beside a recognized router in one call, as in
      `app.use(requireAuth, api)`, which then states no path. Hono's `use`
      never mounts a router, so it takes no place with or without a path,
      whatever its handlers. Under a path, an Express or Koa `use` takes none
      when the scan sees that every handler is a function, as in
      `app.use('/api', requireAuth)`.
   6. Fastify and Bun.serve prefer the most specific route and carry no order; a
      Fastify plugin, whose routes the scan does not read, blocks its prefix
      without one.

## Validation

Independent fixtures cover ECMAScript modules, CommonJS, JSX, browser scripts,
minified files excluded by name and by line length, exact source positions,
unresolved calls, the source outline with its visibility rules, one body that
tokenizes identically in JavaScript and in TypeScript, identical and
near-duplicate bodies found by `groma lint`, a file that does not parse next to
one that does, and each supported HTTP client and router with every case that
reports nothing. The fresh-checkout package check removes language tools from
PATH and blocks JavaScript network access.
See [local qualification](validation.md).
