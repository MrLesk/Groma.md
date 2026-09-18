package main

import (
	"go/ast"
	"go/constant"
	"go/token"
	"net/url"
	"regexp"
	"regexp/syntax"
	"slices"
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
		// A pattern that may span segments stands for the rest of the route.
		if segment.Kind == "catch-all" && segment.Constrained {
			break
		}
	}
	// A net/http pattern ending in `/` serves every path below it.
	if library == netHTTP && strings.HasSuffix(text, "/") {
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

// pathSegment reads one route segment in the framework's own syntax.
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
	// net/http rejects a wildcard that shares its segment with text, so no such route is served.
	if strings.ContainsAny(part, "{}") {
		return endpointSegment{}, false
	}
	return literalSegment(part)
}

// chiSegment reads `{name}`, `{name:regex}` and `*`. A regular expression, or literal text beside
// a placeholder as in `{id}.json`, restricts what chi accepts. chi hands a regular expression the
// text up to the character after its placeholder, which can cross a `/`, so a pattern that may match
// `/` is read as spanning segments: a constrained optional catch-all that stands for the rest.
func chiSegment(part string) (endpointSegment, bool) {
	if part == "*" {
		return catchAll("")
	}
	placeholders, whole, closed := chiPlaceholders(part)
	if !closed || (len(placeholders) == 0 && strings.ContainsAny(part, "{}*")) {
		return endpointSegment{}, false
	}
	if len(placeholders) == 0 {
		return literalSegment(part)
	}
	name, ok := segmentName(placeholders[0].name)
	for _, placeholder := range placeholders {
		if placeholder.pattern != "" && matchesSlash(placeholder.pattern) {
			return endpointSegment{Kind: "catch-all", Name: name, Optional: true, Constrained: true}, ok
		}
	}
	constrained := !whole || placeholders[0].pattern != ""
	return endpointSegment{Kind: "parameter", Name: name, Constrained: constrained}, ok
}

type chiPlaceholder struct {
	name    string
	pattern string
}

// chiPlaceholders reads each `{name}` or `{name:regex}` in a segment, whose regular expression may
// hold braces, and whether one placeholder is the whole segment. It reports whether every brace closes.
func chiPlaceholders(part string) (placeholders []chiPlaceholder, whole bool, closed bool) {
	depth, start := 0, 0
	for index := 0; index < len(part); index++ {
		switch part[index] {
		case '{':
			if depth == 0 {
				start = index
			}
			depth++
		case '}':
			depth--
			if depth < 0 {
				return nil, false, false
			}
			if depth == 0 {
				name, pattern, _ := strings.Cut(part[start+1:index], ":")
				placeholders = append(placeholders, chiPlaceholder{name: name, pattern: pattern})
				whole = start == 0 && index == len(part)-1
			}
		}
	}
	return placeholders, whole, depth == 0
}

// matchesSlash reports whether a regular expression may match text holding `/`. One that does not
// parse may.
func matchesSlash(pattern string) bool {
	expression, err := syntax.Parse(pattern, syntax.Perl)
	return err != nil || slashIn(expression)
}

func slashIn(expression *syntax.Regexp) bool {
	switch expression.Op {
	case syntax.OpAnyChar, syntax.OpAnyCharNotNL:
		return true
	case syntax.OpLiteral:
		return slices.Contains(expression.Rune, '/')
	case syntax.OpCharClass:
		for index := 0; index+1 < len(expression.Rune); index += 2 {
			if expression.Rune[index] <= '/' && '/' <= expression.Rune[index+1] {
				return true
			}
		}
		return false
	}
	return slices.ContainsFunc(expression.Sub, slashIn)
}

// colonSegment reads the gin and echo syntax: `:name` for one segment, `*` or `*name` for the rest.
// Literal text before `:name`, as in `v:version`, restricts what the router accepts in the segment.
func colonSegment(part string) (endpointSegment, bool) {
	if strings.HasPrefix(part, ":") {
		return parameter(strings.TrimPrefix(part, ":"))
	}
	if strings.HasPrefix(part, "*") {
		return catchAll(strings.TrimPrefix(part, "*"))
	}
	if before, name, found := strings.Cut(part, ":"); found && !strings.Contains(before, "*") {
		return constrainedParameter(name, true)
	}
	if strings.Contains(part, "*") {
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
	return constrainedParameter(name, false)
}

func constrainedParameter(name string, constrained bool) (endpointSegment, bool) {
	name, ok := segmentName(name)
	return endpointSegment{Kind: "parameter", Name: name, Constrained: constrained}, ok
}

func catchAll(name string) (endpointSegment, bool) {
	name, ok := segmentName(name)
	return endpointSegment{Kind: "catch-all", Name: name}, ok
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
