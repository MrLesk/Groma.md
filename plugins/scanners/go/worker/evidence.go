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
}
type body struct {
	source *source
	node   ast.Node
	id     string
}
type evidence struct {
	result                      *observation
	bodies                      []body
	operationByFunctionPosition map[string]string
	literals                    map[*ast.FuncLit]string
}

func newEvidence(result *observation) *evidence {
	return &evidence{result: result, operationByFunctionPosition: map[string]string{}, literals: map[*ast.FuncLit]string{}}
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

func (e *evidence) addBody(s *source, declaration ast.Node, executable ast.Node, name string) string {
	id := s.id(declaration.Pos())
	e.result.Operations = append(e.result.Operations, operation{id, s.file, name, s.offset(declaration.Pos())})
	e.bodies = append(e.bodies, body{s, executable, id})
	return id
}

func (e *evidence) declarations(s *source) {
	for _, decl := range s.syntax.Decls {
		switch node := decl.(type) {
		case *ast.FuncDecl:
			if node.Body == nil {
				continue
			}
			function := s.pkg.TypesInfo.Defs[node.Name].(*types.Func)
			id := e.addBody(s, node, node.Body, function.FullName())
			e.operationByFunctionPosition[functionKey(s.pkg, function.Pos())] = id
		case *ast.GenDecl:
			if node.Tok == token.VAR {
				e.initializers(s, node)
			}
		}
	}
	ast.Inspect(s.syntax, func(node ast.Node) bool {
		literal, ok := node.(*ast.FuncLit)
		if ok {
			e.literals[literal] = e.addBody(s, literal, literal.Body, "closure")
		}
		return true
	})
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
			e.addBody(s, value, value, "initializer")
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
