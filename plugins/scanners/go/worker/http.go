package main

import (
	"go/ast"
	"go/types"
	"regexp"
	"strings"
)

// importAliases maps each local package alias in a file to its import path. Blank and dot imports
// share their alias, so this map names libraries, not every imported package.
func importAliases(syntax *ast.File) map[string]string {
	result := map[string]string{}
	for _, entry := range syntax.Imports {
		path := strings.Trim(entry.Path.Value, `"`)
		name := packageName(path)
		if entry.Name != nil {
			name = entry.Name.Name
		}
		result[name] = path
	}
	return result
}

var majorVersion = regexp.MustCompile(`^v[0-9]+$`)

// packageName is the name an import path introduces, skipping a major version suffix such as /v5.
func packageName(path string) string {
	parts := strings.Split(path, "/")
	name := parts[len(parts)-1]
	if len(parts) > 1 && majorVersion.MatchString(name) {
		name = parts[len(parts)-2]
	}
	return name
}

// qualified reads a `package.Name` expression as its import path and member.
func (s *source) qualified(expression ast.Expr) (string, string, bool) {
	selector, ok := ast.Unparen(expression).(*ast.SelectorExpr)
	if !ok {
		return "", "", false
	}
	qualifier, ok := ast.Unparen(selector.X).(*ast.Ident)
	if !ok {
		return "", "", false
	}
	path, ok := s.imports[qualifier.Name]
	return path, selector.Sel.Name, ok
}

// object resolves a name or a field selector to its declaration.
func (s *source) object(expression ast.Expr) types.Object {
	switch node := ast.Unparen(expression).(type) {
	case *ast.Ident:
		return s.pkg.TypesInfo.ObjectOf(node)
	case *ast.SelectorExpr:
		return s.pkg.TypesInfo.ObjectOf(node.Sel)
	}
	return nil
}

// scope is the operation a call belongs to, and whether its facts are silenced by a mount.
type scope struct {
	owner    string
	silenced bool
}

// httpFacts registers assignments, declared values and mounts from every file, then reads each file's calls.
func (e *evidence) httpFacts() {
	for _, file := range e.sources {
		e.readAssignments(file)
		e.declared(file)
		e.mounts(file)
	}
	for _, file := range e.sources {
		e.httpFile(file)
	}
}

// httpFile walks one file, tracking the operation that encloses each call.
func (e *evidence) httpFile(s *source) {
	stack := []scope{{}}
	ast.Inspect(s.syntax, func(node ast.Node) bool {
		if node == nil {
			stack = stack[:len(stack)-1]
			return false
		}
		current := stack[len(stack)-1]
		switch node := node.(type) {
		case *ast.FuncDecl:
			current.owner = e.bodyOwner(s, node, current.owner)
			current.silenced = current.silenced || e.silenced[current.owner]
		case *ast.FuncLit:
			current.owner = e.literals[node]
		case *ast.ValueSpec:
			current.owner = e.bodyOwner(s, node, current.owner)
		case *ast.CallExpr:
			e.httpCall(s, node, current)
		}
		stack = append(stack, current)
		return true
	})
}

// bodyOwner reads the operation a body belongs to; code outside any recorded body owns no fact.
func (e *evidence) bodyOwner(s *source, node ast.Node, owner string) string {
	if id := s.id(node.Pos()); e.recorded[id] {
		return id
	}
	return owner
}

// httpCall reads one call as a route registration, a route group, or an outgoing request.
func (e *evidence) httpCall(s *source, call *ast.CallExpr, current scope) {
	if library, name, ok := s.packageLibrary(call.Fun); ok {
		if _, route := library.routes[name]; route && library.defaultRouter {
			// A package route function, such as http.HandleFunc, registers on the default router.
			e.endpoint(s, router{library: library}, name, call, current)
			return
		}
		if library == netHTTP {
			e.request(s, name, call, current.owner, true)
		}
		return
	}
	selector, ok := ast.Unparen(call.Fun).(*ast.SelectorExpr)
	if !ok {
		return
	}
	if known, ok := e.routerOf(s, selector.X); ok {
		e.endpoint(s, known, selector.Sel.Name, call, current)
		return
	}
	// A tracked client name, or a client value written in place such as http.DefaultClient.
	if e.clients[s.object(selector.X)] || isClient(s, selector.X) {
		e.request(s, selector.Sel.Name, call, current.owner, false)
	}
}

// endpoint reports one route registration.
func (e *evidence) endpoint(s *source, known router, name string, call *ast.CallExpr, current scope) {
	route, ok := known.library.routes[name]
	if !ok {
		return
	}
	fact, ok := e.endpointFact(s, known, route, call)
	if ok && !current.silenced {
		e.result.HTTPEndpoints = append(e.result.HTTPEndpoints, fact)
	}
}

// endpointFact builds the fact, or reports that the route, method or handler is not proven.
func (e *evidence) endpointFact(s *source, known router, route registration, call *ast.CallExpr) (httpEndpoint, bool) {
	// The path is the first argument, or the second when the first states the method.
	path := 0
	if route.method == "" {
		path = 1
	}
	handler := route.handler
	if handler == lastArgument {
		handler = len(call.Args) - 1
	}
	if len(call.Args) <= path || handler <= path {
		return httpEndpoint{}, false
	}
	method := route.method
	if method == "" {
		if method = methodName(s, call.Args[0]); method == "" {
			return httpEndpoint{}, false
		}
	}
	stated, segments, ok := routePattern(s, known.library, call.Args[path])
	if !ok {
		return httpEndpoint{}, false
	}
	if stated != "" {
		method = stated
	}
	operation, ok := e.handlerOperation(s, call.Args[handler])
	if !ok || !(method == "*" || methodToken.MatchString(method)) {
		return httpEndpoint{}, false
	}
	return httpEndpoint{Operation: operation, Method: method, Path: servedPath(known.prefix, segments)}, true
}

// handlerOperation resolves the operation that answers the requests.
func (e *evidence) handlerOperation(s *source, expression ast.Expr) (string, bool) {
	switch node := ast.Unparen(expression).(type) {
	case *ast.FuncLit:
		id, ok := e.literals[node]
		return id, ok
	case *ast.CallExpr:
		// A handler conversion such as http.HandlerFunc(serve) keeps the same operation.
		if _, _, conversion := s.packageLibrary(node.Fun); conversion && len(node.Args) == 1 {
			return e.handlerOperation(s, node.Args[0])
		}
		return "", false
	}
	function, ok := s.object(expression).(*types.Func)
	if !ok {
		return "", false
	}
	id, ok := e.operationByFunctionPosition[functionKey(s.pkg, function.Pos())]
	return id, ok
}
