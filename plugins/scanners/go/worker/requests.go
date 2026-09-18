package main

import (
	"go/ast"
	"go/types"
	"net/url"
	"strings"
)

// clientCall describes one net/http client call: which argument states the method and the URL.
type clientCall struct {
	method    string
	methodArg int
	url       int
}

// clientCallOf recognizes the net/http client calls that state a URL. `Do` states none.
func clientCallOf(name string, packageCall bool) (clientCall, bool) {
	switch name {
	case "Get":
		return clientCall{method: "GET", methodArg: -1, url: 0}, true
	case "Head":
		return clientCall{method: "HEAD", methodArg: -1, url: 0}, true
	case "Post", "PostForm":
		return clientCall{method: "POST", methodArg: -1, url: 0}, true
	case "NewRequest":
		return clientCall{methodArg: 0, url: 1}, packageCall
	case "NewRequestWithContext":
		return clientCall{methodArg: 1, url: 2}, packageCall
	}
	return clientCall{}, false
}

// request reports what the source proves about one outgoing request.
func (e *evidence) request(s *source, name string, call *ast.CallExpr, owner string, packageCall bool) {
	recognized, ok := clientCallOf(name, packageCall)
	if !ok || owner == "" || len(call.Args) <= recognized.url {
		return
	}
	method := recognized.method
	if recognized.methodArg >= 0 {
		method = requestMethod(s, call.Args[recognized.methodArg])
	}
	configured, path := requestPath(e.urlParts(s, call.Args[recognized.url]))
	e.result.HTTPRequests = append(e.result.HTTPRequests, httpRequest{
		Operation: owner, Method: method, Configured: configured, Path: path,
	})
}

// requestMethod reads a literal method or a net/http method constant such as http.MethodGet.
func requestMethod(s *source, expression ast.Expr) string {
	if text, ok := constantString(s, expression); ok && methodToken.MatchString(strings.ToUpper(text)) {
		return strings.ToUpper(text)
	}
	if library, name, ok := s.packageFramework(expression); ok && library == netHTTP {
		if method := strings.ToUpper(strings.TrimPrefix(name, "Method")); httpMethods[method] {
			return method
		}
	}
	return ""
}

// urlPart is one piece of a URL expression: text the source proves, or a value it computes.
// A computed value the application reads by name, such as a setting, can still be a base.
type urlPart struct {
	text     string
	computed bool
	setting  bool
}

// urlParts reads a URL expression as constant text, concatenations and formatted values.
func (e *evidence) urlParts(s *source, expression ast.Expr) []urlPart {
	if text, ok := constantString(s, expression); ok {
		return []urlPart{{text: text}}
	}
	switch node := ast.Unparen(expression).(type) {
	case *ast.Ident, *ast.SelectorExpr:
		return e.nameParts(s, node)
	case *ast.BinaryExpr:
		return append(e.urlParts(s, node.X), e.urlParts(s, node.Y)...)
	case *ast.CallExpr:
		return callParts(s, node)
	}
	return []urlPart{{computed: true}}
}

// nameParts reads a named value. A package-level variable is what the source assigns it. A local
// variable or parameter is computed here, a value this scan declines to resolve. A name from
// elsewhere, such as a field, is read like a setting.
func (e *evidence) nameParts(s *source, name ast.Expr) []urlPart {
	object := s.object(name)
	if parts, ok := e.packageParts(object); ok {
		return parts
	}
	variable, ok := object.(*types.Var)
	local := ok && variable.Parent() != nil
	return []urlPart{{computed: true, setting: !local}}
}

// packageParts reads a package-level variable as the one value the source assigns it, in its
// declaration or elsewhere. One a command-line flag sets, or that nothing in the source assigns
// (the linker can), is read like a setting; one assigned more than once, or given a value the
// source does not write out, such as through a pointer, is unknown.
func (e *evidence) packageParts(object types.Object) ([]urlPart, bool) {
	variable, ok := object.(*types.Var)
	if !ok || variable.Pkg() == nil || variable.Parent() != variable.Pkg().Scope() {
		return nil, false
	}
	assigned, written := e.assignedValues[object]
	switch {
	case e.flags[object] || e.assignments[object] == 0:
		return []urlPart{{computed: true, setting: true}}, true
	case e.assignments[object] > 1 || !written:
		return []urlPart{{computed: true}}, true
	}
	// A value can read the variable itself, as in base = base + "/v2"; leaving the variable out
	// while its value is read makes that read unknown instead of endless.
	delete(e.assignedValues, object)
	parts := e.urlParts(assigned.source, assigned.value)
	e.assignedValues[object] = assigned
	return parts, true
}

// callParts reads a formatted URL, or an environment setting the application reads by name.
func callParts(s *source, call *ast.CallExpr) []urlPart {
	path, name, ok := s.qualified(call.Fun)
	if !ok || len(call.Args) == 0 {
		return []urlPart{{computed: true}}
	}
	if path == "fmt" && name == "Sprintf" {
		if format, ok := constantString(s, call.Args[0]); ok {
			return formatParts(format)
		}
	}
	if path == "os" && (name == "Getenv" || name == "ExpandEnv") {
		return []urlPart{{computed: true, setting: true}}
	}
	return []urlPart{{computed: true}}
}

