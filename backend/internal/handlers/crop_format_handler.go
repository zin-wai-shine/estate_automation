package handlers

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

var cropFormatMutex sync.Mutex

// CropStudioFormatItem represents a crop/cut studio format stored on disk
type CropStudioFormatItem struct {
	ID                  string                 `json:"id"`
	Name                string                 `json:"name"`
	Description         string                 `json:"description"`
	Mode                string                 `json:"mode"`
	TargetWidth         int                    `json:"targetWidth"`
	TargetHeight        int                    `json:"targetHeight"`
	Aspect              string                 `json:"aspect"`
	FitMode             string                 `json:"fitMode"`
	FocusPosition       string                 `json:"focusPosition"`
	CropZoom            float64                `json:"cropZoom,omitempty"`
	WatermarkConfig     map[string]interface{} `json:"watermarkConfig,omitempty"`
	GridLayoutID        string                 `json:"gridLayoutId,omitempty"`
	TileCropMap         map[string]interface{} `json:"tileCropMap,omitempty"`
	TileFocusMap        map[string]interface{} `json:"tileFocusMap,omitempty"`
	UseWatermarkOnTiles bool                   `json:"useWatermarkOnTiles,omitempty"`
	ApplyToAllTiles     bool                   `json:"applyToAllTiles,omitempty"`
	IsDefault           bool                   `json:"isDefault,omitempty"`
	CreatedAt           int64                  `json:"createdAt"`
	UpdatedAt           int64                  `json:"updatedAt"`
}

func getCropFormatsFilePath() string {
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "data"
	}
	_ = os.MkdirAll(dataDir, 0755)
	return filepath.Join(dataDir, "crop_formats.json")
}

// GetInitialDefaultCropFormats returns the pre-configured crop and cut studio formats
func GetInitialDefaultCropFormats() []CropStudioFormatItem {
	now := time.Now().UnixMilli()
	return []CropStudioFormatItem{
		{
			ID:            "format-1792362113668",
			Name:          "FB Format",
			Description:   "1080 × 1350 px • Portrait listing photos for Facebook & IG",
			Mode:          "standard",
			TargetWidth:   1080,
			TargetHeight:  1350,
			Aspect:        "4:5",
			FitMode:       "cover",
			FocusPosition: "center",
			CropZoom:      1,
			IsDefault:     true,
			CreatedAt:     1792362113668,
			UpdatedAt:     now,
		},
		{
			ID:            "format-1774-887",
			Name:          "Original 1774×887 Format",
			Description:   "1774 × 887 px • Fill (Cover) • Anchor: Center",
			Mode:          "standard",
			TargetWidth:   1774,
			TargetHeight:  887,
			Aspect:        "1774:887",
			FitMode:       "cover",
			FocusPosition: "center",
			CropZoom:      1,
			WatermarkConfig: map[string]interface{}{
				"enabled":       true,
				"type":          "text",
				"logoUrl":       "",
				"logoName":      "",
				"text":          "BoltHaven Property",
				"textColor":     "#FFFFFF",
				"color":         "#FFFFFF",
				"fontSize":      26,
				"fontWeight":    "600",
				"opacity":       85,
				"scale":         25,
				"position":      "bottom-right",
				"margin":        4,
				"hasShadow":     true,
				"shadow":        true,
				"shadowColor":   "rgba(0,0,0,0.7)",
				"shadowBlur":    6,
				"preserveAlpha": true,
				"smartScope":    "all",
			},
			IsDefault: false,
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			ID:            "format-ig-portrait",
			Name:          "Instagram Portrait (4:5)",
			Description:   "1080 × 1350 px • High-converting vertical feed format",
			Mode:          "standard",
			TargetWidth:   1080,
			TargetHeight:  1350,
			Aspect:        "4:5",
			FitMode:       "cover",
			FocusPosition: "center",
			CropZoom:      1,
			IsDefault:     false,
			CreatedAt:     now - 3600000*24,
			UpdatedAt:     now,
		},
		{
			ID:            "format-square-post",
			Name:          "Square Listing (1:1)",
			Description:   "1200 × 1200 px • Universal social post & marketplace grid",
			Mode:          "standard",
			TargetWidth:   1200,
			TargetHeight:  1200,
			Aspect:        "1:1",
			FitMode:       "cover",
			FocusPosition: "center",
			CropZoom:      1,
			IsDefault:     false,
			CreatedAt:     now - 3600000*18,
			UpdatedAt:     now,
		},
		{
			ID:            "format-story-reel",
			Name:          "Story / Reel (9:16)",
			Description:   "1080 × 1920 px • Full-screen mobile story & vertical short",
			Mode:          "standard",
			TargetWidth:   1080,
			TargetHeight:  1920,
			Aspect:        "9:16",
			FitMode:       "cover",
			FocusPosition: "center",
			CropZoom:      1,
			IsDefault:     false,
			CreatedAt:     now - 3600000*12,
			UpdatedAt:     now,
		},
		{
			ID:            "format-landscape-web",
			Name:          "Landscape Web (16:9)",
			Description:   "1920 × 1080 px • Website hero & property portal banner",
			Mode:          "standard",
			TargetWidth:   1920,
			TargetHeight:  1080,
			Aspect:        "16:9",
			FitMode:       "cover",
			FocusPosition: "center",
			CropZoom:      1,
			IsDefault:     false,
			CreatedAt:     now - 3600000*6,
			UpdatedAt:     now,
		},
		{
			ID:                  "format-grid-2split",
			Name:                "Carousel Split (2 Squares)",
			Description:         "Social grid split • 2 seamless horizontal swipe tiles",
			Mode:                "grid",
			GridLayoutID:        "two-squares",
			TargetWidth:         1080,
			TargetHeight:        1080,
			Aspect:              "1:1",
			FitMode:             "cover",
			FocusPosition:       "center",
			CropZoom:            1,
			ApplyToAllTiles:     true,
			UseWatermarkOnTiles: false,
			IsDefault:           false,
			CreatedAt:           now - 3600000*3,
			UpdatedAt:           now,
		},
	}
}

