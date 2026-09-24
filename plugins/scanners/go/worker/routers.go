package main

import (
	"go/ast"
	"go/types"
	"slices"
)

// A router value, with the prefix its groups and mount declare.
type router struct {
	library *routerLibrary
	prefix  []endpointSegment
}

// declared registers parameters, struct fields and variables written with a library's root-only
// router type or as a net/http client, and the router a group hands to its closure. Any other
// router value may reach this scan with a prefix it cannot see, so only the constructors, mounts
// and groups in this source establish one.
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
	library, name, ok := s.packageLibrary(written)
	if !ok {
		return
	}
	client := library == netHTTP && name == "Client"
	if !client && library.rootOnlyType != name {
		return
	}
	for _, declared := range names {
		object := s.pkg.TypesInfo.Defs[declared]
		if object == nil {
			continue
		}
		if client {
			e.clients[object] = true
		} else {
			e.routers[object] = router{library: library}
		}
	}
}

// groupClosure gives a group closure's parameter the router its group call builds, as in
// router.Route("/api", func(api chi.Router) {...}), read like any other assigned value.
func (e *evidence) groupClosure(s *source, call *ast.CallExpr) {
	selector, ok := ast.Unparen(call.Fun).(*ast.SelectorExpr)
	if !ok || len(call.Args) == 0 {
		return
	}
	literal, ok := ast.Unparen(call.Args[len(call.Args)-1]).(*ast.FuncLit)
	if !ok || len(literal.Type.Params.List) == 0 {
		return
	}
	parameter := literal.Type.Params.List[0]
	library, _, ok := s.packageLibrary(parameter.Type)
	if !ok || !library.groups[selector.Sel.Name].closure || len(parameter.Names) == 0 {
		return
	}
	if object := s.pkg.TypesInfo.Defs[parameter.Names[0]]; object != nil {
		e.assignedValues[object] = assignedValue{source: s, value: call}
	}
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
	if library, name, ok := s.packageLibrary(call.Fun); ok && slices.Contains(library.constructors, name) {
		return router{library: library}, true
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

// groupRouter reads a group call: the router at its receiver's path, or below the prefix it states.
// A group whose prefix is not constant serves a path this scan cannot state.
func groupRouter(s *source, parent router, name string, call *ast.CallExpr) (router, bool) {
	group, ok := parent.library.groups[name]
	if !ok {
		return router{}, false
	}
	if group.prefix == noPrefix {
		return parent, true
	}
	if len(call.Args) <= group.prefix {
		return router{}, false
	}
	prefix, ok := routePath(s, parent.library, call.Args[group.prefix])
	if !ok {
		return router{}, false
	}
	return router{library: parent.library, prefix: joinSegments(parent.prefix, prefix)}, true
}
