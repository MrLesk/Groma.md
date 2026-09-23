package httpfixture

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func chiRoutes() http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.Logger)
	router.Get("/health", Health)
	router.Route("/api", func(r chi.Router) {
		r.Get("/talks/{id:[0-9]+}", ShowTalk)
		r.Method(http.MethodPut, "/talks", http.HandlerFunc(CreateTalk))
		r.HandleFunc("POST /items/{id}", CreateTalk)
		r.Get("/files/*", ServeFiles)
		r.Get("/exports/{id}.json", ShowTalk)
		r.Get("/reports/{path:.+}.json", ShowTalk)
		r.Get("/raws/{path:.+}/raw", ShowTalk)
		r.Get("/codes/{code:[a-z]{3}}", ShowTalk)
	})
	return router
}

func mountedRoutes() http.Handler {
	root := chi.NewRouter()
	api := chi.NewMux()
	api.Get("/talks", ShowTalk)
	root.Mount("/api", api)
	root.Get("/files/*/legacy", ServeFiles)
	root.Mount("/v2", legacyRoutes())
	return root
}

// A mount under a mount or inside a group serves below every prefix of its receiver.
func nestedRoutes() http.Handler {
	root := chi.NewRouter()
	versions := chi.NewRouter()
	speakers := chi.NewRouter()
	reviews := chi.NewRouter()
	root.Mount("/api", versions)
	versions.Mount("/v1", speakers)
	speakers.Get("/speakers", ListTalks)
	root.Route("/admin", func(admin chi.Router) {
		admin.Mount("/v2", reviews)
	})
	reviews.Get("/reviews", ListTalks)
	return root
}

// A router this scan cannot read may already serve below a prefix of its own.
func mountOn(parent chi.Router) {
	drafts := chi.NewRouter()
	parent.Mount("/drafts", drafts)
	drafts.Get("/drafts", ListTalks)
}

// Only a chi router routes below its mount; any other router still reads the full URL.
func mountedOthers() http.Handler {
	root := chi.NewRouter()
	mux := http.NewServeMux()
	mux.HandleFunc("/muxtalks", ListTalks)
	root.Mount("/api", mux)
	engine := gin.New()
	engine.GET("/gintalks", ginShowTalk)
	root.Mount("/v1", engine)
	return root
}

// A group closure that assigns its parameter again may register on either router.
func reassignedGroup(legacy bool) http.Handler {
	router := chi.NewRouter()
	router.Route("/legacy", func(r chi.Router) {
		if legacy {
			r = chi.NewRouter()
		}
		r.Get("/legacytalks", ListTalks)
	})
	return router
}

var sharedRouter = chi.NewRouter()

var apiRoot = chi.NewRouter()

func mountTalks() {
	apiRoot.Mount("/root", talksRouter)
}

// A group closure parameter that receives a mount serves the mounted routes registered before it.
func closureMount() http.Handler {
	root := chi.NewRouter()
	drafts := chi.NewRouter()
	drafts.Get("/closuretalks", ListTalks)
	root.Route("/closure", func(r chi.Router) {
		r.Mount("/v3", drafts)
	})
	return root
}

var wrapped chi.Router

// A router value that reads its own name is not one this scan can state.
func wrap() {
	wrapped = wrapped.With(middleware.Logger)
	wrapped.Get("/wrappedtalks", ListTalks)
}

// A router mounted twice, or inside itself, serves under paths one fact cannot state.
func unstatedMounts() {
	root := chi.NewRouter()
	twice := chi.NewRouter()
	root.Mount("/one", twice)
	root.Mount("/two", twice)
	twice.Get("/twicetalks", ListTalks)
	loop := chi.NewRouter()
	loop.Mount("/loop", loop)
	loop.Get("/looptalks", ListTalks)
}

func legacyRoutes() http.Handler {
	router := chi.NewRouter()
	router.Get("/legacy", ListTalks)
	return router
}
