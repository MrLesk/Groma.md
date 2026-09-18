# Python scanner

The official `@groma/scanner-python` plugin reads Python source through the
standard library's `ast` parser, running in bundled Pyodide 314.0.7. The
package includes CPython and its standard library as WebAssembly assets.
Git is required; a separate Python installation or virtual environment is not. It does not
import project modules, execute source, install dependencies, or evaluate
`setup.py`. [Python parser documentation](https://docs.python.org/3/library/ast.html).

## Install and scan

For a published release:

```sh
groma scanner add @groma/scanner-python
groma scanner check
groma scan
```

For local development, build a runnable package from the Groma repository,
copy that package into the consumer repository, and add its relative path:

```sh
bun plugins/scanners/python/build.ts /tmp/python-scanner
# In the consumer repository, after copying the folder to tools/python-scanner:
groma scanner add ./tools/python-scanner
groma scanner check
groma scan
```

Each scan uses its own worker and an in-memory copy of the selected files.
The worker runs only the scanner's parser code, then releases its interpreter.
Runtime assets are loaded from the installed scanner package; scanning does
not download Python packages or use project environments.

## Source evidence

The scanner reads Git-tracked and unignored untracked `.py` files. It excludes
shared generated/dependency directories, `.venv`, `venv`, `__pycache__`, `test`,
`tests`, `test_*.py`, `*_test.py`, and `conftest.py`. It scans neither `.pyi`
stubs nor notebooks. Configure additional exclusions through the shared
Groma scanner settings.

`pyproject.toml`, `setup.py`, `setup.cfg`, and `requirements.txt` identify source
projects. A file belongs to its nearest containing project; nested project roots
retain their parent links. Source outside those declarations belongs to one
repository source group. A `pyproject.toml` project name supplies the root name
when present; otherwise the directory name is used. These are source groupings,
not evaluated Python distributions. Discovery reads these declarations without
loading the plugin. Source-only repositories can add the plugin explicitly.

Each file has one record with named classes and functions, including methods,
async functions and nested declarations. Functions also provide operations and
exact UTF-16 source positions. Calls in their bodies identify the owning
operation, call position, line and member name when present. Every call target
is unresolved: Python runtime binding is outside this parser's evidence.
Decorators, defaults, annotations, module/class initialization, lambdas and
lazy generator expressions do not provide invocation evidence. Concrete
callbacks are not analyzed and call evidence produces no derived call
relationships; imports are followed only for the [HTTP facts](#http-facts)
below. Every observation includes a `PYTHON_SYNTAX_ONLY` diagnostic.

Source is parsed and compiled for syntax and scope validation, but the code
object is never executed. Invalid source or project TOML fails the whole Python
observation. Other healthy scanners follow Groma's existing failure isolation.
Correct reported syntax errors or use a scanner release supporting the source
language version. Readiness checks source availability and the packaged worker;
full syntax validation happens during the scan.

## Source outline

Components list the declarations of their Python files under the
[shared outline contract](../creating-a-plugin.md#source-outline). The worker
parses each requested file with the same `ast` parser and lists only
statements directly in the module body:

- `def` and `async def`, and lambdas assigned directly to a module-level name,
  are functions.
- Classes are types. Their members are the `def` and `async def` statements
  directly in the class body, including static methods, class methods and
  `__init__`.

Properties are not members: methods decorated with `@property`,
`@cached_property`, `@functools.cached_property`, or a property's `.getter`,
`.setter`, or `.deleter`. Nested classes and functions, class attributes
holding lambdas, type aliases, and other assignments such as `partial(...)` are
not listed either, nor are declarations inside module-level `if` or `try`
blocks. A declaration's line is its `def`, `class`, or assigned name's line.

Visibility comes from names alone. Dunder names and names without a leading
underscore are `public`. Members named `_name` are `protected` and members named
`__name` are `private`. Other top-level names starting with `_` are `private`.
`__all__` does not change visibility.

A declaration is an entry when a Code link names it: a top-level declaration by
its name, such as `place_order`, and a member by its class and name, such as
`OrderService.fetch`, the form the scan uses for methods.

## Compared operations

`groma lint` and scan findings compare Python operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range, from the `def` line to the body's last line, and body
tokens to every `def` and `async def`: module functions, methods including
`__init__`, and functions nested in functions or classes.

Parameters and the names a function binds, including comprehension variables
and nested function names, become slots in order of appearance; a def, class,
import, except or match name appears where it is bound. A function does not
bind names it declares `global` or `nonlocal`. An import inside a function
keeps the imported module and member, such as `math.floor`, and only its local
name becomes a slot. Docstrings, decorators, parameter defaults and annotations
are not body tokens.

The syntax tree has no parentheses, so an operand of an operator that is itself
a binary, boolean or comparison expression is wrapped in `(` and `)`:
`(a + b) * c` and `a + b * c` differ, and a chain such as `a < b <= c` stays one
run. A subscript writes `index`, a slice keeps where each bound stands, a
dictionary unpacking writes `**` where its key would be, and an else block
starts with `else`.

Lambdas, including those in a dictionary passed to a call or decorator, are
anonymous callbacks and are never compared. A function's tokens include the
functions, lambdas, classes and generator expressions nested in it. Module and
class-body code are initializers and are not compared.

## HTTP facts

The scanner reports the [HTTP endpoints and requests](../evidence.md#http-endpoints-and-requests)
it recognizes in Python source. Supported declarations:

| Construct | Reported as |
| --- | --- |
| `@app.route`, `@app.api_route`, `@app.get` and the other method decorators on a `Flask`, `FastAPI` or `Starlette` application | One endpoint per method; a `route` or `api_route` without `methods` serves `GET` |
| `add_api_route(path, endpoint, methods=...)` and `add_route(...)` on a `FastAPI` or `Starlette` application or router | Read like `route` |
| `mount(path, app)` on a `FastAPI` or `Starlette` application or router | The mounted application's routes under the mount path; a blocker for everything under that path when the scanner cannot resolve the mounted application |
| `host(...)` on a `FastAPI` or `Starlette` application or router | A blocker for the whole application |
| `Blueprint(url_prefix=...)` and `APIRouter(prefix=...)` | The router's own prefix |
| `register_blueprint(..., url_prefix=...)` and `include_router(..., prefix=...)`, in any scanned module | The registering prefix, including nested registrations; Flask's replaces the blueprint's own prefix, FastAPI's goes before the router's |
| `urlpatterns` with `path()`, `re_path()` and `url()` | One endpoint for method `*`, since Django hands every method to the view |
| `include("dotted.module")` | The prefix of the included module's patterns |
| `requests`, `httpx` and `aiohttp` method calls, and `request("METHOD", url)` | One request |
| `httpx.Client`, `httpx.AsyncClient`, `requests.Session` and `aiohttp.ClientSession`, including `base_url=` | One request per call on the session |
| `urllib.request.urlopen` | `GET`, or `POST` with data; `Request(method=...)` states its own method |

`<name>`, `<str:name>`, `{name}` and `{name:str}` are parameters; `<path:rest>` and
`{rest:path}` are catch-alls. A regular-expression route is read segment by
segment, with `(?P<rest>.*)` or `.+` last as a catch-all; a dot in its text is
literal only when escaped.

The scanner reports no endpoint for an application or router created inside a
function, a Starlette or FastAPI route table, a computed route, a computed
`methods` list, or a view or router it cannot resolve, and no request for a
client call outside a function. A router nobody registers in the scanned source
keeps only its own prefix, while a router registered on an application the
scanner cannot resolve, such as one passed to a function, reports no endpoint.
For Django, FastAPI and Starlette, which take the first match, an entry the
scanner recognizes but cannot report is a blocker instead (see decision 8).

Django endpoints need the complete `include()` graph, so `urlpatterns` must be a
literal list or tuple bound once. When any module builds its table by addition,
binds it more than once, includes a computed module, or includes a dotted path
that matches several scanned files, no Django endpoint is reported at all. An
`include()` of a module outside the scan is safe.

Only a name the module binds exactly once resolves to its value, in a module and
in an operation alike, so a constant reassigned anywhere, `PREFIX += "/v2"` and
a `for PREFIX in ...` loop included, and a client session rebound in the same
function, resolve to nothing.
A client call counts only when the module imports that library. A name that a
function binds, such as a parameter named `requests` or `BASE`, never resolves
to the module's import or constant of the same name.

Names resolve across modules by import: the scanner maps each scanned file to
its dotted module path and follows `import`, `from ... import` and relative
imports to one scanned module. A dotted path that matches several files, or
none, resolves to nothing.

The eight [producer decisions](../evidence.md#producer-checklist) for Python:

1. **Which prefixes belong in the path.** A blueprint's or router's own prefix,
   every registering prefix, and every Django `include()` prefix above it.
   Django endpoints are reported only from URL tables nobody includes, so each
   path carries its prefixes. `APIRouter(prefix="/speakers")` included with
   `prefix="/api"` reports `/api/speakers/{speaker_id}`. Flask's
   `register_blueprint(talks, url_prefix="/api")` replaces the blueprint's own
   `url_prefix`, so its `/<int:talk_id>` route reports `/api/<talk_id>`; a
   nested blueprint's prefix follows its parent's.
2. **Whether the construct is an endpoint.** Only a view or decorated handler.
   Flask `before_request` hooks, WSGI or ASGI middleware, Django middleware and
   permission classes, and `static()` helpers are not endpoints.
3. **Dynamic or unknown.** `f"/talks/{talk_id}"` fills one whole segment, so it
   is dynamic; Python cannot prove the value holds no slash. `f"/talks/{talk_id}.json"`
   and a URL read from an unresolved value are unknown.
4. **The local helper.** Only the call that names a recognized client reports a
   request. A helper that takes the URL as a parameter and calls
   `requests.get(url)` reports one request whose path is unknown, and its
   callers report nothing.
5. **The base.** `requests.get("/talks")` has no base. A value read from
   configuration sets `configured`: `os.environ["API"]`, `os.environ.get(...)`,
   `os.getenv(...)`, a Django `settings.API`, and a `base_url` attribute such as
   `self.base_url`, directly or through a module-level name bound once to one.
   So do `requests.post(f"{settings.API}/talks")` and a session with
   `base_url=settings.API`. `self.base_url` is instead the value of its one
   assignment when the class, its ancestors and its subclasses in the scanned
   source assign `base_url` exactly once, by a plain assignment in a class body
   or through `self.base_url = ...`, and no code sets `base_url` on another
   object, such as `client.base_url = url`. So
   `base_url = "https://api.github.com"` leads with an `unknown` segment and
   `base_url = f"{settings.API}/v1"` sets `configured` before `v1`. A base class
   outside the scanned source is not counted.
   `requests.get("https://example.com/talks")`, and a base the scanner can
   neither resolve nor trace to configuration, such as
   `requests.get(url)` with a parameter, `build_url() + "/talks"` or a name bound
   more than once, report a leading `unknown` segment. A module-level name bound
   once resolves to its text, so `API = "/api"` with `API + "/talks"` is
   `/api/talks`. Literal text right after a configured base must start with `/`,
   since `settings.API + "talks"` continues the base's last segment: that
   segment is `unknown`.
6. **Which operation a file-location route names.** Python has no
   file-location routing, so every endpoint names the handler function a
   decorator or URL pattern designates.
7. **Which segments are constrained.** A converter other than `str` or
   `string`, such as `<int:pk>`, `<slug:s>` or `{id:int}`, and a segment that
   mixes text with a placeholder, such as `photo-{id}`, are constrained
   parameters. In a regular-expression route, a named group limited to one
   segment, such as `(?P<pk>[0-9]+)`, is a constrained parameter and
   `(?P<slug>[^/]+)` a plain one. A group that may match a slash, such as
   `(?P<path>[a-z/]+)`, or text the format cannot state, becomes a constrained
   optional catch-all that replaces the rest of the route, and so does a
   catch-all followed by more route text. A regular expression without `$`
   also matches any continuation, so `^feed/` ends with an optional catch-all.
8. **Registration order.** Django, FastAPI and Starlette take the first route
   that matches; Flask prefers the most specific one and reports no `order`.
   A Django endpoint's `order` names the URL table nobody includes, and its
   position follows that table with each `include()` expanded where it stands.
   FastAPI and Starlette add routes as modules import, an order the scanner
   does not prove, so every endpoint of one application shares position `0`.
   The application is the file that creates it, or the router's own file when
   the scanner finds no registration. A route entry these routers register but
   the scanner cannot report keeps its position as a blocker: its literal prefix
   followed by a constrained optional catch-all, so core derives no row to it
   and none for a request it could take first. Django blockers are a
   class-based view through `as_view()`, a view it cannot resolve such as
   `admin.site.urls`, an `include()` of a module outside the scan, an
   unreadable route, and a list element that is not `path()`, `re_path()` or
   `url()`; each names its URL module's code as the `(module)` operation. An
   `include()` whose route does not end in `/`, such as `path("v", include(...))`,
   joins it to the included routes with no separator, so each included route
   is reported in blocker form after the text before that last segment.
   FastAPI and Starlette blockers are a route with a computed path or methods,
   an `add_api_route()` or `add_route()` whose handler the scanner cannot
   resolve, a route on a router registered on an application the scanner
   cannot resolve (a bare catch-all, with the router's own file as the
   application), `include_router()` or `mount()` of a router or application
   the scanner cannot resolve, and every `host()`.

## Architecture meaning

Python roots, symbols and operations are temporary scanner evidence. They add
no OKF record type or C4 containment level. Groma core owns initial placement
and preserves curated file ownership. Ordinary Markdown and OKF readers see
the existing architecture records and Code links with scanner ID `python`.
Framework dependencies and imports alone do not establish C4 collaborations.
The same rules apply across Python projects, without assuming a web framework
or directory layout.

See [fresh-checkout validation](../fresh-checkout-validation.md) for exercised projects and limitations.
