package main

import (
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"sort"

	"golang.org/x/tools/go/packages"
	"golang.org/x/tools/go/types/typeutil"
)

type source struct {
	pkg    *packages.Package
	syntax *ast.File
	file   string
	text   []byte
	// Local package aliases, which name the frameworks this file uses.
	imports map[string]string
}
type body struct {
	source *source
	node   ast.Node
	id     string
}
type evidence struct {
	result                      *observation
	bodies                      []body
	sources                     []*source
	operationByFunctionPosition map[string]string
	literals                    map[*ast.FuncLit]string
	// Operation IDs this observation declares; a fact may only reference one of them.
	recorded map[string]bool
	// Values that carry routes or send requests, and the mount each router serves under.
	routers map[types.Object]router
	clients map[types.Object]bool
	mounted map[types.Object]mount
	// How many values each name is assigned anywhere in the scanned source, a parameter's argument
	// included, and the value a name is assigned when the source writes it out.
	assignments    map[types.Object]int
	assignedValues map[types.Object]assignedValue
	// Operations whose routers are built for a mount, so their served paths are longer.
	silenced map[string]bool
}

func newEvidence(result *observation) *evidence {
	return &evidence{result: result, operationByFunctionPosition: map[string]string{}, literals: map[*ast.FuncLit]string{},
		recorded: map[string]bool{}, routers: map[types.Object]router{}, clients: map[types.Object]bool{},
		mounted: map[types.Object]mount{}, assignments: map[types.Object]int{}, assignedValues: map[types.Object]assignedValue{},
		silenced: map[string]bool{}}
}

func (s *source) offset(pos token.Pos) int {
	bytes := s.pkg.Fset.Position(pos).Offset
	units := 0
	for _, r := range string(s.text[:bytes]) {
		units++
		if r > 0xffff {
			units++
		}
	}
	return units
}

func (s *source) id(pos token.Pos) string {
	return fmt.Sprintf("%s:%d", s.file, s.offset(pos))
}

func functionKey(pkg *packages.Package, pos token.Pos) string {
	position := pkg.Fset.Position(pos)
	return fmt.Sprintf("%s:%d", position.Filename, position.Offset)
}

// addBody records an operation. Only operations with tokens are compared as possible duplicate logic.
func (e *evidence) addBody(s *source, declaration ast.Node, executable ast.Node, name string, tokens []string) string {
	id := s.id(declaration.Pos())
	fact := operation{ID: id, File: s.file, Name: name, Position: s.offset(declaration.Pos())}
	if tokens != nil {
		fact.StartLine = s.pkg.Fset.Position(declaration.Pos()).Line
		fact.EndLine = s.pkg.Fset.Position(declaration.End()).Line
		fact.Tokens = tokens
	}
	e.result.Operations = append(e.result.Operations, fact)
	e.recorded[id] = true
	e.bodies = append(e.bodies, body{s, executable, id})
	return id
}

func (e *evidence) declarations(s *source) {
	info := s.pkg.TypesInfo
	for _, decl := range s.syntax.Decls {
		switch node := decl.(type) {
		case *ast.FuncDecl:
			if node.Body == nil {
				continue
			}
			function := info.Defs[node.Name].(*types.Func)
			var tokens []string
			// Package init functions are initializer code.
			if node.Recv != nil || node.Name.Name != "init" {
				tokens = operationTokens(info, node)
			}
			id := e.addBody(s, node, node.Body, function.FullName(), tokens)
			e.operationByFunctionPosition[functionKey(s.pkg, function.Pos())] = id
		case *ast.GenDecl:
			if node.Tok == token.VAR {
				e.initializers(s, node)
			}
		}
	}
	names := namedLiterals(s.syntax)
	ast.Inspect(s.syntax, func(node ast.Node) bool {
		literal, ok := node.(*ast.FuncLit)
		if !ok {
			return true
		}
		name, named := names[literal]
		if named {
			e.literals[literal] = e.addBody(s, literal, literal.Body, name, operationTokens(info, literal))
		} else {
			e.literals[literal] = e.addBody(s, literal, literal.Body, "closure", nil)
		}
		return true
	})
}

