package main

import (
	"go/ast"
	"go/constant"
	"go/token"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// Groma compares path text exactly, so literal text keeps RFC 3986 path characters.
var pathText = regexp.MustCompile(`^[A-Za-z0-9\-._~!$&'()*+,;=:@%]+$`)
var methodToken = regexp.MustCompile(`^[A-Z][A-Z-]*$`)
var majorVersion = regexp.MustCompile(`^v[0-9]+$`)
var httpMethods = map[string]bool{
	"GET": true, "POST": true, "PUT": true, "PATCH": true, "DELETE": true,
	"HEAD": true, "OPTIONS": true, "CONNECT": true, "TRACE": true,
}

// registration describes one route call: where the method, path and handler are.
type registration struct {
	// method is the HTTP method, or `*` for every method; methodArg names the argument that states it.
	method    string
	methodArg int
	path      int
	// handler is the argument index, or -1 for the last argument.
	handler int
}

// registrationOf recognizes a framework's route methods on a router value.
func registrationOf(library string, name string) (registration, bool) {
	method := strings.ToUpper(name)
	switch library {
	case netHTTP:
		// A net/http pattern may state the method itself.
		if name == "Handle" || name == "HandleFunc" {
			return registration{method: "*", methodArg: -1, path: 0, handler: 1}, true
		}
	case chi:
		if httpMethods[method] {
			return registration{method: method, methodArg: -1, path: 0, handler: 1}, true
		}
		if name == "Handle" || name == "HandleFunc" {
			return registration{method: "*", methodArg: -1, path: 0, handler: 1}, true
		}
		if name == "Method" || name == "MethodFunc" {
			return registration{methodArg: 0, path: 1, handler: 2}, true
		}
	case gin:
		// Middleware precedes the handler, so gin's handler is the last argument.
		if httpMethods[method] {
			return registration{method: method, methodArg: -1, path: 0, handler: -1}, true
		}
		if name == "Any" {
			return registration{method: "*", methodArg: -1, path: 0, handler: -1}, true
		}
		if name == "Handle" {
			return registration{methodArg: 0, path: 1, handler: -1}, true
		}
	case echo:
		if httpMethods[method] {
			return registration{method: method, methodArg: -1, path: 0, handler: 1}, true
		}
		if name == "Any" {
			return registration{method: "*", methodArg: -1, path: 0, handler: 1}, true
		}
		if name == "Add" {
			return registration{methodArg: 0, path: 1, handler: 2}, true
		}
	}
	return registration{}, false
}

// routePattern reads a literal route. A net/http pattern can state the method, which comes back first.
func routePattern(s *source, library string, expression ast.Expr) (string, []endpointSegment, bool) {
	text, ok := constantString(s, expression)
	if !ok {
		return "", nil, false
	}
	method := ""
	if library == netHTTP {
		if before, after, found := strings.Cut(text, " "); found {
			method, text = before, strings.TrimSpace(after)
			if !methodToken.MatchString(method) {
				return "", nil, false
			}
		}
		// A pattern with a host does not describe this application's root path.
		if !strings.HasPrefix(text, "/") {
			return "", nil, false
		}
	}
	path, ok := routeSegments(library, text)
	if !ok {
		return "", nil, false
	}
	return method, path, true
}

// routePath reads a group or mount prefix, which states no method and ends before the
// route's own segments, so it cannot hold a catch-all.
func routePath(s *source, library string, expression ast.Expr) ([]endpointSegment, bool) {
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

func routeSegments(library string, text string) ([]endpointSegment, bool) {
	path := []endpointSegment{}
	for _, part := range strings.Split(text, "/") {
		if part == "" {
			continue
		}
		segment, ok := pathSegment(library, part)
		if !ok {
			return nil, false
		}
		if segment.Kind != "" {
			path = append(path, segment)
		}
	}
	// A net/http pattern ending in `/` serves every path below it.
	if library == netHTTP && strings.HasSuffix(text, "/") {
		path = append(path, endpointSegment{Kind: "catch-all", Name: "path", Optional: true})
	}
	// A catch-all takes the remaining segments, so a route cannot continue after one.
	for index, segment := range path {
		if segment.Kind == "catch-all" && index != len(path)-1 {
			return nil, false
		}
	}
	return path, true
}

// pathSegment reads one route segment in the framework's own syntax. A segment that mixes
// literal text with a wildcard has no equivalent fact, so its route is not reported.
func pathSegment(library string, part string) (endpointSegment, bool) {
	switch library {
	case netHTTP:
		return goSegment(part)
	case chi:
		return chiSegment(part)
	}
	return colonSegment(part)
}

func goSegment(part string) (endpointSegment, bool) {
	// `{$}` anchors the end of the path; it adds no segment.
	if part == "{$}" {
		return endpointSegment{}, true
	}
	if name, ok := wildcard(part, "{", "}"); ok {
		if remainder := strings.TrimSuffix(name, "..."); remainder != name {
			return catchAll(remainder)
		}
		return parameter(name)
	}
	if strings.ContainsAny(part, "{}") {
		return endpointSegment{}, false
	}
	return literalSegment(part)
}

func chiSegment(part string) (endpointSegment, bool) {
	if part == "*" {
		return catchAll("")
	}
	if name, ok := wildcard(part, "{", "}"); ok {
		// A regular expression constrains the text but still matches one segment.
		pattern, _, _ := strings.Cut(name, ":")
		return parameter(pattern)
	}
	if strings.ContainsAny(part, "{}*") {
		return endpointSegment{}, false
	}
	return literalSegment(part)
}

// colonSegment reads the gin and echo syntax: `:name` for one segment, `*` or `*name` for the rest.
func colonSegment(part string) (endpointSegment, bool) {
	if strings.HasPrefix(part, ":") {
		return parameter(strings.TrimPrefix(part, ":"))
	}
	if strings.HasPrefix(part, "*") {
		return catchAll(strings.TrimPrefix(part, "*"))
	}
	if strings.ContainsAny(part, ":*") {
		return endpointSegment{}, false
	}
	return literalSegment(part)
}

func wildcard(part string, open string, close string) (string, bool) {
	if !strings.HasPrefix(part, open) || !strings.HasSuffix(part, close) {
		return "", false
	}
	return part[len(open) : len(part)-len(close)], true
}

func parameter(name string) (endpointSegment, bool) {
	name, ok := segmentName(name)
	return endpointSegment{Kind: "parameter", Name: name}, ok
}

func catchAll(name string) (endpointSegment, bool) {
	name, ok := segmentName(name)
	return endpointSegment{Kind: "catch-all", Name: name, Optional: true}, ok
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
