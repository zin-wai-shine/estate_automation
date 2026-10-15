package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/services"
)

// GetFacebookPageStatus returns current live Meta Graph API connection details
// Never exposes secrets (Page Access Token or App Secret)
func GetFacebookPageStatus(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	svc := services.GetFacebookPublishService()
	status, err := svc.ValidateAndGetConnectionStatus(ctx)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	appID, pageID, version, baseURL, pageURL := svc.GetConfig()
	hasToken := svc.GetPageAccessToken() != ""

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":             status.Status,
		"connected":          status.Connected,
		"meta_app_id":        appID,
		"facebook_page_id":   pageID,
		"facebook_page_url":  pageURL,
		"page_name":          status.PageName,
		"graph_api_version":  version,
		"graph_base_url":     baseURL,
		"has_token":          hasToken,
		"permissions":        status.Permissions,
		"can_create_content": status.CanCreateContent,
		"error_message":      status.ErrorMessage,
		"checked_at":         status.CheckedAt,
	})
}

// TestFacebookPageConnection tests credentials against Meta Graph API without publishing anything
func TestFacebookPageConnection(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 20*time.Second)
	defer cancel()

	svc := services.GetFacebookPublishService()
	status, err := svc.ValidateAndGetConnectionStatus(ctx)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	appID, pageID, version, _, pageURL := svc.GetConfig()

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":             status.Status,
		"connected":          status.Connected,
		"meta_app_id":        appID,
		"facebook_page_id":   pageID,
		"facebook_page_url":  pageURL,
		"page_name":          status.PageName,
		"graph_api_version":  version,
		"permissions":        status.Permissions,
		"can_create_content": status.CanCreateContent,
		"error_message":      status.ErrorMessage,
		"checked_at":         status.CheckedAt,
		"test_passed":        status.Connected && status.CanCreateContent,
	})
}

// UpdateFacebookPageToken updates or rotates the Facebook Page Access Token safely
func UpdateFacebookPageToken(c *fiber.Ctx) error {
	var body struct {
		Token string `json:"token"`
	}

	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Token) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Token is required and cannot be blank",
		})
	}

	svc := services.GetFacebookPublishService()
	if err := svc.SetPageAccessToken(body.Token); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	// Validate the updated token immediately
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	status, _ := svc.ValidateAndGetConnectionStatus(ctx)

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":             "success",
		"message":            "Page Access Token updated successfully",
		"connection_status":  status.Status,
		"connected":          status.Connected,
		"can_create_content": status.CanCreateContent,
		"permissions":        status.Permissions,
	})
}

// PublishFacebookPost publishes caption and multiple images to Facebook Page feed
func PublishFacebookPost(c *fiber.Ctx) error {
	var req services.PublishPostRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid request payload: " + err.Error(),
		})
	}

	if strings.TrimSpace(req.Caption) == "" && len(req.ImageURLs) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Post requires either a caption or at least one image",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 120*time.Second)
	defer cancel()

	svc := services.GetFacebookPublishService()
	res, err := svc.PublishPost(ctx, req)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":           "success",
		"data":             res,
		"facebook_post_id": res.FacebookPostID,
		"permalink_url":    res.PermalinkURL,
		"is_duplicate":     res.IsDuplicate,
		"published_at":     res.PublishedAt,
	})
}

// ScheduleFacebookPost registers a post for future scheduled publication
func ScheduleFacebookPost(c *fiber.Ctx) error {
	var req services.PublishPostRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid request payload: " + err.Error(),
		})
	}

	if req.ScheduledAt == nil || req.ScheduledAt.Before(time.Now()) {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "scheduled_at must be a valid future ISO-8601 timestamp",
		})
	}

	if strings.TrimSpace(req.Caption) == "" && len(req.ImageURLs) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Post requires either a caption or at least one image",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()

	svc := services.GetFacebookPublishService()
	scheduledPost, err := svc.SchedulePost(ctx, req)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":       "success",
		"message":      "Post scheduled successfully",
		"post_id":      scheduledPost.ID,
		"scheduled_at": scheduledPost.ScheduledAt,
	})
}

// GetFacebookPosts returns publishing history from database with optional page filtering
func GetFacebookPosts(c *fiber.Ctx) error {
	limitStr := c.Query("limit", "20")
	offsetStr := c.Query("offset", "0")
	pageID := c.Query("page_id", "")

	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	svc := services.GetFacebookPublishService()
	posts, total, err := svc.GetPostHistory(ctx, pageID, limit, offset)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"total":  total,
		"limit":  limit,
		"offset": offset,
		"posts":  posts,
	})
}

