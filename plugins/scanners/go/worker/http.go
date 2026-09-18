package main

import (
	"go/ast"
	"go/token"
	"go/types"
	"regexp"
	"strings"
)

// External packages stay unresolved in a source-only scan, so frameworks are recognized by
// import path and declared syntax, never by resolved types.
const (
	netHTTP = "net/http"
	chi     = "chi"
	gin     = "gin"
	echo    = "echo"
)

// framework names the routing library an import path belongs to.
func framework(path string) string {
	switch {
	case path == netHTTP:
		return netHTTP
	case strings.HasPrefix(path, "github.com/go-chi/chi"):
		// The middleware package holds no routes.
		if strings.HasSuffix(path, "/middleware") {
			return ""
		}
		return chi
	case strings.HasPrefix(path, "github.com/gin-gonic/gin"):
		return gin
	case strings.HasPrefix(path, "github.com/labstack/echo"):
		return echo
	}
	return ""
}

var routerConstructors = map[string]map[string]bool{
	netHTTP: {"NewServeMux": true},
	chi:     {"NewRouter": true, "NewMux": true},
	gin:     {"New": true, "Default": true},
	echo:    {"New": true},
}

// A router value, with the prefix its groups and mount declare.
type router struct {
	framework string
	prefix    []endpointSegment
}

