package main

// prometheus/common/route wraps httprouter, so its paths read like httprouter's. WithPrefix returns
// the same *route.Router type as route.New, so a router that arrives as a parameter may already
// carry a prefix: the record has no rootOnlyType.
var prometheusRoute = &routerLibrary{
	imports:      func(path string) bool { return path == "github.com/prometheus/common/route" },
	constructors: []string{"New"},
	routes: map[string]registration{
		"Del": {method: "DELETE", handler: 1}, "Get": {method: "GET", handler: 1}, "Head": {method: "HEAD", handler: 1},
		"Options": {method: "OPTIONS", handler: 1}, "Post": {method: "POST", handler: 1}, "Put": {method: "PUT", handler: 1},
		"Query": {method: "QUERY", handler: 1},
	},
	groups:      map[string]group{"WithPrefix": {prefix: 0}, "WithInstrumentation": {prefix: noPrefix}},
	pathSegment: colonSegment,
}
