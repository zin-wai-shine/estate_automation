package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

const (
	DefaultMetaAppID       = "967687235797751"
	DefaultFacebookPageID  = "1287202894475973"
	DefaultFacebookPageURL = "https://www.facebook.com/profile.php?id=1287202894475973"
	DefaultGraphAPIVersion = "v26.0"
	MetaGraphBaseURL       = "https://graph.facebook.com"
)

// Required Meta permissions according to specification
var RequiredMetaPermissions = []string{
	"pages_show_list",
	"pages_read_engagement",
	"pages_manage_posts",
}

type FacebookConnectionStatusResponse struct {
	Connected        bool      `json:"connected"`
	Status           string    `json:"status"` // CONNECTED, EXPIRED, ERROR, UNCONFIGURED
	PageID           string    `json:"page_id"`
	PageName         string    `json:"page_name"`
	PageURL          string    `json:"page_url"`
	GraphAPIVersion  string    `json:"graph_api_version"`
	Permissions      []string  `json:"permissions"`
	CanCreateContent bool      `json:"can_create_content"`
	ErrorMessage     string    `json:"error_message,omitempty"`
	CheckedAt        time.Time `json:"checked_at"`
}

type PublishPostRequest struct {
	PageID      string     `json:"page_id"`
	Headline    string     `json:"headline"`
	Caption     string     `json:"caption"`
	Hashtags    string     `json:"hashtags"`
	ImageURLs   []string   `json:"image_urls"`
	ScheduledAt *time.Time `json:"scheduled_at,omitempty"`

	// ExistingPostID reuses an existing DB record (scheduled/retry) instead of creating a new one.
	ExistingPostID uint `json:"-"`
}

// composeCaption builds the final message: headline + caption + hashtags (each only once).
func composeCaption(headline, caption, hashtags string) string {
	full := strings.TrimSpace(caption)
	headline = strings.TrimSpace(headline)
	hashtags = strings.TrimSpace(hashtags)
	if headline != "" && !strings.Contains(full, headline) {
		if full == "" {
			full = headline
		} else {
			full = fmt.Sprintf("%s\n\n%s", headline, full)
		}
	}
	if hashtags != "" && !strings.Contains(full, hashtags) {
		if full == "" {
			full = hashtags
		} else {
			full = fmt.Sprintf("%s\n\n%s", full, hashtags)
		}
	}
	return full
}

type PublishPostResponse struct {
	ID             uint      `json:"id"`
	FacebookPostID string    `json:"facebook_post_id"`
	PermalinkURL   string    `json:"permalink_url"`
	Status         string    `json:"status"`
	PageID         string    `json:"page_id"`
	PageSlot       int       `json:"page_slot"`
	PageName       string    `json:"page_name"`
	ImageCount     int       `json:"image_count"`
	IsDuplicate    bool      `json:"is_duplicate,omitempty"`
	PublishedAt    time.Time `json:"published_at"`
}

type FacebookPublishService struct {
	httpClient *http.Client
	mu         sync.RWMutex
}

var (
	publishServiceInstance *FacebookPublishService
	publishServiceOnce     sync.Once
)

func GetFacebookPublishService() *FacebookPublishService {
	publishServiceOnce.Do(func() {
		publishServiceInstance = &FacebookPublishService{
			httpClient: &http.Client{
				Timeout: 45 * time.Second,
			},
		}
	})
	return publishServiceInstance
}

// GetConfig returns the active Meta configuration parameters
func (s *FacebookPublishService) GetConfig() (appID, pageID, version, baseURL, pageURL string) {
	appID = GetSystemSetting("META_APP_ID")
	if appID == "" {
		appID = os.Getenv("META_APP_ID")
	}
	if appID == "" {
		appID = DefaultMetaAppID
	}

	pageID = os.Getenv("FACEBOOK_PAGE_ID")
	if pageID == "" {
		pageID = DefaultFacebookPageID
	}

	version = os.Getenv("META_GRAPH_API_VERSION")
	if version == "" {
		version = os.Getenv("META_GRAPH_VERSION")
	}
	if version == "" {
		version = DefaultGraphAPIVersion
	}
	if !strings.HasPrefix(version, "v") {
		version = "v" + version
	}

	baseURL = MetaGraphBaseURL
	pageURL = fmt.Sprintf("https://www.facebook.com/profile.php?id=%s", pageID)
	return
}

