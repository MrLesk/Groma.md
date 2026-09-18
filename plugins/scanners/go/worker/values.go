package main

import (
	"go/ast"
	"go/constant"
	"go/token"
	"strconv"
	"strings"
)

// What the source proves a name holds: how many values it is assigned anywhere, the value when the
// source writes exactly one out, and whether a command-line flag sets it.

// assignedValue is a value the source assigns a name, and the file that assigns it.
type assignedValue struct {
	source *source
	value  ast.Expr
}

// readAssignments counts the values assigned to each name, wherever the assignment is. A parameter
// receives its argument, which is one assignment, and a pointer to a name can write it, which is
// another.
func (e *evidence) readAssignments(s *source) {
	ast.Inspect(s.syntax, func(node ast.Node) bool {
		switch node := node.(type) {
		case *ast.FuncType:
			for _, field := range node.Params.List {
				for _, name := range field.Names {
					e.assign(s, name, nil)
				}
			}
		case *ast.AssignStmt:
			for index, target := range node.Lhs {
				e.assign(s, target, assignedAt(node, index))
			}
		case *ast.ValueSpec:
			for index, name := range node.Names {
				if len(node.Values) == len(node.Names) {
					e.assign(s, name, node.Values[index])
				} else if len(node.Values) > 0 {
					e.assign(s, name, nil)
				}
			}
		case *ast.UnaryExpr:
			if node.Op == token.AND {
				e.assign(s, node.X, nil)
			}
		case *ast.CallExpr:
			e.readFlag(s, node)
		}
		return true
	})
}

// assignedAt is the value one target of an assignment receives, or nil when the source does not
// write it out, as when one call returns every value or an operator combines it with the old one.
func assignedAt(node *ast.AssignStmt, index int) ast.Expr {
	if len(node.Rhs) != len(node.Lhs) || (node.Tok != token.ASSIGN && node.Tok != token.DEFINE) {
		return nil
	}
	return node.Rhs[index]
}

func (e *evidence) assign(s *source, target ast.Expr, value ast.Expr) {
	object := s.object(target)
	if object == nil {
		return
	}
	e.assignments[object]++
	if value != nil {
		e.assignedValues[object] = assignedValue{source: s, value: value}
		e.clients[object] = e.clients[object] || isClient(s, value)
	}
}

// readFlag marks a variable whose address a flag or pflag `...Var` function takes: a command-line
// flag sets it, so it is configuration whatever it is declared with.
func (e *evidence) readFlag(s *source, call *ast.CallExpr) {
	path, name, ok := s.qualified(call.Fun)
	if !ok || (path != "flag" && path != "github.com/spf13/pflag") || !strings.Contains(name, "Var") || len(call.Args) == 0 {
		return
	}
	if address, ok := ast.Unparen(call.Args[0]).(*ast.UnaryExpr); ok && address.Op == token.AND {
		if object := s.object(address.X); object != nil {
			e.flags[object] = true
		}
	}
}

// constantString reads text the source proves constant, including a constant declared once
// and a concatenation of constants.
func constantString(s *source, expression ast.Expr) (string, bool) {
	if value := s.pkg.TypesInfo.Types[expression].Value; value != nil && value.Kind() == constant.String {
		return constant.StringVal(value), true
	}
	switch node := ast.Unparen(expression).(type) {
	case *ast.BasicLit:
		if node.Kind != token.STRING {
			return "", false
		}
		text, err := strconv.Unquote(node.Value)
		return text, err == nil
	case *ast.BinaryExpr:
		if node.Op != token.ADD {
			return "", false
		}
		left, leftKnown := constantString(s, node.X)
		right, rightKnown := constantString(s, node.Y)
		return left + right, leftKnown && rightKnown
	}
	return "", false
}
