package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/token"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"golang.org/x/tools/go/packages"
)

func main() {
	if len(os.Args) != 2 {
		fail(fmt.Errorf("expected repository root"))
	}
	result, err := scan(os.Args[1])
	if err != nil {
		fail(err)
	}
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		fail(err)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "GO_SCAN_FAILED:", err)
	os.Exit(1)
}

func scan(directory string) (*observation, error) {
	directory, err := filepath.Abs(directory)
	if err != nil {
		return nil, err
	}
	loaded, err := packages.Load(&packages.Config{
		Dir: directory, Mode: packages.LoadSyntax | packages.NeedModule,
		Tests: false, BuildFlags: []string{"-mod=readonly"},
	}, "./...")
	if err != nil {
		return nil, err
	}
	if packages.PrintErrors(loaded) != 0 {
		return nil, fmt.Errorf("prepare project dependencies and correct Go compilation errors")
	}
	if len(loaded) == 0 {
		return nil, fmt.Errorf("the root module has no active Go packages")
	}
	sort.Slice(loaded, func(i, j int) bool { return loaded[i].PkgPath < loaded[j].PkgPath })
	result := &observation{
		SchemaVersion: 1, Complete: true,
		Scanner: identity{"go", "go/packages + go/types", runtime.Version() + " / x/tools v0.49.0"},
		Scopes:  []scope{}, Files: []sourceFile{}, Placements: []placement{},
		Relationships: []relationship{}, Operations: []operation{}, Invocations: []invocation{},
		Diagnostics: []diagnostic{{"info", "GO_ANALYSIS_SCOPE",
			"Root module active host build context; tests and nested modules are excluded. Dynamic dispatch and providers outside this module remain unresolved. No callback binding propagation."}},
	}
	analyzer := newEvidence(result)
	known := map[string]bool{}
	for _, pkg := range loaded {
		if pkg.Module == nil || filepath.Clean(pkg.Module.Dir) != directory {
			return nil, fmt.Errorf("only the module rooted at the selected repository is supported")
		}
		result.Root = root{"module", pkg.Module.Path, "go.mod"}
		known[pkg.PkgPath] = true
		result.Scopes = append(result.Scopes, scope{pkg.PkgPath, pkg.PkgPath})
		if err := analyzer.addPackage(directory, pkg); err != nil {
			return nil, err
		}
	}
	for _, pkg := range loaded {
		for imported := range pkg.Imports {
			if known[imported] {
				result.Relationships = append(result.Relationships, relationship{pkg.PkgPath, imported, "import"})
			}
		}
	}
	analyzer.calls()
	return result, nil
}

func (e *evidence) addPackage(directory string, pkg *packages.Package) error {
	for _, syntax := range pkg.Syntax {
		absolute := pkg.Fset.Position(syntax.Pos()).Filename
		relative, err := filepath.Rel(directory, absolute)
		if err != nil {
			return err
		}
		if relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			return fmt.Errorf("compiler source outside the root module: %s", absolute)
		}
		data, err := os.ReadFile(absolute)
		if err != nil {
			return err
		}
		file := &source{pkg: pkg, syntax: syntax, file: filepath.ToSlash(relative), text: data}
		e.result.Files = append(e.result.Files, sourceFile{file.file, file.symbols()})
		e.result.Placements = append(e.result.Placements, placement{file.file, pkg.PkgPath})
		e.declarations(file)
	}
	return nil
}

func (s *source) symbols() []symbol {
	result := []symbol{}
	for _, decl := range s.syntax.Decls {
		switch node := decl.(type) {
		case *ast.FuncDecl:
			kind := "function"
			if node.Recv != nil {
				kind = "method"
			}
			result = append(result, symbol{s.id(node.Pos()), node.Name.Name, kind})
		case *ast.GenDecl:
			result = append(result, s.specSymbols(node)...)
		}
	}
	return result
}

func (s *source) specSymbols(decl *ast.GenDecl) []symbol {
	result := []symbol{}
	for _, spec := range decl.Specs {
		switch node := spec.(type) {
		case *ast.TypeSpec:
			result = append(result, symbol{s.id(node.Pos()), node.Name.Name, "type"})
		case *ast.ValueSpec:
			kind := "variable"
			if decl.Tok == token.CONST {
				kind = "constant"
			}
			for _, name := range node.Names {
				if name.Name != "_" {
					result = append(result, symbol{s.id(name.Pos()), name.Name, kind})
				}
			}
		}
	}
	return result
}