// GetPageAccessToken returns the default (Page 1) Facebook Page Access Token safely.
// Used by the legacy single-page status endpoints only; publishing uses TokenForPage.
func (s *FacebookPublishService) GetPageAccessToken() string {
	_, pageID, _, _, _ := s.GetConfig()
	if database.DB != nil {
		if token, _, err := GetFacebookPageManager().TokenForPage(pageID); err == nil && token != "" {
			return token
		}
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	token := os.Getenv("FACEBOOK_PAGE_ACCESS_TOKEN")
	if token != "" && !strings.Contains(token, "REPLACE_WITH_") {
		return strings.TrimSpace(token)
	}

	// Secondary fallback to legacy database table if configured
	if database.DB != nil {
		var fbPage models.FacebookPage
		if err := database.DB.Where("page_id = ? AND is_connected = ?", pageID, true).First(&fbPage).Error; err == nil {
			if fbPage.PageAccessToken != "" {
				return fbPage.PageAccessToken
			}
		}
	}

	return ""
}

// SetPageAccessToken updates the default (Page 1) token via the encrypted page manager.
func (s *FacebookPublishService) SetPageAccessToken(newToken string) error {
	cleanToken := strings.TrimSpace(newToken)
	if cleanToken == "" {
		return fmt.Errorf("token cannot be empty")
	}

	_, pageID, _, _, _ := s.GetConfig()
	if database.DB != nil {
		if _, err := GetFacebookPageManager().SetPageToken(context.Background(), pageID, cleanToken); err != nil {
			return err
		}
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	_ = os.Setenv("FACEBOOK_PAGE_ACCESS_TOKEN", cleanToken)
	return nil
}

// ValidateAndGetConnectionStatus checks Page Access Token, verifies permissions and CREATE_CONTENT access
func (s *FacebookPublishService) ValidateAndGetConnectionStatus(ctx context.Context) (*FacebookConnectionStatusResponse, error) {
	_, pageID, version, baseURL, pageURL := s.GetConfig()
	token := s.GetPageAccessToken()

	now := time.Now()
	res := &FacebookConnectionStatusResponse{
		Connected:        false,
		Status:           "UNCONFIGURED",
		PageID:           pageID,
		PageName:         "Facebook Business Page",
		PageURL:          pageURL,
		GraphAPIVersion:  version,
		Permissions:      []string{},
		CanCreateContent: false,
		CheckedAt:        now,
	}

	if token == "" {
		res.ErrorMessage = "FACEBOOK_PAGE_ACCESS_TOKEN is not configured in environment or database."
		return res, nil
	}

	// 1. Fetch Page Details via Graph API
	// GET https://graph.facebook.com/v26.0/{page-id}?fields=id,name,link,is_published
	pageAPIURL := fmt.Sprintf("%s/%s/%s?fields=id,name,link,is_published&access_token=%s",
		baseURL, version, pageID, url.QueryEscape(token))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pageAPIURL, nil)
	if err != nil {
		res.Status = "ERROR"
		res.ErrorMessage = fmt.Sprintf("Failed to build request: %v", err)
		return res, nil
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		res.Status = "ERROR"
		res.ErrorMessage = fmt.Sprintf("Network error connecting to Meta Graph API: %v", err)
		return res, nil
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		res.Status = "ERROR"
		res.ErrorMessage = fmt.Sprintf("Failed to read response from Meta Graph API: %v", err)
		return res, nil
	}

	var graphResponse struct {
		ID          string   `json:"id"`
		Name        string   `json:"name"`
		Link        string   `json:"link"`
		IsPublished bool     `json:"is_published"`
		Tasks       []string `json:"tasks"`
		Perms       []string `json:"perms"`
		Error       *struct {
			Message      string `json:"message"`
			Type         string `json:"type"`
			Code         int    `json:"code"`
			ErrorSubcode int    `json:"error_subcode"`
			FBTraceID    string `json:"fbtrace_id"`
		} `json:"error,omitempty"`
	}

	if err := json.Unmarshal(bodyBytes, &graphResponse); err != nil {
		res.Status = "ERROR"
		res.ErrorMessage = fmt.Sprintf("Failed to parse Meta Graph API response: %v", err)
		return res, nil
	}

	if graphResponse.Error != nil {
		code := graphResponse.Error.Code
		subcode := graphResponse.Error.ErrorSubcode
		// Token expiration / revocation codes in Meta Graph API
		if code == 190 || subcode == 463 || subcode == 467 || subcode == 490 {
			res.Status = "EXPIRED"
			res.ErrorMessage = fmt.Sprintf("Page Access Token has expired or was revoked (Code: %d, Subcode: %d). Please generate and update a new token.", code, subcode)
		} else {
			res.Status = "ERROR"
			res.ErrorMessage = fmt.Sprintf("Meta Graph API error (Code: %d): %s", code, graphResponse.Error.Message)
		}
		return res, nil
	}

	if graphResponse.Name != "" {
		res.PageName = graphResponse.Name
	}
	if graphResponse.Link != "" {
		res.PageURL = graphResponse.Link
	}

	// 2. Verify CREATE_CONTENT access from tasks
	canCreateContent := false
	for _, task := range graphResponse.Tasks {
		upper := strings.ToUpper(task)
		if upper == "CREATE_CONTENT" || upper == "MANAGE" || upper == "MODERATE" || upper == "POST" || upper == "ADVERTISE" {
			canCreateContent = true
			break
		}
	}
	// In some token types, permissions are in Perms
	for _, perm := range graphResponse.Perms {
		upper := strings.ToUpper(perm)
		if upper == "CREATE_CONTENT" || upper == "ADMINISTER" || upper == "EDIT_PAGE" {
			canCreateContent = true
			break
		}
	}
	// If the page was successfully retrieved with the token, default to true unless explicitly restricted
	if len(graphResponse.Tasks) == 0 && len(graphResponse.Perms) == 0 && graphResponse.ID == pageID {
		canCreateContent = true
	}
	res.CanCreateContent = canCreateContent

	// 3. Verify Required Permissions via /me/permissions
	// GET https://graph.facebook.com/v26.0/me/permissions?access_token={token}
	permsAPIURL := fmt.Sprintf("%s/%s/me/permissions?access_token=%s", baseURL, version, url.QueryEscape(token))
	permsReq, err := http.NewRequestWithContext(ctx, http.MethodGet, permsAPIURL, nil)
	if err == nil {
		permsResp, err := s.httpClient.Do(permsReq)
		if err == nil {
			defer permsResp.Body.Close()
			permsBytes, _ := io.ReadAll(permsResp.Body)
			var permsData struct {
				Data []struct {
					Permission string `json:"permission"`
					Status     string `json:"status"`
				} `json:"data"`
			}
			if err := json.Unmarshal(permsBytes, &permsData); err == nil {
				for _, p := range permsData.Data {
					if strings.ToLower(p.Status) == "granted" {
						res.Permissions = append(res.Permissions, p.Permission)
					}
				}
			}
		}
	}

	// If permissions list empty, populate with available tasks or the required defaults if authenticated
	if len(res.Permissions) == 0 {
		res.Permissions = append(res.Permissions, RequiredMetaPermissions...)
	}

	res.Connected = true
	res.Status = "CONNECTED"
	return res, nil
}

// sanitizeMetaString strips sensitive access tokens and query credentials from logged URLs and responses.
func sanitizeMetaString(s string) string {
	re := regexp.MustCompile(`(?i)(access_token|fb_exchange_token|client_secret)=([a-zA-Z0-9_\-]+)`)
	return re.ReplaceAllString(s, "$1=[REDACTED]")
}

// isPermanentMetaError identifies permanent authentication, authorization, and parameter errors that should NOT be retried.
func isPermanentMetaError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	if strings.Contains(msg, "(190)") || strings.Contains(msg, " 190:") ||
		strings.Contains(msg, "(200)") || strings.Contains(msg, " 200:") ||
		strings.Contains(msg, "(100)") || strings.Contains(msg, " 100:") ||
		strings.Contains(msg, "(10)") || strings.Contains(msg, " 10:") ||
		strings.Contains(msg, "OAuthException") ||
		strings.Contains(msg, "Unpublished posts must be posted to a page as the page itself") ||
		strings.Contains(msg, "Token identity mismatch") {
		return true
	}
	return false
}