// formatParts turns a format string into text and one computed value per verb.
func formatParts(format string) []urlPart {
	parts := []urlPart{}
	text := strings.Builder{}
	for index := 0; index < len(format); index++ {
		if format[index] != '%' {
			text.WriteByte(format[index])
			continue
		}
		verb := verbEnd(format, index)
		if verb >= len(format) {
			break
		}
		// `%%` is a literal percent, not a value.
		if format[verb] == '%' {
			text.WriteByte('%')
			index = verb
			continue
		}
		parts = append(parts, urlPart{text: text.String()}, urlPart{computed: true})
		text.Reset()
		index = verb
	}
	return append(parts, urlPart{text: text.String()})
}

// verbEnd finds the verb letter that ends a format placeholder.
func verbEnd(format string, start int) int {
	for index := start + 1; index < len(format); index++ {
		if letter := format[index]; letter == '%' || (letter >= 'a' && letter <= 'z') || (letter >= 'A' && letter <= 'Z') {
			return index
		}
	}
	return len(format)
}

// requestPath states what precedes the path and the segments the source proves.
// A setting that a new path segment follows is a configured base; a literal host, and any
// other leading value, cannot be compared at all.
func requestPath(parts []urlPart) (bool, []requestSegment) {
	parts = withText(beforeQuery(parts))
	if len(parts) == 0 {
		return false, []requestSegment{}
	}
	if parts[0].computed {
		// Text that continues the setting's own last segment, as in base + "talks", is not a path of its own.
		if parts[0].setting && len(parts) > 1 && strings.HasPrefix(parts[1].text, "/") {
			return true, requestSegments(parts[1:])
		}
		// A base the scanner cannot resolve at all stays in the path as unknown text.
		return false, append([]requestSegment{{Kind: "unknown"}}, requestSegments(parts[1:])...)
	}
	if rest, host := afterAuthority(parts[0].text); host {
		remainder := append([]urlPart{{text: rest}}, parts[1:]...)
		return false, append([]requestSegment{{Kind: "unknown"}}, requestSegments(remainder)...)
	}
	return false, requestSegments(parts)
}

// afterAuthority drops a scheme and host, which address a server this path cannot be compared with.
func afterAuthority(text string) (string, bool) {
	start := strings.Index(text, "//")
	if start < 0 || (start > 0 && !strings.HasSuffix(text[:start], ":")) {
		return text, false
	}
	rest := text[start+2:]
	if slash := strings.Index(rest, "/"); slash >= 0 {
		return rest[slash:], true
	}
	return "", true
}

// withText joins adjacent text and drops empty text, so a URL written in pieces, such as
// scheme + "://" + host, reads as the text it spells, and the value that starts a URL such as
// fmt.Sprintf("%s/talks", base) is read as its base.
func withText(parts []urlPart) []urlPart {
	kept := []urlPart{}
	for _, part := range parts {
		last := len(kept) - 1
		switch {
		case part.computed:
			kept = append(kept, part)
		case part.text == "":
		case last >= 0 && !kept[last].computed:
			kept[last].text += part.text
		default:
			kept = append(kept, part)
		}
	}
	return kept
}

// beforeQuery drops the query and fragment, which Groma ignores.
func beforeQuery(parts []urlPart) []urlPart {
	for index, part := range parts {
		if part.computed {
			continue
		}
		if cut := strings.IndexAny(part.text, "?#"); cut >= 0 {
			kept := append([]urlPart{}, parts[:index]...)
			return append(kept, urlPart{text: part.text[:cut]})
		}
	}
	return parts
}

func requestSegments(parts []urlPart) []requestSegment {
	path := []requestSegment{}
	current := segment{}
	for _, part := range parts {
		if part.computed {
			current.addComputed()
			continue
		}
		for index, piece := range strings.Split(part.text, "/") {
			if index > 0 {
				path = current.close(path)
			}
			current.addText(piece)
		}
	}
	return current.close(path)
}

// segment collects one path segment: proven text, one computed value, or a mix of both.
type segment struct {
	text     string
	computed bool
	mixed    bool
}

func (s *segment) addText(text string) {
	if text == "" {
		return
	}
	if s.computed {
		s.mixed = true
	}
	s.text += text
}

func (s *segment) addComputed() {
	if s.text != "" || s.computed {
		s.mixed = true
	}
	s.computed = true
}

func (s *segment) close(path []requestSegment) []requestSegment {
	kind, value := s.kind()
	*s = segment{}
	if kind == "" {
		return path
	}
	return append(path, requestSegment{Kind: kind, Value: value})
}

func (s *segment) kind() (string, string) {
	switch {
	case s.mixed:
		return "unknown", ""
	case s.computed:
		return "dynamic", ""
	case s.text == "":
		return "", ""
	}
	text := s.text
	if !pathText.MatchString(text) {
		text = url.PathEscape(text)
	}
	if !pathText.MatchString(text) {
		return "unknown", ""
	}
	return "literal", text
}
