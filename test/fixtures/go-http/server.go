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

func buildMux() *http.ServeMux { return http.NewServeMux() }

func NewAdmin() *Admin {
	admin := &Admin{}
	admin.mux = buildMux()
	return admin
}

func (a *Admin) second() {
	a.mux.HandleFunc("/secondtalks", ListTalks)
}

// A router behind http.StripPrefix serves a path this scan does not carry.
func stripped() {
	inner := http.NewServeMux()
	inner.HandleFunc("/striptalks", ListTalks)
	http.Handle("/strip/", http.StripPrefix("/strip", inner))
}

func useAdmin(replacement *http.ServeMux) {
	adminMux = http.NewServeMux()
	adminMux = replacement
}
