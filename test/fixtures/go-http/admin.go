package httpfixture

import "net/http"

// A ServeMux name that a later file assigns more than once may hold either mux.
var adminMux *http.ServeMux

func adminRoutes() {
	adminMux.HandleFunc("/admintalks", ListTalks)
}
