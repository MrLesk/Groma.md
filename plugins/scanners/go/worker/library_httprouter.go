package main

import "strings"

// julienschmidt/httprouter has no groups, so every router serves from the root, and a request
// matches one route or none.
var httprouter = &routerLibrary{
	imports:      func(path string) bool { return path == "github.com/julienschmidt/httprouter" },
	constructors: []string{"New"},
	rootOnlyType: "Router",
	routes: map[string]registration{
		"DELETE": {method: "DELETE", handler: 1}, "GET": {method: "GET", handler: 1}, "HEAD": {method: "HEAD", handler: 1},
		"OPTIONS": {method: "OPTIONS", handler: 1}, "PATCH": {method: "PATCH", handler: 1}, "POST": {method: "POST", handler: 1},
		"PUT":    {method: "PUT", handler: 1},
		"Handle": {handler: 2}, "Handler": {handler: 2}, "HandlerFunc": {handler: 2},
	},
	pathSegment: colonSegment,
}

// colonSegment reads httprouter's syntax, which gin, echo and prometheus route share: `:name` for
// one segment, `*` or `*name` for the rest. Literal text before `:name`, as in `v:version`,
// restricts what the router accepts in the segment.
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