// RetryFacebookPost retries a previously failed post
func RetryFacebookPost(c *fiber.Ctx) error {
	postIDStr := c.Params("id")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid post ID",
		})
	}

	var post models.FacebookPublishPost
	if err := database.DB.First(&post, postID).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": "Post not found",
		})
	}

	var imgURLs []string
	if post.ImageURLs != "" {
		_ = jsonUnmarshal(post.ImageURLs, &imgURLs)
	}

	ctx, cancel := context.WithTimeout(c.Context(), 120*time.Second)
	defer cancel()

	svc := services.GetFacebookPublishService()
	res, err := svc.PublishPost(ctx, services.PublishPostRequest{
		PageID:         post.PageID,
		Headline:       post.Headline,
		Caption:        post.Caption,
		Hashtags:       post.Hashtags,
		ImageURLs:      imgURLs,
		ExistingPostID: post.ID,
	})
	if err != nil {
		post.RetryCount++
		post.ErrorMessage = err.Error()
		post.Status = models.FBPostStatusFailed
		database.DB.Save(&post)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":           "success",
		"facebook_post_id": res.FacebookPostID,
		"permalink_url":    res.PermalinkURL,
	})
}

// DeleteFacebookPost removes a post record or cancels a scheduled post
func DeleteFacebookPost(c *fiber.Ctx) error {
	postIDStr := c.Params("id")
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid post ID",
		})
	}

	if err := database.DB.Delete(&models.FacebookPublishPost{}, postID).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "Post deleted successfully",
	})
}

// -----------------------------------------------------------------------------
// Multi-Page Management Endpoints (Unified "Page Tokens" Menu)
// -----------------------------------------------------------------------------

// ListManagedFacebookPages returns Page 1 & Page 2 state without secrets
func ListManagedFacebookPages(c *fiber.Ctx) error {
	mgr := services.GetFacebookPageManager()
	pages, err := mgr.ListPages()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}
	appID, _, version, baseURL, _ := services.GetFacebookPublishService().GetConfig()
	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":            "success",
		"meta_app_id":       appID,
		"graph_api_version": version,
		"graph_base_url":    baseURL,
		"pages":             pages,
	})
}

// GetManagedFacebookPage returns single page details
func GetManagedFacebookPage(c *fiber.Ctx) error {
	pageID := c.Params("pageId")
	mgr := services.GetFacebookPageManager()
	page, err := mgr.GetPageDTO(pageID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"page":   page,
	})
}

// GetManagedPageToken retrieves the decrypted Page Access Token for authorized viewing
func GetManagedPageToken(c *fiber.Ctx) error {
	pageID := c.Params("pageId")
	mgr := services.GetFacebookPageManager()
	token, page, err := mgr.GetDecryptedPageToken(pageID)
	if err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":     "success",
		"page_id":    page.PageID,
		"slot":       page.Slot,
		"name":       page.Name,
		"token":      token,
		"token_hint": page.TokenHint,
	})
}