// UploadUnpublishedPhoto uploads a single image with published=false to obtain a Meta media_fbid.
// Permanent errors (such as #190 and #200) are never retried; temporary network errors are retried with backoff.
func (s *FacebookPublishService) UploadUnpublishedPhoto(ctx context.Context, pageID, pageToken, imageURL string) (string, error) {
	_, _, version, baseURL, _ := s.GetConfig()
	uploadURL := fmt.Sprintf("%s/%s/%s/photos", baseURL, version, pageID)

	maxRetries := 3
	var lastErr error

	for attempt := 1; attempt <= maxRetries; attempt++ {
		photoID, err := s.doUploadPhotoRequest(ctx, uploadURL, pageID, pageToken, imageURL)
		if err == nil && photoID != "" {
			return photoID, nil
		}
		lastErr = err

		// Stop retrying permanent authentication or permission errors such as #190 and #200
		if isPermanentMetaError(err) {
			log.Printf("[FB Publish] Permanent error on photo upload for Page %s (attempt %d/%d) — aborting retries: %v",
				pageID, attempt, maxRetries, sanitizeMetaString(err.Error()))
			return "", err
		}

		log.Printf("[FB Publish] Temporary error on photo upload for Page %s (attempt %d/%d): %v. Retrying...",
			pageID, attempt, maxRetries, sanitizeMetaString(err.Error()))

		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(time.Duration(attempt) * 1200 * time.Millisecond):
		}
	}

	return "", fmt.Errorf("failed to upload photo after %d retries: %w", maxRetries, lastErr)
}

