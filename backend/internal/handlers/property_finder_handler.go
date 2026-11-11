package handlers

import (
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

// GetFinderOverview returns dashboard summary metrics
func GetFinderOverview(c *fiber.Ctx) error {
	svc := services.GetPropertyFinderService()
	stats := svc.GetOverviewStats()
	return c.JSON(fiber.Map{
		"status": "success",
		"data":   stats,
	})
}

// ListFinderProjects returns all monitored condominium projects
func ListFinderProjects(c *fiber.Ctx) error {
	var projects []models.FinderProject
	if err := database.DB.Order("id desc").Find(&projects).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to load projects",
		})
	}
	return c.JSON(fiber.Map{
		"status": "success",
		"data":   projects,
	})
}

// CreateFinderProject creates a new condominium search project
func CreateFinderProject(c *fiber.Ctx) error {
	var project models.FinderProject
	if err := c.BodyParser(&project); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid project data",
		})
	}

	if strings.TrimSpace(project.ProjectName) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Project name is required",
		})
	}

	if project.PropertyType == "" {
		project.PropertyType = "CONDO"
	}
	if project.ListingType == "" {
		project.ListingType = "ANY"
	}
	project.CreatedAt = time.Now()
	project.UpdatedAt = time.Now()

	if err := database.DB.Create(&project).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to create project",
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"status": "success",
		"data":   project,
	})
}

// UpdateFinderProject updates an existing project configuration
func UpdateFinderProject(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid ID"})
	}

	var existing models.FinderProject
	if err := database.DB.First(&existing, uint(id)).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"status": "error", "message": "Project not found"})
	}

	if err := c.BodyParser(&existing); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid body"})
	}
	existing.ID = uint(id)
	existing.UpdatedAt = time.Now()

	if err := database.DB.Save(&existing).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to update project"})
	}

	return c.JSON(fiber.Map{"status": "success", "data": existing})
}

// DeleteFinderProject removes a project
func DeleteFinderProject(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid ID"})
	}

	if err := database.DB.Delete(&models.FinderProject{}, uint(id)).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to delete project"})
	}

	return c.JSON(fiber.Map{"status": "success", "message": "Project deleted successfully"})
}

// ToggleFinderProject enables or disables a project
func ToggleFinderProject(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid ID"})
	}

	var existing models.FinderProject
	if err := database.DB.First(&existing, uint(id)).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"status": "error", "message": "Project not found"})
	}

	existing.Enabled = !existing.Enabled
	existing.UpdatedAt = time.Now()
	database.DB.Save(&existing)

	return c.JSON(fiber.Map{"status": "success", "data": existing})
}

// ListFinderSources returns collection sources
func ListFinderSources(c *fiber.Ctx) error {
	var sources []models.FinderSource
	database.DB.Order("id asc").Find(&sources)
	return c.JSON(fiber.Map{
		"status": "success",
		"data":   sources,
	})
}

// CreateFinderSource creates a new collection source
func CreateFinderSource(c *fiber.Ctx) error {
	var source models.FinderSource
	if err := c.BodyParser(&source); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid data"})
	}
	source.CreatedAt = time.Now()
	source.UpdatedAt = time.Now()
	if err := database.DB.Create(&source).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": "Failed to create source"})
	}
	return c.Status(http.StatusCreated).JSON(fiber.Map{"status": "success", "data": source})
}

// UpdateFinderSource updates a source
func UpdateFinderSource(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid ID"})
	}

	var source models.FinderSource
	if err := database.DB.First(&source, uint(id)).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"status": "error", "message": "Source not found"})
	}
	if err := c.BodyParser(&source); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid data"})
	}
	source.ID = uint(id)
	source.UpdatedAt = time.Now()
	database.DB.Save(&source)

	return c.JSON(fiber.Map{"status": "success", "data": source})
}

// DeleteFinderSource removes a source
func DeleteFinderSource(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid ID"})
	}
	database.DB.Delete(&models.FinderSource{}, uint(id))
	return c.JSON(fiber.Map{"status": "success", "message": "Source deleted"})
}

