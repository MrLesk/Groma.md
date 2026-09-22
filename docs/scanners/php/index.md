# PHP scanner

The PHP scanner reads tracked and unignored `.php` files, including PHP embedded
in HTML. It also reads extensionless PHP commands named by a Composer `bin` or
direct `php` script when the file contains a PHP opening tag. It does not require
Composer, PHP, WordPress, project dependencies, or application execution.
Discovery matches PHP source directly, even without a package manifest.

```sh
bun plugins/scanners/php/build.ts
```

From the project being scanned:

```sh
groma scanner add /absolute/path/to/groma/plugins/scanners/php/dist/package
groma scan
```

The package bundles [php-parser 3.7.0](https://github.com/glayzzle/php-parser/releases/tag/v3.7.0),
a JavaScript parser configured for PHP syntax through 8.4. It includes the parser
license and needs no installation scripts or downloads while scanning. This is
source syntax analysis, not a PHP runtime compatibility check. Newer syntax
outside the bundled parser is unsupported; parser errors fail the observation
rather than publish partial evidence.

## Evidence

The scanner reports one repository source root, exact PHP paths, named functions,
classes, interfaces, traits, enums, and methods. Implemented functions, methods,
closures, and arrow functions produce operation evidence with UTF-16 source
offsets. A file's top-level code is one more operation, `(module)`, which
declares no symbol, when an HTTP fact below names it: a request sent there, or
a blocker registered there. Calls and constructions within these operations
remain unresolved.

The repository source root is initial placement evidence, not a claim that every
PHP file belongs to one C4 runtime boundary. Core owns architecture identity and
curation. There is no Composer autoload resolution, runtime execution of
includes, WordPress hook matching, or dependency resolution. The HTTP facts
below read which routes files a Laravel project loads from its source, and core
joins them into relationships. An import or include does not associate files
into a component. Ordinary OKF Code links
expose file ownership without adding a new architecture level or stored graph.

PHP edits and new files use the shared scanner watcher. Repeated scans preserve
one physical owner and authored architecture. Shared Git boundaries omit ignored
files and dependency/build output directories. Core applies configured source
exclusions. Test source is otherwise treated like other PHP source; projects can
exclude it explicitly.
The live scanner also rescans after other unexcluded repository changes so it
can catch extensionless Composer commands at any declared path.

## Source outline

The web and terminal maps list a PHP file's declarations under the
[shared outline rules](../creating-a-plugin.md#source-outline). The scanner
parses the file with the bundled parser and lists what is declared directly in
the file or in a braced or unbraced `namespace` block:

- functions, including a function declared directly inside
  `if (!function_exists('name')) { ... }` when the guard names that function
  by its namespace-qualified name, such as `'Shop\format_total'` inside
  `namespace Shop`; a bare guard name inside a namespace means the global
  function, so the declared function is not listed;
- closures and arrow functions assigned directly to a variable, listed under
  the variable name, such as `$format`;
- classes, interfaces, traits, and enums, with every method as a member,
  including static, abstract, and interface methods and `__construct`.

Top-level declarations are `public`. Members are `private` or `protected` when
declared so, and `public` otherwise. Properties, constants, enum cases, trait
`use` statements, and declarations inside functions, methods, or other
control-flow blocks are not listed. A declaration is marked as
an entry when the component's Code names its scan symbol, such as
`Shop\OrderService` or `Shop\OrderService::store`.

## Compared operations

`groma lint` and scan findings compare PHP operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range and body tokens to:

- functions with a body, including functions declared inside other bodies;
- methods with a body, including constructors and methods of anonymous classes.

Parameters and local variables become slots from their first use, because PHP
variables have function scope. `$this`, superglobals, names declared `global`,
and static properties such as `self::$count` keep their names. A closure body
sees only the variables it imports with `use`; an arrow function body sees the
enclosing variables. Every parenthesis the source writes around an expression
remains, and so does the `&` of a variable bound by reference in `foreach` or
in a closure's `use` list.

Closures and arrow functions are not compared, including those assigned to a
variable or to an array key: PHP is one of the languages whose scanner treats
every closure and arrow function as an anonymous callback under the
[shared rule](../../architecture-findings.md#compared-operations).

Top-level code and property and constant initializers are not operations and
are not compared.

## HTTP facts

The scanner reports the [HTTP endpoints and requests](../evidence.md#http-endpoints-and-requests)
a PHP file states, and core joins them into relationships. It answers the
[producer checklist](../evidence.md#producer-checklist) below.

A member call such as `get` counts only on a receiver the scanner proves to
hold a router or a client, because ordinary objects share the member names:
`Cache::get('/talks', $callback)` and `$cache->get('/talks')` report nothing. A
proved receiver is:

- Laravel's `Route` facade, imported or through its global alias;
- a property declared with a recognized type, including a promoted constructor
  parameter;
- a parameter declared with a recognized type that its function never assigns;
- a variable every write of which in its own function or top-level code creates
  a Slim application with `AppFactory::create()` or `new App(...)`;
- a variable a closure imports by value from a proved one and never assigns;
- the first parameter of the closure a proved router's `group` calls.

The recognized types, resolved through the file's `use` aliases, are Guzzle's
`Client` and `ClientInterface`, PSR's `ClientInterface` and Symfony's
`HttpClientInterface` for clients, and `Slim\App`, Slim's `RouteCollectorProxy`
and `RouteCollectorProxyInterface`, and Laravel's `Router` and `Registrar` for
routers. Variables of enclosing code, including those an arrow function
captures, are not visible.

**Prefixes.** An endpoint path carries every prefix the source states: a Laravel
`Route::prefix('api')->group(...)`, `Route::prefix('api')->get(...)` or
`Route::group(['prefix' => 'api'], ...)`, a route builder's
`$app->group('/admin', ...)`, and a class-level Symfony
`#[Route('/api/speakers')]`. A WordPress route's namespace is its prefix, so
`register_rest_route('shop/v1', '/orders')` serves `/shop/v1/orders`; the REST
root the site prepends is not in the source. A prefix the source computes, such
as `Route::prefix('beta/' . config('api.prefix'))` or
`#[Route('/drafts/' . Paths::DRAFTS)]`, makes each route under it a blocker (see
**Registration order**) under the whole segments it states first. A group that
states no prefix at all still reports its routes.

A Laravel routes file is served under the files that load it.
`bootstrap/app.php` with `->withRouting(web: ..., api: __DIR__.'/../routes/api.php')`
serves web routes from the root and API routes under its `apiPrefix`, `api`
unless stated. A group given a file, such as
`Route::prefix('api')->group(base_path('routes/api.php'))`, serves it under the
group's prefix and patterns, and a `require` or `include` of a file, at the top
level of a loaded file or inside a group's closure, serves it under that code,
as `routes/web.php` requires `routes/auth.php`. Loads compose: a file loaded
under `api` that loads another under `v1` serves that one under `api/v1`. A
group or `withRouting` in a file nothing loads, such as a route service
provider, serves from the root, while a `require` there, as in a seeding script,
serves nothing. The Laravel routes of a file that no load
reaches, including one only an unrecognized loader such as `loadRoutesFrom` or
`module_path` loads, and those under a prefix a loader computes, are blockers.

A Slim route carries the prefix of the router it is registered on. An
application its code creates registers at the root, or under the base path the
same code gives it with `setBasePath`. A typed `Slim\App` registers under the
project's base path: the root when no scanned file calls `setBasePath`, the
stated path when exactly one call states a literal path, and an unresolved
prefix otherwise. A group's closure parameter registers under the group's
prefix. A group object
typed `RouteCollectorProxy` anywhere else, and every route inside a closure
passed to `group` on a receiver the scanner cannot prove, have an unresolved
prefix, so they are blockers.

**Endpoints.** Only the handler a route names is an endpoint, and only a route
registered on a proved router counts. The scanner reads `get`, `post`, `put`,
`patch`, `delete`, `options`, `head`, `any`, `match` and `map` on such a
router, Symfony `#[Route]` attributes on controller methods (including Drupal's
attribute that extends Symfony's),
the class-level `#[Route]` of an invokable controller whose methods declare
none, which routes `__invoke`, and `register_rest_route` with the
`WP_REST_Server` method constants. A handler is a closure written in place,
`[Type::class, 'method']`, `[$this, 'method']`, `Type::class` for an invokable
class, or a string naming a function or `Type::method`, and must be a function
or method with a body in the scanned files, including an inherited method on a
scanned parent class. Laravel reads a plain string
handler as a method of the controller its `Route::controller(...)` group names,
and otherwise as a controller class, so outside such a group it is unknown.
A Laravel route under `domain(...)`, or in a group whose options state a
`domain`, answers only on that host, so it is a blocker. `view`, `redirect`,
`permanentRedirect` and the resource and singleton members register routes
whose handlers or paths are framework conventions, so they are blockers.
Middleware reports nothing, and neither does `Route::fallback`, which the router
tries only after every other route. WordPress skips associative route options
beside numeric endpoint groups and defaults a group without `methods` to `GET`.

**Dynamic or unknown.** `"/talks/$id"` fills one whole segment, so it is
dynamic; PHP proves nothing about whether the value holds a slash.
`"/talks/item-$id"`, any other segment mixing literal and computed text, and a
URL the scanner cannot read are unknown.

**Local helpers.** Not supported. A request belongs to the operation that calls
a recognized client, or to the file's top-level code, so a wrapper function
reports the request and its callers report nothing.

**The base.** `curl_setopt($handle, CURLOPT_URL, '/shop/v1/orders')` has no
base. A client call such as `$client->get('/api/talks')` sets `configured`,
because the client's own `base_uri` is not visible at the call, and so do the
WordPress site-URL calls `rest_url`, `home_url`, `site_url` and `admin_url` with
their literal path argument. Text right after such a call without a path
argument, as in `home_url() . 'api/talks'`, continues the site root's last
segment, so it is unknown. A literal scheme or authority, and a URL the scanner
cannot resolve, become the leading unknown segment.

**File-location routes.** PHP declares no routes by file location, so every
endpoint names the handler its route states.

**Constrained segments.** A parameter whose pattern the router checks is
constrained: Symfony `{id<\d+>}` and `requirements`, Slim `{id:\d+}`,
WordPress `(?P<id>\d+)`, and Laravel `where`, `whereNumber`, `whereAlpha`,
`whereAlphaNumeric`, `whereUuid`, `whereUlid` and `whereIn`, written on the
route or on the chain before a route or group. A segment that mixes text with a
placeholder, such as `photo-{size}`, is one constrained parameter. A pattern of
`.*` or `.+` on the last segment is a plain optional or required catch-all. A
pattern that may match `/`, a pattern or parameter name the scanner cannot read,
and a Slim optional group such as `[/{page}]` become a constrained optional
catch-all that replaces the rest of the route. Laravel's global
`Route::pattern` and `Route::patterns`, in any scanned file, constrain every
Laravel route parameter of that name that states no pattern of its own; one
whose parameter name the scanner cannot read constrains every such parameter.
Symfony's `{slug:post}` maps the route parameter to a controller argument; it
does not constrain the path segment.

**Registration order.** Laravel, Symfony, Slim and WordPress take the first
registered route that matches, so every endpoint reports `order`. The scanner
does not prove the order in which files and functions register their routes, so
every endpoint takes position 0: an unknown order. The routes and blockers of
one Laravel project share one application, its `bootstrap/app.php`, else its
nearest `composer.json`, so that they compete with each other; any other route's
application is the file that declares it.

A route entry the scanner sees but cannot report is still reported, as a
blocker that could capture requests first: a computed route or prefix, a
route whose prefix is not proved, a routes file loaded from a place the scan
cannot find, a host-bound route, unreadable methods, a handler the scan cannot
place, and the conventional routes above. A
blocker states the whole literal segments the route states first and then a
constrained optional catch-all, for its methods or `*` when they are not
readable, and names the operation that registers it: the enclosing function,
method or closure, or the file's top-level code. Core derives no row to a
blocker.

Requests come from Guzzle-style clients
(`$client->get|post|put|patch|delete|head|options($url[, $options])` and
`$client->request($method, $url)`, including the `Async` members), the WordPress
HTTP API (`wp_remote_get`, `wp_remote_post`, `wp_remote_head`,
`wp_remote_request` and their `wp_safe_` forms), and cURL (`curl_init`,
`curl_setopt` with `CURLOPT_URL`, `CURLOPT_CUSTOMREQUEST` or `CURLOPT_POST`, and
`curl_setopt_array`). Further limits:

- A client call counts only on a proved client receiver, so a client reached
  through an untyped value reports nothing, and so does a client the code
  constructs with `new Client(...)`, whose own `base_uri` the scanner does not
  read.
- The scanner does not follow a cURL handle through other variables or
  functions, so an operation reports a request only when one `curl_init` result
  assigned to one handle is configured through that handle alone. Several
  handles, several URLs, and an option or method the scanner cannot read report
  no request. `CURLOPT_POST` states POST when set to `true` or `1`. A cURL
  request without `CURLOPT_CUSTOMREQUEST` or `CURLOPT_POST` reports no method,
  which derives no row.
- Only a constant the same file declares once resolves to text: a namespace
  `const`, which an unqualified name reaches before a global constant of that
  name, a class constant named through `self::` or its class, and `define`.
  `static::` and a constant from another file leave the path unknown.
- Query strings and fragments are ignored, as the fact format requires.

## Validation

Independent fixtures cover declarations, mixed PHP/HTML, nested function
ownership, exact source locations, unresolved calls, invalid syntax, discovery
without Composer, repeat scans, live source edits, identical,
near-duplicate and renamed bodies found by `groma lint`, the source outline
of PHP files beside a TypeScript file in one component, and the HTTP facts of
each supported routing and client API with their unresolved cases. The fresh-checkout
package check removes language tools from PATH and blocks JavaScript network
access.
See [local qualification](validation.md) for the Call for Papers example.
