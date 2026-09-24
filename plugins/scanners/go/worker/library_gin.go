package main

import "strings"

// gin takes middleware before the handler, so its handler is the last argument.
var gin = &routerLibrary{
	imports:      func(path string) bool { return strings.HasPrefix(path, "github.com/gin-gonic/gin") },
	constructors: []string{"New", "Default"},
	rootOnlyType: "Engine",
	routes: map[string]registration{
		"DELETE": {method: "DELETE", handler: lastArgument}, "GET": {method: "GET", handler: lastArgument},
		"HEAD": {method: "HEAD", handler: lastArgument}, "OPTIONS": {method: "OPTIONS", handler: lastArgument},
		"PATCH": {method: "PATCH", handler: lastArgument}, "POST": {method: "POST", handler: lastArgument},
		"PUT": {method: "PUT", handler: lastArgument},
		"Any": {method: "*", handler: lastArgument}, "Handle": {handler: lastArgument},
	},
	groups:      map[string]group{"Group": {prefix: 0}, "Use": {prefix: noPrefix}},
	pathSegment: colonSegment,
}
