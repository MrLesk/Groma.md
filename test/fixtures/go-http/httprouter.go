package httpfixture

import (
	"net/http"

	"github.com/julienschmidt/httprouter"
)

// httprouter has no groups: a router parameter serves from the root, and text before :name
// constrains its segment. A handler a local wrapper returns is not proven.
func httprouterRoutes() *httprouter.Router {
	router := httprouter.New()
	router.GET("/speakers/:id", showSpeaker)
	router.POST("/speakers", createSpeaker)
	router.Handle("DELETE", "/speakers/:id", deleteSpeaker)
	router.HandlerFunc(http.MethodPut, "/speakers/:id", updateSpeaker)
	router.Handler("GET", "/speakers/:id/photo", http.HandlerFunc(speakerPhoto))
	router.GET("/assets/*filepath", speakerAssets)
	router.GET("/rooms/room-:number", showRoom)
	router.GET("/logged", logSpeaker(showSpeaker))
	return router
}

func httprouterParameter(router *httprouter.Router) {
	router.GET("/parameterspeakers", showSpeaker)
}

func showSpeaker(w http.ResponseWriter, r *http.Request, ps httprouter.Params)   {}
func createSpeaker(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {}
func deleteSpeaker(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {}
func speakerAssets(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {}
func showRoom(w http.ResponseWriter, r *http.Request, ps httprouter.Params)      {}
func updateSpeaker(w http.ResponseWriter, r *http.Request)                       {}
func speakerPhoto(w http.ResponseWriter, r *http.Request)                        {}

func logSpeaker(handle httprouter.Handle) httprouter.Handle { return handle }