func (s *FacebookPublishService) doUploadPhotoRequest(ctx context.Context, uploadURL, pageID, pageToken, imageURL string) (string, error) {
	var req *http.Request
	var err error

	// 1. Check if imageURL is a Base64 data URI
	if strings.HasPrefix(imageURL, "data:image/") {
		parts := strings.SplitN(imageURL, ",", 2)
		if len(parts) != 2 {
			return "", fmt.Errorf("invalid base64 image data")
		}
		rawBytes, decErr := base64.StdEncoding.DecodeString(parts[1])
		if decErr != nil {
			return "", fmt.Errorf("failed to decode base64 image: %w", decErr)
		}

		bodyBuf := &bytes.Buffer{}
		writer := multipart.NewWriter(bodyBuf)
		_ = writer.WriteField("access_token", pageToken)
		_ = writer.WriteField("published", "false")

		part, pErr := writer.CreateFormFile("source", "photo.jpg")
		if pErr != nil {
			return "", pErr
		}
		if _, wErr := part.Write(rawBytes); wErr != nil {
			return "", wErr
		}
		writer.Close()

		req, err = http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, bodyBuf)
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", writer.FormDataContentType())
	} else if strings.HasPrefix(imageURL, "/storage/") || strings.Contains(imageURL, "localhost:8085/storage/") {
		// Local file on server: upload file contents directly via multipart 'source'
		localPath := imageURL
		if idx := strings.Index(localPath, "/storage/"); idx != -1 {
			localPath = "." + localPath[idx:]
		}
		fileBytes, fErr := os.ReadFile(localPath)
		if fErr == nil && len(fileBytes) > 0 {
			bodyBuf := &bytes.Buffer{}
			writer := multipart.NewWriter(bodyBuf)
			_ = writer.WriteField("access_token", pageToken)
			_ = writer.WriteField("published", "false")

			part, pErr := writer.CreateFormFile("source", "photo.jpg")
			if pErr != nil {
				return "", pErr
			}
			if _, wErr := part.Write(fileBytes); wErr != nil {
				return "", wErr
			}
			writer.Close()

			req, err = http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, bodyBuf)
			if err != nil {
				return "", err
			}
			req.Header.Set("Content-Type", writer.FormDataContentType())
		} else {
			// Fallback to URL parameter
			form := url.Values{}
			form.Set("access_token", pageToken)
			form.Set("published", "false")
			form.Set("url", imageURL)
			req, err = http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, strings.NewReader(form.Encode()))
			if err != nil {
				return "", err
			}
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}
	} else {
		// Standard HTTP/HTTPS image URL upload
		form := url.Values{}
		form.Set("access_token", pageToken)
		form.Set("published", "false")
		form.Set("url", imageURL)

		req, err = http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, strings.NewReader(form.Encode()))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("network error during photo upload: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read photo upload response: %w", err)
	}

	var photoResp struct {
		ID    string `json:"id"`
		Error *struct {
			Message string `json:"message"`
			Code    int    `json:"code"`
			Type    string `json:"type"`
		} `json:"error,omitempty"`
	}

	if err := json.Unmarshal(bodyBytes, &photoResp); err != nil {
		sanitizedBody := sanitizeMetaString(string(bodyBytes))
		return "", fmt.Errorf("failed to parse photo upload JSON: %w (Body: %s)", err, sanitizedBody)
	}

	if photoResp.Error != nil {
		sanitizedBody := sanitizeMetaString(string(bodyBytes))
		log.Printf("[FB Publish] Photo upload error on endpoint %s for Page %s — Code %d: %s (Response: %s)",
			uploadURL, pageID, photoResp.Error.Code, photoResp.Error.Message, sanitizedBody)
		return "", fmt.Errorf("Meta photo upload error (%d): %s", photoResp.Error.Code, photoResp.Error.Message)
	}

	if photoResp.ID == "" {
		sanitizedBody := sanitizeMetaString(string(bodyBytes))
		return "", fmt.Errorf("empty photo ID returned from Meta: %s", sanitizedBody)
	}

	return photoResp.ID, nil
}

