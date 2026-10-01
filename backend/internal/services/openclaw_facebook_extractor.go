package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/utils"
)

type OpenClawFacebookExtractor struct {
	httpClient *http.Client
}

func NewOpenClawFacebookExtractor() *OpenClawFacebookExtractor {
	return &OpenClawFacebookExtractor{
		httpClient: &http.Client{Timeout: 90 * time.Second},
	}
}

type BrowserExtractRequest struct {
	URL       string `json:"url"`
	MaxImages int    `json:"max_images"`
	UserID    string `json:"user_id"`
}

type BrowserExtractResponse struct {
	Success       bool                   `json:"success"`
	CanonicalURL  string                 `json:"canonical_url"`
	SourceType    string                 `json:"source_type"`
	SourceName    string                 `json:"source_name"`
	PostID        string                 `json:"post_id"`
	CreatedTime   string                 `json:"created_time"`
	Caption       string                 `json:"caption"`
	Images        []models.ExtractedImage `json:"images"`
	SessionStatus string                 `json:"session_status"` // "CONNECTED", "LOGIN_REQUIRED", "ACCESS_RESTRICTED"
	ErrorCode     string                 `json:"error_code,omitempty"`
	ErrorMessage  string                 `json:"error_message,omitempty"`
}

type BrowserStatusResponse struct {
	Status        string `json:"status"`
	WorkerRunning bool   `json:"worker_running"`
	SessionState  string `json:"session_state"`
	LockActive    bool   `json:"lock_active"`
}

// GetBrowserStatus queries the OpenClaw browser-worker for its current status
func (e *OpenClawFacebookExtractor) GetBrowserStatus() (*BrowserStatusResponse, error) {
	workerURL := utils.GetBrowserWorkerURL()
	resp, err := e.httpClient.Get(workerURL + "/health")
	if err != nil {
		return nil, fmt.Errorf("browser worker unreachable: %w", err)
	}
	defer resp.Body.Close()

	var status BrowserStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}
	return &status, nil
}

// LaunchBrowser launches the persistent browser session
func (e *OpenClawFacebookExtractor) LaunchBrowser() error {
	workerURL := utils.GetBrowserWorkerURL()
	resp, err := e.httpClient.Post(workerURL+"/connect", "application/json", bytes.NewBuffer([]byte(`{"headless":false}`)))
	if err != nil {
		return fmt.Errorf("failed to launch browser: %w", err)
	}
	defer resp.Body.Close()
	return nil
}

// ExtractPost navigates to the post in the authorized OpenClaw browser session and extracts caption + carousel images
func (e *OpenClawFacebookExtractor) ExtractPost(targetURL string, maxImages int) (*models.FacebookImportResult, string, error) {
	if maxImages <= 0 {
		maxImages = 50
	}

	workerURL := utils.GetBrowserWorkerURL()

	reqPayload := BrowserExtractRequest{
		URL:       targetURL,
		MaxImages: maxImages,
		UserID:    "1",
	}

	payloadBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, models.ErrCodeExtractionFailed, err
	}

	// First try dedicated /facebook-post-extract endpoint
	resp, err := e.httpClient.Post(workerURL+"/facebook-post-extract", "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		// Fallback to sequential test-navigation + extract-post-text + extract-target-images if endpoint not yet loaded
		return e.fallbackSequentialExtract(targetURL, maxImages)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return e.fallbackSequentialExtract(targetURL, maxImages)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, models.ErrCodeExtractionFailed, err
	}

	var extractResp BrowserExtractResponse
	if err := json.Unmarshal(bodyBytes, &extractResp); err != nil {
		return nil, models.ErrCodeExtractionFailed, err
	}

	if !extractResp.Success {
		errCode := extractResp.ErrorCode
		if errCode == "" {
			errCode = models.ErrCodeExtractionFailed
		}
		return nil, errCode, fmt.Errorf("%s", extractResp.ErrorMessage)
	}

	result := &models.FacebookImportResult{
		Source: models.SourceDetails{
			Platform:         "facebook",
			OriginalURL:      targetURL,
			CanonicalURL:     extractResp.CanonicalURL,
			SourceType:       extractResp.SourceType,
			SourceName:       extractResp.SourceName,
			PostID:           extractResp.PostID,
			CreatedTime:      extractResp.CreatedTime,
			ExtractionMethod: models.ExtractionMethodOpenClawBrowser,
		},
		Caption: models.CaptionDetails{
			Original: extractResp.Caption,
			Cleaned:  extractResp.Caption,
		},
		Images: extractResp.Images,
	}

	return result, "", nil
}

