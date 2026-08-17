package facebook

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

type BrowserAgentProvider struct {
	ProfileDir string
	WorkerURL  string
}

func NewBrowserAgentProvider() *BrowserAgentProvider {
	profileDir := os.Getenv("BROWSER_PROFILES_DIR")
	if profileDir == "" {
		profileDir = "/data/browser-profiles"
	}
	workerURL := os.Getenv("BROWSER_WORKER_URL")
	if workerURL == "" {
		workerURL = "http://localhost:9223"
	}
	return &BrowserAgentProvider{
		ProfileDir: profileDir,
		WorkerURL:  workerURL,
	}
}

func (b *BrowserAgentProvider) GetProviderName() string {
	return "OPENCLAW_BROWSER_AGENT"
}

func (b *BrowserAgentProvider) CanHandle(ctx context.Context, rawURL string) bool {
	return strings.Contains(rawURL, "facebook.com") || strings.Contains(rawURL, "fb.com")
}

func (b *BrowserAgentProvider) HealthCheck(ctx context.Context) error {
	var session models.BrowserSession
	err := database.DB.Where("session_status = ?", models.SessionConnected).First(&session).Error
	if err != nil {
		return fmt.Errorf("RECONNECT_REQUIRED: No active persistent Facebook browser session found")
	}

	resp, err := http.Get(b.WorkerURL + "/health")
	if err != nil || resp.StatusCode != http.StatusOK {
		return fmt.Errorf("OPENCLAW_UNAVAILABLE: Browser worker worker server is unreachable")
	}
	defer resp.Body.Close()
	return nil
}

type ExtractPostResponse struct {
	Success   bool   `json:"success"`
	ErrorCode string `json:"error_code,omitempty"`
	Message   string `json:"message,omitempty"`
	Data      *struct {
		SourceURL            string   `json:"source_url"`
		NormalizedURL        string   `json:"normalized_url"`
		SourceName          string   `json:"source_name"`
		OriginalContent       string   `json:"original_content"`
		ExtractionConfidence float64  `json:"extraction_confidence"`
		Provider             string   `json:"provider"`
		ImageURLs            []string `json:"image_urls"`
	} `json:"data,omitempty"`
}

func (b *BrowserAgentProvider) ImportPost(ctx context.Context, rawURL string) (*ImportPostResult, error) {
	// 1. Health check: Verify persistent browser session is valid
	if err := b.HealthCheck(ctx); err != nil {
		return nil, err
	}

	payload := map[string]string{"url": rawURL}
	payloadBytes, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", b.WorkerURL+"/extract-post", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("EXTRACTION_FAILED: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OPENCLAW_WORKER_TIMEOUT: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	var extractRes ExtractPostResponse
	if err := json.Unmarshal(bodyBytes, &extractRes); err != nil {
		return nil, fmt.Errorf("INVALID_WORKER_RESPONSE: %v", err)
	}

	if !extractRes.Success {
		if extractRes.ErrorCode == "RECONNECT_REQUIRED" {
			database.DB.Model(&models.BrowserSession{}).Where("user_id = ?", 1).Update("session_status", models.SessionReconnectRequired)
			return nil, fmt.Errorf("RECONNECT_REQUIRED: %s", extractRes.Message)
		}
		if extractRes.ErrorCode == "TARGET_POST_NOT_CONFIRMED" {
			return nil, fmt.Errorf("TARGET_POST_NOT_CONFIRMED: %s", extractRes.Message)
		}
		return nil, fmt.Errorf("%s: %s", extractRes.ErrorCode, extractRes.Message)
	}

	now := time.Now()
	database.DB.Model(&models.BrowserSession{}).Where("user_id = ?", 1).Update("last_used_at", now)

	data := extractRes.Data
	if data == nil {
		return nil, fmt.Errorf("EMPTY_EXTRACT_DATA: Extraction returned null payload")
	}

	return &ImportPostResult{
		PostID:      fmt.Sprintf("fb_post_%d", now.Unix()),
		PageID:      "fb_target_group",
		SourceName:  data.SourceName,
		Message:     data.OriginalContent,
		CreatedTime: now,
		ImageURLs:   data.ImageURLs,
		Provider:    "OPENCLAW_BROWSER_AGENT",
	}, nil
}
