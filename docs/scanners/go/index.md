# Go scanner

The Go scanner includes a native worker containing Go's parser and type checker.
A fresh source checkout needs no Go installation, module cache, dependency
download or application build.

```sh
groma scanner add @groma/scanner-go
groma scan
```

Maintainers build with `bun plugins/scanners/go/build.ts`. Building requires
Go and the scanner's own build dependencies. The resulting package includes
the adapter, native worker and upstream licenses, with no installation scripts.

## Source and evidence

Each tracked or unignored `go.mod` identifies a module. The worker reads its
module declaration and parses active host-platform Go files with `go/parser`.
`go/build.MatchFile` selects files; test files, vendor, testdata and nested
modules are excluded. Nested modules are scanned independently. cgo and custom
build contexts are outside this source loader.

The source importer gives `go/types` local packages from that module.
External packages, including standard-library declarations, are unresolved
context. The scanner does not invoke `go`, use its cache, or evaluate `go.work`.
Missing dependencies produce diagnostics without blocking source inventory.
Invalid syntax still fails the scan.

Files retain package and module membership. Functions, methods, closures and
package initializers supply operations and exact UTF-16 source positions.
Local imported aliases and concrete method calls retain their canonical target.
Interfaces, function values and providers outside the module remain unresolved.
An immediately invoked closure owns its own calls. Builtins and type conversions
are not operation calls. There is no callback propagation or framework inference.

These are temporary source facts. Packages are not proof of C4 deployment
boundaries, and do not create new OKF concepts. Core preserves curated source
ownership and writes ordinary Markdown Code links and reviewed relationships.
Ordinary Go calls do not automatically become map arrows.

Run fixture tests with the maintainer Go executable:

```sh
GROMA_TEST_GO="$(command -v go)" bun test test-bun/go-scanner.test.ts
```

The separate packaged test removes language tools from PATH. See
[fresh-checkout validation](../fresh-checkout-validation.md).

## Source outline

The worker outlines Go files under the
[shared outline rules](../creating-a-plugin.md#source-outline) by parsing each
referenced file with `go/parser` only. It does not type-check or read other
files.

- Types are defined types such as `type Store struct{}` or `type Count int`,
  never aliases. Interface method signatures are their members.
- A method with receiver `T`, `*T`, or generic `T[P]` is a member of the file's
  entry for `T`. When another file declares `T`, the entry sits at the first
  such method.
- Functions are top-level functions and function literals assigned directly to
  a package-level variable.
- Exported names are `public`; other names are `internal`. Blank `_` names are
  not listed.

## HTTP facts

The worker reports the endpoints this module serves and the requests it sends as
[HTTP facts](../evidence.md#http-endpoints-and-requests). External packages stay
unresolved in a source-only scan, so frameworks are recognized by import path and
written type: `net/http`, `github.com/go-chi/chi`, `github.com/gin-gonic/gin` and
`github.com/labstack/echo`. A router is a value built by `http.NewServeMux`,
`chi.NewRouter`, `chi.NewMux`, `gin.New`, `gin.Default` or `echo.New`, the default
`ServeMux` behind `http.Handle` and `http.HandleFunc`, or a parameter, struct field
or variable written as `*http.ServeMux`. A chi, gin or echo router that arrives as a
parameter or field may already carry a group prefix this scan cannot see, so its
routes are not reported.

Answers to the [producer checklist](../evidence.md#producer-checklist):

1. **Prefixes.** Every constant prefix the source declares: a chi `Route` or
   `Mount` prefix, a gin or echo `Group` prefix, nested groups, and the route's
   own path. A group or mount whose prefix is not constant reports nothing for its
   routes.
2. **Endpoints.** Only route registrations: net/http `Handle` and `HandleFunc`,
   chi `Get` through `Trace` with `Handle`, `HandleFunc`, `Method` and
   `MethodFunc`, gin `GET` through `OPTIONS` with `Any` and `Handle`, and echo
   `GET` through `CONNECT` with `Any` and `Add`. `Use` middleware, echo `Static`
   and `File`, and a handler this scan cannot resolve to an operation report
   nothing.
3. **Dynamic or unknown.** A `fmt.Sprintf` verb that fills a whole segment, as in
   `/talks/%d`, is dynamic. A verb that shares a segment with text, as in
   `/talks/%s-%s`, and every other computed value are unknown.
4. **The local helper.** Nothing: this scanner does not propagate arguments, so a
   URL that arrives as a parameter stays unknown, reported where the client call
   is.
5. **The base.** `http.Get("/talks")` has no base. A value read by name before
   the path, such as a struct field, a package-level variable or
   `os.Getenv("TALKS_URL")`, sets `configured`. A literal scheme and host, a local
   variable, a parameter, and every other computed value are a leading unknown
   segment.
6. **File-location routes.** Go has none, so every endpoint names its handler: a
   function, a method value, an `http.HandlerFunc` conversion, or a function
   literal.

Route syntax follows each framework: net/http method patterns such as
`"GET /talks/{id}"`, `{name}`, `{name...}`, the `{$}` anchor and a
trailing-slash subtree, including the bare `/`, which is reported as an optional
catch-all so core prefers a more specific route over it; chi `{name}`,
`{name:regex}` and `*`; gin `:name` and `*name`; echo `:name` and `*`.

Requests come from `http.Get`, `Head`, `Post` and `PostForm`, the same
methods on a tracked `*http.Client` or `http.DefaultClient`, and
`http.NewRequest` and `http.NewRequestWithContext`; `Do` states no URL of its
own.

A route or method that is not constant, a net/http pattern with a host, a segment
that mixes literal text with a wildcard, and a route that continues after a
catch-all report nothing. A router built by a function whose result is mounted, and
one passed to `http.StripPrefix`, report nothing either, because the mount path
belongs to other source. A router mounted by any other mechanism, such as a
third-party helper, is still reported without that prefix. Routes another module
registers are outside this scan.

## Compared operations

`groma lint` and scan findings compare Go operations under the
[shared rule](../../architecture-findings.md#compared-operations). The scanner
attaches a source range and body tokens to:

- functions and methods with a body, except `init` functions;
- function literals assigned to a named variable with `var`, `:=`, or `=`;
- function literals written as any keyed element of a composite literal, such
  as a struct field or map value.

These function literals take the variable name, or the key's source text, as
their operation name. Keyed function literals in a composite literal passed
directly to a call, alone or behind `&`, are anonymous callbacks, as are all
other function literals. Package variable initializers and `init` functions
are initializer code. Go has no constructors.

Receivers and named results are bound with the parameters in declaration
order. Every other name declared inside the operation becomes a slot in order
of first use. Package-level names, including the operation's own name, stay as
written.