// SetManagedPageToken updates the token for a specific page (Page 1 or Page 2)
func SetManagedPageToken(c *fiber.Ctx) error {
	pageID := c.Params("pageId")
	var body struct {
		Token string `json:"token"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.Token) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "token is required and cannot be empty",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 25*time.Second)
	defer cancel()

	mgr := services.GetFacebookPageManager()
	result, err := mgr.SetPageToken(ctx, pageID, body.Token)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	pageDTO, _ := mgr.GetPageDTO(pageID)
	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":      "success",
		"message":     "Token updated and validated successfully",
		"test_result": result,
		"page":        pageDTO,
	})
}

// ImportFacebookUserToken imports tokens for all managed pages using a single user token
func ImportFacebookUserToken(c *fiber.Ctx) error {
	var body struct {
		UserToken string `json:"user_token"`
	}
	if err := c.BodyParser(&body); err != nil || strings.TrimSpace(body.UserToken) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "user_token is required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 45*time.Second)
	defer cancel()

	mgr := services.GetFacebookPageManager()
	results, err := mgr.ImportFromUserToken(ctx, body.UserToken)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	pages, _ := mgr.ListPages()
	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "User token processed successfully",
		"results": results,
		"pages":   pages,
	})
}

// TestManagedFacebookPage tests access for a specific page without publishing
func TestManagedFacebookPage(c *fiber.Ctx) error {
	pageID := c.Params("pageId")
	ctx, cancel := context.WithTimeout(c.Context(), 25*time.Second)
	defer cancel()

	mgr := services.GetFacebookPageManager()
	result, err := mgr.TestPage(ctx, pageID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	pageDTO, _ := mgr.GetPageDTO(pageID)
	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":      "success",
		"test_result": result,
		"page":        pageDTO,
	})
}

// TestAllManagedFacebookPages tests both Page 1 and Page 2 in parallel
func TestAllManagedFacebookPages(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 30*time.Second)
	defer cancel()

	mgr := services.GetFacebookPageManager()
	results := mgr.TestAllPages(ctx)
	pages, _ := mgr.ListPages()

	allPassed := true
	for _, r := range results {
		if !r.Passed {
			allPassed = false
			break
		}
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":     "success",
		"all_passed": allPassed,
		"results":    results,
		"pages":      pages,
	})
}

// RefreshManagedFacebookPage fetches real Facebook Page name and profile picture from Meta
func RefreshManagedFacebookPage(c *fiber.Ctx) error {
	pageID := c.Params("pageId")
	ctx, cancel := context.WithTimeout(c.Context(), 25*time.Second)
	defer cancel()

	mgr := services.GetFacebookPageManager()
	result, err := mgr.RefreshPageInfo(ctx, pageID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	pageDTO, _ := mgr.GetPageDTO(pageID)
	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":      "success",
		"message":     "Page information refreshed successfully from Meta Graph API",
		"test_result": result,
		"page":        pageDTO,
	})
}

// RefreshAllManagedFacebookPages refreshes Page 1 and Page 2 in parallel from Meta
func RefreshAllManagedFacebookPages(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 35*time.Second)
	defer cancel()

	mgr := services.GetFacebookPageManager()
	results := mgr.RefreshAllPages(ctx)
	pages, _ := mgr.ListPages()

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "All Facebook pages refreshed from Meta Graph API",
		"results": results,
		"pages":   pages,
	})
}

// GetAuthorizedFacebookAccounts returns all pages authorized under the user's Meta account
// GetDiscoveredPagesHandler returns all authorized pages from /me/accounts without exposing tokens
func GetDiscoveredPagesHandler(c *fiber.Ctx) error {
	userToken := strings.TrimSpace(c.Query("user_token"))
	ctx, cancel := context.WithTimeout(c.Context(), 25*time.Second)
	defer cancel()

	mgr := services.GetFacebookPageManager()
	pages, err := mgr.GetDiscoveredPages(ctx, userToken)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"pages":  pages,
	})
}

// ConnectSelectedPagesHandler enables and securely saves tokens for selected page IDs
func ConnectSelectedPagesHandler(c *fiber.Ctx) error {
	var body struct {
		PageIDs   []string `json:"page_ids"`
		UserToken string   `json:"user_token"`
	}
	if err := c.BodyParser(&body); err != nil || len(body.PageIDs) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "page_ids list is required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 35*time.Second)
	defer cancel()

	mgr := services.GetFacebookPageManager()
	results, err := mgr.ConnectSelectedPages(ctx, body.PageIDs, body.UserToken)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	allPages, _ := mgr.ListPages()
	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":       "success",
		"message":      fmt.Sprintf("Successfully connected %d Facebook page(s)", len(results)),
		"test_results": results,
		"pages":        allPages,
	})
}

// DisconnectManagedFacebookPage disconnects an individual page
func DisconnectManagedFacebookPage(c *fiber.Ctx) error {
	pageID := c.Params("pageId")
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	mgr := services.GetFacebookPageManager()
	page, err := mgr.DisconnectPage(ctx, pageID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "Page disconnected successfully",
		"page":    page,
	})
}

// GET /me/accounts?fields=id,name,access_token,tasks (delegates to safe discovery)
func GetAuthorizedFacebookAccounts(c *fiber.Ctx) error {
	return GetDiscoveredPagesHandler(c)
}

// TogglePageAutoPublish enables or disables automated scheduled publishing for a page
func TogglePageAutoPublish(c *fiber.Ctx) error {
	pageID := c.Params("pageId")
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "invalid payload",
		})
	}

	mgr := services.GetFacebookPageManager()
	page, err := mgr.SetAutoPublish(pageID, body.Enabled)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "Auto-publish setting updated",
		"page":    page,
	})
}

// UpdatePageLabel sets a custom human-readable label for a page
func UpdatePageLabel(c *fiber.Ctx) error {
	pageID := c.Params("pageId")
	var body struct {
		Label string `json:"label"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "invalid payload",
		})
	}

	mgr := services.GetFacebookPageManager()
	page, err := mgr.UpdateLabel(pageID, body.Label)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "Label updated",
		"page":    page,
	})
}