// namedLiterals names the function literals that are named operations: those assigned to a named
// variable, and keyed elements of a composite literal that is not written directly as a call argument.
func namedLiterals(file *ast.File) map[*ast.FuncLit]string {
	names := map[*ast.FuncLit]string{}
	argumentLiterals := map[*ast.CompositeLit]bool{}
	ast.Inspect(file, func(node ast.Node) bool {
		switch node := node.(type) {
		case *ast.CallExpr:
			// A call is visited before its arguments.
			for _, argument := range node.Args {
				if composite := argumentLiteral(argument); composite != nil {
					argumentLiterals[composite] = true
				}
			}
		case *ast.ValueSpec:
			for index, value := range node.Values {
				if index < len(node.Names) {
					nameLiteral(names, node.Names[index], value)
				}
			}
		case *ast.AssignStmt:
			for index, value := range node.Rhs {
				if index < len(node.Lhs) {
					nameLiteral(names, node.Lhs[index], value)
				}
			}
		case *ast.CompositeLit:
			if !argumentLiterals[node] {
				nameElements(names, node)
			}
		}
		return true
	})
	return names
}

// argumentLiteral returns a composite literal passed as the argument itself, alone or behind &,
// in or out of parentheses.
func argumentLiteral(argument ast.Expr) *ast.CompositeLit {
	argument = ast.Unparen(argument)
	if address, ok := argument.(*ast.UnaryExpr); ok && address.Op == token.AND {
		argument = ast.Unparen(address.X)
	}
	composite, _ := argument.(*ast.CompositeLit)
	return composite
}

func nameLiteral(names map[*ast.FuncLit]string, target ast.Expr, value ast.Expr) {
	literal, isLiteral := ast.Unparen(value).(*ast.FuncLit)
	variable, isVariable := target.(*ast.Ident)
	if isLiteral && isVariable && variable.Name != "_" {
		names[literal] = variable.Name
	}
}

func nameElements(names map[*ast.FuncLit]string, composite *ast.CompositeLit) {
	for _, element := range composite.Elts {
		field, isField := element.(*ast.KeyValueExpr)
		if !isField {
			continue
		}
		if literal, isLiteral := ast.Unparen(field.Value).(*ast.FuncLit); isLiteral {
			names[literal] = types.ExprString(field.Key)
		}
	}
}

// A package variable initializer can call code outside any declared function.
func (e *evidence) initializers(s *source, decl *ast.GenDecl) {
	for _, spec := range decl.Specs {
		value := spec.(*ast.ValueSpec)
		hasCall := false
		ast.Inspect(value, func(node ast.Node) bool {
			if _, ok := node.(*ast.FuncLit); ok {
				return false
			}
			if _, ok := node.(*ast.CallExpr); ok {
				hasCall = true
			}
			return true
		})
		if hasCall {
			e.addBody(s, value, value, "initializer", nil)
		}
	}
}

func (e *evidence) calls() {
	sort.Slice(e.bodies, func(i, j int) bool { return e.bodies[i].id < e.bodies[j].id })
	for _, caller := range e.bodies {
		ast.Inspect(caller.node, func(node ast.Node) bool {
			// A closure owns its calls, even when its declaration is inside another body.
			if _, ok := node.(*ast.FuncLit); ok {
				return false
			}
			call, ok := node.(*ast.CallExpr)
			if ok {
				e.call(caller, call)
			}
			return true
		})
	}
}

func (e *evidence) call(caller body, call *ast.CallExpr) {
	info := caller.source.pkg.TypesInfo
	if info.Types[call.Fun].IsType() {
		return
	}
	if _, builtin := typeutil.Callee(info, call).(*types.Builtin); builtin {
		return
	}
	fact := invocation{
		Source: caller.id, Targets: []string{}, Unresolved: true,
		Line:     caller.source.pkg.Fset.Position(call.Pos()).Line,
		Position: caller.source.offset(call.Pos()),
	}
	if selector, ok := ast.Unparen(call.Fun).(*ast.SelectorExpr); ok {
		fact.Member = selector.Sel.Name
	}
	target := ""
	if function := typeutil.StaticCallee(info, call); function != nil {
		target = e.operationByFunctionPosition[functionKey(caller.source.pkg, function.Pos())]
	}
	if literal, ok := ast.Unparen(call.Fun).(*ast.FuncLit); ok {
		target = e.literals[literal]
	}
	if target != "" {
		fact.Targets = append(fact.Targets, target)
		fact.Unresolved = false
	}
	e.result.Invocations = append(e.result.Invocations, fact)
}
