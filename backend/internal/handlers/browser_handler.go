package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/services"
)

// ListBrowserProfiles handles GET /api/browser/profiles
func ListBrowserProfiles(c *fiber.Ctx) error {
	svc := services.GetBrowserProfileService()
	profiles, err := svc.ListProfiles()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to list browser profiles: %v", err),
		})
	}
	return c.JSON(fiber.Map{
		"status":   "success",
		"profiles": profiles,
	})
}

// RegisterBrowserProfile handles POST /api/browser/profiles/register
func RegisterBrowserProfile(c *fiber.Ctx) error {
	var body struct {
		ProfileKey  string `json:"profile_key"`
		DisplayName string `json:"display_name"`
		Email       string `json:"email"`
	}
	if err := c.BodyParser(&body); err != nil || body.ProfileKey == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "profile_key and display_name are required",
		})
	}

	svc := services.GetBrowserProfileService()
	profile, err := svc.RegisterProfile(body.ProfileKey, body.DisplayName, body.Email)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to register profile: %v", err),
		})
	}
	return c.JSON(fiber.Map{
		"status":  "success",
		"profile": profile,
	})
}

// SyncBrowserProfiles handles POST /api/browser/profiles/sync
func SyncBrowserProfiles(c *fiber.Ctx) error {
	svc := services.GetBrowserProfileService()
	profiles, addedCount, err := svc.SyncDiscoveredProfiles()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to sync browser profiles: %v", err),
		})
	}
	return c.JSON(fiber.Map{
		"status":      "success",
		"added_count": addedCount,
		"profiles":    profiles,
	})
}

// OpenBrowserProfile handles POST /api/browser/profiles/:id/open
func OpenBrowserProfile(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid profile ID",
		})
	}

	svc := services.GetBrowserProfileService()
	profiles, err := svc.ListProfiles()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to locate profile",
		})
	}

	var targetKey string
	for _, p := range profiles {
		if p.ID == uint(id) {
			targetKey = p.ProfileKey
			break
		}
	}

	if targetKey == "" {
		targetKey = "Default"
	}

	if err := svc.LaunchOrFocusProfile(targetKey); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to launch/focus profile %s: %v", targetKey, err),
		})
	}
	return c.JSON(fiber.Map{
		"status":      "success",
		"message":     fmt.Sprintf("Chrome profile %s focused/launched", targetKey),
		"profile_key": targetKey,
	})
}

// OpenBrowserProfileURL handles POST /api/browser/profiles/:id/open-url
// Opens a specific URL in the correct external Chrome profile (not the web app browser).
func OpenBrowserProfileURL(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid profile ID",
		})
	}

	var body struct {
		URL string `json:"url"`
	}
	if err := c.BodyParser(&body); err != nil || body.URL == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Missing or invalid 'url' in request body",
		})
	}

	svc := services.GetBrowserProfileService()
	profiles, err := svc.ListProfiles()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to locate profile",
		})
	}

	var targetKey string
	for _, p := range profiles {
		if p.ID == uint(id) {
			targetKey = p.ProfileKey
			break
		}
	}
	if targetKey == "" {
		targetKey = "Default"
	}

	if err := svc.LaunchProfileWithURL(targetKey, body.URL); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to open URL in profile %s: %v", targetKey, err),
		})
	}
	return c.JSON(fiber.Map{
		"status":      "success",
		"message":     fmt.Sprintf("URL opened in Chrome profile %s", targetKey),
		"profile_key": targetKey,
		"url":         body.URL,
	})
}