// fallbackSequentialExtract uses the existing endpoints (/test-navigation, /extract-post-text, /extract-target-images)
func (e *OpenClawFacebookExtractor) fallbackSequentialExtract(targetURL string, maxImages int) (*models.FacebookImportResult, string, error) {
	workerURL := utils.GetBrowserWorkerURL()

	// 1. Navigate and verify post
	navPayload := map[string]any{"url": targetURL}
	navBytes, _ := json.Marshal(navPayload)
	navResp, err := e.httpClient.Post(workerURL+"/test-navigation", "application/json", bytes.NewBuffer(navBytes))
	if err != nil {
		return nil, models.ErrCodeBrowserTimeout, fmt.Errorf("failed to navigate in browser: %w", err)
	}
	defer navResp.Body.Close()

	var navData struct {
		Success       bool   `json:"success"`
		CurrentURL    string `json:"current_url"`
		SessionStatus string `json:"facebook_status"`
		ErrorCode     string `json:"error_code"`
		Message       string `json:"message"`
	}
	_ = json.NewDecoder(navResp.Body).Decode(&navData)

	if navData.SessionStatus == "LOGIN_REQUIRED" || navData.ErrorCode == "FACEBOOK_SESSION_REQUIRED" {
		return nil, models.ErrCodeLoginRequired, fmt.Errorf("Facebook login required in browser session")
	}

	// 2. Extract Caption
	textResp, err := e.httpClient.Post(workerURL+"/extract-post-text", "application/json", bytes.NewBuffer([]byte(`{}`)))
	captionText := ""
	if err == nil {
		defer textResp.Body.Close()
		var textData struct {
			Success bool   `json:"success"`
			Text    string `json:"text"`
		}
		if err := json.NewDecoder(textResp.Body).Decode(&textData); err == nil {
			captionText = textData.Text
		}
	}

	// 3. Extract Images
	imgPayload := map[string]any{
		"target_url": targetURL,
		"max_images": maxImages,
	}
	imgBytes, _ := json.Marshal(imgPayload)
	imgResp, err := e.httpClient.Post(workerURL+"/extract-target-images", "application/json", bytes.NewBuffer(imgBytes))

	var rawImages []models.ExtractedImage
	if err == nil {
		defer imgResp.Body.Close()
		var imgData struct {
			Success bool `json:"success"`
			Images  []struct {
				Index     int    `json:"index"`
				SourceURL string `json:"source_url"`
				Width     int    `json:"width"`
				Height    int    `json:"height"`
				MimeType  string `json:"mime_type"`
				SHA256    string `json:"sha256"`
			} `json:"images"`
		}
		if err := json.NewDecoder(imgResp.Body).Decode(&imgData); err == nil {
			for _, img := range imgData.Images {
				rawImages = append(rawImages, models.ExtractedImage{
					Index:     img.Index,
					SourceURL: img.SourceURL,
					Width:     img.Width,
					Height:    img.Height,
					MimeType:  img.MimeType,
					SHA256:    img.SHA256,
					Status:    "pending",
				})
			}
		}
	}

	canonicalURL := navData.CurrentURL
	if canonicalURL == "" {
		canonicalURL = targetURL
	}

	result := &models.FacebookImportResult{
		Source: models.SourceDetails{
			Platform:         "facebook",
			OriginalURL:      targetURL,
			CanonicalURL:     canonicalURL,
			ExtractionMethod: models.ExtractionMethodOpenClawBrowser,
		},
		Caption: models.CaptionDetails{
			Original: captionText,
			Cleaned:  captionText,
		},
		Images: rawImages,
	}

	return result, "", nil
}
