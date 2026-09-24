package main

import "strings"

// echo shares gin's path syntax, but its handler follows the path.
var echo = &routerLibrary{
	imports:      func(path string) bool { return strings.HasPrefix(path, "github.com/labstack/echo") },
	constructors: []string{"New"},
	root:         "Echo",
	routes: map[string]registration{
		"CONNECT": {method: "CONNECT", handler: 1}, "DELETE": {method: "DELETE", handler: 1}, "GET": {method: "GET", handler: 1},
		"HEAD": {method: "HEAD", handler: 1}, "OPTIONS": {method: "OPTIONS", handler: 1}, "PATCH": {method: "PATCH", handler: 1},
		"POST": {method: "POST", handler: 1}, "PUT": {method: "PUT", handler: 1}, "TRACE": {method: "TRACE", handler: 1},
		"Any": {method: "*", handler: 1}, "Add": {handler: 2},
	},
	groups:      map[string]group{"Group": {prefix: 0}},
	pathSegment: colonSegment,
}
