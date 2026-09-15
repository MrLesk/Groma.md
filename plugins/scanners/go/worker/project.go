package main

import (
	"fmt"
	"go/ast"
	"go/build"
	"go/parser"
	"go/token"
	"go/types"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/mod/modfile"
	"golang.org/x/tools/go/packages"
)

// The compiler and source importer run inside the scanner binary. No go command is used.
type sourceImporter struct {
	packages map[string]*packages.Package
	checking map[string]bool
	diagnostics []diagnostic
	root string
}

func (loader *sourceImporter) Import(name string) (*types.Package, error) {
	if name == "unsafe" { return types.Unsafe, nil }
	pkg := loader.packages[name]
	if pkg == nil { return nil, fmt.Errorf("external package %s is not part of the source checkout", name) }
	if pkg.Types != nil { return pkg.Types, nil }
	if loader.checking[name] { return nil, fmt.Errorf("import cycle involving %s", name) }
	loader.checking[name] = true
	config := types.Config{Importer: loader, Error: func(err error) {
		message := diagnostic{Severity: "warning", Code: "GO_UNRESOLVED_TYPE", Message: err.Error()}
		if typed, ok := err.(types.Error); ok {
			position := typed.Fset.Position(typed.Pos)
			file, _ := filepath.Rel(loader.root, position.Filename)
			message.File, message.Line = filepath.ToSlash(file), position.Line
		}
		loader.diagnostics = append(loader.diagnostics, message)
	}}
	pkg.Types, _ = config.Check(name, pkg.Fset, pkg.Syntax, pkg.TypesInfo)
	return pkg.Types, nil
}

func loadSources(directory string) ([]*packages.Package, []diagnostic, error) {
	data, err := os.ReadFile(filepath.Join(directory, "go.mod"))
	if err != nil { return nil, nil, err }
	module := modfile.ModulePath(data)
	if module == "" { return nil, nil, fmt.Errorf("go.mod needs a module declaration") }
	loader := &sourceImporter{packages: map[string]*packages.Package{}, checking: map[string]bool{}, root: directory}
	fset := token.NewFileSet()
	err = filepath.WalkDir(directory, func(file string, entry fs.DirEntry, err error) error {
		if err != nil { return err }
		if entry.IsDir() {
			if file == directory { return nil }
			if strings.HasPrefix(entry.Name(), ".") || entry.Name() == "vendor" || entry.Name() == "testdata" { return filepath.SkipDir }
			if _, err := os.Stat(filepath.Join(file, "go.mod")); err == nil { return filepath.SkipDir }
			return nil
		}
		if !strings.HasSuffix(file, ".go") || strings.HasSuffix(file, "_test.go") { return nil }
		active, err := build.Default.MatchFile(filepath.Dir(file), entry.Name())
		if err != nil || !active { return err }
		syntax, err := parser.ParseFile(fset, file, nil, parser.AllErrors)
		if err != nil { return err }
		relative, _ := filepath.Rel(directory, filepath.Dir(file))
		name := module
		if relative != "." { name += "/" + filepath.ToSlash(relative) }
		pkg := loader.packages[name]
		if pkg == nil {
			pkg = &packages.Package{PkgPath: name, Name: syntax.Name.Name, Fset: fset,
				Module: &packages.Module{Path: module, Dir: directory},
				TypesInfo: &types.Info{Types: map[ast.Expr]types.TypeAndValue{}, Defs: map[*ast.Ident]types.Object{},
					Uses: map[*ast.Ident]types.Object{}, Selections: map[*ast.SelectorExpr]*types.Selection{},
					Instances: map[*ast.Ident]types.Instance{}, Scopes: map[ast.Node]*types.Scope{}, Implicits: map[ast.Node]types.Object{}}}
			loader.packages[name] = pkg
		}
		if syntax.Name.Name != pkg.Name { return fmt.Errorf("multiple packages in %s", filepath.Dir(file)) }
		pkg.Syntax = append(pkg.Syntax, syntax)
		return nil
	})
	if err != nil { return nil, nil, err }
	names := make([]string, 0, len(loader.packages))
	for name := range loader.packages { names = append(names, name) }
	sort.Strings(names)
	result := make([]*packages.Package, 0, len(names))
	for _, name := range names {
		if _, err := loader.Import(name); err != nil { return nil, nil, err }
		result = append(result, loader.packages[name])
	}
	return result, loader.diagnostics, nil
}
