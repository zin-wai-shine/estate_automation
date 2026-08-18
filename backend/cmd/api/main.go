package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/handlers"
	"github.com/zinwaishine/estate-automate/backend/internal/middleware"
)

func main() {
	// Initialize GORM Database
	database.ConnectDB()

	app := fiber.New(fiber.Config{
		AppName: "Estate Automate API",
	})

	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, HEAD, PUT, DELETE, PATCH",
	}))

	// Health Check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status":  "success",
			"message": "API is healthy",
		})
	})

	// Public Auth Routes
	auth := app.Group("/api/auth")
	auth.Post("/login", handlers.Login)
	auth.Post("/register", handlers.Register)
	auth.Post("/logout", handlers.Logout)

	// Social Facebook Persistent Browser Session Routes
	socialFB := app.Group("/api/social/facebook/browser")
	socialFB.Post("/connect", handlers.ConnectSocialBrowser)
	socialFB.Post("/confirm-login", handlers.ConfirmSocialBrowserLogin)
	socialFB.Get("/status", handlers.GetSocialBrowserStatus)
	socialFB.Post("/test", handlers.TestSocialBrowserConnection)
	socialFB.Post("/reconnect", handlers.ReconnectSocialBrowser)
	socialFB.Post("/switch-account", handlers.SwitchSocialBrowserAccount)
	socialFB.Post("/disconnect", handlers.DisconnectSocialBrowser)
	socialFB.Get("/live-session", handlers.GetLiveSessionStream)
	socialFB.Get("/health", handlers.GetBrowserWorkerHealth)

	// Facebook Integration Routes
	fb := app.Group("/api/facebook")
	fb.Get("/status", handlers.GetFacebookStatus)
	fb.Get("/sessions", handlers.GetBrowserSessions)
	fb.Get("/browser-session", handlers.GetBrowserSessionStatus)
	fb.Post("/browser-session/connect", handlers.ConnectBrowserSession)
	fb.Post("/browser-session/verify", handlers.VerifyBrowserSession)
	fb.Get("/auth/start", handlers.StartFacebookAuth)
	fb.Get("/auth/callback", handlers.HandleFacebookCallback)
	fb.Post("/disconnect", handlers.DisconnectFacebook)

	// Property Import & Multi-Provider Pipeline Routes
	props := app.Group("/api/properties")
	props.Post("/", handlers.CreateProperty)
	props.Post("/import", handlers.ImportProperty)
	props.Get("/:id/import-status", handlers.GetPropertyImportStatus)
	props.Get("/:id/preview", handlers.GetImportPreview)
	props.Post("/:id/preview/update", handlers.UpdateImportPreview)
	props.Post("/:id/continue-ai", handlers.ContinueAIProcessing)
	props.Post("/:id/retry-import", handlers.RetryPropertyImport)
	props.Post("/:id/manual-import", handlers.ManualPropertyImport)

	// Workflow Map Configuration Persistence Routes
	wf := app.Group("/api/workflow")
	wf.Get("/config", handlers.GetWorkflowConfig)
	wf.Post("/config", handlers.SaveWorkflowConfig)

	// Isolated Testing Menu Routes
	testingApi := app.Group("/api/testing")
	testingApi.Post("/import", handlers.ExecuteTestImport)
	testingApi.Get("/runs/:id", handlers.GetTestRun)
	testingApi.Delete("/runs/:id", handlers.DeleteTestRun)
	testingApi.Get("/live-browser", handlers.GetLiveBrowserScreenshot)

	// AI Facebook Vision Test Routes
	fbTest := app.Group("/api/facebook/test")
	fbTest.Post("/navigation", handlers.TestFacebookNavigation)
	fbTest.Post("/start", handlers.StartVisionTest)
	fbTest.Post("/screenshot", handlers.CaptureVisionScreenshot)
	fbTest.Post("/analyze", handlers.AnalyzeVisionScreenshot)
	fbTest.Post("/read-cropped", handlers.ReadCroppedTargetPost)
	fbTest.Post("/combine-text", handlers.CombineVisionTextChunks)
	fbTest.Post("/validate-content", handlers.ValidateVisionContent)
	fbTest.Post("/execute-action", handlers.ExecuteVisionAction)
	fbTest.Post("/extract-images", handlers.ExtractTargetPostImages)
	fbTest.Post("/analyze-image", handlers.AnalyzeSingleImage)
	fbTest.Post("/enhance-image", handlers.EnhanceVisionImage)
	fbTest.Post("/detect-image-coordinates", handlers.DetectImageCoordinates)
	fbTest.Get("/:testRunId", handlers.GetVisionTestRun)
	fbTest.Get("/:testRunId/logs", handlers.GetVisionTestLogs)

	// Protected Auth Routes
	authProtected := auth.Group("", middleware.Protected())
	authProtected.Get("/me", handlers.GetMe)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}

	log.Printf("Starting API server on :%s\n", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Error starting API server: %v", err)
	}
}
