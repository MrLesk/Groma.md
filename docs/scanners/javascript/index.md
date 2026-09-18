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
derives no relationship from JavaScript calls. The HTTP facts below are the
exception: they state a route or a URL, which core can compare across files.

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
[shared rule](../../architecture-findings.md#compared-operations). The
JavaScript, Vue and TypeScript scanners share one rule and one tokenizer, so the
operations the [TypeScript scanner](../typescript/index.md#compared-operations)
compares, those it does not compare yet, and the tokens that page lists apply
here too. The same body in a `.js` file and in a `.ts` file therefore compares
equal.

## HTTP facts

The scanner reports the [HTTP endpoints and requests](../evidence.md#http-endpoints-and-requests)
a JavaScript file states, and core joins them into relationships. Each file is
parsed alone, so a construct counts only when that file states it.

| Construct | Reported |
| --- | --- |
| `fetch(url, init)`, including a `node-fetch` default import | Request; the method comes from a literal `method`, else `GET` |
| `axios.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options` | Request with that method |
| `axios(config)`, `axios.request(config)` | Request from a literal `url` and `method`, else `GET` |
| `axios.create({ baseURL })` instances | Request whose path follows that base |
| `$.get`, `$.post`, `$.getJSON`, `$.getScript` | Request with that helper's method |
| `$.ajax(settings)` and `$.ajax(url, settings)` | Request from the settings' `type` or `method`, else `GET`; settings the scanner cannot read state nothing |
| `express()` and `express.Router()` | Endpoint per `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `all` call with a handler |
| `Fastify()` | The same calls, and `route({ method, url, handler })`, including a method array |
| `new Hono()` | The same calls |
| `new Koa()` with `@koa/router` or `koa-router` | The same calls on a router `use` mounts, under its `new Router({ prefix })` or `router.prefix(...)` path |
| `Bun.serve({ routes })` | Endpoint per route: a function serves every method, an object one per method key |

A name is a client, application or router when this file imports or requires it
and never assigns it again, so `import express from 'express'`,
`const express = require('express')`, `const { Router } = require('express')` and
`require('express')()` are all recognized. jQuery is the exception a browser
script needs: a `$` or `jQuery` receiver counts when the file imports it or leaves
it to the page, and not when the file declares that name itself. A member name
alone is never enough: `cache.get('/talks')` reports nothing.
`http.createServer`, Fastify's `register` prefixes, and any application, router or
client an imported factory returns are not read yet.

The six [producer decisions](../evidence.md#producer-checklist) for this
ecosystem:

1. **Prefixes.** An endpoint path carries every prefix this file states:
   `app.use('/orders', router)`, Hono's `app.route('/api', api)` and a Koa
   `app.use(router.routes())` prepend their literal prefix, and mounts nest. A Koa
   router adds its own path from `new Router({ prefix })` or `router.prefix(...)`.
   An application instance serves from the root. A router this file never mounts, a
   mount under a computed prefix, a router whose second prefix statement replaces
   the first, and a mount on a host the scanner does not recognize report nothing,
   because the path the application serves is then unknown.
2. **Endpoints.** Only a route registration with its own handler is an endpoint.
   `app.use(express.json())` and `app.use('/static', express.static('public'))`
   are middleware, `app.get('name')` with one argument reads a setting, and a
   `Bun.serve` route key that is not a method, such as `middleware`, names no
   handler. A route pattern is literal text, `:name`, `:name?`, or a trailing `*`,
   `*name` or `(.*)`; another regular expression, an optional group, and a
   catch-all that is not last report nothing, as does a route or method the source
   computes. Where a router accepts `get(name, path, handler)`, the route name is
   not a path segment, and the path that follows it is the endpoint.
3. **Dynamic or unknown.** A value filling one whole segment is dynamic, as in
   `` fetch(`/talks/${id}`) ``. A segment that mixes computed and literal text is
   unknown, as in `` fetch(`/api/talks/${id}-${slug}`) ``, and so is a URL the
   scanner cannot resolve, such as `fetch(buildUrl(id))`. Query strings and
   fragments are ignored.
4. **Local helpers.** Not supported. A request belongs to the operation that
   calls a recognized client, so a wrapper function reports the request and its
   callers report nothing.
5. **The base.** `fetch('/api/talks')` has no base. A value this file cannot see
   is configuration, so an imported or required constant, `process.env.API_URL`,
   and an `axios.create({ baseURL })` built from one set `configured`, as does a
   field read through `this`, which holds the client's own base setting. A
   variable with a literal initializer that this file never assigns again
   resolves to its own literal text. So does a property of an object literal such
   a variable holds, while the file does not export the variable and nothing in
   it assigns or deletes that property or an object above it, hands one of them
   to other code, or calls a method through them. A literal scheme and host, also
   when literal pieces only state it together, text that continues a configured
   value's last segment instead of starting with `/`, and a base the file
   computes become the leading unknown segment, which derives nothing. Every
   other name the file binds counts as computed, including a parameter, a
   destructured name and a `for (const base of bases)` variable: a name the
   scanner merely failed to resolve must never pass for a configuration value,
   because core compares a configured path.
6. **File-location routes.** These frameworks declare no route by file location,
   so every endpoint names the handler its route states: the function written in
   place, or the one this file declares under the name the route gives. When the
   handler comes from another file, the endpoint names the operation that
   registers the route.

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
