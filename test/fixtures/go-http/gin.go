package httpfixture

import "github.com/gin-gonic/gin"

func ginRoutes() *gin.Engine {
	engine := gin.Default()
	api := engine.Group("/api")
	api.GET("/talks/:id", authorize, ginShowTalk)
	api.Any("/health", ginHealth)
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
