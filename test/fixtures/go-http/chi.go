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
		r.Method("PUT", "/talks", http.HandlerFunc(CreateTalk))
		r.Get("/files/*", ServeFiles)
		r.Get("/exports/{id}.json", ShowTalk)
		r.Get("/reports/{path:.+}.json", ShowTalk)
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

func legacyRoutes() http.Handler {
	router := chi.NewRouter()
	router.Get("/legacy", ListTalks)
	return router
}
