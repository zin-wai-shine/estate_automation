package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/services"
)

var (
	urlResolver     = services.NewFacebookURLResolver()
	sourceDetector  = services.NewFacebookSourceDetector()
	graphClient     = services.NewFacebookGraphClient()
	openClawClient  = services.NewOpenClawFacebookExtractor()
	mediaDownloader = services.NewFacebookMediaDownloader("./storage/uploads/facebook-import")
	aiExtractor     = services.NewPropertyAIExtractor()
	importRepo      = services.GetFacebookImportRepository()
	googleAIService = services.NewGoogleAIService()
)

// ResolveFacebookURL validates and resolves canonical Facebook URLs
func ResolveFacebookURL(c *fiber.Ctx) error {
	var req models.ResolveURLRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.URL) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success":       false,
			"error_code":    models.ErrCodeInvalidURL,
			"error_message": "Please provide a valid URL",
		})
	}

	targetURL := strings.TrimSpace(req.URL)
	if !urlResolver.IsFacebookURL(targetURL) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success":       false,
			"error_code":    models.ErrCodeNotFacebookURL,
			"error_message": "Supplied URL is not a valid Facebook URL",
		})
	}

	canonicalURL, err := urlResolver.ResolveCanonicalURL(targetURL)
	if err != nil {
		canonicalURL = targetURL
	}

	sourceType, sourceName := sourceDetector.DetectSource(canonicalURL)
	postID := urlResolver.ExtractPostID(canonicalURL)

	return c.JSON(fiber.Map{
		"success":       true,
		"original_url":  targetURL,
		"canonical_url": canonicalURL,
		"source_type":   sourceType,
		"source_name":   sourceName,
		"post_id":       postID,
	})
}

