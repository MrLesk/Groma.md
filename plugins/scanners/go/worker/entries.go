package main

import (
	"go/ast"
	"path"

	"golang.org/x/tools/go/packages"
)

// packageEntry reports a main package with a main function as an execution entry. The Go language
// starts there, and the binary compiles every module package that package imports, directly or
// indirectly, including blank and dot imports.
func packageEntry(pkg *packages.Package, loaded *loadedModule) *entryPoint {
	if pkg.Name != "main" {
		return nil
	}
	local := map[string]*packages.Package{}
	for _, member := range loaded.packages {
		local[member.PkgPath] = member
	}
	entry := entryPoint{Name: path.Base(pkg.PkgPath), Declaration: "go.mod", Files: []string{}}
	seen := map[string]bool{}
	var visit func(*packages.Package)
	visit = func(member *packages.Package) {
		if seen[member.PkgPath] {
			return
		}
		seen[member.PkgPath] = true
		for _, file := range loaded.files[member.PkgPath] {
			entry.Files = append(entry.Files, file.file)
			if member == pkg && declaresMain(file.syntax) {
				entry.File = file.file
			}
		}
		for _, imported := range member.Types.Imports() {
			if next := local[imported.Path()]; next != nil {
				visit(next)
			}
		}
	}
	visit(pkg)
	if entry.File == "" {
		return nil
	}
	return &entry
}

func declaresMain(syntax *ast.File) bool {
	for _, decl := range syntax.Decls {
		function, ok := decl.(*ast.FuncDecl)
		if ok && function.Recv == nil && function.Name.Name == "main" && function.Body != nil {
			return true
		}
	}
	return false
}
