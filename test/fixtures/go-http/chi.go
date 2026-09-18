package httpfixture

import (
	"net/http"

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
		r.Get("/talks/{id}.json", ShowTalk)
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

func legacyRoutes() http.Handler {
	router := chi.NewRouter()
	router.Get("/legacy", ListTalks)
	return router
}
