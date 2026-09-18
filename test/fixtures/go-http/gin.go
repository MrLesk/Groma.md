package httpfixture

import "github.com/gin-gonic/gin"

func ginRoutes() *gin.Engine {
	engine := gin.Default()
	api := engine.Group("/api")
	api.GET("/talks/:id", authorize, ginShowTalk)
	api.Any("/health", ginHealth)
	api.GET("/versions/v:version", ginShowTalk)
	engine.Handle("DELETE", "/talks/:id", ginDeleteTalk)
	engine.GET("/files/*filepath", ginFiles)
	return engine
}

func authorize(c *gin.Context)     {}
func ginShowTalk(c *gin.Context)   {}
func ginHealth(c *gin.Context)     {}
func ginDeleteTalk(c *gin.Context) {}
func ginFiles(c *gin.Context)      {}

func ginComputed(prefix string) {
	engine := gin.New()
	group := engine.Group(prefix)
	group.GET("/talks", ginShowTalk)
}

// A group name assigned again may register on either value.
func ginReassigned(prefix string, admin bool) {
	engine := gin.New()
	group := engine.Group("/v1")
	group = engine.Group(prefix)
	group.GET("/reassigned", ginShowTalk)
	scoped := engine.Group("/public")
	if admin {
		scoped = engine.Group("/private")
	}
	scoped.GET("/scoped", ginShowTalk)
}
