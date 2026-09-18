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

- binary, assignment, conditional and prefix and postfix unary operators, and
  `typeof`, `void`, `delete`, `await`, `yield` and `new`;
- `if`, `else`, `for`, `while`, `do`, `switch`, `case`, `default`, `break`,
  `continue`, `return`, `throw` and `try`;
- string and number literals, `true`, `false` and `null`;
- property names, the operation's own name and names declared elsewhere;
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
from, in the file that uses them. A wrapper that re-exports a framework, a
factory that returns an application, and a registrar received as a parameter,
such as a Fastify plugin's `fastify`, are not recognized.

| Construct | Reported |
| --- | --- |
| `fetch(url, init)` | Request; the method comes from a literal `method`, else `GET` |
| `axios.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, `.options` | Request with that method |
| `axios(config)`, `axios.request(config)` | Request from literal `url` and `method`, else `GET` |
| `axios.create({ baseURL })` instances | Request whose path follows that base |
| `express()` and `express.Router()` | Endpoint per `get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `all` call with a handler |
| `Fastify()` | The same calls, and `route({ method, url, handler })`, including a method array |
| `new Hono()` | The same calls |
| `@Controller` classes | Endpoint per `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Head`, `@Options`, `@All` method from `@nestjs/common` |
| `Bun.serve({ routes })` | Endpoint per route: a function serves every method, an object one endpoint per known method key |

The six [producer decisions](../evidence.md#producer-checklist) for this
ecosystem:

1. **Prefixes.** A route's path includes its `@Controller` prefix and every
   mount prefix, from `app.use('/api', router)` and `app.route('/v1', child)`.
   A router mounted twice reports one endpoint per prefix. A router this scan
   never sees mounted, a mount whose prefix is not literal, and a mount on a
   host the scan does not recognize, such as `createApp().use('/api', router)`,
   report nothing; an application instance without a mount serves from the root.
   A Fastify plugin registered with a `prefix` reports nothing, because its
   routes are registered on the plugin's parameter. A controller is the
   exception: its endpoints are reported without seeing its module
   registration, so a `setGlobalPrefix` path is missing from them, which core's
   single leading segment tolerates.
2. **Endpoints.** Only the route registrations above. `use` with one argument,
   middleware, and a `Bun.serve` `fetch` handler are not endpoints, and
   `app.get('name')` without a handler reads a setting. A route value the scan
   cannot read, such as a spread of handlers, claims no method.
3. **Dynamic or unknown.** `` `/talks/${id}` `` is dynamic;
   `` `/talks/${id}-latest` ``, a path built from a parameter, and an
   unresolvable value are unknown. A query string is dropped, computed or not.
4. **Local helpers.** Not supported: the URL is read at the client call only, so
   a helper that forwards a parameter reports unknown text. Author those rows.
5. **Bases.** A `const` assigned a literal once, an object-literal property, and
   a template of those are literal text. `process.env.X` and
   `import.meta.env.X` set `configured` whatever declares them, as does any
   value whose root is declared outside project source, such as an imported
   package constant. A literal scheme and host, and a value computed in project
   source, report a leading unknown segment. An `axios.create` instance must be
   a `const`, because a reassignable one can change its base.
6. **File-location routes.** None: TypeScript projects declare routes in code,
   so every endpoint names its resolved handler, or the registering operation
   when the handler is not certain.

Supported route patterns are literal text, `:name`, `:name?`, and a trailing
`*` or `*name`. A regular-expression parameter, an optional group, and a
mid-path wildcard report nothing for that route.
