package main

import "go/ast"

// A routing library as the route readers know it. External packages stay unresolved in a
// source-only scan, so a library is recognized by import path and declared syntax, never by
// resolved types. Every rule that differs between libraries lives in its record, one file per
// library, so adding a library means adding its file and its tests.
type routerLibrary struct {
	// imports reports whether an import path is one of the library's routing packages.
	imports func(path string) bool
	// constructors build a router that serves from the root.
	constructors []string
	// root is the router type that serves from the root, so a parameter, field or variable written
	// with it is a router; empty when a group returns that type too, since it may carry a prefix.
	root string
	// routes are the route registration methods.
	routes map[string]registration
	// groups return a router at or below their receiver's path.
	groups map[string]group
	// mount is the method that serves another router of this library below a prefix, as chi's Mount
	// does. A router of any other library mounted there still reads the full URL, which its routes
	// do not state.
	mount string
	// stripPrefix is the package function that serves a handler below a prefix it strips, so the
	// handler's routes serve a path this scan does not carry.
	stripPrefix string
	// defaultRouter: the package's own route functions, such as http.HandleFunc, register on a
	// default router at the root.
	defaultRouter bool
	// A pattern may state its method before a space or tab, as in "GET /talks", read in any case
	// when anyCaseMethod is set.
	methodInPattern, anyCaseMethod bool
	// hostPatterns: a pattern that does not start with `/` names a host, so it describes no path of
	// this application.
	hostPatterns bool
	// subtree: a pattern ending in `/` serves every path below it.
	subtree bool
	// pathSegment reads one route segment in the library's path syntax.
	pathSegment func(part string) (endpointSegment, bool)
}

// registration describes one route method: the method it registers, and where its handler is.
// Its path is the first argument, or the second when the first states the method.
type registration struct {
	// method is the HTTP method, `*` for every method, or empty when the first argument states it.
	method string
	// handler is the argument index, or lastArgument.
	handler int
}

const lastArgument = -1

// group describes a method that returns a router at or below its receiver's path.
type group struct {
	// prefix is the argument holding the group's path, or noPrefix when the group serves at its
	// receiver's path, as a middleware chain does.
	prefix int
	// closure says that the group hands its router to the function it takes.
	closure bool
}

const noPrefix = -1

var libraries = []*routerLibrary{netHTTP, chi, gin, echo}

// libraryOf names the routing library an import path belongs to, or nil.
func libraryOf(path string) *routerLibrary {
	for _, library := range libraries {
		if library.imports(path) {
			return library
		}
	}
	return nil
}

// packageLibrary reports the routing library a `package.Name` expression belongs to.
func (s *source) packageLibrary(expression ast.Expr) (*routerLibrary, string, bool) {
	path, name, ok := s.qualified(expression)
	if !ok {
		return nil, "", false
	}
	library := libraryOf(path)
	return library, name, library != nil
}
