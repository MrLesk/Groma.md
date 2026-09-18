package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/token"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"golang.org/x/tools/go/packages"
)

func main() {
	var result any
	var err error
	switch {
	case len(os.Args) == 3 && os.Args[1] == "outline":
		result, err = outline(os.Args[2], os.Stdin)
	case len(os.Args) == 2:
		result, err = scan(os.Args[1])
	default:
		err = fmt.Errorf("expected a repository root, or outline and a repository root")
	}
	if err != nil {
		fail(err)
	}
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		fail(err)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "GO_WORKER_FAILED:", err)
	os.Exit(1)
}

func scan(directory string) (*observation, error) {
	directory, err := filepath.Abs(directory)
	if err != nil {
		return nil, err
	}
	loaded, messages, err := loadSources(directory)
	if err != nil { return nil, err }
	if len(loaded) == 0 {
		return nil, fmt.Errorf("the root module has no active Go packages")
	}
	result := &observation{
		SchemaVersion: 1,
		Scanner:       identity{"go", "go", "go/parser + go/types", runtime.Version() + " / x/tools v0.49.0"},
		Roots:         []root{}, Files: []sourceFile{},
		Operations: []operation{}, Invocations: []invocation{},
		HTTPEndpoints: []httpEndpoint{}, HTTPRequests: []httpRequest{},
		Diagnostics: []diagnostic{{Severity: "info", Code: "GO_ANALYSIS_SCOPE",
			Message: "Root module active host build context; tests and nested modules are excluded. Dynamic dispatch and providers outside this module remain unresolved. No callback binding propagation."}},
	}
	result.Diagnostics = append(result.Diagnostics, messages...)
	analyzer := newEvidence(result)
	for _, pkg := range loaded {
		if pkg.Module == nil || filepath.Clean(pkg.Module.Dir) != directory {
			return nil, fmt.Errorf("only the module rooted at the selected repository is supported")
		}
		result.Roots = append(result.Roots, root{ID: pkg.PkgPath, Parent: "module:" + pkg.Module.Path, Kind: "package", Name: pkg.PkgPath})
		if err := analyzer.addPackage(directory, pkg); err != nil {
			return nil, err
		}
	}
	module := loaded[0].Module
	result.Roots = append(result.Roots, root{ID: "module:" + module.Path, Kind: "module", Name: module.Path, File: "go.mod"})
	analyzer.calls()
	analyzer.httpFacts()
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
		file := &source{pkg: pkg, syntax: syntax, file: filepath.ToSlash(relative), text: data, imports: importPaths(syntax)}
		e.sources = append(e.sources, file)
		e.result.Files = append(e.result.Files, sourceFile{Roots: []string{pkg.PkgPath}, File: file.file, Symbols: file.symbols()})
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
