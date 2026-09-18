package httpfixture

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// A ServeMux name that a later file assigns more than once may hold either mux.
var adminMux *http.ServeMux

func adminRoutes() {
	adminMux.HandleFunc("/admintalks", ListTalks)
}

// Names read here are assigned, built or mounted in later files, which does not change their routes.
func earlyRoutes() {
	sharedRouter.Get("/earlytalks", ListTalks)
	talksRouter.Get("/mountedtalks", ListTalks)
}

var talksRouter = chi.NewRouter()

type Admin struct {
	mux *http.ServeMux
}

func (a *Admin) first() {
	a.mux.HandleFunc("/firsttalks", ListTalks)
}
