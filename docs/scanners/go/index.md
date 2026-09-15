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
