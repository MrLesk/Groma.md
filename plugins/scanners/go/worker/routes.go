package main

import (
	"go/ast"
	"net/url"
	"regexp"
	"strings"
)

// Groma compares path text exactly, so literal text keeps RFC 3986 path characters.
var pathText = regexp.MustCompile(`^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$`)
var methodToken = regexp.MustCompile(`^[A-Z][A-Z-]*$`)
var httpMethods = map[string]bool{
	"GET": true, "POST": true, "PUT": true, "PATCH": true, "DELETE": true,
	"HEAD": true, "OPTIONS": true, "CONNECT": true, "TRACE": true,
}

// methodName reads a literal method or a net/http method constant such as http.MethodGet, or "".
func methodName(s *source, expression ast.Expr) string {
	if text, ok := constantString(s, expression); ok && methodToken.MatchString(strings.ToUpper(text)) {
		return strings.ToUpper(text)
	}
	if library, name, ok := s.packageLibrary(expression); ok && library == netHTTP {
		if method := strings.ToUpper(strings.TrimPrefix(name, "Method")); httpMethods[method] {
			return method
		}
	}
	return ""
}

// routePattern reads a literal route in the library's syntax. A method the pattern states before a
// space or tab comes back first.
func routePattern(s *source, library *routerLibrary, expression ast.Expr) (string, []endpointSegment, bool) {
	text, ok := constantString(s, expression)
	if !ok {
		return "", nil, false
	}
	method := ""
	if index := strings.IndexAny(text, " \t"); index >= 0 && library.methodInPattern {
		method, text = text[:index], strings.TrimLeft(text[index+1:], " \t")
		if library.anyCaseMethod {
			method = strings.ToUpper(method)
		}
		if !methodToken.MatchString(method) {
			return "", nil, false
		}
	}
	if library.hostPatterns && !strings.HasPrefix(text, "/") {
		return "", nil, false
	}
	path, ok := routeSegments(library, text)
	if !ok {
		return "", nil, false
	}
	return method, path, true
}

// routePath reads a group or mount prefix, which states no method and ends before the
// route's own segments, so it cannot hold a catch-all.
func routePath(s *source, library *routerLibrary, expression ast.Expr) ([]endpointSegment, bool) {
	method, path, ok := routePattern(s, library, expression)
	if !ok || method != "" {
		return nil, false
	}
	for _, segment := range path {
		if segment.Kind == "catch-all" {
			return nil, false
		}
	}
	return path, true
}

func routeSegments(library *routerLibrary, text string) ([]endpointSegment, bool) {
	path := []endpointSegment{}
	for _, part := range strings.Split(text, "/") {
		if part == "" {
			continue
		}
		segment, ok := library.pathSegment(part)
		if !ok {
			return nil, false
		}
		if segment.Kind != "" {
			path = append(path, segment)
		}
		// A pattern that may span segments stands for the rest of the route.
		if segment.Kind == "catch-all" && segment.Constrained {
			break
		}
	}
	if library.subtree && strings.HasSuffix(text, "/") {
		path = append(path, endpointSegment{Kind: "catch-all", Name: "path"})
	}
	// A catch-all takes the remaining segments, so a route cannot continue after one.
	for index, segment := range path {
		if segment.Kind == "catch-all" && index != len(path)-1 {
			return nil, false
		}
	}
	return path, true
}

// colonSegment reads the gin and echo syntax: `:name` for one segment, `*` or `*name` for the rest.
// Literal text before `:name`, as in `v:version`, restricts what the router accepts in the segment.
func colonSegment(part string) (endpointSegment, bool) {
	if strings.HasPrefix(part, ":") {
		return parameter(strings.TrimPrefix(part, ":"), false)
	}
	if strings.HasPrefix(part, "*") {
		return catchAll(strings.TrimPrefix(part, "*"))
	}
	if before, name, found := strings.Cut(part, ":"); found && !strings.Contains(before, "*") {
		return parameter(name, true)
	}
	if strings.Contains(part, "*") {
		return endpointSegment{}, false
	}
	return literalSegment(part)
}

func parameter(name string, constrained bool) (endpointSegment, bool) {
	name, ok := segmentName(name)
	return endpointSegment{Kind: "parameter", Name: name, Constrained: constrained}, ok
}

func catchAll(name string) (endpointSegment, bool) {
	name, ok := segmentName(name)
	return endpointSegment{Kind: "catch-all", Name: name}, ok
}

func joinSegments(prefix []endpointSegment, path []endpointSegment) []endpointSegment {
	return append(append([]endpointSegment{}, prefix...), path...)
}

// servedPath joins a router's prefix and a route. A catch-all serves an empty remainder only
// after a trailing slash, as in /files/, which request paths do not keep, so it requires a
// remainder. A catch-all at the root is the exception: every request path starts with that slash.
func servedPath(prefix []endpointSegment, route []endpointSegment) []endpointSegment {
	path := joinSegments(prefix, route)
	if len(path) == 1 && path[0].Kind == "catch-all" {
		path[0].Optional = true
	}
	return path
}

// segmentName keeps the route's own name; an unnamed wildcard is reported as `path`.
func segmentName(name string) (string, bool) {
	if name == "" {
		return "path", true
	}
	return name, pathText.MatchString(name)
}

func literalSegment(part string) (endpointSegment, bool) {
	if !pathText.MatchString(part) {
		part = url.PathEscape(part)
	}
	return endpointSegment{Kind: "literal", Value: part}, pathText.MatchString(part)
}
