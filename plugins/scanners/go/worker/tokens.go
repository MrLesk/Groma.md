package main

import (
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
)

// tokenizer turns one operation body into binding-normalized tokens.
// Names declared inside the operation become slots; everything else keeps its text.
type tokenizer struct {
	info   *types.Info
	root   ast.Node
	slots  map[token.Pos]int
	tokens []string
}

// operationTokens tokenizes a function declaration or function literal.
// The result is never nil: nil marks an operation that is not compared.
func operationTokens(info *types.Info, operation ast.Node) []string {
	t := &tokenizer{info: info, root: operation, slots: map[token.Pos]int{}, tokens: []string{}}
	switch node := operation.(type) {
	case *ast.FuncDecl:
		t.bind(node.Recv)
		t.function(node.Type, node.Body)
	case *ast.FuncLit:
		t.function(node.Type, node.Body)
	}
	return t.tokens
}

// function binds parameters and named results in declaration order, then reads the body.
func (t *tokenizer) function(signature *ast.FuncType, body *ast.BlockStmt) {
	t.bind(signature.Params)
	t.bind(signature.Results)
	t.walk(body)
}

func (t *tokenizer) bind(fields *ast.FieldList) {
	if fields == nil {
		return
	}
	for _, field := range fields.List {
		for _, name := range field.Names {
			t.slot(name.Pos())
		}
	}
}

// slot numbers a local declaration, keyed by the position go/types gives its object.
func (t *tokenizer) slot(declared token.Pos) string {
	slot, ok := t.slots[declared]
	if !ok {
		slot = len(t.slots)
		t.slots[declared] = slot
	}
	return fmt.Sprintf("$%d", slot)
}

func (t *tokenizer) emit(text string) {
	if text != "" {
		t.tokens = append(t.tokens, text)
	}
}

// ident keeps fields, methods, package-level names (including the operation's own name), builtins
// and unresolved names as text. Names declared inside the operation become slots.
func (t *tokenizer) ident(name *ast.Ident) {
	object := t.info.ObjectOf(name)
	if object == nil || !t.local(object) {
		t.emit(name.Name)
		return
	}
	t.emit(t.slot(object.Pos()))
}

func (t *tokenizer) local(object types.Object) bool {
	inside := object.Pos() >= t.root.Pos() && object.Pos() < t.root.End()
	return inside && object.Parent() != nil && object.Parent() != object.Pkg().Scope()
}

func (t *tokenizer) walk(node ast.Node) {
	switch node := node.(type) {
	case nil:
	case *ast.Ident:
		t.ident(node)
	case *ast.BasicLit:
		t.emit(node.Value)
	case *ast.SelectorExpr:
		t.walk(node.X)
		t.emit("." + node.Sel.Name)
	case *ast.FuncLit:
		t.emit("fn")
		t.function(node.Type, node.Body)
	case *ast.CallExpr:
		t.call(node)
	case *ast.BinaryExpr:
		t.infix(node.X, node.Op, node.Y)
	case *ast.KeyValueExpr:
		t.infix(node.Key, token.COLON, node.Value)
	case *ast.SendStmt:
		t.infix(node.Chan, token.ARROW, node.Value)
	case *ast.AssignStmt:
		t.walkAll(node.Lhs)
		t.emit(node.Tok.String())
		t.walkAll(node.Rhs)
	case *ast.IncDecStmt:
		t.walk(node.X)
		t.emit(node.Tok.String())
	case *ast.SliceExpr:
		t.slice(node)
	case *ast.IfStmt:
		t.ifStatement(node)
	case *ast.TypeSwitchStmt:
		t.typeSwitch(node)
	default:
		t.emit(keyword(node))
		t.children(node)
	}
}

func (t *tokenizer) walkAll(nodes []ast.Expr) {
	for _, node := range nodes {
		t.walk(node)
	}
}

func (t *tokenizer) infix(left ast.Expr, operator token.Token, right ast.Expr) {
	t.walk(left)
	t.emit(operator.String())
	t.walk(right)
}

func (t *tokenizer) call(node *ast.CallExpr) {
	t.walk(node.Fun)
	t.emit("call")
	t.walkAll(node.Args)
	if node.Ellipsis.IsValid() {
		t.emit("...")
	}
}

func (t *tokenizer) slice(node *ast.SliceExpr) {
	t.emit("slice")
	t.walk(node.X)
	t.walk(node.Low)
	t.emit(":")
	t.walk(node.High)
	if node.Slice3 {
		t.emit(":")
		t.walk(node.Max)
	}
}

func (t *tokenizer) ifStatement(node *ast.IfStmt) {
	t.emit("if")
	t.walk(node.Init)
	t.walk(node.Cond)
	t.walk(node.Body)
	if node.Else != nil {
		t.emit("else")
		t.walk(node.Else)
	}
}

// The symbolic variable of `switch v := x.(type)` has no object; each clause declares one at its position.
func (t *tokenizer) typeSwitch(node *ast.TypeSwitchStmt) {
	t.emit("switch")
	t.walk(node.Init)
	if assign, ok := node.Assign.(*ast.AssignStmt); ok {
		t.emit(t.slot(assign.Lhs[0].Pos()))
		t.emit(assign.Tok.String())
		t.walk(assign.Rhs[0])
	} else {
		t.walk(node.Assign)
	}
	t.walk(node.Body)
}

// children walks the direct children of a node in source order.
func (t *tokenizer) children(node ast.Node) {
	ast.Inspect(node, func(child ast.Node) bool {
		if child == node {
			return true
		}
		if child != nil {
			t.walk(child)
		}
		return false
	})
}

func keyword(node ast.Node) string {
	switch node := node.(type) {
	case *ast.ReturnStmt:
		return "return"
	case *ast.ForStmt:
		return "for"
	case *ast.RangeStmt:
		return "range"
	case *ast.SwitchStmt:
		return "switch"
	case *ast.SelectStmt:
		return "select"
	case *ast.CaseClause, *ast.CommClause:
		return "case"
	case *ast.GoStmt:
		return "go"
	case *ast.DeferStmt:
		return "defer"
	case *ast.BranchStmt:
		return node.Tok.String()
	case *ast.GenDecl:
		return node.Tok.String()
	case *ast.UnaryExpr:
		return node.Op.String()
	case *ast.StarExpr:
		return "*"
	}
	return expressionKeyword(node)
}

func expressionKeyword(node ast.Node) string {
	switch node.(type) {
	case *ast.IndexExpr, *ast.IndexListExpr:
		return "index"
	case *ast.TypeAssertExpr:
		return "assert"
	case *ast.CompositeLit:
		return "literal"
	case *ast.ArrayType:
		return "[]"
	case *ast.MapType:
		return "map"
	case *ast.ChanType:
		return "chan"
	case *ast.FuncType:
		return "func"
	case *ast.StructType:
		return "struct"
	case *ast.InterfaceType:
		return "interface"
	case *ast.Ellipsis:
		return "..."
	}
	return ""
}
