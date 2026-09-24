package main

import (
	"regexp/syntax"
	"slices"
	"strings"
)

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
	placeholders, whole, closed := chiPlaceholders(part)
	if !closed || (len(placeholders) == 0 && strings.ContainsAny(part, "{}*")) {
		return endpointSegment{}, false
	}
	if len(placeholders) == 0 {
		return literalSegment(part)
	}
	first := placeholders[0]
	for _, placeholder := range placeholders {
		if placeholder.pattern != "" && !placeholder.last && matchesSlash(placeholder.pattern) {
			segment, ok := catchAll(first.name)
			segment.Optional, segment.Constrained = true, true
			return segment, ok
		}
	}
	return parameter(first.name, !whole || first.pattern != "")
}

type chiPlaceholder struct {
	name    string
	pattern string
	// last reports that the placeholder ends its segment.
	last bool
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
				last := index == len(part)-1
				placeholders = append(placeholders, chiPlaceholder{name: name, pattern: pattern, last: last})
				whole = start == 0 && last
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