// ExtractFacebookPost coordinates hybrid extraction pipeline (Meta API -> OpenClaw -> Downloader -> AI)
func ExtractFacebookPost(c *fiber.Ctx) error {
	var req models.ExtractRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.URL) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success":       false,
			"error_code":    models.ErrCodeInvalidURL,
			"error_message": "Please provide a Facebook URL",
		})
	}

	rawURL := strings.TrimSpace(req.URL)
	if !urlResolver.IsFacebookURL(rawURL) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success":       false,
			"error_code":    models.ErrCodeNotFacebookURL,
			"error_message": "Supplied URL is not a recognized Facebook domain",
		})
	}

	canonicalURL, _ := urlResolver.ResolveCanonicalURL(rawURL)
	if canonicalURL == "" {
		canonicalURL = rawURL
	}

	sourceType, sourceName := sourceDetector.DetectSource(canonicalURL)
	postID := urlResolver.ExtractPostID(canonicalURL)

	// Create new job
	method := models.ExtractionMethodOpenClawBrowser
	if req.PreferredMethod == models.ExtractionMethodMetaAPI {
		method = models.ExtractionMethodMetaAPI
	} else if req.PreferredMethod == models.ExtractionMethodManualFallback {
		method = models.ExtractionMethodManualFallback
	}

	job := importRepo.CreateJob(rawURL, canonicalURL, method, sourceType)
	jobID := job.JobID

	// Execute extraction pipeline synchronously for immediate review screen response
	importRepo.UpdateJobStatus(jobID, models.JobStateResolvingURL)
	importRepo.AddJobLog(jobID, "info", fmt.Sprintf("Facebook share URL resolved: %s", canonicalURL))

	importRepo.UpdateJobStatus(jobID, models.JobStateDetectingSource)
	importRepo.AddJobLog(jobID, "info", fmt.Sprintf("Source detected: %s", sourceName))

	var rawResult *models.FacebookImportResult
	var extractionMethodUsed = method

	// Step 1: Method 1 (Meta Graph API if not forced browser and postID available)
	if req.PreferredMethod != models.ExtractionMethodOpenClawBrowser && postID != "" {
		importRepo.UpdateJobStatus(jobID, models.JobStateCheckingAPI)
		importRepo.AddJobLog(jobID, "info", "Checking authorized Meta API access...")

		graphResult, errCode, err := graphClient.ExtractPost(postID)
		if err == nil && graphResult != nil {
			rawResult = graphResult
			rawResult.Source.OriginalURL = rawURL
			rawResult.Source.CanonicalURL = canonicalURL
			rawResult.Source.SourceType = sourceType
			rawResult.Source.SourceName = sourceName
			extractionMethodUsed = models.ExtractionMethodMetaAPI
			importRepo.AddJobLog(jobID, "success", "Extracted content via Meta Graph API")
		} else {
			importRepo.AddJobLog(jobID, "warn", fmt.Sprintf("Meta API not available (%s). Continuing to OpenClaw browser fallback.", errCode))
		}
	}

	// Step 2: Method 2 (OpenClaw Live Browser fallback)
	if rawResult == nil {
		importRepo.UpdateJobStatus(jobID, models.JobStateOpeningBrowser)
		importRepo.AddJobLog(jobID, "info", "Opening authorized Facebook browser session...")

		browserResult, errCode, err := openClawClient.ExtractPost(canonicalURL, req.MaxImages)
		if err != nil {
			importRepo.SetJobError(jobID, errCode, err.Error())
			updatedJob, _ := importRepo.GetJob(jobID)
			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"success": false,
				"job":     updatedJob,
			})
		}

		rawResult = browserResult
		rawResult.Source.OriginalURL = rawURL
		rawResult.Source.CanonicalURL = canonicalURL
		rawResult.Source.SourceType = sourceType
		rawResult.Source.SourceName = sourceName
		if postID != "" && rawResult.Source.PostID == "" {
			rawResult.Source.PostID = postID
		}
		extractionMethodUsed = models.ExtractionMethodOpenClawBrowser
		importRepo.AddJobLog(jobID, "success", "Target post identified in browser")
	}

	// Step 3: Caption processing
	importRepo.UpdateJobStatus(jobID, models.JobStateExtractingCaption)
	if rawResult.Caption.Original != "" {
		importRepo.AddJobLog(jobID, "info", fmt.Sprintf("Caption extracted (%d characters)", len(rawResult.Caption.Original)))
	} else {
		importRepo.AddJobLog(jobID, "warn", "No caption text detected in target post")
	}

	// Step 4: Photo Downloading & Deduplication
	importRepo.UpdateJobStatus(jobID, models.JobStateDownloadingMedia)
	importRepo.AddJobLog(jobID, "info", fmt.Sprintf("%d photos detected in post container", len(rawResult.Images)))

	downloadedImages, dlErr := mediaDownloader.DownloadPostImages(jobID, rawResult.Images)
	if dlErr == nil && len(downloadedImages) > 0 {
		rawResult.Images = downloadedImages
		importRepo.AddJobLog(jobID, "success", fmt.Sprintf("%d photos downloaded & stored locally", len(downloadedImages)))
	} else {
		importRepo.AddJobLog(jobID, "warn", "Photos could not be downloaded locally; retaining source URLs")
	}

	// Step 5: AI Property Structuring
	importRepo.UpdateJobStatus(jobID, models.JobStateAnalyzing)
	importRepo.AddJobLog(jobID, "info", "Running AI property extraction on caption & media...")

	finalResult, aiErr := aiExtractor.ExtractPropertyDetails(rawResult.Caption.Original, rawResult.Images, &rawResult.Source)
	if aiErr == nil && finalResult != nil {
		finalResult.Source.ExtractionMethod = extractionMethodUsed
		rawResult = finalResult
		importRepo.AddJobLog(jobID, "success", "AI property analysis complete")
	}

	// Finalize Job
	importRepo.SetJobResult(jobID, rawResult)
	importRepo.AddJobLog(jobID, "success", "Ready for review")

	updatedJob, _ := importRepo.GetJob(jobID)
	return c.JSON(fiber.Map{
		"success": true,
		"job":     updatedJob,
		"result":  rawResult,
	})
}

