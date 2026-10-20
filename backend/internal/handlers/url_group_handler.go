package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

type CreateUrlGroupRequest struct {
	RawText string `json:"raw_text"`
}

// GetUrlGroups handles GET /api/url-groups
func GetUrlGroups(c *fiber.Ctx) error {
	var groups []models.UrlGroup
	if err := database.DB.Order("id asc").Find(&groups).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status": "error",
			"error":  "Failed to load URL groups",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data":   groups,
	})
}

// CreateUrlGroup handles POST /api/url-groups
func CreateUrlGroup(c *fiber.Ctx) error {
	var req CreateUrlGroupRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status": "error",
			"error":  "Invalid request body",
		})
	}

	trimmedText := strings.TrimSpace(req.RawText)
	if trimmedText == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status": "error",
			"error":  "Links text cannot be empty",
		})
	}

	// Extract individual URLs from the raw text
	re := regexp.MustCompile(`https?://[^\s,;]+`)
	extractedUrls := re.FindAllString(trimmedText, -1)

	var finalUrls []string
	if len(extractedUrls) > 0 {
		for _, u := range extractedUrls {
			cleaned := strings.TrimSpace(u)
			if cleaned != "" {
				finalUrls = append(finalUrls, cleaned)
			}
		}
	} else {
		// Fallback: split by lines
		lines := strings.Split(trimmedText, "\n")
		for _, l := range lines {
			cleaned := strings.TrimSpace(l)
			if cleaned != "" {
				finalUrls = append(finalUrls, cleaned)
			}
		}
	}

	urlsJSON, _ := json.Marshal(finalUrls)
	urlCount := len(finalUrls)
	if urlCount == 0 {
		urlCount = 1
	}

	var totalCount int64
	database.DB.Model(&models.UrlGroup{}).Count(&totalCount)
	serial := fmt.Sprintf("%02d", totalCount+1)

	now := time.Now()
	group := models.UrlGroup{
		Serial:    serial,
		RawText:   trimmedText,
		UrlsJSON:  string(urlsJSON),
		UrlCount:  urlCount,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := database.DB.Create(&group).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status": "error",
			"error":  fmt.Sprintf("Failed to save URL group: %v", err),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"status":  "success",
		"message": "URL group saved successfully",
		"data":    group,
	})
}

// DeleteUrlGroup handles DELETE /api/url-groups/:id
func DeleteUrlGroup(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status": "error",
			"error":  "Invalid group ID",
		})
	}

	if err := database.DB.Delete(&models.UrlGroup{}, id).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status": "error",
			"error":  "Failed to delete URL group",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "URL group deleted successfully",
	})
}

// ClearUrlGroups handles DELETE /api/url-groups
func ClearUrlGroups(c *fiber.Ctx) error {
	if err := database.DB.Exec("DELETE FROM url_groups").Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status": "error",
			"error":  "Failed to clear URL groups",
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "All URL groups cleared successfully",
	})
}