// GetCropFormats retrieves saved crop studio formats from disk JSON file
func GetCropFormats(c *fiber.Ctx) error {
	cropFormatMutex.Lock()
	defer cropFormatMutex.Unlock()

	filePath := getCropFormatsFilePath()
	data, err := os.ReadFile(filePath)
	if err != nil {
		defaults := GetInitialDefaultCropFormats()
		if out, errM := json.MarshalIndent(defaults, "", "  "); errM == nil {
			_ = os.WriteFile(filePath, out, 0644)
		}
		return c.JSON(fiber.Map{
			"success": true,
			"formats": defaults,
		})
	}

	var formats []CropStudioFormatItem
	if err := json.Unmarshal(data, &formats); err != nil || len(formats) == 0 {
		defaults := GetInitialDefaultCropFormats()
		if out, errM := json.MarshalIndent(defaults, "", "  "); errM == nil {
			_ = os.WriteFile(filePath, out, 0644)
		}
		return c.JSON(fiber.Map{
			"success": true,
			"formats": defaults,
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"formats": formats,
	})
}

// SaveCropFormats persists updated crop studio formats list to disk JSON file (safe, zero DB touch)
func SaveCropFormats(c *fiber.Ctx) error {
	cropFormatMutex.Lock()
	defer cropFormatMutex.Unlock()

	var formats []CropStudioFormatItem

	// Try parsing as array directly
	if err := c.BodyParser(&formats); err != nil || len(formats) == 0 {
		// Try parsing as object with "formats" field
		var wrapper struct {
			Formats []CropStudioFormatItem `json:"formats"`
		}
		if err2 := c.BodyParser(&wrapper); err2 == nil && len(wrapper.Formats) > 0 {
			formats = wrapper.Formats
		} else {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid request payload: expected array of crop formats",
			})
		}
	}

	data, err := json.MarshalIndent(formats, "", "  ")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to serialize crop formats",
		})
	}

	filePath := getCropFormatsFilePath()
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to save crop formats file",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Crop studio formats persisted successfully",
		"formats": formats,
	})
}