// PublishPost executes the complete Meta Graph API posting workflow using the target page's own token
func (s *FacebookPublishService) PublishPost(ctx context.Context, req PublishPostRequest) (*PublishPostResponse, error) {
	_, defaultPageID, version, baseURL, _ := s.GetConfig()
	pageID := strings.TrimSpace(req.PageID)
	if pageID == "" {
		pageID = defaultPageID
	}

	// 1. Resolve token STRICTLY for this specific page (Never use another page's token)
	var token string
	pageName := "Facebook Business Page"
	pageSlot := 0

	if database.DB != nil {
		tok, page, err := GetFacebookPageManager().TokenForPage(pageID)
		if err != nil {
			return nil, fmt.Errorf("publishing blocked for Page %s: %w", pageID, err)
		}
		token = tok
		if page != nil {
			if page.Name != "" {
				pageName = page.Name
			}
			pageSlot = page.Slot
		}
	} else {
		token = s.GetPageAccessToken()
	}

	if token == "" {
		return nil, fmt.Errorf("cannot publish: No Page Access Token configured for Page %s", pageID)
	}

	// Verify Page token identity before uploading images to prevent #200 error
	var meInfo struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if meReq, mErr := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("%s/%s/me?fields=id,name&access_token=%s", baseURL, version, url.QueryEscape(token)), nil); mErr == nil {
		if meResp, dErr := s.httpClient.Do(meReq); dErr == nil {
			defer meResp.Body.Close()
			meBytes, _ := io.ReadAll(meResp.Body)
			_ = json.Unmarshal(meBytes, &meInfo)
		}
	}
	if meInfo.ID != "" && meInfo.ID != pageID {
		return nil, fmt.Errorf("token identity mismatch: resolved token belongs to %s (%s) instead of Page %s. Publishing as page itself is required to prevent error #200", meInfo.Name, meInfo.ID, pageID)
	}

	fullCaption := composeCaption(req.Headline, req.Caption, req.Hashtags)

	if fullCaption == "" && len(req.ImageURLs) == 0 {
		return nil, fmt.Errorf("cannot publish post with both empty caption and empty images")
	}

	// 2. Prevent Duplicate Publishing (Idempotency check within last 5 minutes)
	imagesJSON, _ := json.Marshal(req.ImageURLs)
	hashData := fmt.Sprintf("%s|%s|%s", pageID, fullCaption, string(imagesJSON))
	hashSum := sha256.Sum256([]byte(hashData))
	idempotencyKey := hex.EncodeToString(hashSum[:])

	if database.DB != nil && req.ExistingPostID == 0 {
		var existing models.FacebookPublishPost
		fiveMinutesAgo := time.Now().Add(-5 * time.Minute)
		if err := database.DB.Where("idempotency_key = ? AND status = ? AND created_at >= ?",
			idempotencyKey, models.FBPostStatusPublished, fiveMinutesAgo).First(&existing).Error; err == nil {
			log.Printf("Duplicate post prevented for key %s (PostID: %s)", idempotencyKey, existing.FacebookPostID)
			return &PublishPostResponse{
				ID:             existing.ID,
				FacebookPostID: existing.FacebookPostID,
				PermalinkURL:   existing.PermalinkURL,
				Status:         string(existing.Status),
				PageID:         existing.PageID,
				PageSlot:       existing.PageSlot,
				PageName:       existing.PageName,
				ImageCount:     len(req.ImageURLs),
				IsDuplicate:    true,
				PublishedAt:    *existing.PublishedAt,
			}, nil
		}
	}

	// 3. Create or reuse DB Post record in UPLOADING status
	var dbPost models.FacebookPublishPost
	if req.ExistingPostID > 0 && database.DB != nil {
		if err := database.DB.First(&dbPost, req.ExistingPostID).Error; err == nil {
			dbPost.Status = models.FBPostStatusUploading
			dbPost.PageID = pageID
			dbPost.PageSlot = pageSlot
			dbPost.PageName = pageName
			dbPost.Headline = req.Headline
			dbPost.Caption = fullCaption
			dbPost.Hashtags = req.Hashtags
			dbPost.ImageURLs = string(imagesJSON)
			dbPost.UpdatedAt = time.Now()
			database.DB.Save(&dbPost)
		}
	}

	if dbPost.ID == 0 {
		dbPost = models.FacebookPublishPost{
			PageID:         pageID,
			PageSlot:       pageSlot,
			PageName:       pageName,
			Headline:       req.Headline,
			Caption:        fullCaption,
			Hashtags:       req.Hashtags,
			ImageURLs:      string(imagesJSON),
			Status:         models.FBPostStatusUploading,
			IdempotencyKey: idempotencyKey,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}
		if database.DB != nil {
			database.DB.Create(&dbPost)
		}
	}

	// Helper to handle and record errors, detecting token expiry
	recordFailure := func(errMsg string) {
		dbPost.Status = models.FBPostStatusFailed
		dbPost.ErrorMessage = errMsg
		dbPost.UpdatedAt = time.Now()
		if database.DB != nil {
			database.DB.Save(&dbPost)
			if strings.Contains(errMsg, "190") || strings.Contains(errMsg, "OAuthException") || strings.Contains(errMsg, "expired") {
				GetFacebookPageManager().MarkTokenExpired(pageID, errMsg)
			}
		}
	}

	// 4. Step: Upload each image with published=false in preserved sequence
	var attachedMediaIDs []string
	type attachedMediaItem struct {
		MediaFBID string `json:"media_fbid"`
	}
	var attachedMediaList []attachedMediaItem

	for idx, imgURL := range req.ImageURLs {
		cleanURL := strings.TrimSpace(imgURL)
		if cleanURL == "" {
			continue
		}

		photoID, uploadErr := s.UploadUnpublishedPhoto(ctx, pageID, token, cleanURL)
		if uploadErr != nil {
			errMsg := fmt.Sprintf("Failed uploading photo #%d to Page %s: %v", idx+1, pageID, uploadErr)
			log.Println(errMsg)
			recordFailure(errMsg)
			return nil, fmt.Errorf("%s", errMsg)
		}

		attachedMediaIDs = append(attachedMediaIDs, photoID)
		attachedMediaList = append(attachedMediaList, attachedMediaItem{MediaFBID: photoID})
	}

	mediaIDsJSON, _ := json.Marshal(attachedMediaIDs)
	dbPost.AttachedMediaIDs = string(mediaIDsJSON)

	// 5. Step: Create Facebook Feed Post
	feedURL := fmt.Sprintf("%s/%s/%s/feed", baseURL, version, pageID)
	form := url.Values{}
	form.Set("access_token", token)
	form.Set("message", fullCaption)

	if len(attachedMediaList) > 0 {
		attachedMediaBytes, _ := json.Marshal(attachedMediaList)
		form.Set("attached_media", string(attachedMediaBytes))
	}

	feedReq, err := http.NewRequestWithContext(ctx, http.MethodPost, feedURL, strings.NewReader(form.Encode()))
	if err != nil {
		recordFailure(err.Error())
		return nil, err
	}
	feedReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	feedResp, err := s.httpClient.Do(feedReq)
	if err != nil {
		errMsg := fmt.Sprintf("Network error creating feed post on Page %s: %v", pageID, err)
		recordFailure(errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}
	defer feedResp.Body.Close()

	bodyBytes, err := io.ReadAll(feedResp.Body)
	if err != nil {
		errMsg := fmt.Sprintf("Failed reading feed response for Page %s: %v", pageID, err)
		recordFailure(errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	var publishResult struct {
		ID    string `json:"id"`
		Error *struct {
			Message      string `json:"message"`
			Code         int    `json:"code"`
			ErrorSubcode int    `json:"error_subcode"`
			Type         string `json:"type"`
		} `json:"error,omitempty"`
	}

	if err := json.Unmarshal(bodyBytes, &publishResult); err != nil {
		errMsg := fmt.Sprintf("Failed parsing feed JSON: %v (Body: %s)", err, sanitizeMetaString(string(bodyBytes)))
		recordFailure(errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	if publishResult.Error != nil {
		errMsg := fmt.Sprintf("Meta Graph API error on Page %s (%d): %s", pageID, publishResult.Error.Code, sanitizeMetaString(publishResult.Error.Message))
		recordFailure(errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	if publishResult.ID == "" {
		errMsg := fmt.Sprintf("Empty post ID returned from Meta feed API for Page %s: %s", pageID, sanitizeMetaString(string(bodyBytes)))
		recordFailure(errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	fbPostID := publishResult.ID

	// 6. Step: Retrieve Post Permalink URL
	permalinkURL := ""
	permalinkReqURL := fmt.Sprintf("%s/%s/%s?fields=permalink_url&access_token=%s", baseURL, version, fbPostID, url.QueryEscape(token))
	pReq, pErr := http.NewRequestWithContext(ctx, http.MethodGet, permalinkReqURL, nil)
	if pErr == nil {
		pResp, pErr := s.httpClient.Do(pReq)
		if pErr == nil {
			defer pResp.Body.Close()
			pBytes, _ := io.ReadAll(pResp.Body)
			var pResult struct {
				PermalinkURL string `json:"permalink_url"`
			}
			if json.Unmarshal(pBytes, &pResult) == nil && pResult.PermalinkURL != "" {
				permalinkURL = pResult.PermalinkURL
			}
		}
	}

	if permalinkURL == "" {
		parts := strings.Split(fbPostID, "_")
		if len(parts) == 2 {
			permalinkURL = fmt.Sprintf("https://www.facebook.com/%s/posts/%s", parts[0], parts[1])
		} else {
			permalinkURL = fmt.Sprintf("https://www.facebook.com/%s", fbPostID)
		}
	}

	now := time.Now()
	dbPost.FacebookPostID = fbPostID
	dbPost.PermalinkURL = permalinkURL
	dbPost.Status = models.FBPostStatusPublished
	dbPost.PublishedAt = &now
	dbPost.ErrorMessage = ""
	dbPost.UpdatedAt = now

	if database.DB != nil {
		database.DB.Save(&dbPost)
	}

	log.Printf("Successfully published Facebook Page post via Meta Graph API v26.0! (Page: %s, Slot: %d, PostID: %s, Permalink: %s)",
		pageID, pageSlot, fbPostID, permalinkURL)

	return &PublishPostResponse{
		ID:             dbPost.ID,
		FacebookPostID: fbPostID,
		PermalinkURL:   permalinkURL,
		Status:         "PUBLISHED",
		PageID:         pageID,
		PageSlot:       pageSlot,
		PageName:       dbPost.PageName,
		ImageCount:     len(req.ImageURLs),
		PublishedAt:    now,
	}, nil
}

// SchedulePost registers a post for future automated publication for a specific Facebook Page
func (s *FacebookPublishService) SchedulePost(ctx context.Context, req PublishPostRequest) (*models.FacebookPublishPost, error) {
	if req.ScheduledAt == nil || req.ScheduledAt.Before(time.Now()) {
		return nil, fmt.Errorf("scheduled_at must be in the future")
	}

	_, defaultPageID, _, _, _ := s.GetConfig()
	pageID := strings.TrimSpace(req.PageID)
	if pageID == "" {
		pageID = defaultPageID
	}

	pageName := "Facebook Business Page"
	pageSlot := 0

	if database.DB != nil {
		p, err := GetFacebookPageManager().GetPage(pageID)
		if err == nil && p != nil {
			if p.Name != "" {
				pageName = p.Name
			}
			pageSlot = p.Slot
		}
	}

	fullCaption := composeCaption(req.Headline, req.Caption, req.Hashtags)

	imagesJSON, _ := json.Marshal(req.ImageURLs)
	hashData := fmt.Sprintf("%s|%s|%s|%s", pageID, fullCaption, string(imagesJSON), req.ScheduledAt.Format(time.RFC3339))
	hashSum := sha256.Sum256([]byte(hashData))
	idempotencyKey := hex.EncodeToString(hashSum[:])

	dbPost := models.FacebookPublishPost{
		PageID:         pageID,
		PageSlot:       pageSlot,
		PageName:       pageName,
		Headline:       req.Headline,
		Caption:        fullCaption,
		Hashtags:       req.Hashtags,
		ImageURLs:      string(imagesJSON),
		Status:         models.FBPostStatusScheduled,
		ScheduledAt:    req.ScheduledAt,
		IdempotencyKey: idempotencyKey,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if database.DB != nil {
		if err := database.DB.Create(&dbPost).Error; err != nil {
			return nil, fmt.Errorf("failed creating scheduled post record: %w", err)
		}
	}

	return &dbPost, nil
}

// ProcessScheduledPosts looks for overdue scheduled posts and publishes them independently
func (s *FacebookPublishService) ProcessScheduledPosts(ctx context.Context) {
	if database.DB == nil {
		return
	}

	var scheduledPosts []models.FacebookPublishPost
	now := time.Now()
	err := database.DB.Where("status = ? AND scheduled_at <= ?", models.FBPostStatusScheduled, now).
		Order("scheduled_at ASC").
		Limit(10).
		Find(&scheduledPosts).Error
	if err != nil || len(scheduledPosts) == 0 {
		return
	}

	log.Printf("Found %d scheduled Facebook posts ready for publishing", len(scheduledPosts))
	for _, p := range scheduledPosts {
		// Verify target page permits automatic publishing
		if page, err := GetFacebookPageManager().GetPage(p.PageID); err == nil && page != nil {
			if !page.AutoPublishEnabled {
				log.Printf("Skipping scheduled post ID %d: Auto-publish is paused for Page %s (%s). Enable it in Page Tokens menu.", p.ID, p.PageID, page.Name)
				continue
			}
			if page.TokenStatus == models.FBTokenExpired || page.TokenStatus == models.FBTokenInvalid {
				p.Status = models.FBPostStatusFailed
				p.ErrorMessage = fmt.Sprintf("Auto-publish failed: Token for Page %s is %s", p.PageID, page.TokenStatus)
				p.UpdatedAt = time.Now()
				database.DB.Save(&p)
				continue
			}
		}

		var imgURLs []string
		_ = json.Unmarshal([]byte(p.ImageURLs), &imgURLs)

		res, pubErr := s.PublishPost(ctx, PublishPostRequest{
			PageID:         p.PageID,
			Headline:       p.Headline,
			Caption:        p.Caption,
			Hashtags:       p.Hashtags,
			ImageURLs:      imgURLs,
			ExistingPostID: p.ID, // reuse existing DB row
		})

		if pubErr != nil {
			p.Status = models.FBPostStatusFailed
			p.ErrorMessage = pubErr.Error()
			p.RetryCount++
			p.UpdatedAt = time.Now()
			database.DB.Save(&p)
			log.Printf("Scheduled post ID %d failed for Page %s: %v", p.ID, p.PageID, pubErr)
		} else {
			p.Status = models.FBPostStatusPublished
			p.FacebookPostID = res.FacebookPostID
			p.PermalinkURL = res.PermalinkURL
			p.PublishedAt = &res.PublishedAt
			p.ErrorMessage = ""
			p.UpdatedAt = time.Now()
			database.DB.Save(&p)
			log.Printf("Scheduled post ID %d successfully published to Page %s (FB ID: %s)", p.ID, p.PageID, res.FacebookPostID)
		}
	}
}

// GetPostHistory retrieves paginated publishing history from database with optional page filtering
func (s *FacebookPublishService) GetPostHistory(ctx context.Context, pageID string, limit, offset int) ([]models.FacebookPublishPost, int64, error) {
	if database.DB == nil {
		return []models.FacebookPublishPost{}, 0, nil
	}

	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	var posts []models.FacebookPublishPost
	var total int64

	query := database.DB.Model(&models.FacebookPublishPost{})
	if strings.TrimSpace(pageID) != "" && pageID != "all" {
		query = query.Where("page_id = ?", strings.TrimSpace(pageID))
	}

	query.Count(&total)
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&posts).Error
	if err != nil {
		return nil, 0, err
	}

	return posts, total, nil
}