// FocusBrowserTabGroup handles POST /api/browser/profiles/focus-group
// Focuses the chosen Chrome profile and activates its tab group.
func FocusBrowserTabGroup(c *fiber.Ctx) error {
	var body struct {
		ProfileID    uint     `json:"profile_id"`
		ProfileKey   string   `json:"profile_key"`
		GroupName    string   `json:"group_name"`
		TabID        string   `json:"tab_id"`
		URL          string   `json:"url"`
		GroupTabUrls []string `json:"group_tab_urls"`
	}
	_ = c.BodyParser(&body)

	targetKey := body.ProfileKey
	if targetKey == "" && body.ProfileID > 0 {
		svc := services.GetBrowserProfileService()
		if profiles, err := svc.ListProfiles(); err == nil {
			for _, p := range profiles {
				if p.ID == body.ProfileID {
					targetKey = p.ProfileKey
					break
				}
			}
		}
	}
	if targetKey == "" {
		targetKey = "Profile 14"
	}
	if body.GroupName == "" {
		body.GroupName = "Enhance IMG"
	}

	svc := services.GetBrowserProfileService()
	res, err := svc.FocusTabGroupViaCompanion(targetKey, body.GroupName, body.TabID, body.URL, body.GroupTabUrls)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":    "success",
		"message":   fmt.Sprintf("Profile %s and Tab Group %s focused", targetKey, body.GroupName),
		"companion": res,
	})
}

// GetBrowserTabGroups handles GET /api/browser/profiles/:id/groups
func GetBrowserTabGroups(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid profile ID",
		})
	}

	svc := services.GetBrowserProfileService()
	groups, err := svc.GetGroupsForProfile(uint(id))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to get tab groups: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"groups": groups,
	})
}

// ListProcessingLanes handles GET /api/browser/lanes
func ListProcessingLanes(c *fiber.Ctx) error {
	svc := services.GetBrowserProfileService()
	lanes, err := svc.ListLanes()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to list processing lanes: %v", err),
		})
	}
	return c.JSON(fiber.Map{
		"status": "success",
		"lanes":  lanes,
	})
}

// UpdateProcessingLane handles POST /api/browser/lanes
func UpdateProcessingLane(c *fiber.Ctx) error {
	var lane models.ProcessingLane
	if err := c.BodyParser(&lane); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid lane payload",
		})
	}

	svc := services.GetBrowserProfileService()
	if err := svc.UpdateLane(&lane); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to update lane: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"lane":   lane,
	})
}

// GetImageJobsQueue handles GET /api/browser/queue
func GetImageJobsQueue(c *fiber.Ctx) error {
	propertyID := c.Query("property_id")
	svc := services.GetSmartImageQueueService()
	jobs, err := svc.GetQueue(propertyID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to load queue: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"jobs":   jobs,
		"count":  len(jobs),
	})
}

// CreateBatchImageJobs handles POST /api/browser/queue/batch
func CreateBatchImageJobs(c *fiber.Ctx) error {
	var req services.BatchCreateJobRequest
	if err := c.BodyParser(&req); err != nil || len(req.Images) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "images array is required to create processing queue",
		})
	}

	svc := services.GetSmartImageQueueService()
	jobs, err := svc.CreateBatchJobs(req)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to create batch jobs: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"status":      "success",
		"jobs":        jobs,
		"total_count": len(jobs),
		"property_id": req.PropertyID,
	})
}

// StartImageQueue handles POST /api/browser/queue/start
func StartImageQueue(c *fiber.Ctx) error {
	var body struct {
		PropertyID string `json:"property_id"`
	}
	_ = c.BodyParser(&body)

	svc := services.GetSmartImageQueueService()
	activeJob, err := svc.StartQueue(body.PropertyID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to start queue: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"status":     "success",
		"active_job": activeJob,
	})
}

// GetImageJobDetails handles GET /api/browser/queue/:id
func GetImageJobDetails(c *fiber.Ctx) error {
	jobID := c.Params("id")
	svc := services.GetSmartImageQueueService()
	job, events, err := svc.GetJob(jobID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": "Job not found",
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"job":    job,
		"events": events,
	})
}

// PauseImageJob handles POST /api/browser/queue/:id/pause
func PauseImageJob(c *fiber.Ctx) error {
	jobID := c.Params("id")
	svc := services.GetSmartImageQueueService()
	if err := svc.PauseJob(jobID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{"status": "success", "message": "Job paused"})
}

