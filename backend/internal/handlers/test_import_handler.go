package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/storage"
	"github.com/zinwaishine/estate-automate/backend/internal/utils"
)

type TestImportRequest struct {
	URL string `json:"url"`
}

type OpenClawDebugMetrics struct {
	CandidatePostCount       int      `json:"candidate_post_count"`
	TextNodesInspected       int      `json:"text_nodes_inspected"`
	TextNodesAccepted        int      `json:"text_nodes_accepted"`
	TextNodesRejected        int      `json:"text_nodes_rejected"`
	ImageCandidatesInspected int      `json:"image_candidates_inspected"`
	ImagesAccepted           int      `json:"images_accepted"`
	ImagesRejected           int      `json:"images_rejected"`
	RejectionReasons         []string `json:"rejection_reasons"`
}

type OpenClawTestExtractResponse struct {
	Success             bool                 `json:"success"`
	TestRunID           string               `json:"test_run_id"`
	Status              string               `json:"status"`
	ErrorCode           string               `json:"error_code,omitempty"`
	Message             string               `json:"message,omitempty"`
	DebugScreenshotPath string               `json:"debug_screenshot_path,omitempty"`
	RawDOMSnippet       string               `json:"raw_dom_snippet,omitempty"`
	ExecutionDurationMs int64                `json:"execution_duration_ms"`
	DebugMetrics        OpenClawDebugMetrics `json:"debug_metrics"`
	Navigation          struct {
		OriginalURL   string `json:"original_url"`
		NormalizedURL string `json:"normalized_url"`
		FinalURL      string `json:"final_url"`
		SessionStatus string `json:"session_status"`
	} `json:"navigation"`
	Detection struct {
		TargetPostFound bool    `json:"target_post_found"`
		TargetPostID    string  `json:"target_post_id"`
		TargetPostURL   string  `json:"target_post_url"`
		TargetAuthor    string  `json:"target_author"`
		Confidence      float64 `json:"confidence"`
		Reason          string  `json:"reason"`
		DetectionMethod string  `json:"detection_method"`
	} `json:"detection"`
	Content struct {
		OriginalContent string `json:"original_content"`
		ContentLength   int    `json:"content_length"`
	} `json:"content"`
	Media struct {
		ImagesDetectedCount int      `json:"images_detected_count"`
		ImageURLs           []string `json:"image_urls"`
	} `json:"media"`
}

