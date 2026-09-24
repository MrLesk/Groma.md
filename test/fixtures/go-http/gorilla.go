package httpfixture

import (
	"net/http"

	"github.com/gorilla/mux"
)

// gorilla/mux takes the first registered match, so a route this scan cannot read blocks the requests
// under its readable literal prefix: a wrapped handler, a Queries matcher, a route kept in a variable,
// a computed path and a route below a computed prefix. A variable whose expression may match `/` spans
// the rest of the path, and a *mux.Router parameter may already carry a prefix, as Subrouter returns
// that type too.
func gorillaRoutes(version string) *mux.Router {
	router := mux.NewRouter().StrictSlash(true)
	router.HandleFunc("/reviews", listReviews).Methods(http.MethodGet)
	router.HandleFunc("/reviews", saveReview).Methods("POST", "PUT").Name("saveReview")
	router.Handle("/reviews/{id:[0-9]+}", http.HandlerFunc(showReview))
	router.HandleFunc("/reviews/{id}.json", reviewJSON).Methods("GET")
	router.HandleFunc("/archive/{rest:.*}", archivedReviews)
	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/scores/{id}", showScore).Methods("GET")
	router.HandleFunc("/speakers/{id}", logReview(showReview))
	router.HandleFunc("/search", searchReviews).Queries("q", "{q}")
	kept := router.HandleFunc("/kept", keptReview)
	kept.Methods("DELETE")
	router.HandleFunc("/"+version+"/status", reviewStatus)
	versioned := router.PathPrefix("/" + version).Subrouter().PathPrefix("/health").Subrouter()
	versioned.HandleFunc("/live", reviewStatus)
	return router
}

func gorillaParameter(router *mux.Router) {
	router.HandleFunc("/parameterreviews", listReviews)
}

func listReviews(w http.ResponseWriter, r *http.Request)     {}
func saveReview(w http.ResponseWriter, r *http.Request)      {}
func showReview(w http.ResponseWriter, r *http.Request)      {}
func reviewJSON(w http.ResponseWriter, r *http.Request)      {}
func archivedReviews(w http.ResponseWriter, r *http.Request) {}
func showScore(w http.ResponseWriter, r *http.Request)       {}
func searchReviews(w http.ResponseWriter, r *http.Request)   {}
func keptReview(w http.ResponseWriter, r *http.Request)      {}
func reviewStatus(w http.ResponseWriter, r *http.Request)    {}

func logReview(handler http.HandlerFunc) http.HandlerFunc { return handler }