// ResumeImageJob handles POST /api/browser/queue/:id/resume
func ResumeImageJob(c *fiber.Ctx) error {
	jobID := c.Params("id")
	svc := services.GetSmartImageQueueService()
	if err := svc.ResumeJob(jobID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{"status": "success", "message": "Job resumed"})
}

// RetryImageJob handles POST /api/browser/queue/:id/retry
func RetryImageJob(c *fiber.Ctx) error {
	jobID := c.Params("id")
	svc := services.GetSmartImageQueueService()
	if err := svc.RetryJob(jobID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{"status": "success", "message": "Job retry queued"})
}

// SkipImageJob handles POST /api/browser/queue/:id/skip
func SkipImageJob(c *fiber.Ctx) error {
	jobID := c.Params("id")
	svc := services.GetSmartImageQueueService()
	if err := svc.SkipJob(jobID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{"status": "success", "message": "Job skipped"})
}

// CancelImageJob handles POST /api/browser/queue/:id/cancel
func CancelImageJob(c *fiber.Ctx) error {
	jobID := c.Params("id")
	svc := services.GetSmartImageQueueService()
	if err := svc.CancelJob(jobID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{"status": "success", "message": "Job cancelled"})
}

// ProcessLocalImageJob handles POST /api/browser/queue/:id/process-local
func ProcessLocalImageJob(c *fiber.Ctx) error {
	jobID := c.Params("id")
	svc := services.GetSmartImageQueueService()
	if err := svc.ExecuteLocalJob(jobID); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Local image enhancement completed",
	})
}

// CompleteImageJobWithFile handles POST /api/browser/queue/:id/complete
func CompleteImageJobWithFile(c *fiber.Ctx) error {
	jobID := c.Params("id")
	var body struct {
		FilePath string `json:"file_path"`
		FileURL  string `json:"file_url"`
		Checksum string `json:"checksum"`
		Width    int    `json:"width"`
		Height   int    `json:"height"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "file_url and checksum are required",
		})
	}

	svc := services.GetSmartImageQueueService()
	if err := svc.CompleteJobWithFile(jobID, body.FilePath, body.FileURL, body.Checksum, body.Width, body.Height); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Job marked as completed with validated output",
	})
}

// PreviewResolvedPrompt handles POST /api/browser/prompt-preview
func PreviewResolvedPrompt(c *fiber.Ctx) error {
	var body struct {
		TemplateText     string                 `json:"template_text"`
		PropertyName     string                 `json:"property_name"`
		PropertyMetadata map[string]interface{} `json:"property_metadata"`
		ImagePosition    int                    `json:"image_position"`
		TotalImages      int                    `json:"total_images"`
		OutputWidth      int                    `json:"output_width"`
		OutputHeight     int                    `json:"output_height"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid preview payload",
		})
	}

	if body.ImagePosition <= 0 {
		body.ImagePosition = 1
	}
	if body.TotalImages <= 0 {
		body.TotalImages = 6
	}
	if body.OutputWidth <= 0 {
		body.OutputWidth = 1080
	}
	if body.OutputHeight <= 0 {
		body.OutputHeight = 1350
	}

	svc := services.GetSmartImageQueueService()
	preview := svc.ResolvePromptText(body.TemplateText, body.PropertyName, body.PropertyMetadata, body.ImagePosition, body.TotalImages, body.OutputWidth, body.OutputHeight)

	return c.JSON(fiber.Map{
		"status":          "success",
		"resolved_prompt": preview,
	})
}

// GetDownloadWatcherStatus handles GET /api/browser/download-watcher/status
func GetDownloadWatcherStatus(c *fiber.Ctx) error {
	mgr := services.GetSmartDownloadManager()
	status := mgr.GetStatus()
	return c.JSON(fiber.Map{
		"status": "success",
		"data":   status,
	})
}