// importPaths maps each local package alias in a file to its import path.
func importPaths(syntax *ast.File) map[string]string {
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

// packageFramework reports the framework a `package.Name` expression belongs to.
func (s *source) packageFramework(expression ast.Expr) (string, string, bool) {
	path, name, ok := s.qualified(expression)
	if !ok {
		return "", "", false
	}
	library := framework(path)
	return library, name, library != ""
}

// declared registers parameters, struct fields and variables written as a net/http type, and the
// router a chi group closure receives. A group-capable router reaches this scan with a prefix it
// cannot see, so only the constructors, mounts and groups in this source establish one.
func (e *evidence) declared(s *source) {
	ast.Inspect(s.syntax, func(node ast.Node) bool {
		switch node := node.(type) {
		case *ast.Field:
			e.declaredNames(s, node.Names, node.Type)
		case *ast.ValueSpec:
			e.declaredNames(s, node.Names, node.Type)
		case *ast.CallExpr:
			e.groupClosure(s, node)
		}
		return true
	})
}

func (e *evidence) declaredNames(s *source, names []*ast.Ident, written ast.Expr) {
	if written == nil {
		return
	}
	if pointer, ok := ast.Unparen(written).(*ast.StarExpr); ok {
		written = pointer.X
	}
	library, name, ok := s.packageFramework(written)
	if !ok || library != netHTTP || (name != "ServeMux" && name != "Client") {
		return
	}
	for _, declared := range names {
		object := s.pkg.TypesInfo.Defs[declared]
		if object == nil {
			continue
		}
		if name == "ServeMux" {
			e.routers[object] = router{framework: netHTTP}
		} else {
			e.clients[object] = true
		}
	}
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

// routerOf reads a router from a name, a constructor call, a group call or a middleware chain.
func (e *evidence) routerOf(s *source, expression ast.Expr) (router, bool) {
	if object := s.object(expression); object != nil {
		known, ok := e.namedRouter(object)
		if !ok {
			return router{}, false
		}
		return e.mountedRouter(object, known)
	}
	call, ok := ast.Unparen(expression).(*ast.CallExpr)
	if !ok {
		return router{}, false
	}
	if library, name, ok := s.packageFramework(call.Fun); ok && routerConstructors[library][name] {
		return router{framework: library}, true
	}
	selector, ok := ast.Unparen(call.Fun).(*ast.SelectorExpr)
	if !ok {
		return router{}, false
	}
	parent, ok := e.routerOf(s, selector.X)
	if !ok {
		return router{}, false
	}
	return groupRouter(s, parent, selector.Sel.Name, call)
}

// namedRouter reads a name as the one value the source assigns it, or as the router its declared
// type gives it. A name assigned more than once may register routes on either value.
func (e *evidence) namedRouter(object types.Object) (router, bool) {
	if e.assignments[object] > 1 {
		return router{}, false
	}
	assigned, written := e.assignedValues[object]
	if !written {
		known, ok := e.routers[object]
		return known, ok
	}
	// Leaving the name out while its value is read ends a value that reads the name itself.
	delete(e.assignedValues, object)
	known, ok := e.routerOf(assigned.source, assigned.value)
	e.assignedValues[object] = assigned
	return known, ok
}

func joinSegments(prefix []endpointSegment, path []endpointSegment) []endpointSegment {
	return append(append([]endpointSegment{}, prefix...), path...)
}

// groupRouter applies a group prefix, or keeps the router across a middleware chain.
// A group whose prefix is not constant serves a path this scan cannot state.
func groupRouter(s *source, parent router, name string, call *ast.CallExpr) (router, bool) {
	if name == "With" || name == "Use" {
		return parent, true
	}
	if name != "Group" && name != "Route" || len(call.Args) == 0 {
		return router{}, false
	}
	// A chi group takes only a closure, so it adds no prefix.
	if _, closure := ast.Unparen(call.Args[0]).(*ast.FuncLit); closure && name == "Group" {
		return parent, true
	}
	prefix, ok := routePath(s, parent.framework, call.Args[0])
	if !ok {
		return router{}, false
	}
	return router{framework: parent.framework, prefix: joinSegments(parent.prefix, prefix)}, true
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

// isClient recognizes the net/http client values a request can be sent through.
func isClient(s *source, expression ast.Expr) bool {
	value := ast.Unparen(expression)
	if address, ok := value.(*ast.UnaryExpr); ok && address.Op == token.AND {
		value = address.X
	}
	if literal, ok := value.(*ast.CompositeLit); ok {
		library, name, ok := s.packageFramework(literal.Type)
		return ok && library == netHTTP && name == "Client"
	}
	library, name, ok := s.packageFramework(value)
	return ok && library == netHTTP && name == "DefaultClient"
}

// httpCall reads one call as a route registration, a route group, or an outgoing request.
func (e *evidence) httpCall(s *source, call *ast.CallExpr, current scope) {
	if library, name, ok := s.packageFramework(call.Fun); ok {
		if library == netHTTP && (name == "Handle" || name == "HandleFunc") {
			// The package functions register on the default ServeMux.
			e.endpoint(s, router{framework: netHTTP}, name, call, current)
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
	if object := s.object(selector.X); object != nil && e.clients[object] {
		e.request(s, selector.Sel.Name, call, current.owner, false)
	}
}

// endpoint reports one route registration.
func (e *evidence) endpoint(s *source, known router, name string, call *ast.CallExpr, current scope) {
	route, ok := registrationOf(known.framework, name)
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
	handler := route.handler
	if handler < 0 {
		handler = len(call.Args) - 1
	}
	if len(call.Args) <= route.path || handler <= route.path {
		return httpEndpoint{}, false
	}
	method := route.method
	if route.methodArg >= 0 {
		text, ok := constantString(s, call.Args[route.methodArg])
		if !ok {
			return httpEndpoint{}, false
		}
		method = strings.ToUpper(text)
	}
	stated, path, ok := routePattern(s, known.framework, call.Args[route.path])
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
	return httpEndpoint{Operation: operation, Method: method, Path: servedPath(known.prefix, path)}, true
}

// handlerOperation resolves the operation that answers the requests.
func (e *evidence) handlerOperation(s *source, expression ast.Expr) (string, bool) {
	switch node := ast.Unparen(expression).(type) {
	case *ast.FuncLit:
		id, ok := e.literals[node]
		return id, ok
	case *ast.CallExpr:
		// A handler conversion such as http.HandlerFunc(serve) keeps the same operation.
		if _, _, framework := s.packageFramework(node.Fun); framework && len(node.Args) == 1 {
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

// groupClosure gives a chi group closure's parameter the router its group call builds, as in
// router.Route("/api", func(api chi.Router) {...}), read like any other assigned value.
func (e *evidence) groupClosure(s *source, call *ast.CallExpr) {
	selector, ok := ast.Unparen(call.Fun).(*ast.SelectorExpr)
	if !ok || (selector.Sel.Name != "Route" && selector.Sel.Name != "Group") || len(call.Args) == 0 {
		return
	}
	literal, ok := ast.Unparen(call.Args[len(call.Args)-1]).(*ast.FuncLit)
	if !ok || len(literal.Type.Params.List) == 0 {
		return
	}
	parameter := literal.Type.Params.List[0]
	if library, _, ok := s.packageFramework(parameter.Type); !ok || library != chi || len(parameter.Names) == 0 {
		return
	}
	if object := s.pkg.TypesInfo.Defs[parameter.Names[0]]; object != nil {
		e.assignedValues[object] = assignedValue{source: s, value: call}
	}
}
