package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/token"
	"io"
	"os"
	"path/filepath"
	"runtime"
)

func main() {
	var result any
	var err error
	switch {
	case len(os.Args) == 3 && os.Args[1] == "outline":
		result, err = outline(os.Args[2], os.Stdin)
	case len(os.Args) == 2:
		result, err = scan(os.Args[1], os.Stdin)
	default:
		err = fmt.Errorf("expected a module root, or outline and a repository root")
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

// scan analyzes one module. Its files arrive on stdin as module-relative paths: the adapter's
// sources.ts selects them the way the go command selects packages.
func scan(directory string, input io.Reader) (*observation, error) {
	directory, err := filepath.Abs(directory)
	if err != nil {
		return nil, err
	}
	var files []string
	if err := json.NewDecoder(input).Decode(&files); err != nil {
		return nil, err
	}
	loaded, err := loadSources(directory, files)
	if err != nil {
		return nil, err
	}
	result := &observation{
		SchemaVersion: 1,
		Scanner:       identity{"go", "go", "go/parser + go/types", runtime.Version() + " / x/tools v0.49.0"},
		Roots:         []root{}, Files: []sourceFile{},
		Operations: []operation{}, Invocations: []invocation{},
		EntryPoints:   []entryPoint{},
		HTTPEndpoints: []httpEndpoint{}, HTTPRequests: []httpRequest{},
		Diagnostics: []diagnostic{{Severity: "info", Code: "GO_ANALYSIS_SCOPE",
			Message: "Each module is analyzed on its own in one linux/amd64 build context with cgo, without test files. Dynamic dispatch and providers outside the module remain unresolved. No callback binding propagation."}},
	}
	// A module whose files all sit behind build constraints, such as a tools module, adds no evidence.
	if len(loaded.packages) == 0 {
		return result, nil
	}
	result.Diagnostics = append(result.Diagnostics, loaded.diagnostics...)
	analyzer := newEvidence(result)
	for _, pkg := range loaded.packages {
		result.Roots = append(result.Roots, root{ID: pkg.PkgPath, Parent: "module:" + pkg.Module.Path, Kind: "package", Name: pkg.PkgPath})
		analyzer.addFiles(loaded.files[pkg.PkgPath])
		if entry := packageEntry(pkg, loaded); entry != nil {
			result.EntryPoints = append(result.EntryPoints, *entry)
		}
	}
	module := loaded.packages[0].Module
	result.Roots = append(result.Roots, root{ID: "module:" + module.Path, Kind: "module", Name: module.Path, File: "go.mod"})
	analyzer.calls()
	analyzer.httpFacts()
	return result, nil
}

func (e *evidence) addFiles(files []*source) {
	for _, file := range files {
		e.sources = append(e.sources, file)
		e.result.Files = append(e.result.Files, sourceFile{Roots: []string{file.pkg.PkgPath}, File: file.file, Symbols: file.symbols()})
		e.declarations(file)
	}
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
