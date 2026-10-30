package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/handlers"
	"github.com/zinwaishine/estate-automate/backend/internal/middleware"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/services"
)

func main() {
	// Initialize GORM Database
	database.ConnectDB()

	app := fiber.New(fiber.Config{
		AppName:   "Estate Automate API",
		BodyLimit: 120 * 1024 * 1024, // 120MB limit for multi-photo payloads
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

	// Static Storage file serving
	app.Static("/storage", "./storage")

	// Public Auth Routes
	auth := app.Group("/api/auth")
	auth.Post("/login", handlers.Login)
	auth.Post("/register", handlers.Register)
	auth.Post("/logout", handlers.Logout)
	auth.Get("/tiktok/start", handlers.StartTikTokAuth)
	auth.Get("/tiktok/callback", handlers.HandleTikTokCallback)

	// TikTok Account Management & Content Posting API Routes
	tiktok := app.Group("/api/tiktok")
	tiktok.Get("/accounts", handlers.ListTikTokAccounts)
	tiktok.Get("/accounts/:id", handlers.GetTikTokAccount)
	tiktok.Post("/accounts/:id/test", handlers.TestTikTokAccount)
	tiktok.Post("/accounts/:id/refresh", handlers.RefreshTikTokAccount)
	tiktok.Post("/accounts/:id/disconnect", handlers.DisconnectTikTokAccount)
	tiktok.Post("/accounts/:id/auto-publish", handlers.ToggleTikTokAutoPublish)
	tiktok.Post("/publish", handlers.PublishTikTokPhoto)
	tiktok.Get("/publish/:publishId/status", handlers.GetTikTokPublishStatus)
	tiktok.Get("/posts", handlers.GetTikTokPosts)

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

	// Seed default Facebook Pages (Page 1: 61568058604134, Page 2: 61593000699921)
	services.GetFacebookPageManager().SeedDefaultPages()

	// Official Meta Graph API v26.0 Facebook Page Auto-Posting Routes (Legacy single page compatibility)
	fbPage := app.Group("/api/facebook/page")
	fbPage.Get("/status", handlers.GetFacebookPageStatus)
	fbPage.Post("/test", handlers.TestFacebookPageConnection)
	fbPage.Post("/token", handlers.UpdateFacebookPageToken)

	// Multi-Page Management & Token Storage (Unified Page Tokens Menu)
	fbPages := app.Group("/api/facebook/pages")
	fbPages.Get("/", handlers.ListManagedFacebookPages)
	fbPages.Post("/refresh-all", handlers.RefreshAllManagedFacebookPages)
	fbPages.Get("/authorized", handlers.GetAuthorizedFacebookAccounts)
	fbPages.Post("/import-user-token", handlers.ImportFacebookUserToken)
	fbPages.Post("/test-all", handlers.TestAllManagedFacebookPages)
	fbPages.Get("/discover", handlers.GetDiscoveredPagesHandler)
	fbPages.Post("/connect-selected", handlers.ConnectSelectedPagesHandler)
	fbPages.Get("/:pageId", handlers.GetManagedFacebookPage)
	fbPages.Get("/:pageId/token", handlers.GetManagedPageToken)
	fbPages.Post("/:pageId/refresh", handlers.RefreshManagedFacebookPage)
	fbPages.Post("/:pageId/token", handlers.SetManagedPageToken)
	fbPages.Post("/:pageId/test", handlers.TestManagedFacebookPage)
	fbPages.Post("/:pageId/disconnect", handlers.DisconnectManagedFacebookPage)
	fbPages.Post("/:pageId/auto-publish", handlers.TogglePageAutoPublish)
	fbPages.Post("/:pageId/label", handlers.UpdatePageLabel)
	fbPages.Post("/:pageId/picture", handlers.UpdatePagePicture)
	fbPages.Delete("/:pageId/token", handlers.RemovePageToken)

	// Facebook Publishing & Scheduling
	fbPublish := app.Group("/api/facebook")
	fbPublish.Post("/publish", handlers.PublishFacebookPost)
	fbPublish.Post("/publish-batch", handlers.PublishFacebookBatch)
	fbPublish.Post("/schedule", handlers.ScheduleFacebookPost)
	fbPublish.Get("/posts", handlers.GetFacebookPosts)
	fbPublish.Post("/posts/:id/retry", handlers.RetryFacebookPost)
	fbPublish.Delete("/posts", handlers.DeleteAllFacebookPosts)
	fbPublish.Delete("/posts/:id", handlers.DeleteFacebookPost)

	// Start scheduled Facebook posts processor background worker & health checker
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		healthTicker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		defer healthTicker.Stop()
		pubSvc := services.GetFacebookPublishService()
		pageMgr := services.GetFacebookPageManager()
		for {
			select {
			case <-ticker.C:
				pubSvc.ProcessScheduledPosts(context.Background())
			case <-healthTicker.C:
				pageMgr.RunHealthCheck(context.Background())
			}
		}
	}()

	// Standalone Facebook Post Importer Routes
	fbImport := app.Group("/api/facebook-import")
	fbImport.Post("/resolve", handlers.ResolveFacebookURL)
	fbImport.Post("/extract", handlers.ExtractFacebookPost)
	fbImport.Post("/browser/start", handlers.StartFacebookBrowser)
	fbImport.Get("/browser/status", handlers.GetFacebookBrowserStatus)
	fbImport.Post("/browser/continue", handlers.ContinueFacebookBrowser)
	fbImport.Post("/analyze", handlers.AnalyzePropertyContent)
	fbImport.Post("/save", handlers.SaveToPropertyInbox)
	fbImport.Get("/jobs/:id", handlers.GetFacebookImportJob)
	fbImport.Post("/upload-photos", handlers.UploadFacebookImportPhotos)
	fbImport.Get("/proxy-image", handlers.ProxyFacebookImage)
	fbImport.Post("/generate-ai", handlers.GenerateAICopy)
	fbImport.Post("/enhance-image", handlers.EnhanceVisionImage)

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

	// URL Groups Batch Management Routes (Add URL single-row grouping)
	urlGroups := app.Group("/api/url-groups")
	urlGroups.Get("/", handlers.GetUrlGroups)
	urlGroups.Post("/", handlers.CreateUrlGroup)
	urlGroups.Delete("/:id", handlers.DeleteUrlGroup)
	urlGroups.Delete("/", handlers.ClearUrlGroups)

	// Workflow Map Configuration Persistence Routes
	wf := app.Group("/api/workflow")
	wf.Get("/config", handlers.GetWorkflowConfig)
	wf.Post("/config", handlers.SaveWorkflowConfig)

	// Prompt Templates File-based Persistence Routes (no DB touch)
	promptsGroup := app.Group("/api/prompt-templates")
	promptsGroup.Get("/", handlers.GetPromptTemplates)
	promptsGroup.Post("/", handlers.SavePromptTemplates)

	// Crop & Cut Studio Formats Persistence Routes (no DB touch)
	cropFormatsGroup := app.Group("/api/crop-formats")
	cropFormatsGroup.Get("/", handlers.GetCropFormats)
	cropFormatsGroup.Post("/", handlers.SaveCropFormats)

	// n8n Automation Engine Integration Routes (Admin-protected)
	n8nRoutes := app.Group("/api/integrations/n8n", middleware.Protected(), middleware.RequireRole(models.RoleAdmin))
	n8nRoutes.Get("/status", handlers.N8NStatusCheck)
	n8nRoutes.Get("/workflows", handlers.N8NListWorkflows)
	n8nRoutes.Get("/workflows/:id", handlers.N8NGetWorkflow)
	n8nRoutes.Post("/workflows/:id/run", handlers.N8NRunWorkflow)
	n8nRoutes.Post("/workflows/:id/activate", handlers.N8NActivateWorkflow)
	n8nRoutes.Post("/workflows/:id/deactivate", handlers.N8NDeactivateWorkflow)
	n8nRoutes.Get("/executions", handlers.N8NListExecutions)
	n8nRoutes.Get("/executions/:id", handlers.N8NGetExecution)
	n8nRoutes.Get("/settings", handlers.N8NGetSettings)
	n8nRoutes.Put("/settings", handlers.N8NUpdateSettings)
	// Webhook callback endpoint — validated by HMAC signature, not JWT
	app.Post("/api/integrations/n8n/callback", handlers.N8NWebhookCallback)

	// External Browser Processing & Smart Image Queue Routes
	browserRoutes := app.Group("/api/browser")
	browserRoutes.Get("/profiles", handlers.ListBrowserProfiles)
	browserRoutes.Post("/profiles/register", handlers.RegisterBrowserProfile)
	browserRoutes.Post("/profiles/sync", handlers.SyncBrowserProfiles)
	browserRoutes.Post("/profiles/:id/open", handlers.OpenBrowserProfile)
	browserRoutes.Post("/profiles/:id/open-url", handlers.OpenBrowserProfileURL)
	browserRoutes.Post("/profiles/focus-group", handlers.FocusBrowserTabGroup)
	browserRoutes.Get("/profiles/:id/groups", handlers.GetBrowserTabGroups)
	browserRoutes.Get("/lanes", handlers.ListProcessingLanes)
	browserRoutes.Post("/lanes", handlers.UpdateProcessingLane)
	browserRoutes.Get("/queue", handlers.GetImageJobsQueue)
	browserRoutes.Post("/queue/batch", handlers.CreateBatchImageJobs)
	browserRoutes.Post("/queue/start", handlers.StartImageQueue)
	browserRoutes.Get("/queue/:id", handlers.GetImageJobDetails)
	browserRoutes.Post("/queue/:id/pause", handlers.PauseImageJob)
	browserRoutes.Post("/queue/:id/resume", handlers.ResumeImageJob)
	browserRoutes.Post("/queue/:id/retry", handlers.RetryImageJob)
	browserRoutes.Post("/queue/:id/skip", handlers.SkipImageJob)
	browserRoutes.Post("/queue/:id/cancel", handlers.CancelImageJob)
	browserRoutes.Post("/queue/:id/process-local", handlers.ProcessLocalImageJob)
	browserRoutes.Post("/queue/:id/complete", handlers.CompleteImageJobWithFile)
	browserRoutes.Post("/prompt-preview", handlers.PreviewResolvedPrompt)
	browserRoutes.Get("/download-watcher/status", handlers.GetDownloadWatcherStatus)
	browserRoutes.Post("/download-watcher/settings", handlers.UpdateDownloadWatcherSettings)
	browserRoutes.Post("/companion/sync", handlers.CompanionSync)
	browserRoutes.Post("/automation/start", handlers.StartAutomation)
	browserRoutes.Post("/automation/stop", handlers.StopAutomation)
	browserRoutes.Get("/automation/status", handlers.GetAutomationStatus)
	browserRoutes.Post("/jobs/:jobId/complete-from-tab", handlers.CompleteJobFromTab)

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
	fbTest.Post("/dom-text", handlers.ExtractDOMPostText)
	fbTest.Get("/dom-text", handlers.ExtractDOMPostText)
	fbTest.Post("/execute-action", handlers.ExecuteVisionAction)
	fbTest.Post("/extract-images", handlers.ExtractTargetPostImages)
	fbTest.Post("/analyze-image", handlers.AnalyzeSingleImage)
	fbTest.Post("/enhance-image", handlers.EnhanceVisionImage)
	fbTest.Post("/detect-image-coordinates", handlers.DetectImageCoordinates)
	fbTest.Post("/verify-target", handlers.VerifyTargetPlacement)
	fbTest.Post("/transform-content", handlers.TransformContent)
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
