package httpfixture

import "net/http"

func ShowTalk(w http.ResponseWriter, r *http.Request)   {}
func CreateTalk(w http.ResponseWriter, r *http.Request) {}
func ListTalks(w http.ResponseWriter, r *http.Request)  {}
func ServeFiles(w http.ResponseWriter, r *http.Request) {}
func Anything(w http.ResponseWriter, r *http.Request)   {}
func Health(w http.ResponseWriter, r *http.Request)     {}
func Version(w http.ResponseWriter, r *http.Request)    {}