// StartFacebookBrowser launches or focuses the persistent browser worker
func StartFacebookBrowser(c *fiber.Ctx) error {
	if err := openClawClient.LaunchBrowser(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}
	return c.JSON(fiber.Map{
		"success": true,
		"message": "OpenClaw browser initialized",
	})
}

// GetFacebookBrowserStatus returns the live status of the browser worker
func GetFacebookBrowserStatus(c *fiber.Ctx) error {
	status, err := openClawClient.GetBrowserStatus()
	if err != nil {
		return c.JSON(fiber.Map{
			"status":         "Disconnected",
			"worker_running": false,
			"session_state":  "DISCONNECTED",
		})
	}
	return c.JSON(fiber.Map{
		"status":         status.Status,
		"worker_running": status.WorkerRunning,
		"session_state":  status.SessionState,
		"lock_active":    status.LockActive,
	})
}

// ContinueFacebookBrowser resumes extraction after user manual login
func ContinueFacebookBrowser(c *fiber.Ctx) error {
	var req models.ExtractRequest
	_ = c.BodyParser(&req)
	return ExtractFacebookPost(c)
}

// AnalyzePropertyContent re-runs the AI analysis on caption and media
func AnalyzePropertyContent(c *fiber.Ctx) error {
	var req models.AnalyzeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	res, err := aiExtractor.ExtractPropertyDetails(req.Caption, req.Images, req.Source)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"result":  res,
	})
}

// SaveToPropertyInbox saves reviewed Facebook import data into EstateAutomate's Property structure
func SaveToPropertyInbox(c *fiber.Ctx) error {
	var req models.SaveToInboxRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	res := req.Result
	now := time.Now()
	todayStr := now.Format("060102")
	refCode := fmt.Sprintf("BH%s-%04d", todayStr, (now.UnixNano()%9000)+1000)

	projectName := "Bangkok Property"
	if res.Property.ProjectName != nil && *res.Property.ProjectName != "" {
		projectName = *res.Property.ProjectName
	}

	listingType := "RENT"
	if res.Property.ListingType != nil && *res.Property.ListingType != "" {
		listingType = *res.Property.ListingType
	}

	title := fmt.Sprintf("%s - %s", projectName, listingType)
	if res.Property.Bedrooms != nil {
		title = fmt.Sprintf("%s (%d Bed)", title, *res.Property.Bedrooms)
	}

	var rentPrice float64 = 0
	var salePrice float64 = 0
	if res.Property.Price != nil {
		if listingType == "SALE" {
			salePrice = *res.Property.Price
		} else {
			rentPrice = *res.Property.Price
		}
	}

	var originalImages []string
	for _, img := range res.Images {
		if img.StoredURL != "" {
			originalImages = append(originalImages, img.StoredURL)
		} else if img.SourceURL != "" {
			originalImages = append(originalImages, img.SourceURL)
		}
	}

	contactStr := ""
	if res.Contact.Phone != nil && *res.Contact.Phone != "" {
		contactStr += "Tel: " + *res.Contact.Phone + " "
	}
	if res.Contact.Line != nil && *res.Contact.Line != "" {
		contactStr += "Line: " + *res.Contact.Line
	}

	// Create Property record for frontend / database
	propertyRecord := fiber.Map{
		"id":             time.Now().UnixMilli(),
		"code":           refCode,
		"projectName":    projectName,
		"propertyType":   "CONDO",
		"listingType":    listingType,
		"title":          title,
		"description":    res.Caption.Original,
		"rentPrice":      rentPrice,
		"salePrice":      salePrice,
		"bedrooms":       res.Property.Bedrooms,
		"bathrooms":      res.Property.Bathrooms,
		"sizeSqm":        res.Property.SizeSqm,
		"floor":          res.Property.Floor,
		"btsMrt":         res.Property.NearestTransit,
		"contactInfo":    contactStr,
		"status":         "NEW",
		"sourceUrl":      res.Source.CanonicalURL,
		"sourceAuthor":   res.Source.SourceName,
		"originalImages": originalImages,
		"enhancedImages": originalImages,
		"finalImages":    originalImages,
		"createdAt":      "Just now",
	}

	// Persist to database if DB connected
	if database.DB != nil {
		importSource := models.ImportSource{
			FacebookURL:     res.Source.OriginalURL,
			NormalizedURL:   res.Source.CanonicalURL,
			FacebookPostID:  res.Source.PostID,
			SourceType:      res.Source.SourceType,
			SourceName:      res.Source.SourceName,
			OriginalContent: res.Caption.Original,
			ImportTimestamp: now,
			Provider:        res.Source.ExtractionMethod,
			ImportStatus:    models.ImportSuccess,
		}
		_ = database.DB.Create(&importSource)
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"property": propertyRecord,
		"message":  "Property successfully saved to Property Inbox",
	})
}