// ExecuteTestImport handles POST /api/testing/import
func ExecuteTestImport(c *fiber.Ctx) error {
	var req TestImportRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.URL) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":     "error",
			"error_code": "FACEBOOK_URL_INVALID",
			"message":    "Valid Facebook URL is required for test import",
		})
	}

	normalizedURL, err := utils.NormalizeFacebookURL(req.URL)
	if err != nil {
		normalizedURL = req.URL
	}

	// Call OpenClaw Browser Worker endpoint: http://localhost:9223/test-extract-post
	workerURL := "http://localhost:9223/test-extract-post"
	payloadBytes, _ := json.Marshal(map[string]string{"url": req.URL})

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Post(workerURL, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
			"status":     "error",
			"error_code": "FACEBOOK_PAGE_LOAD_FAILED",
			"message":    fmt.Sprintf("OpenClaw browser worker connection failed: %v", err),
		})
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":     "error",
			"error_code": "EXTRACTION_READ_FAILED",
			"message":    "Failed to read OpenClaw worker response",
		})
	}

	var workerData OpenClawTestExtractResponse
	if err := json.Unmarshal(bodyBytes, &workerData); err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":     "error",
			"error_code": "INVALID_WORKER_JSON",
			"message":    "Failed to parse OpenClaw JSON payload",
		})
	}

	testRunID := workerData.TestRunID
	if testRunID == "" {
		dateStr := time.Now().Format("20060102")
		testRunID = fmt.Sprintf("TEST-%s-%d", dateStr, time.Now().UnixNano()%9000+1000)
	}

	now := time.Now()

	// Create GORM TestImportRun DB Record
	runRecord := models.TestImportRun{
		TestRunID:           testRunID,
		FacebookURL:         req.URL,
		NormalizedURL:       normalizedURL,
		FinalURL:            workerData.Navigation.FinalURL,
		SessionStatus:       workerData.Navigation.SessionStatus,
		TargetPostFound:     workerData.Detection.TargetPostFound,
		TargetPostID:        workerData.Detection.TargetPostID,
		TargetPostURL:       workerData.Detection.TargetPostURL,
		TargetAuthor:        workerData.Detection.TargetAuthor,
		DetectionMethod:     workerData.Detection.DetectionMethod,
		Confidence:          workerData.Detection.Confidence,
		DetectionReason:     workerData.Detection.Reason,
		ExtractedContent:    workerData.Content.OriginalContent,
		ContentLength:       len(workerData.Content.OriginalContent),
		ImageCount:          workerData.Media.ImagesDetectedCount,
		Status:              models.TestRunStatus(workerData.Status),
		ErrorCode:           workerData.ErrorCode,
		ErrorMessage:        workerData.Message,
		DebugScreenshotPath: workerData.DebugScreenshotPath,
		RawDOMSnapshot:      workerData.RawDOMSnippet,
		ExecutionDurationMs: workerData.ExecutionDurationMs,
		CreatedAt:           now,
	}

	if !workerData.Success {
		runRecord.CompletedAt = &now
		database.DB.Create(&runRecord)
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":        "failed",
			"test_run_id":   testRunID,
			"error_code":    workerData.ErrorCode,
			"message":       workerData.Message,
			"test_run":      runRecord,
			"debug_metrics": workerData.DebugMetrics,
		})
	}

	// Download & Validate Original Images Strictly to test-imports/{test_run_id}/source/
	storageProv := storage.NewStorageProvider()
	downloadedCount := 0
	validatedCount := 0

	var testImages []models.TestImportImage

	for i, imgURL := range workerData.Media.ImageURLs {
		if err := utils.ValidateMediaURL(imgURL); err != nil {
			continue
		}

		imgResp, err := client.Get(imgURL)
		if err != nil || imgResp.StatusCode != http.StatusOK {
			continue
		}

		contentType := imgResp.Header.Get("Content-Type")
		if !strings.HasPrefix(contentType, "image/") && !strings.Contains(imgURL, "fbcdn") && !strings.Contains(imgURL, "scontent") {
			imgResp.Body.Close()
			continue // Reject HTML or login pages
		}

		imgBytes, err := io.ReadAll(imgResp.Body)
		imgResp.Body.Close()
		if err != nil || len(imgBytes) < 5000 {
			continue // Reject images smaller than 5KB (icons, tracking pixels)
		}

		downloadedCount++

		// Decode image config for dimensions & MIME validation
		imgConfig, _, decodeErr := image.DecodeConfig(bytes.NewReader(imgBytes))
		width := imgConfig.Width
		height := imgConfig.Height
		if decodeErr == nil && (width < 120 || height < 120) {
			continue // Reject small thumbnails
		}

		checksum := utils.CalculateSHA256(imgBytes)
		validatedCount++

		storageKey := fmt.Sprintf("test-imports/%s/source/img_%d.jpg", testRunID, i+1)
		reader := bytes.NewReader(imgBytes)

		publicURL, err := storageProv.UploadMedia(c.Context(), storageKey, reader, "image/jpeg", int64(len(imgBytes)))
		if err != nil {
			publicURL = fmt.Sprintf("/uploads/%s", storageKey)
		}

		testImg := models.TestImportImage{
			TestRunID:       testRunID,
			TargetPostID:    workerData.Detection.TargetPostID,
			OriginalOrder:   i + 1,
			SourceReference: imgURL,
			StorageKey:      storageKey,
			PublicURL:       publicURL,
			MimeType:        "image/jpeg",
			FileSize:        int64(len(imgBytes)),
			Width:           width,
			Height:          height,
			Checksum:        checksum,
			DownloadStatus:  "SUCCESS",
			CreatedAt:       time.Now(),
		}
		database.DB.Create(&testImg)
		testImages = append(testImages, testImg)
	}

	completedTime := time.Now()
	runRecord.ImagesDownloadedCount = downloadedCount
	runRecord.ImagesValidatedCount = validatedCount
	runRecord.Status = models.TestStatusSuccess
	runRecord.CompletedAt = &completedTime
	database.DB.Create(&runRecord)

	runRecord.Images = testImages

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":        "success",
		"test_run_id":   testRunID,
		"message":       "Test import pipeline executed successfully",
		"test_run":      runRecord,
		"debug_metrics": workerData.DebugMetrics,
	})
}

// GetTestRun handles GET /api/testing/runs/:id
func GetTestRun(c *fiber.Ctx) error {
	testRunID := c.Params("id")
	var run models.TestImportRun
	if err := database.DB.Preload("Images").Where("test_run_id = ?", testRunID).First(&run).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": "Test run not found",
		})
	}
	return c.JSON(fiber.Map{"status": "success", "test_run": run})
}

// DeleteTestRun handles DELETE /api/testing/runs/:id
func DeleteTestRun(c *fiber.Ctx) error {
	testRunID := c.Params("id")

	database.DB.Where("test_run_id = ?", testRunID).Delete(&models.TestImportImage{})
	database.DB.Where("test_run_id = ?", testRunID).Delete(&models.TestImportRun{})

	dirPath := fmt.Sprintf("./storage/uploads/test-imports/%s", testRunID)
	_ = os.RemoveAll(dirPath)

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": fmt.Sprintf("Test run %s cleared successfully", testRunID),
	})
}

// GetLiveBrowserScreenshot handles GET /api/testing/live-browser
func GetLiveBrowserScreenshot(c *fiber.Ctx) error {
	resp, err := http.Get("http://localhost:9223/live-screenshot")
	if err != nil {
		return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{
			"status":  "error",
			"message": "OpenClaw browser worker is offline",
		})
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to read screenshot from worker",
		})
	}

	return c.Status(resp.StatusCode).Send(body)
}
