package httpfixture

import (
	"net/http"

	promroute "github.com/prometheus/common/route"
)

// WithPrefix adds its prefix, WithInstrumentation keeps the router's path, and Del registers
// DELETE. WithPrefix returns the same type as route.New, so a router parameter may already carry
// a prefix and reports nothing. A handler a local wrapper returns is not proven.
func prometheusRoutes() *promroute.Router {
	router := promroute.New().WithInstrumentation(promInstrument)
	router.Get("/-/healthy", promHealthy)
	api := router.WithPrefix("/api/v1")
	api.Get("/query", promQuery)
	api.Del("/series", promDeleteSeries)
	api.Post("/admin/tsdb/snapshot", promSnapshot)
	api.Get("/labels", promWrap(promLabels))
	return router
}

func prometheusParameter(router *promroute.Router) {
	router.Get("/parameterquery", promQuery)
}

func promInstrument(name string, handler http.HandlerFunc) http.HandlerFunc { return handler }
func promWrap(handler http.HandlerFunc) http.HandlerFunc                    { return handler }
func promHealthy(w http.ResponseWriter, r *http.Request)                    {}
func promQuery(w http.ResponseWriter, r *http.Request)                      {}
func promDeleteSeries(w http.ResponseWriter, r *http.Request)               {}
func promSnapshot(w http.ResponseWriter, r *http.Request)                   {}
func promLabels(w http.ResponseWriter, r *http.Request)                     {}