// UpdateDownloadWatcherSettings handles POST /api/browser/download-watcher/settings
func UpdateDownloadWatcherSettings(c *fiber.Ctx) error {
	var body struct {
		WatchDirectory   string `json:"watch_directory"`
		AutoAdvanceQueue bool   `json:"auto_advance_queue"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid settings payload",
		})
	}

	mgr := services.GetSmartDownloadManager()
	if err := mgr.UpdateSettings(body.WatchDirectory, body.AutoAdvanceQueue); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Download watcher settings updated",
	})
}

// CompanionSync handles POST /api/browser/companion/sync
func CompanionSync(c *fiber.Ctx) error {
	var body struct {
		ProfileKey     string `json:"profile_key"`
		TabGroup       string `json:"tab_group"`
		ActiveTab      string `json:"active_tab"`
		DownloadedFile string `json:"downloaded_file"`
	}
	_ = c.BodyParser(&body)

	return c.JSON(fiber.Map{
		"status":    "success",
		"message":   "Companion state synchronized",
		"synced_at": c.Context().Time(),
	})
}

// StartAutomation handles POST /api/browser/automation/start
// Accepts: property_id, profile_key, tab_ids ([]int — Chrome tab IDs from the extension)
// Fetches pending queue jobs, then calls the companion service to kick off the extension worker.
func StartAutomation(c *fiber.Ctx) error {
	var body struct {
		PropertyID string `json:"property_id"`
		ProfileKey string `json:"profile_key"`
		TabIDs     []int  `json:"tab_ids"`
	}
	if err := c.BodyParser(&body); err != nil || body.PropertyID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "property_id is required",
		})
	}

	// Load all pending jobs for this property
	queueSvc := services.GetSmartImageQueueService()
	jobs, err := queueSvc.GetQueue(body.PropertyID)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to load queue: %v", err),
		})
	}

	pendingJobs := make([]models.ImageProcessingJob, 0, len(jobs))
	for _, j := range jobs {
		if j.Status == models.ImgJobStatusPending || j.Status == models.ImgJobStatusReadyForUser {
			pendingJobs = append(pendingJobs, j)
		}
	}

	if len(pendingJobs) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "No pending or ready jobs found for this property",
		})
	}

	// Call the companion service which queues a START_AUTOMATION command for the extension
	browserSvc := services.GetBrowserProfileService()
	result, err := browserSvc.StartAutomationViaCompanion(body.ProfileKey, body.PropertyID, body.TabIDs, pendingJobs)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to start automation: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"status":      "success",
		"message":     fmt.Sprintf("Automation started: %d jobs queued", len(pendingJobs)),
		"job_count":   len(pendingJobs),
		"property_id": body.PropertyID,
		"companion":   result,
	})
}

// StopAutomation handles POST /api/browser/automation/stop
func StopAutomation(c *fiber.Ctx) error {
	browserSvc := services.GetBrowserProfileService()
	_ = browserSvc.StopAutomationViaCompanion()
	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Stop automation command sent",
	})
}

// GetAutomationStatus handles GET /api/browser/automation/status
func GetAutomationStatus(c *fiber.Ctx) error {
	browserSvc := services.GetBrowserProfileService()
	status, err := browserSvc.GetAutomationStatus()
	if err != nil {
		return c.JSON(fiber.Map{
			"status":     "unavailable",
			"automation": nil,
		})
	}
	return c.JSON(fiber.Map{
		"status":     "success",
		"automation": status,
	})
}

// CompleteJobFromTab handles POST /api/browser/jobs/:jobId/complete-from-tab
// Called by the Chrome extension content script when a tab finishes generating.
func CompleteJobFromTab(c *fiber.Ctx) error {
	jobID := c.Params("jobId")
	var body struct {
		ResultURL     string `json:"result_url"`
		CompletedVia  string `json:"completed_via"`
	}
	_ = c.BodyParser(&body)

	svc := services.GetSmartImageQueueService()
	if err := svc.CompleteJobWithFile(jobID, body.ResultURL, body.ResultURL, "", 0, 0); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Failed to complete job %s: %v", jobID, err),
		})
	}

	// Advance queue to next job
	if job, _, err := svc.GetJob(jobID); err == nil && job != nil {
		_, _ = svc.AdvanceToNextJob(job.PropertyID)
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"job_id":  jobID,
		"message": "Job marked complete from tab automation",
	})
}
