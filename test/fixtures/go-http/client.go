package httpfixture

import (
	"flag"
	"fmt"
	"net/http"
	"os"

	"example.test/httpfixture/config"
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

func joinedBase() {
	http.Get(apiBase + "joinedtalks")
}

func formattedBase(base string) {
	http.Get(fmt.Sprintf("%s/formattedtalks", base))
}

var outsideBase = "https://api.example.com"

var mirrorBase = "https://mirror.example.com"

func useMirror() {
	mirrorBase = os.Getenv("MIRROR_URL")
}

var initBase string

func init() {
	initBase = "https://init.example.com"
}

var formattedHost = fmt.Sprintf("https://%s", os.Getenv("TALKS_HOST"))

var flagBase string

func readFlags() {
	flag.StringVar(&flagBase, "talks", "", "talks service URL")
}

func literalBases() {
	http.Get(outsideBase + "/outsidetalks")
	http.Get(mirrorBase + "/mirrortalks")
	http.Get(config.APIBase + "/configtalks")
	http.Get(config.PathBase + "/pathtalks")
	http.Get(initBase + "/inittalks")
	http.Get(formattedHost + "/hosttalks")
	http.Get(flagBase + "/flagtalks")
}

var scheme = "http"

var localHost = "localhost:8080"

func splitHosts() {
	http.Get(scheme + "://" + localHost + "/schemetalks")
	http.Get("http://" + localHost + "/porttalks")
}