// ListFinderPosts queries posts with rich filters, search, and sorting
func ListFinderPosts(c *fiber.Ctx) error {
	query := database.DB.Model(&models.FinderPost{}).Preload("Project").Preload("Analysis")

	hasAnalysisJoin := false
	ensureAnalysisJoin := func() {
		if !hasAnalysisJoin {
			query = query.Joins("LEFT JOIN finder_analyses ON finder_analyses.post_id = finder_posts.id")
			hasAnalysisJoin = true
		}
	}

	// Filters
	if projectID := c.Query("project_id"); projectID != "" && projectID != "all" {
		query = query.Where("matched_project_id = ?", projectID)
	}

	if classification := c.Query("classification"); classification != "" && classification != "all" {
		ensureAnalysisJoin()
		query = query.Where("finder_analyses.owner_classification = ?", classification)
	}

	if listingType := c.Query("listing_type"); listingType != "" && listingType != "all" {
		ensureAnalysisJoin()
		query = query.Where("finder_analyses.listing_type = ?", listingType)
	}

	if minPriceStr := c.Query("min_price"); minPriceStr != "" {
		if minPrice, err := strconv.ParseFloat(minPriceStr, 64); err == nil {
			ensureAnalysisJoin()
			query = query.Where("(finder_analyses.rental_price >= ? OR finder_analyses.sale_price >= ?)", minPrice, minPrice)
		}
	}

	if maxPriceStr := c.Query("max_price"); maxPriceStr != "" {
		if maxPrice, err := strconv.ParseFloat(maxPriceStr, 64); err == nil {
			ensureAnalysisJoin()
			query = query.Where("(finder_analyses.rental_price <= ? OR finder_analyses.sale_price <= ?)", maxPrice, maxPrice)
		}
	}

	if minSizeStr := c.Query("min_size"); minSizeStr != "" {
		if minSize, err := strconv.ParseFloat(minSizeStr, 64); err == nil {
			ensureAnalysisJoin()
			query = query.Where("finder_analyses.size_sqm >= ?", minSize)
		}
	}

	if bedroomsStr := c.Query("bedrooms"); bedroomsStr != "" && bedroomsStr != "all" {
		if beds, err := strconv.Atoi(bedroomsStr); err == nil {
			ensureAnalysisJoin()
			query = query.Where("finder_analyses.bedrooms = ?", beds)
		}
	}

	if search := strings.TrimSpace(c.Query("search")); search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("finder_posts.post_text ILIKE ? OR finder_posts.author_display_name ILIKE ? OR finder_posts.source_group ILIKE ?",
			searchPattern, searchPattern, searchPattern)
	}

	// Sorting
	sortBy := c.Query("sort_by", "newest")
	switch sortBy {
	case "oldest":
		query = query.Order("finder_posts.created_at asc")
	case "highest_confidence":
		ensureAnalysisJoin()
		query = query.Order("finder_analyses.confidence desc")
	case "lowest_price":
		ensureAnalysisJoin()
		query = query.Order("COALESCE(finder_analyses.rental_price, finder_analyses.sale_price) asc")
	case "highest_price":
		ensureAnalysisJoin()
		query = query.Order("COALESCE(finder_analyses.sale_price, finder_analyses.rental_price) desc")
	case "largest_room":
		ensureAnalysisJoin()
		query = query.Order("finder_analyses.size_sqm desc")
	default:
		query = query.Order("finder_posts.created_at desc")
	}

	var total int64
	query.Count(&total)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var posts []models.FinderPost
	if err := query.Limit(limit).Offset(offset).Find(&posts).Error; err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": "Failed to fetch posts",
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   posts,
		"meta": fiber.Map{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// GetFinderPost returns single post with complete details
func GetFinderPost(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid ID"})
	}

	var post models.FinderPost
	if err := database.DB.Preload("Project").Preload("Analysis").First(&post, uint(id)).Error; err != nil {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{"status": "error", "message": "Post not found"})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   post,
	})
}

