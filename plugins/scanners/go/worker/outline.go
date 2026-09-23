package main

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"path/filepath"
	"slices"
	"sort"
)

// outline lists the top-level declarations of each referenced file by parsing its source only.
func outline(directory string, input io.Reader) ([]codeFile, error) {
	var references []reference
	if err := json.NewDecoder(input).Decode(&references); err != nil {
		return nil, err
	}
	fset := token.NewFileSet()
	files := []codeFile{}
	for _, source := range references {
		syntax, err := parser.ParseFile(fset, filepath.Join(directory, filepath.FromSlash(source.File)), nil, parser.SkipObjectResolution)
		if err != nil {
			return nil, err
		}
		if declarations := fileOutline(fset, syntax, source.Symbols); len(declarations) > 0 {
			files = append(files, codeFile{source.File, declarations})
		}
	}
	return files, nil
}

// placed pairs a declaration with its source position, the sort key for source order.
type placed struct {
	declaration codeDeclaration
	pos         token.Pos
}

type outliner struct {
	fset         *token.FileSet
	symbols      []string
	declarations []placed
	// Index of each type entry in declarations, by type name.
	types map[string]int
}

func fileOutline(fset *token.FileSet, syntax *ast.File, symbols []string) []codeDeclaration {
	o := &outliner{fset: fset, symbols: symbols, types: map[string]int{}}
	for _, decl := range syntax.Decls {
		switch node := decl.(type) {
		case *ast.GenDecl:
			o.specs(node)
		case *ast.FuncDecl:
			if node.Recv == nil {
				o.add("function", node.Name, nil)
			}
		}
	}
	// Methods follow every type declaration, so a method written before its type still joins that entry.
	for _, decl := range syntax.Decls {
		if method, ok := decl.(*ast.FuncDecl); ok && method.Recv != nil && len(method.Recv.List) > 0 {
			o.method(method)
		}
	}
	sort.SliceStable(o.declarations, func(i, j int) bool { return o.declarations[i].pos < o.declarations[j].pos })
	declarations := make([]codeDeclaration, len(o.declarations))
	for index, entry := range o.declarations {
		declarations[index] = entry.declaration
	}
	return declarations
}

func (o *outliner) symbol(name *ast.Ident) codeSymbol {
	visibility := "internal"
	if name.IsExported() {
		visibility = "public"
	}
	return codeSymbol{name.Name, o.fset.Position(name.Pos()).Line, visibility, slices.Contains(o.symbols, name.Name)}
}

// add lists a named declaration; the blank identifier names nothing.
func (o *outliner) add(kind string, name *ast.Ident, members []codeSymbol) {
	if name.Name == "_" {
		return
	}
	if kind == "type" {
		o.types[name.Name] = len(o.declarations)
	}
	o.declarations = append(o.declarations, placed{codeDeclaration{Kind: kind, codeSymbol: o.symbol(name), Members: members}, name.Pos()})
}

// specs lists defined types, never aliases, and function literals bound directly to a package-level name.
func (o *outliner) specs(decl *ast.GenDecl) {
	for _, spec := range decl.Specs {
		switch spec := spec.(type) {
		case *ast.TypeSpec:
			if !spec.Assign.IsValid() {
				o.add("type", spec.Name, o.interfaceMethods(spec.Type))
			}
		case *ast.ValueSpec:
			for index, value := range spec.Values {
				if _, literal := value.(*ast.FuncLit); literal && index < len(spec.Names) {
					o.add("function", spec.Names[index], nil)
				}
			}
		}
	}
}

// interfaceMethods lists method signatures. Scan symbols never name one, so a Code link that shares
// its name names another declaration and does not make the signature an entry.
func (o *outliner) interfaceMethods(definition ast.Expr) []codeSymbol {
	members := []codeSymbol{}
	if methods, ok := definition.(*ast.InterfaceType); ok {
		for _, field := range methods.Methods.List {
			for _, name := range field.Names {
				member := o.symbol(name)
				member.Entry = false
				members = append(members, member)
			}
		}
	}
	return members
}

// method joins the file's entry for its receiver type. A type declared in another file gets
// an entry at its first method here, with visibility from the type name. A blank method names nothing.
func (o *outliner) method(method *ast.FuncDecl) {
	receiver := receiverType(method.Recv.List[0].Type)
	if receiver == nil || method.Name.Name == "_" {
		return
	}
	index, ok := o.types[receiver.Name]
	if !ok {
		index = len(o.declarations)
		o.types[receiver.Name] = index
		o.declarations = append(o.declarations, placed{codeDeclaration{Kind: "type", codeSymbol: o.symbol(receiver), Members: []codeSymbol{}}, method.Pos()})
	}
	entry := &o.declarations[index].declaration
	entry.Members = append(entry.Members, o.symbol(method.Name))
}

// receiverType finds T in the receivers T, *T, T[P] and *T[P, Q].
func receiverType(receiver ast.Expr) *ast.Ident {
	for {
		switch node := receiver.(type) {
		case *ast.Ident:
			return node
		case *ast.StarExpr:
			receiver = node.X
		case *ast.IndexExpr:
			receiver = node.X
		case *ast.IndexListExpr:
			receiver = node.X
		default:
			return nil
		}
	}
}
