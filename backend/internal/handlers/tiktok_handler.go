package handlers

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/services"
)

// StartTikTokAuth initiates the TikTok OAuth v2 Login Kit authorization
func StartTikTokAuth(c *fiber.Ctx) error {
	svc := services.GetTikTokService()
	state := services.GenerateSecureOAuthState()
	redirectURI := c.Query("redirect_uri")

	authURL, err := svc.BuildAuthURL(state, redirectURI)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "config_error",
			"message": err.Error(),
		})
	}

	mode := c.Query("mode")
	if mode == "redirect" {
		return c.Redirect(authURL, fiber.StatusTemporaryRedirect)
	}

	return c.JSON(fiber.Map{
		"status":   "success",
		"auth_url": authURL,
		"state":    state,
	})
}

// HandleTikTokCallback handles the redirect callback from TikTok Login Kit
func HandleTikTokCallback(c *fiber.Ctx) error {
	svc := services.GetTikTokService()

	// Check for authorization denial or error from TikTok
	errCode := c.Query("error")
	errDesc := c.Query("error_description")
	if errCode != "" {
		errMsg := fmt.Sprintf("TikTok authorization denied: %s (%s)", errDesc, errCode)
		redirectTarget := fmt.Sprintf("/?tab=auth-manager&platform=tiktok&error=%s", url.QueryEscape(errMsg))
		return c.Redirect(redirectTarget, fiber.StatusTemporaryRedirect)
	}

	code := c.Query("code")
	state := c.Query("state")

	if code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_code",
			"message": "Authorization code is missing from callback",
		})
	}

	// Validate CSRF state
	if !services.ValidateOAuthState(state) {
		redirectTarget := "/?tab=auth-manager&platform=tiktok&error=" + url.QueryEscape("Security check failed: invalid or expired OAuth state")
		return c.Redirect(redirectTarget, fiber.StatusTemporaryRedirect)
	}

	// Perform server-side token exchange and user profile fetch
	account, err := svc.HandleAuthCallback(code, "")
	if err != nil {
		errMsg := fmt.Sprintf("Failed to complete TikTok account connection: %v", err)
		redirectTarget := fmt.Sprintf("/?tab=auth-manager&platform=tiktok&error=%s", url.QueryEscape(errMsg))
		return c.Redirect(redirectTarget, fiber.StatusTemporaryRedirect)
	}

	// Redirect back to Auth Manager tab in frontend with success flag
	successRedirect := fmt.Sprintf(
		"/?tab=auth-manager&platform=tiktok&status=connected&username=%s&account_id=%d",
		url.QueryEscape(account.Username),
		account.ID,
	)
	return c.Redirect(successRedirect, fiber.StatusTemporaryRedirect)
}

// ListTikTokAccounts returns all authorized TikTok accounts without sensitive credentials
func ListTikTokAccounts(c *fiber.Ctx) error {
	svc := services.GetTikTokService()
	accounts, err := svc.ListAccounts()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "database_error",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   accounts,
	})
}

// GetTikTokAccount returns details of a single TikTok account
func GetTikTokAccount(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_id"})
	}

	svc := services.GetTikTokService()
	account, err := svc.GetAccount(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "account_not_found"})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   account,
	})
}

// TestTikTokAccount performs real API verification in sandbox or live mode
func TestTikTokAccount(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_id"})
	}

	svc := services.GetTikTokService()
	account, err := svc.TestAccount(uint(id))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"error":   "verification_failed",
			"message": err.Error(),
			"data":    account,
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": fmt.Sprintf("TikTok account @%s verified successfully", account.Username),
		"data":    account,
	})
}

// RefreshTikTokAccount manually refreshes access tokens
func RefreshTikTokAccount(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_id"})
	}

	svc := services.GetTikTokService()
	account, err := svc.GetAccount(uint(id))
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "account_not_found"})
	}

	if err := svc.RefreshToken(account); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "refresh_failed",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Token refreshed successfully",
		"data":    account,
	})
}

// DisconnectTikTokAccount revokes access and deletes the stored account
func DisconnectTikTokAccount(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_id"})
	}

	svc := services.GetTikTokService()
	if err := svc.DeleteAccount(uint(id)); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "delete_failed",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "TikTok account disconnected",
	})
}

// ToggleTikTokAutoPublish toggles the auto_publish_enabled setting
func ToggleTikTokAutoPublish(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_id"})
	}

	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_payload"})
	}

	svc := services.GetTikTokService()
	account, err := svc.ToggleAutoPublish(uint(id), body.Enabled)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   account,
	})
}

// PublishTikTokPhoto handles the direct publishing of photo mode carousel posts
func PublishTikTokPhoto(c *fiber.Ctx) error {
	var req services.PublishPhotoRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_request",
			"message": "Failed to parse publication request payload",
		})
	}

	if req.AccountID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_account",
			"message": "account_id is required",
		})
	}
	if strings.TrimSpace(req.Title) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_title",
			"message": "Post caption / title is required",
		})
	}
	if len(req.PhotoImages) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_photos",
			"message": "At least one property image URL is required for TikTok photo mode",
		})
	}

	svc := services.GetTikTokService()
	post, err := svc.PublishPhotoPost(req)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"error":   "publish_failed",
			"message": err.Error(),
			"data":    post,
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "TikTok content publication initialized",
		"data":    post,
	})
}

// GetTikTokPublishStatus polls real publication status from TikTok Content Posting API
func GetTikTokPublishStatus(c *fiber.Ctx) error {
	publishID := c.Params("publishId")
	if publishID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing_publish_id"})
	}

	svc := services.GetTikTokService()
	post, err := svc.FetchPublishStatus(publishID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"error":   "status_check_failed",
			"message": err.Error(),
			"data":    post,
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   post,
	})
}

// GetTikTokPosts returns the real posting history
func GetTikTokPosts(c *fiber.Ctx) error {
	svc := services.GetTikTokService()
	posts, err := svc.ListPosts()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "fetch_error",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   posts,
	})
}
