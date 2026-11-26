package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/services"
)

// ListGoogleDriveFolderImages - POST /api/google-drive/list-folder-images
func ListGoogleDriveFolderImages(c *fiber.Ctx) error {
	var req struct {
		DriveURL   string `json:"driveUrl"`
		BasePath   string `json:"basePath"`
		FolderName string `json:"folderName"`
		SubPath    string `json:"subPath"`
		MaxCount   int    `json:"maxCount"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status": "error",
			"error":  "Invalid request body",
			"images": []interface{}{},
		})
	}

	targetURL := req.DriveURL
	if targetURL == "" {
		targetURL = req.BasePath
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	res, err := services.NewGoogleDriveService().ListPublicFolderImages(ctx, targetURL, req.FolderName, req.SubPath, req.MaxCount)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status": "error",
			"error":  err.Error(),
			"images": []interface{}{},
		})
	}
	return c.JSON(res)
}

// ProxyGoogleDriveImage - GET /api/google-drive/image?fileId=...
func ProxyGoogleDriveImage(c *fiber.Ctx) error {
	fileID := c.Query("fileId")
	if fileID == "" {
		return c.Status(http.StatusBadRequest).SendString("fileId is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	data, contentType, err := services.NewGoogleDriveService().FetchImageBytes(ctx, fileID)
	if err != nil {
		return c.Status(http.StatusBadGateway).SendString(err.Error())
	}

	c.Set("Content-Type", contentType)
	c.Set("Cache-Control", "public, max-age=3600")
	return c.Send(data)
}
