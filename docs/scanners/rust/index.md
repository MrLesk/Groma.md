# Rust scanner

The Rust scanner carries a native rust-analyzer HIR worker. HIR is the engine's
model for source names, modules and types. A source checkout needs no Cargo,
rustc, rust-src, downloaded crates or application build.

```sh
groma scanner add @groma/scanner-rust
groma scan
```

Maintainers build with Bun and Rust using `bun plugins/scanners/rust/build.ts`.
The resulting package contains the native worker, bundled adapter and licenses.
Scanner consumers do not build the worker or install a separate language runtime.

## Project inputs

The adapter reads tracked and unignored `Cargo.toml` files with a TOML parser.
Workspace members and exclusions, package names, editions, library/binary paths,
local workspace dependencies and declared default features supply a source
crate graph. It passes that graph directly to rust-analyzer's `ProjectJson`
API. The engine loads modules and resolves source names. Cargo metadata,
rustc, build scripts and procedural macros are never executed.

By default each workspace is scanned once. A package selects its library and
binary targets; a workspace selects its members. `settings.manifest` on the
existing Rust scanner entry selects one manifest relative to the repository.
Test, example, benchmark and build-script targets are outside this extraction.
External crates and standard-library types remain unresolved. This source
loader does not evaluate custom target configurations or build-generated flags.

## Evidence and uncertainty

The scanner emits module source files, functions, exact UTF-16 positions and
calls. Locally resolvable re-exports and inherent methods retain their source
targets. Executable wrappers remain separate operations. Trait dispatch,
function-pointer and callback value flow, calls in closure and async-block
bodies, macro-expanded call bodies and generated sources are not extracted.

A physical file shared by multiple module contexts appears once, with no guessed
declarations or targets and a `rust-unsupported-compilation-contexts` diagnostic.
Invalid syntax or an engine module-loading error fails the observation.
Unresolved external semantics do not fail the source scan. A completed scan
does not claim that the application compiles.

Crates and compiler contexts are temporary evidence, not new OKF concepts or
C4 levels. Core owns curated file membership and relationship policy. Markdown
readers retain readable Code links and responsibilities. Ordinary Rust calls
do not automatically become architecture relationships.

