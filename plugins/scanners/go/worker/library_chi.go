package main

import "strings"

// chi routes below a mount and reads the method of a pattern such as "get /talks" in any case.
var chi = &routerLibrary{
	imports: func(path string) bool {
		// The middleware package holds no routes.
		return strings.HasPrefix(path, "github.com/go-chi/chi") && !strings.HasSuffix(path, "/middleware")
	},
	constructors: []string{"NewRouter", "NewMux"},
	routes: map[string]registration{
		"Connect": {method: "CONNECT", handler: 1}, "Delete": {method: "DELETE", handler: 1}, "Get": {method: "GET", handler: 1},
		"Head": {method: "HEAD", handler: 1}, "Options": {method: "OPTIONS", handler: 1}, "Patch": {method: "PATCH", handler: 1},
		"Post": {method: "POST", handler: 1}, "Put": {method: "PUT", handler: 1}, "Trace": {method: "TRACE", handler: 1},
		"Handle": {method: "*", handler: 1}, "HandleFunc": {method: "*", handler: 1},
		"Method": {handler: 2}, "MethodFunc": {handler: 2},
	},
	// router.Route("/api", func(r chi.Router) {...}) and router.Group(func(r chi.Router) {...}).
	groups: map[string]group{
		"Route": {prefix: 0, closure: true}, "Group": {prefix: noPrefix, closure: true}, "With": {prefix: noPrefix},
	},
	mount:           "Mount",
	methodInPattern: true,
	anyCaseMethod:   true,
	pathSegment:     chiSegment,
}

// chiSegment reads `{name}`, `{name:regex}` and `*`. A regular expression, or literal text beside
// a placeholder as in `{id}.json`, restricts what chi accepts. chi hands a regular expression the
// text up to the character that follows its placeholder. At the end of a segment that is the next
// `/`, so the placeholder stays in its segment. Before other text, as in `{path:.+}.json`, an
// expression that may match `/` spans segments: a constrained optional catch-all that stands for the rest.
func chiSegment(part string) (endpointSegment, bool) {
	if part == "*" {
		return catchAll("")
	}
	if strings.Contains(part, "*") && !strings.Contains(part, "{") {
		return endpointSegment{}, false
	}
	return braceSegment(part, func(p placeholder) bool { return !p.last && p.matchesSlash() })
}
