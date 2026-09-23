package httpfixture

import "github.com/labstack/echo/v4"

func echoRoutes() *echo.Echo {
	server := echo.New()
	group := server.Group("/api")
	group.POST("/talks", echoCreateTalk)
	group.Add("PATCH", "/talks/:id", echoUpdateTalk)
	server.GET("/files/*", echoFiles)
	return server
}

func echoCreateTalk(c echo.Context) error { return nil }
func echoUpdateTalk(c echo.Context) error { return nil }
func echoFiles(c echo.Context) error      { return nil }

// A root router serves from the root wherever it comes from; a group may already carry a prefix.
func registerEchoTalks(server *echo.Echo, admin *echo.Group) {
	server.GET("/paramtalks", echoFiles)
	server.Group("/v2").DELETE("/talks/:id", echoUpdateTalk)
	admin.GET("/unseen", echoFiles)
}
