package main

import "strings"

// net/http's ServeMux, including the default one behind http.Handle and http.HandleFunc.
var netHTTP = &routerLibrary{
	imports:         func(path string) bool { return path == "net/http" },
	constructors:    []string{"NewServeMux"},
	rootOnlyType:    "ServeMux",
	routes:          map[string]registration{"Handle": {method: "*", handler: 1}, "HandleFunc": {method: "*", handler: 1}},
	stripPrefix:     "StripPrefix",
	defaultRouter:   true,
	methodInPattern: true,
	hostPatterns:    true,
	subtree:         true,
	pathSegment:     goSegment,
}

// goSegment reads the net/http syntax: `{name}` for one segment, `{name...}` for the rest.
func goSegment(part string) (endpointSegment, bool) {
	// `{$}` anchors the end of the path; it adds no segment.
	if part == "{$}" {
		return endpointSegment{}, true
	}
	if name, ok := braced(part); ok {
		if remainder := strings.TrimSuffix(name, "..."); remainder != name {
			return catchAll(remainder)
		}
		return parameter(name, false)
	}
	// net/http rejects a wildcard that shares its segment with text, so no such route is served.
	if strings.ContainsAny(part, "{}") {
		return endpointSegment{}, false
	}
	return literalSegment(part)
}

// braced reads a net/http wildcard: the name inside braces that make up the whole segment.
func braced(part string) (string, bool) {
	if !strings.HasPrefix(part, "{") || !strings.HasSuffix(part, "}") {
		return "", false
	}
	return part[1 : len(part)-1], true
}
