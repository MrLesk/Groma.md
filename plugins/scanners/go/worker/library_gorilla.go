package main

// gorilla/mux tries routes in registration order and takes the first match. A route's methods come
// from the .Methods call that follows it, and a subrouter's prefix from the PathPrefix before its
// Subrouter call. Subrouter returns the same *mux.Router type as mux.NewRouter, so the record has
// no rootOnlyType.
var gorilla = &routerLibrary{
	imports:      func(path string) bool { return path == "github.com/gorilla/mux" },
	constructors: []string{"NewRouter"},
	routes:       map[string]registration{"HandleFunc": {method: "*", handler: 1}, "Handle": {method: "*", handler: 1}},
	methodsCall:  "Methods",
	nameCall:     "Name",
	firstMatch:   true,
	// StrictSlash only redirects a path to its form with or without a trailing slash.
	groups:      map[string]group{"PathPrefix": {prefix: 0}, "Subrouter": {prefix: noPrefix}, "StrictSlash": {prefix: noPrefix}},
	pathSegment: gorillaSegment,
}

// gorillaSegment reads `{name}` and `{name:regex}`. gorilla matches the whole path with one regular
// expression, so a variable whose expression may match `/` spans segments wherever it stands: a
// constrained optional catch-all that stands for the rest. Literal text beside a variable, or an
// expression of its own, restricts what the segment accepts.
func gorillaSegment(part string) (endpointSegment, bool) {
	return braceSegment(part, placeholder.matchesSlash)
}
