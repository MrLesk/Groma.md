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
- constructors with a body;
- arrow functions and function expressions assigned to a `const`, `let`, or
  `var` variable, or to a property of an object literal.

Functions written as properties or method shorthand of an object literal passed
directly to a function call, `new`, or a decorator are anonymous callbacks, as
are other unnamed arrow functions and function expressions. The object literal
may sit inside parentheses, `as`, `satisfies`, or `!`.

Parameters and local names become slots. These stay in the tokens as written:

- binary, assignment, conditional and prefix and postfix unary operators,
  `typeof`, `void`, `delete`, `await`, `yield`, `new`, `?.` and the spread `...`;
- `if`, `else`, `for`, `while`, `do`, `switch`, `case`, `default`, `break`,
  `continue`, `return`, `throw`, `try`, `catch` and `finally`, and `index` before
  an element access such as `items[key]`;
- string, template text, number, bigint and regular expression literals, `true`,
  `false`, `null`, `this` and `super`;
- property names, including `#name` members and the property names a
  destructuring pattern reads, the operation's own name and names declared
  elsewhere;
- parentheses around an operator expression, so `(a + b) * c` and `a + b * c`
  are different bodies. Parentheses around a name or a call do not change a
  body, and neither do type annotations and assertions.

These named operations are not compared yet:

- `get` or `set` accessors;
- methods whose name is not an identifier, such as `#run()`, `'run'()`, or
  `[key]()`;
- functions assigned to class fields, such as `onClick = () => {}`.

## HTTP endpoints and requests

The scanner reports [HTTP facts](../evidence.md#http-endpoints-and-requests) for
the clients and routers it recognizes by the module their names are imported
from, in the file that uses them. The checker decides what a name means, so a
parameter or local that shadows an import is not that import. A wrapper that
re-exports a framework, a factory that returns an application, and a registrar
received as a parameter, such as a Fastify plugin's `fastify`, are not
recognized, and an application or router is one only while a variable the
program never assigns again holds it. The routers are read by the reader the
[JavaScript scanner](../javascript/index.md#http-facts) shares.

| Construct | Reported |
| --- | --- |
| `fetch(url, init)`, including a `node-fetch` default import | Request; a literal `method` gives the method, no options means `GET`, and options the scanner cannot read leave it out |
| `axios.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options` | Request with that method |
| `axios(config)`, `axios.request(config)` | Request from the config's `url`; its `method`, else the client's, else `GET` |
| `axios.create(config)` instances | Request whose path follows the config's `baseURL`, and whose method defaults to the config's |
| `express()` and `express.Router()` | Endpoint per `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `all` call with a handler |
| `Fastify()` | The same calls, and `route({ method, url, handler })`, including a method array |
| `new Hono()` | The same calls |
| `@Controller` classes | Endpoint per `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Head`, `@Options`, `@All` method from `@nestjs/common` |
| `Bun.serve({ routes })` | Endpoint per route: a function serves every method, an object one endpoint per known method key |

Values and options follow the shared rules the framework scanners apply, as
the [React scanner](../react/index.md#http-endpoints-and-requests) states them:
a changed, duplicated or computed option is never taken for the literal it once
held, options the scanner cannot read leave the method out and, for axios, the
base unknown, and a `fetch` input that is not a URL, such as a `Request`, states
no method. A request's own `baseURL` replaces the client's; a base joins a
relative path with one slash, and an absolute URL replaces it. Exactly one
assignment to `defaults.baseURL` or `defaults.method` on `axios` or on an
instance sets it, and any other change to `defaults` hides both; interceptors
and code a client is handed to are not read.

The [producer decisions](../evidence.md#producer-checklist) for this ecosystem:

1. **Prefixes.** A route's path includes its `@Controller` prefix and every
   mount prefix, from `app.use('/api', router)`, `app.use(router)` and
   `app.route('/v1', child)`. A router mounted twice reports one endpoint per
   prefix. A router this scan never sees mounted, and a mount on a host the scan
   does not recognize, such as `createApp().use('/api', router)`, report
   nothing; an application instance without a mount serves from the root. A
   Fastify plugin's routes are registered on the plugin's parameter, which the
   scan does not read, so `register(plugin, { prefix })` blocks its prefix, as
   decision 8 describes, without an order. A controller is the exception: its
   endpoints are reported without seeing its module registration, so a
   `setGlobalPrefix` path is missing from them, which core's single leading
   segment tolerates.
2. **Endpoints.** Only the route registrations above. `use` without a path,
   middleware, and a `Bun.serve` `fetch` handler are not endpoints, and
   `app.get('name')` without a handler reads a setting. A route value the scan
   cannot read, such as a spread of handlers, claims no method.
3. **Dynamic or unknown.** `` `/talks/${id}` `` is dynamic;
   `` `/talks/${id}-latest` ``, a path built from a parameter, and an
   unresolvable value are unknown. A query string is dropped, computed or not.
4. **Local helpers.** Not supported: the URL is read at the client call only, so
   a helper that forwards a parameter reports unknown text. Author those rows.
5. **Bases.** A variable with a literal initializer that the program never
   assigns again, a property of an object literal it holds while nothing in the
   program can change that property, and a template of those are literal text.
   A value the scanner cannot see is configuration and sets `configured`:
   `process.env.X`, `import.meta.env.X`, a name only a declaration file or a
   `declare` statement states, an imported package constant, and a field read
   through `this`, which holds the client's own base. Text that continues a
   configured value's last segment instead of starting with `/`, a literal
   scheme and host, also when literal pieces only state it together, a
   parameter, a value a call returns, and any other computed value report a
   leading unknown segment.
6. **File-location routes.** None: TypeScript projects declare routes in code,
   so every endpoint names its resolved handler, or the registering operation
   when the handler is not certain.
7. **Constrained segments.** Route patterns are literal text, `:name`, `:name?`,
   Express 5's trailing optional group `{/:name}`, and a trailing `*`, `*name`,
   `(.*)` or `:name(.*)` catch-all, which needs at least one segment because a
   request path cannot tell `/files` from `/files/`; Hono's trailing `*` also
   matches the path without it, so it is an optional catch-all. A pattern
   parameter, such as `:id(\d+)` or Hono's `:id{[0-9]+}`, and text mixed with a
   placeholder, such as `talk-:id`, are constrained parameters. A pattern that
   may span segments or that the scanner cannot state, such as another optional
   group or a mid-path wildcard, becomes a constrained optional catch-all in
   place of itself and the rest of the route, so no route is omitted.
8. **Registration order.** Express, Hono and NestJS behind Express take the
   first registered match, so their endpoints carry `order`, ranked by the
   [JavaScript scanner's routing model](../javascript/index.md#http-facts) with
   these differences. The program holds every file that imports a registrar, so
   an export registers nothing, and a hand-off counts in the file that creates
   the registrar and in every file that registers on it; a file that only
   imports it and hands it on runs after that file's top-level registrations, a
   circular import being the accepted exception. A function from the
   application's own module is middleware, because the checker sees it, and a
   value loaded from one that is neither a router nor a function blocks as a
   router the scan cannot follow. Koa is not read. NestJS behind Express
   registers its routes in an order the scan does not follow, so every route of
   its application, named by the file that calls `NestFactory.create`, shares
   one position; a computed `@Controller` path blocks every route below it, and
   a computed route its own. NestJS behind a `FastifyAdapter` prefers the most
   specific route and carries no order.
