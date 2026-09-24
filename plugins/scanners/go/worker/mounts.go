package main

import (
	"go/ast"
	"go/types"
)

// mount is the router another router is mounted on, the library whose mount method did it, and
// the path under it. An unknown mount silences its routes, because their served path is longer
// than the source states here.
type mount struct {
	source   *source
	receiver ast.Expr
	library  *routerLibrary
	prefix   []endpointSegment
	unknown  bool
}

// mounts reads every router mounted under a path, before any route is read.
func (e *evidence) mounts(s *source) {
	ast.Inspect(s.syntax, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok || len(call.Args) != 2 {
			return true
		}
		// A mount is read with the mounted router's routes, below its receiving router.
		if selector, ok := ast.Unparen(call.Fun).(*ast.SelectorExpr); ok {
			for _, library := range libraries {
				if library.mount == selector.Sel.Name {
					prefix, ok := routePath(s, library, call.Args[0])
					e.mountRouter(s, call.Args[1], mount{source: s, receiver: selector.X, library: library, prefix: prefix, unknown: !ok})
				}
			}
		}
		// A router behind a prefix-stripping handler, such as http.StripPrefix, serves a path this scan does not carry.
		if library, name, ok := s.packageLibrary(call.Fun); ok && library.stripPrefix == name {
			e.mountRouter(s, call.Args[1], mount{unknown: true})
		}
		return true
	})
}

// mountRouter records the mount on a named router, or silences the function that builds one.
func (e *evidence) mountRouter(s *source, mounted ast.Expr, under mount) {
	if call, ok := ast.Unparen(mounted).(*ast.CallExpr); ok {
		// The routes belong to a router this call builds, so the source here cannot carry the prefix.
		if function, ok := s.object(call.Fun).(*types.Func); ok {
			e.silenced[e.operationByFunctionPosition[functionKey(s.pkg, function.Pos())]] = true
		}
		return
	}
	object := s.object(mounted)
	if object == nil {
		return
	}
	// A router mounted twice serves under two paths, which one fact cannot state.
	if _, twice := e.mounted[object]; twice {
		under = mount{unknown: true}
	}
	e.mounted[object] = under
}

// mountedRouter puts the receiving router's served path and the mount path in front of the
// router's own prefix. A receiver this scan cannot read serves under a path it cannot state, and a
// router of another library than the mount's still reads the full URL, so it reports nothing.
func (e *evidence) mountedRouter(object types.Object, known router) (router, bool) {
	under, mounted := e.mounted[object]
	if !mounted {
		return known, true
	}
	if under.unknown || known.library != under.library {
		return router{}, false
	}
	// While the receiver resolves, this mount is unknown, so a router mounted inside itself ends.
	e.mounted[object] = mount{unknown: true}
	receiver, ok := e.routerOf(under.source, under.receiver)
	e.mounted[object] = under
	if !ok {
		return router{}, false
	}
	known.prefix = joinSegments(joinSegments(receiver.prefix, under.prefix), known.prefix)
	return known, true
}