// GetFacebookImportJob returns the current status and logs for a job
func GetFacebookImportJob(c *fiber.Ctx) error {
	id := c.Params("id")
	job, exists := importRepo.GetJob(id)
	if !exists {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Job not found"})
	}
	return c.JSON(fiber.Map{
		"success": true,
		"job":     job,
	})
}

// UploadFacebookImportPhotos handles manual fallback photo uploads
func UploadFacebookImportPhotos(c *fiber.Ctx) error {
	form, err := c.MultipartForm()
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to parse multipart form"})
	}

	files := form.File["photos"]
	jobID := c.FormValue("job_id")
	if jobID == "" {
		jobID = fmt.Sprintf("MANUAL-%s", time.Now().Format("20060102-150405"))
	}

	var savedImages []models.ExtractedImage
	for idx, file := range files {
		f, err := file.Open()
		if err != nil {
			continue
		}
		bytes, err := io.ReadAll(f)
		f.Close()
		if err != nil {
			continue
		}

		img, err := mediaDownloader.SaveUploadedFile(jobID, idx+1, file.Filename, bytes)
		if err == nil && img != nil {
			savedImages = append(savedImages, *img)
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"job_id":  jobID,
		"images":  savedImages,
	})
}

// ProxyFacebookImage streams an image through the backend with permissive CORS for clipboard copy
func ProxyFacebookImage(c *fiber.Ctx) error {
	targetURL := c.Query("url")
	if strings.TrimSpace(targetURL) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "url parameter required"})
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(targetURL)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "Failed to fetch image"})
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read image"})
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}

	c.Set("Content-Type", contentType)
	c.Set("Access-Control-Allow-Origin", "*")
	c.Set("Cache-Control", "public, max-age=86400")
	return c.Send(bodyBytes)
}

type GenerateAICopyRequest struct {
	Provider     string `json:"provider"` // "google_ai" or "openai"
	TemplateID   string `json:"template_id"`
	TemplateName string `json:"template_name"`
	TemplateText string `json:"template_text"`
	RawContent   string `json:"raw_content"`
	CustomPrompt string `json:"custom_prompt"`
	APIKey       string `json:"api_key"`
	Model        string `json:"model"`
}

// GenerateAICopy modifies raw content using Google AI (Gemini) or OpenAI and the selected prompt template
func GenerateAICopy(c *fiber.Ctx) error {
	var req GenerateAICopyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request payload",
		})
	}

	if strings.TrimSpace(req.RawContent) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Raw content cannot be empty",
		})
	}

	prompt := req.TemplateText
	if strings.TrimSpace(req.CustomPrompt) != "" {
		if strings.TrimSpace(prompt) != "" {
			prompt = req.CustomPrompt + "\n\n" + prompt
		} else {
			prompt = req.CustomPrompt
		}
	}

	var generatedText string
	var err error
	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	if provider == "openai" {
		generatedText, err = googleAIService.GenerateContentWithOpenAI(prompt, req.RawContent, req.APIKey, req.Model)
	} else {
		provider = "google_ai"
		generatedText, err = googleAIService.GenerateContent(prompt, req.RawContent, req.APIKey, req.Model)
	}

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   fmt.Sprintf("Failed to generate AI copy: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"success":           true,
		"generated_content": generatedText,
		"template_name":     req.TemplateName,
		"provider":          provider,
	})
}

