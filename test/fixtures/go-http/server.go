package httpfixture

import "net/http"

const talksRoute = "/talks/"

type Server struct {
	mux *http.ServeMux
}

func (s *Server) register() {
	s.mux.HandleFunc("GET "+talksRoute+"{id}", ShowTalk)
	s.mux.Handle("POST /talks", http.HandlerFunc(CreateTalk))
	s.mux.HandleFunc("/files/{path...}", ServeFiles)
	s.mux.HandleFunc("/", Anything)
	s.mux.HandleFunc("/health/{$}", Health)
	s.mux.HandleFunc("example.com/hosted", Health)
	s.mux.HandleFunc(route(), Health)
}

func register(mux *http.ServeMux) {
	mux.HandleFunc("GET /talks", ListTalks)
	http.HandleFunc("GET /version", Version)
}

func route() string { return "/computed" }