// AnalyzeRawPostContent processes raw pasted text (single or multiple posts), runs AI extraction, matches monitored condos, deduplicates, and saves to database
func AnalyzeRawPostContent(c *fiber.Ctx) error {
	var body struct {
		RawContent string `json:"raw_content"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Invalid request body",
		})
	}

	trimmed := strings.TrimSpace(body.RawContent)
	if trimmed == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Please paste Facebook post content to analyze",
		})
	}

	svc := services.GetPropertyFinderService()
	results, err := svc.ProcessRawContent(trimmed)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status":         "success",
		"total_detected": len(results),
		"results":        results,
	})
}

// ImportFinderPost handles manual or single post submission
func ImportFinderPost(c *fiber.Ctx) error {
	var input models.FinderPost
	if err := c.BodyParser(&input); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid post data"})
	}

	if strings.TrimSpace(input.PostText) == "" && strings.TrimSpace(input.PostURL) == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Post text or URL is required",
		})
	}

	autoAnalyze := c.Query("auto_analyze", "true") == "true"
	svc := services.GetPropertyFinderService()
	created, isDuplicate, err := svc.IngestPost(input, autoAnalyze)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.Status(http.StatusCreated).JSON(fiber.Map{
		"status":       "success",
		"is_duplicate": isDuplicate,
		"data":         created,
	})
}

// BatchImportFinderPosts handles array of posts
func BatchImportFinderPosts(c *fiber.Ctx) error {
	var body struct {
		Posts       []models.FinderPost `json:"posts"`
		AutoAnalyze bool                `json:"auto_analyze"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid request body"})
	}

	svc := services.GetPropertyFinderService()
	var createdList []*models.FinderPost
	duplicateCount := 0

	for _, p := range body.Posts {
		created, isDup, err := svc.IngestPost(p, body.AutoAnalyze)
		if err == nil && created != nil {
			if isDup {
				duplicateCount++
			} else {
				createdList = append(createdList, created)
			}
		}
	}

	return c.JSON(fiber.Map{
		"status":          "success",
		"imported_count": len(createdList),
		"duplicate_count": duplicateCount,
		"data":            createdList,
	})
}

// AnalyzeFinderPost triggers or re-triggers AI analysis on a post
func AnalyzeFinderPost(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid ID"})
	}

	svc := services.GetPropertyFinderService()
	analysis, err := svc.AnalyzePost(uint(id))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   analysis,
	})
}

// DeleteFinderPost removes a post and its associated analysis
func DeleteFinderPost(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid ID"})
	}

	database.DB.Where("post_id = ?", uint(id)).Delete(&models.FinderAnalysis{})
	database.DB.Where("post_id = ?", uint(id)).Delete(&models.FinderJob{})
	database.DB.Delete(&models.FinderPost{}, uint(id))

	return c.JSON(fiber.Map{"status": "success", "message": "Post deleted successfully"})
}

// GetFinderSettings returns current settings
func GetFinderSettings(c *fiber.Ctx) error {
	var settings []models.FinderSetting
	database.DB.Find(&settings)
	settingsMap := make(map[string]string)
	for _, s := range settings {
		settingsMap[s.Key] = s.Value
	}
	return c.JSON(fiber.Map{"status": "success", "data": settingsMap})
}

// UpdateFinderSettings updates settings
func UpdateFinderSettings(c *fiber.Ctx) error {
	var updates map[string]string
	if err := c.BodyParser(&updates); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"status": "error", "message": "Invalid settings data"})
	}

	svc := services.GetPropertyFinderService()
	for k, v := range updates {
		_ = svc.SetSetting(k, v)
	}

	return c.JSON(fiber.Map{"status": "success", "message": "Settings updated"})
}

// LoadSampleFinderPosts loads realistic Thai sample posts for testing
func LoadSampleFinderPosts(c *fiber.Ctx) error {
	svc := services.GetPropertyFinderService()
	posts, err := svc.SeedSamplePosts()
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": err.Error()})
	}
	return c.JSON(fiber.Map{
		"status": "success",
		"count":  len(posts),
		"data":   posts,
	})
}

// TestTelegramNotification sends a test message to verify Telegram bot setup
func TestTelegramNotification(c *fiber.Ctx) error {
	var body struct {
		BotToken string `json:"bot_token"`
		ChatID   string `json:"chat_id"`
	}
	_ = c.BodyParser(&body)

	svc := services.GetPropertyFinderService()
	botToken := body.BotToken
	if botToken == "" {
		botToken = svc.GetSetting("telegram_bot_token", "")
	}
	chatID := body.ChatID
	if chatID == "" {
		chatID = svc.GetSetting("telegram_chat_id", "")
	}

	if botToken == "" || chatID == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": "Both Telegram Bot Token and Chat ID are required",
		})
	}

	msg := "🔔 *Facebook Property Finder* — Telegram Notification Test Successful! Your alerts are properly configured."
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	resp, err := http.Post(apiURL, "application/json", strings.NewReader(fmt.Sprintf(`{"chat_id":"%s","text":"%s","parse_mode":"Markdown"}`, chatID, msg)))
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"status": "error", "message": err.Error()})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"status":  "error",
			"message": fmt.Sprintf("Telegram API returned error status: %d. Check your Bot Token and Chat ID.", resp.StatusCode),
		})
	}

	return c.JSON(fiber.Map{"status": "success", "message": "Test notification sent successfully!"})
}