The [rust-analyzer project JSON format](https://rust-analyzer.github.io/book/non_cargo_based_projects.html)
provides the source graph interface. See
[fresh-checkout validation](../fresh-checkout-validation.md) for exercised flows.

## Source outline

Components list the declarations of their Rust files under the
[shared outline contract](../creating-a-plugin.md#source-outline). The worker
parses each requested file on its own with the Rust 2021 grammar, so the
outline needs no Cargo project or crate graph. It lists items directly in the
file and in inline `mod` blocks:

- `fn` items, and closures written directly as a `const` or `static` value, are
  functions.
- Structs, enums, unions and traits are types. A trait's members are its method
  signatures and default methods. A type's members are the `fn` items of every
  `impl` block for it in the file, including associated functions without
  `self`.

An `impl` block's type path is read from the block's module: `self` and `super`
step through the file's inline modules, and the rest of the path is looked up
in that module and then in each enclosing module, so a module that imports its
parent's names still reaches them. Same-named types in different modules keep
their own members, and a type declared twice in one module, such as under
different `cfg` conditions, is listed once. A path that names no type the file
declares is a type declared elsewhere: each such path, without its `self` and
`super` steps, adds one `public` entry at the type name in its first `impl`
block. A `crate` path is never resolved to a type in the file, because a file
parsed alone does not know its module path, so `impl crate::a::Item` gets its
own entry even in a crate root that declares `a::Item`. `impl` blocks for a
generic parameter, such as `impl<T> Store for T`, or for a type that is not a
path, such as a reference or a tuple, are not listed. Functions nested in
functions, other constants and statics, associated constants and types, type
and trait aliases, and items inside macros are not listed either.

Test code, which the scan leaves out as well, is not listed: an item or method
whose `cfg` condition requires `test`, that is `test` itself or an `all(...)`
with such an argument, as in `#[cfg(all(test, unix))]`. Other conditions, such
as `#[cfg(not(test))]` or `#[cfg(any(test, feature = "tools"))]`, are listed.
A declaration's line is its name's line.

Visibility comes from the item's own `pub`; an enclosing module does not
narrow it. Methods in a trait definition take the trait's visibility, and
methods in a trait `impl` are `public`.

A declaration is an entry when a Code link names it by its bare name, such as
`place_order` or `load`, the form the scan uses for functions and methods.

## HTTP facts

The worker reports the endpoints these crates serve and the requests they send as
[HTTP facts](../evidence.md#http-endpoints-and-requests). External crates stay
unresolved in a source-only scan, so routers and clients are recognized by the
shape of the call: axum's `route`, `nest` and `merge`, actix-web's route attribute
macros with `service`, `configure`, `web::scope` and `web::resource`, Rocket's
route attribute macros with `mount` and `routes!`, and the reqwest and hyper
calls listed below.

Answers to the [producer checklist](../evidence.md#producer-checklist):

1. **Prefixes.** Every literal prefix the source declares: an axum `nest` path, a
   Rocket `mount` base, an actix `web::scope` or `web::resource` path, and the
   route's own path. A router function another function nests carries that prefix,
   however deep. A prefix that is not literal reports nothing for the routes under
   it, and neither does a route whose own path is not literal.
2. **Endpoints.** Only route declarations: `route` with a method router such as
   `get(handler).post(other)`, `route` with actix's `web::get().to(handler)`, and a
   handler whose attribute macro states a method and a path, once something
   registers it. `any` reports the `*` method. `layer`, `with_state` and other
   wrapping calls keep the routes they wrap. `fallback`, `route_service`,
   `nest_service`, `wrap` middleware, `on(MethodFilter::GET, handler)`, and a
   handler this scan cannot resolve to a function report nothing. So does an
   attribute handler nothing registers, because the prefix it is served under is
   unknown, and an actix resource route with no path of its own.
3. **Dynamic or unknown.** A `format!` placeholder written between two slashes, or
   between a slash and the end of the path, is dynamic: `format!("/talks/{id}")`.
   A placeholder that shares its segment with other text is unknown:
   `format!("/talks/{slug}-latest")`, and `format!("{BASE}{path}")`, where the
   placeholder follows the text of `BASE` with no slash between them.
4. **The local helper.** Nothing: this scanner does not propagate arguments, so a
   URL that arrives as a parameter stays unknown and is reported where the client
   call is.
5. **The base.** `client.get("/api/talks")` has no base. A `const` or `static`
   with a literal value, and a `let` bound once to one, read as their text, so
   `format!("{BASE}/talks")` is a literal path; a name the enclosing function binds
   itself is not read as a crate constant. A name the scan cannot read before the
   path, such as `self.base` or a setting, sets `configured`. A literal scheme and
   host, and any other computed base, become a leading unknown segment.
6. **File-location routes.** Rust has none, so every endpoint names its handler
   function.

Route syntax is read in each supported form: `:name` and `{name}` for one segment,
`{*rest}` and `*rest` for the remainder, actix's `{name:.*}` tail, and Rocket's
`<name>` and `<rest..>`. A query string is dropped. An actix regular expression, a
segment that mixes literal text with a parameter, and a catch-all that is not last
report nothing.

Requests come from `reqwest::get` and from the client methods `get`, `post`,
`put`, `patch`, `delete`, `head` and `options`, as well as
`request(Method::DELETE, url)`, each when its own value flows into `send`. A URL
inside such a chain that is only an argument, such as a header value read from a
map, is not a request. A hyper or http `Request::builder().uri(url)` chain
reports the method its `method` call states. A request the source splits across statements, a warp filter, and routes
another crate registers are outside this scan.

## Compared operations

`groma lint` and scan findings compare Rust operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range and body tokens to every function with a body:

- free functions, including `fn` items nested in another function body;
- methods and associated functions in `impl` blocks;
- trait methods with a default body.

Closures and async blocks are anonymous callbacks; their tokens belong to the
function that contains them. These functions are not compared:

- functions produced by macros;
- functions under inactive `cfg` conditions, such as `#[cfg(test)]`;
- functions in a file with several compilation contexts.

Macro arguments are raw token trees. A name inside them takes the slot of the
latest local binding with that name. Names inside format strings, such as
`format!("{count}")`, stay text.

The standard library is not loaded, so rust-analyzer cannot tell an unresolved
name in a pattern from a new binding. An identifier pattern that starts with an
uppercase letter, such as `None` or a glob-imported `Less`, stays text,
because Rust names enum variants and constants that way.
