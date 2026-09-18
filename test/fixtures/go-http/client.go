package httpfixture

import (
	"fmt"
	"net/http"
	"os"
)

var apiBase = os.Getenv("API_BASE")

type Client struct {
	http *http.Client
	base string
}

func (c *Client) talk(id int) {
	c.http.Get(fmt.Sprintf("/api/talks/%d", id))
}

func (c *Client) create() {
	http.Post(c.base+"/talks", "application/json", nil)
}

func replace() {
	http.NewRequest(http.MethodPut, "/talks/7", nil)
}

func check() {
	http.Get("/health?full=1")
}

func setting() {
	http.Get(os.Getenv("TALKS_URL") + "/talks")
}

func outside() {
	http.Get("https://api.example.com/talks")
}

func send(method string) {
	http.NewRequest(method, "/talks", nil)
}

func rate() {
	http.Get(fmt.Sprintf("/rate/100%%"))
}

func unproven() {
	http.Get(address())
	http.Get(fmt.Sprintf("/talks/%s-%s", "first", "second"))
	client := &http.Client{}
	client.Do(nil)
}

func address() string { return "/computed" }

func packageBase() {
	http.Get(apiBase + "/settingtalks")
}

func localBase() {
	base := address()
	http.Get(base + "/localtalks")
}

func parameterBase(base string) {
	http.Get(base + "/paramtalks")
}