// RemovePageToken deletes the stored token for a specific page
func RemovePageToken(c *fiber.Ctx) error {
	pageID := c.Params("pageId")
	mgr := services.GetFacebookPageManager()
	page, err := mgr.RemoveToken(pageID)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "Token removed",
		"page":    page,
	})
}

// FacebookPagePublishItem represents one page's custom publishing payload in a multi-page batch
type FacebookPagePublishItem struct {
	PageID      string     `json:"page_id"`
	Headline    string     `json:"headline"`
	Caption     string     `json:"caption"`
	Hashtags    string     `json:"hashtags"`
	ImageURLs   []string   `json:"image_urls"`
	ScheduledAt *time.Time `json:"scheduled_at,omitempty"`
}

// FacebookPagePublishItemResult reports the individual outcome for one page
type FacebookPagePublishItemResult struct {
	PageID         string `json:"page_id"`
	PageSlot       int    `json:"page_slot"`
	PageName       string `json:"page_name"`
	Success        bool   `json:"success"`
	Status         string `json:"status"` // PUBLISHED, SCHEDULED, FAILED
	PostID         uint   `json:"post_id,omitempty"`
	FacebookPostID string `json:"facebook_post_id,omitempty"`
	PermalinkURL   string `json:"permalink_url,omitempty"`
	Error          string `json:"error,omitempty"`
}

// PublishFacebookBatch publishes or schedules posts to Page 1, Page 2, or both simultaneously
// with each page having its OWN images, captions, headlines, hashtags, and schedule.
func PublishFacebookBatch(c *fiber.Ctx) error {
	var body struct {
		Pages []FacebookPagePublishItem `json:"pages"`
	}
	if err := c.BodyParser(&body); err != nil || len(body.Pages) == 0 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "at least one page payload is required in pages array",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 180*time.Second)
	defer cancel()

	svc := services.GetFacebookPublishService()
	mgr := services.GetFacebookPageManager()

	results := make([]FacebookPagePublishItemResult, 0, len(body.Pages))
	overallSuccess := true

	for _, item := range body.Pages {
		cleanPageID := strings.TrimSpace(item.PageID)
		if cleanPageID == "" {
			continue
		}

		resItem := FacebookPagePublishItemResult{
			PageID: cleanPageID,
		}
		if p, err := mgr.GetPage(cleanPageID); err == nil && p != nil {
			resItem.PageSlot = p.Slot
			resItem.PageName = p.Name
		}

		req := services.PublishPostRequest{
			PageID:      cleanPageID,
			Headline:    item.Headline,
			Caption:     item.Caption,
			Hashtags:    item.Hashtags,
			ImageURLs:   item.ImageURLs,
			ScheduledAt: item.ScheduledAt,
		}

		if item.ScheduledAt != nil && item.ScheduledAt.After(time.Now()) {
			schedPost, err := svc.SchedulePost(ctx, req)
			if err != nil {
				resItem.Success = false
				resItem.Status = "FAILED"
				resItem.Error = err.Error()
				overallSuccess = false
			} else {
				resItem.Success = true
				resItem.Status = "SCHEDULED"
				resItem.PostID = schedPost.ID
			}
		} else {
			pubResp, err := svc.PublishPost(ctx, req)
			if err != nil {
				resItem.Success = false
				resItem.Status = "FAILED"
				resItem.Error = err.Error()
				overallSuccess = false
			} else {
				resItem.Success = true
				resItem.Status = "PUBLISHED"
				resItem.PostID = pubResp.ID
				resItem.FacebookPostID = pubResp.FacebookPostID
				resItem.PermalinkURL = pubResp.PermalinkURL
				resItem.PageName = pubResp.PageName
			}
		}
		results = append(results, resItem)
	}

	statusStr := "success"
	hasAnySuccess := false
	for _, r := range results {
		if r.Success {
			hasAnySuccess = true
		}
	}
	statusCode := http.StatusOK
	if !overallSuccess {
		if hasAnySuccess {
			statusStr = "partial"
		} else {
			statusStr = "failed"
			statusCode = http.StatusBadRequest
		}
	}

	return c.Status(statusCode).JSON(fiber.Map{
		"status":  statusStr,
		"results": results,
	})
}

func jsonUnmarshal(data string, v interface{}) error {
	return json.Unmarshal([]byte(data), v)
}

