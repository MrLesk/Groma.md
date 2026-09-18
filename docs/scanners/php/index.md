# PHP scanner

The PHP scanner reads tracked and unignored `.php` files, including PHP embedded
in HTML. It does not require Composer, PHP, WordPress, project dependencies, or
application execution. Discovery matches PHP source directly, even without a
package manifest.

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
offsets. Calls and constructions within these operations remain unresolved.
Top-level executable statements are inventoried as part of their source file;
they do not create artificial functions.

The repository source root is initial placement evidence, not a claim that every
PHP file belongs to one C4 runtime boundary. Core owns architecture identity and
curation. There is no Composer autoload resolution, include execution, WordPress
hook matching, or dependency resolution; core joins the HTTP facts below into
relationships. An import
or include does not associate files into a component. Ordinary OKF Code links
expose file ownership without adding a new architecture level or stored graph.

PHP edits and new files use the shared scanner watcher. Repeated scans preserve
one physical owner and authored architecture. Shared Git boundaries omit ignored
files and dependency/build output directories. Core applies configured source
exclusions. Test source is otherwise treated like other PHP source; projects can
exclude it explicitly.

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
enclosing variables.

These named operations are not compared:

- closures and arrow functions, including those assigned to a variable or to an
  array key. This is a PHP exception to the shared rule; the scanner treats every
  closure and arrow function as an anonymous callback.

Top-level code and property and constant initializers are not operations and
are not compared.

## HTTP facts

The scanner reports the [HTTP endpoints and requests](../evidence.md#http-endpoints-and-requests)
a PHP file states, and core joins them into relationships. It answers the
[producer checklist](../evidence.md#producer-checklist) as follows.

**Prefixes.** An endpoint path carries every prefix the source states: a Laravel
`Route::prefix('api')->group(...)` or `Route::group(['prefix' => 'api'], ...)`, a
route builder's `$app->group('/admin', ...)`, and a class-level Symfony
`#[Route('/api/speakers')]`. A WordPress route's namespace is its prefix, so
`register_rest_route('shop/v1', '/orders')` serves `/shop/v1/orders`; the REST
root the site prepends is not in the source. A prefix the source computes, such
as `Route::prefix(config('api.prefix'))` or `#[Route(Paths::DRAFTS)]`, reports
nothing for the routes under it: no literal path can stand for it. A group that
states no prefix at all still reports its routes.

**Endpoints.** Only the handler a route names is an endpoint. The scanner reads
`Route::get`, `post`, `put`, `patch`, `delete`, `options`, `head`, `any` and
`match`, the same members on an application or group object such as
`$app->get(...)` and `$group->delete(...)` including `map`, Symfony `#[Route]`
attributes on controller methods, and `register_rest_route` with the
`WP_REST_Server` method constants. Middleware, `Route::view`, `Route::redirect`
and `Route::resource` report nothing: they name no PHP handler, or their paths
are framework conventions rather than source text. A handler is a closure written
in place, `[Type::class, 'method']`, `[$this, 'method']`, `Type::class` for an
invokable class, or a string naming a function or `Type::method`; the handler
must be a function or method with a body in the scanned files.

**Dynamic or unknown.** `"/talks/$id"` fills one whole segment, so it is
dynamic; PHP proves nothing about whether the value holds a slash.
`"/talks/item-$id"`, any other segment mixing literal and computed text, and a
URL the scanner cannot read are unknown. A route segment that is neither a whole
literal nor a whole parameter, such as `/talks/item-{id}` or
`(?P<id>\d+)/items-(?P<index>\d+)`, reports no endpoint at all, because the
format cannot state the path the application serves. Catch-all segments are
never reported, so a Laravel `->where('path', '.*')` route and an optional
builder group such as `[/{page}]` report only what their literal text states.

**Local helpers.** Not supported. A request belongs to the operation that calls
a recognized client, so a wrapper function reports the request and its callers
report nothing.

**The base.** `curl_setopt($handle, CURLOPT_URL, '/shop/v1/orders')` has no
base. A client call such as `$client->get('/api/talks')` sets `configured`,
because the client's own `base_uri` is not visible at the call, and so do the
WordPress site-URL calls `rest_url`, `home_url`, `site_url` and `admin_url` with
their literal path argument. A literal scheme or authority, and a URL the
scanner cannot resolve, become the leading unknown segment.

**File-location routes.** PHP declares no routes by file location, so every
endpoint names the handler its route states.

Requests come from Guzzle-style clients
(`$client->get|post|put|patch|delete|head|options($url[, $options])` and
`$client->request($method, $url)`, including the `Async` members), the WordPress
HTTP API (`wp_remote_get`, `wp_remote_post`, `wp_remote_head`,
`wp_remote_request` and their `wp_safe_` forms), and cURL (`curl_init`,
`curl_setopt` with `CURLOPT_URL`, `CURLOPT_CUSTOMREQUEST` or `CURLOPT_POST`, and
`curl_setopt_array`). Further limits:

- Client members are ordinary method names, so the receiver must be proved to
  hold a client: a parameter or property typed `GuzzleHttp\Client`,
  `ClientInterface` or Symfony's `HttpClientInterface`, or a variable bound to
  `new Client(...)` in the same file, with the type resolved through the file's
  `use` aliases. `$cache->get('/talks')` and a route registration therefore
  report nothing, and a client reached through an untyped value reports nothing
  either.
- The cURL options of one operation are not tied to their handle, so an
  operation that states several URLs or several methods reports no request. A
  cURL request without `CURLOPT_CUSTOMREQUEST` or `CURLOPT_POST` reports no
  method, which derives no row.
- Only a constant the same file declares once resolves to text: `const`, a class
  constant, or `define`. A constant from another file leaves the path unknown.
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
