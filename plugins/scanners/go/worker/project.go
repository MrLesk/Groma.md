package main

import (
	"fmt"
	"go/ast"
	"go/build"
	"go/parser"
	"go/token"
	"go/types"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/mod/modfile"
	"golang.org/x/tools/go/packages"
)

// Every machine scans the same files: one build context, linux/amd64 with cgo, whatever the host
// platform or the GOOS, GOARCH, CGO_ENABLED and GOEXPERIMENT environment.
var buildContext = func() build.Context {
	context := build.Default
	context.GOOS, context.GOARCH, context.CgoEnabled, context.ToolTags = "linux", "amd64", true, nil
	return context
}()

// The compiler and source importer run inside the scanner binary. No go command is used.
type sourceImporter struct {
	packages map[string]*packages.Package
	checking map[string]bool
	root     string
	// Imports this scan does not load, by the number of packages importing them. Type errors follow
	// from them, so the scan reports one summary located at the first error.
	missing    map[string]int
	typeErrors int
	firstError diagnostic
}

func (loader *sourceImporter) Import(name string) (*types.Package, error) {
	if name == "unsafe" { return types.Unsafe, nil }
	pkg := loader.packages[name]
	if pkg == nil {
		loader.missing[name]++
		return nil, fmt.Errorf("%s is not loaded", name)
	}
	if pkg.Types != nil { return pkg.Types, nil }
	if loader.checking[name] { return nil, fmt.Errorf("import cycle involving %s", name) }
	loader.checking[name] = true
	config := types.Config{Importer: loader, Error: func(err error) {
		if typed, ok := err.(types.Error); ok && loader.typeErrors == 0 {
			position := typed.Fset.Position(typed.Pos)
			file, _ := filepath.Rel(loader.root, position.Filename)
			loader.firstError.File, loader.firstError.Line = filepath.ToSlash(file), position.Line
		}
		loader.typeErrors++
	}}
	pkg.Types, _ = config.Check(name, pkg.Fset, pkg.Syntax, pkg.TypesInfo)
	return pkg.Types, nil
}

// summary names the five module dependencies most packages import; the standard library is always missing.
func (loader *sourceImporter) summary() []diagnostic {
	if loader.typeErrors == 0 { return nil }
	dependencies := []string{}
	for name := range loader.missing {
		if first, _, _ := strings.Cut(name, "/"); strings.Contains(first, ".") { dependencies = append(dependencies, name) }
	}
	sort.Slice(dependencies, func(i, j int) bool {
		left, right := loader.missing[dependencies[i]], loader.missing[dependencies[j]]
		return left > right || left == right && dependencies[i] < dependencies[j]
	})
	message := fmt.Sprintf("%d type errors follow from %d imports this scan does not load: the standard library, module dependencies, cgo and local packages without files in this build context.", loader.typeErrors, len(loader.missing))
	if len(dependencies) > 0 {
		message += fmt.Sprintf(" Most imported dependencies: %s.", strings.Join(dependencies[:min(5, len(dependencies))], ", "))
	}
	result := loader.firstError
	result.Severity, result.Code, result.Message = "info", "GO_MISSING_EXTERNAL_PACKAGES", message
	return []diagnostic{result}
}

// A loaded module: its packages in path order, each package's files, and the type-check summary.
type loadedModule struct {
	packages    []*packages.Package
	files       map[string][]*source
	diagnostics []diagnostic
}

// loadSources reads and parses each module file the adapter selected, once, and type-checks their
// packages. The build context decides which of the files build.
func loadSources(directory string, files []string) (*loadedModule, error) {
	data, err := os.ReadFile(filepath.Join(directory, "go.mod"))
	if err != nil { return nil, err }
	module := modfile.ModulePath(data)
	if module == "" { return nil, fmt.Errorf("go.mod needs a module declaration") }
	loader := &sourceImporter{packages: map[string]*packages.Package{}, checking: map[string]bool{}, root: directory, missing: map[string]int{}}
	loaded := &loadedModule{files: map[string][]*source{}}
	fset := token.NewFileSet()
	for _, relative := range files {
		file := filepath.Join(directory, filepath.FromSlash(relative))
		active, err := buildContext.MatchFile(filepath.Dir(file), filepath.Base(file))
		if err != nil { return nil, err }
		if !active { continue }
		text, err := os.ReadFile(file)
		if err != nil { return nil, err }
		// Comments stay in the tree for the generated-code marker; operation tokens skip them.
		syntax, err := parser.ParseFile(fset, file, text, parser.AllErrors|parser.ParseComments)
		if err != nil { return nil, err }
		name := module
		if folder := path.Dir(relative); folder != "." { name += "/" + folder }
		pkg := loader.packages[name]
		if pkg == nil {
			pkg = &packages.Package{PkgPath: name, Name: syntax.Name.Name, Fset: fset, Module: &packages.Module{Path: module},
				TypesInfo: &types.Info{Types: map[ast.Expr]types.TypeAndValue{}, Defs: map[*ast.Ident]types.Object{},
					Uses: map[*ast.Ident]types.Object{}, Selections: map[*ast.SelectorExpr]*types.Selection{},
					Instances: map[*ast.Ident]types.Instance{}, Scopes: map[ast.Node]*types.Scope{}, Implicits: map[ast.Node]types.Object{}}}
			loader.packages[name] = pkg
		}
		if syntax.Name.Name != pkg.Name { return nil, fmt.Errorf("multiple packages in %s", path.Dir(relative)) }
		pkg.Syntax = append(pkg.Syntax, syntax)
		loaded.files[name] = append(loaded.files[name], &source{pkg: pkg, syntax: syntax, file: relative,
			wide: wideEnds(text), generated: ast.IsGenerated(syntax), imports: importAliases(syntax)})
	}
	names := make([]string, 0, len(loader.packages))
	for name := range loader.packages { names = append(names, name) }
	sort.Strings(names)
	for _, name := range names {
		if _, err := loader.Import(name); err != nil { return nil, err }
		loaded.packages = append(loaded.packages, loader.packages[name])
	}
	loaded.diagnostics = loader.summary()
	return loaded, nil
}
