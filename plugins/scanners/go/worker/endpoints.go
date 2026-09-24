package main

import (
	"go/ast"
	"go/types"
)

// chainCalls notes, for each call, the call made on its result, as .Methods("GET") after
// r.HandleFunc(...), and the calls an expression statement makes without keeping their result.
func chainCalls(syntax *ast.File) (next map[*ast.CallExpr]*ast.CallExpr, discarded map[*ast.CallExpr]bool) {
	next, discarded = map[*ast.CallExpr]*ast.CallExpr{}, map[*ast.CallExpr]bool{}
	ast.Inspect(syntax, func(node ast.Node) bool {
		switch node := node.(type) {
		case *ast.ExprStmt:
			if call, ok := ast.Unparen(node.X).(*ast.CallExpr); ok {
				discarded[call] = true
			}
		case *ast.CallExpr:
			if selector, ok := ast.Unparen(node.Fun).(*ast.SelectorExpr); ok {
				if inner, ok := ast.Unparen(selector.X).(*ast.CallExpr); ok {
					next[inner] = node
				}
			}
		}
		return true
	})
	return next, discarded
}

// endpoint reports one route registration: a fact per method it serves or, for a library that takes
// the first match, a blocker when this scan cannot read the route. Such a library's facts carry the
// router tree's order; they share one position, since the order among them is not read.
func (e *evidence) endpoint(s *source, known router, name string, call *ast.CallExpr, current scope) {
	route, ok := known.library.routes[name]
	if !ok || current.silenced {
		return
	}
	facts, ok := e.registrationFacts(s, known, route, call)
	if !ok && known.library.firstMatch && current.owner != "" {
		facts, ok = []httpEndpoint{blocker(s, known, route, call, current.owner)}, true
	}
	if !ok {
		return
	}
	if known.library.firstMatch {
		for index := range facts {
			facts[index].Order = &endpointOrder{Application: known.application}
		}
	}
	e.result.HTTPEndpoints = append(e.result.HTTPEndpoints, facts...)
}

// registrationFacts reads a registration: a fact per method the calls that follow it state, or one for
// the registration's own method. It reports false when the route, a method or the handler is not
// proven, or when the router is blocked.
func (e *evidence) registrationFacts(s *source, known router, route registration, call *ast.CallExpr) ([]httpEndpoint, bool) {
	methods, ok := chainedMethods(s, known.library, call)
	if !ok || known.blocked {
		return nil, false
	}
	fact, ok := e.endpointFact(s, known, route, call)
	if !ok {
		return nil, false
	}
	if len(methods) == 0 {
		return []httpEndpoint{fact}, true
	}
	facts := []httpEndpoint{}
	for _, method := range methods {
		fact.Method = method
		facts = append(facts, fact)
	}
	return facts, true
}

// chainedMethods reads the calls a library lets follow a registration: the methods they state, none
// for the registration's own method, and false when another call narrows the route or its result is
// kept, since a later call may narrow it.
func chainedMethods(s *source, library *routerLibrary, call *ast.CallExpr) ([]string, bool) {
	if library.methodsCall == "" {
		return nil, true
	}
	methods, last := []string{}, call
	for next := s.next[call]; next != nil; last, next = next, s.next[next] {
		switch ast.Unparen(next.Fun).(*ast.SelectorExpr).Sel.Name {
		case library.nameCall:
		case library.methodsCall:
			for _, argument := range next.Args {
				method := methodName(s, argument)
				if method == "" {
					return nil, false
				}
				methods = append(methods, method)
			}
		default:
			return nil, false
		}
	}
	return methods, s.discarded[last]
}

// blocker stands for a route this scan sees but cannot read: the literal segments its router's and
// its own path start with, then a constrained optional catch-all, for every method, named after the
// operation that registers it. No request below that literal part is taken for another route.
func blocker(s *source, known router, route registration, call *ast.CallExpr, owner string) httpEndpoint {
	path := known.prefix
	if argument := route.pathArgument(); !known.blocked && argument < len(call.Args) {
		if _, segments, ok := routePattern(s, known.library, call.Args[argument]); ok {
			path = joinSegments(path, segments)
		}
	}
	literal := 0
	for literal < len(path) && path[literal].Kind == "literal" {
		literal++
	}
	rest := endpointSegment{Kind: "catch-all", Name: "path", Optional: true, Constrained: true}
	return httpEndpoint{Operation: owner, Method: "*", Path: joinSegments(path[:literal], []endpointSegment{rest})}
}

// endpointFact builds the fact, or reports that the route, method or handler is not proven.
func (e *evidence) endpointFact(s *source, known router, route registration, call *ast.CallExpr) (httpEndpoint, bool) {
	path := route.pathArgument()
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
