package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/utils"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// ConnectDB initializes PostgreSQL connection, falling back to SQLite if PostgreSQL is unavailable.
func ConnectDB() *gorm.DB {
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	user := os.Getenv("DB_USER")
	if user == "" {
		user = "postgres"
	}
	password := os.Getenv("DB_PASSWORD")
	if password == "" {
		password = "postgres"
	}
	dbname := os.Getenv("DB_NAME")
	if dbname == "" {
		dbname = "estate_automate"
	}
	port := os.Getenv("DB_PORT")
	if port == "" {
		port = "5432"
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		host, user, password, dbname, port)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Printf("Warning: Failed to connect to PostgreSQL (%v). Initializing SQLite fallback database.", err)
		fallbackDb, fbErr := gorm.Open(sqlite.Open("estate_automate_dev.db"), &gorm.Config{})
		if fbErr != nil {
			log.Fatalf("Fatal error: Could not initialize SQLite fallback database: %v", fbErr)
		}
		db = fallbackDb
		log.Println("Successfully connected to SQLite fallback database (estate_automate_dev.db)")
	} else {
		log.Println("Successfully connected to PostgreSQL database")
	}

	// Auto Migrate models
	err = db.AutoMigrate(
		&models.User{},
		&models.RolePermission{},
		&models.SystemSetting{},
		&models.FacebookAccount{},
		&models.FacebookPage{},
		&models.FacebookImportJob{},
		&models.BrowserSession{},
		&models.ImportSource{},
		&models.PropertyImage{},
		&models.TestImportRun{},
		&models.TestImportImage{},
		&models.FacebookPublishPost{},
		&models.FacebookManagedPage{},
		&models.TikTokAccount{},
		&models.TikTokPublishPost{},
		&models.UrlGroup{},
		// n8n Integration Tables
		&models.N8NWorkflowConnection{},
		&models.N8NExecutionRecord{},
		&models.N8NAutomationSetting{},
		// External Browser Processing & Smart Image Queue Tables
		&models.BrowserProfile{},
		&models.BrowserGroupBinding{},
		&models.ProcessingLane{},
		&models.ImageProcessingJob{},
		&models.JobEvent{},
		&models.ProcessedImageOutput{},
		&models.DownloadWatcherSetting{},
		// Facebook Property Finder Tables
		&models.FinderProject{},
		&models.FinderSource{},
		&models.FinderPost{},
		&models.FinderAnalysis{},
		&models.FinderJob{},
		&models.FinderSetting{},
	)
	if err != nil {
		log.Fatalf("Failed to auto-migrate models: %v", err)
	}

	SeedAdmin(db)
	SeedPropertyFinderDefaults(db)

	DB = db
	return db
}

// SeedAdmin ensures a default Admin user exists in development/production.
func SeedAdmin(db *gorm.DB) {
	var count int64
	db.Model(&models.User{}).Where("email = ?", "admin@estate.com").Count(&count)
	if count == 0 {
		hashedPassword, _ := utils.HashPassword("Admin123!")
		adminUser := models.User{
			Email:    "admin@estate.com",
			Password: hashedPassword,
			Name:     "Platform Administrator",
			Role:     models.RoleAdmin,
			Status:   "ACTIVE",
		}
		if err := db.Create(&adminUser).Error; err != nil {
			log.Printf("Error seeding admin user: %v", err)
		} else {
			log.Println("Seeded default admin user: admin@estate.com / Admin123!")
		}
	}
}

// SeedPropertyFinderDefaults populates default condominium projects, sources, and settings.
func SeedPropertyFinderDefaults(db *gorm.DB) {
	var projectCount int64
	db.Model(&models.FinderProject{}).Count(&projectCount)
	if projectCount == 0 {
		defaultProjects := []models.FinderProject{
			{
				ProjectName:          "Regent Home Bangna",
				ThaiName:             "รีเจ้นท์ โฮม บางนา",
				EnglishName:          "Regent Home Bangna",
				AlternativeSpellings: "Regent Bangna, รีเจ้นท์ บางนา, Regent Home บางนา",
				KeywordsThai:         "รีเจ้นท์ โฮม บางนา, รีเจ้นท์บางนา, คอนโดบางนา, สรรพาวุธ",
				KeywordsEnglish:      "Regent Home Bangna, Regent Bangna, Sanphawut",
				PropertyType:         "CONDO",
				ListingType:          "ANY",
				TargetMinPrice:       6000,
				TargetMaxPrice:       15000,
				TargetMinSizeSqm:     28,
				TargetMaxSizeSqm:     35,
				OwnerKeywords:        "เจ้าของขายเอง, เจ้าของปล่อยเช่าเอง, ขายเอง, ปล่อยเช่าเอง, ห้องของตัวเอง, ไม่ผ่านนายหน้า, ติดต่อเจ้าของโดยตรง",
				AgentExclusionKeywords: "รับฝากขาย, รับฝากเช่า, นายหน้า, รับหาห้อง, มีห้องในมือ, บริษัทอสังหาริมทรัพย์, co-agent, ยินดีรับโค",
				ImageAnalysisEnabled: true,
				Enabled:              true,
			},
			{
				ProjectName:          "Aspire Erawan Prime",
				ThaiName:             "แอสปาย เอราวัณ ไพร์ม",
				EnglishName:          "Aspire Erawan Prime",
				AlternativeSpellings: "Aspire Erawan, แอสปาย เอราวัณ",
				KeywordsThai:         "แอสปาย เอราวัณ ไพร์ม, แอสปาย เอราวัณ, BTS ช้างเอราวัณ",
				KeywordsEnglish:      "Aspire Erawan Prime, Aspire Erawan, BTS Chang Erawan",
				PropertyType:         "CONDO",
				ListingType:          "ANY",
				TargetMinPrice:       7000,
				TargetMaxPrice:       18000,
				TargetMinSizeSqm:     27,
				TargetMaxSizeSqm:     40,
				OwnerKeywords:        "เจ้าของขายเอง, เจ้าของปล่อยเช่าเอง, ขายเอง, ปล่อยเช่าเอง, ห้องของตัวเอง, ไม่ผ่านนายหน้า, ติดต่อเจ้าของโดยตรง",
				AgentExclusionKeywords: "รับฝากขาย, รับฝากเช่า, นายหน้า, รับหาห้อง, มีห้องในมือ, บริษัทอสังหาริมทรัพย์, co-agent",
				ImageAnalysisEnabled: true,
				Enabled:              true,
			},
			{
				ProjectName:          "The Metropolis Samrong",
				ThaiName:             "เดอะ เมโทรโพลิส สำโรง",
				EnglishName:          "The Metropolis Samrong",
				AlternativeSpellings: "Metropolis Samrong, เมโทรโพลิส สำโรง",
				KeywordsThai:         "เดอะ เมโทรโพลิส สำโรง, เมโทรโพลิส สำโรง, BTS สำโรง",
				KeywordsEnglish:      "The Metropolis Samrong, Metropolis Samrong, BTS Samrong",
				PropertyType:         "CONDO",
				ListingType:          "ANY",
				TargetMinPrice:       8000,
				TargetMaxPrice:       22000,
				TargetMinSizeSqm:     28,
				TargetMaxSizeSqm:     55,
				OwnerKeywords:        "เจ้าของขายเอง, เจ้าของปล่อยเช่าเอง, ขายเอง, ปล่อยเช่าเอง, ห้องของตัวเอง, ไม่ผ่านนายหน้า",
				AgentExclusionKeywords: "รับฝากขาย, รับฝากเช่า, นายหน้า, บริษัทอสังหาริมทรัพย์",
				ImageAnalysisEnabled: true,
				Enabled:              true,
			},
		}
		for _, p := range defaultProjects {
			db.Create(&p)
		}
		log.Println("Seeded default Property Finder projects (Regent Home Bangna, etc.)")
	}

	var sourceCount int64
	db.Model(&models.FinderSource{}).Count(&sourceCount)
	if sourceCount == 0 {
		defaultSources := []models.FinderSource{
			{
				SourceType:          "authorized_import",
				SourceName:          "Manual & User-Provided Content",
				SourceURL:           "https://www.facebook.com",
				AuthorizationStatus: "authorized",
				Enabled:             true,
			},
			{
				SourceType:          "local_browser",
				SourceName:          "Local Browser Context (Playwright)",
				SourceURL:           "http://127.0.0.1:9224",
				AuthorizationStatus: "authorized",
				Enabled:             true,
			},
		}
		for _, s := range defaultSources {
			db.Create(&s)
		}
		log.Println("Seeded default Property Finder collection sources")
	}

	// Default settings
	defaultSettings := map[string]string{
		"ai_provider":            "openai",
		"ai_model":               "gpt-4o",
		"enable_image_analysis":  "true",
		"image_analysis_mode":    "conditional",
		"auto_deduplicate":       "true",
		"telegram_enabled":       "false",
		"telegram_bot_token":     "",
		"telegram_chat_id":       "",
		"notify_owner_only":      "true",
		"max_concurrent_jobs":    "3",
		"min_confidence_score":   "0.60",
	}
	for k, v := range defaultSettings {
		var existing models.FinderSetting
		if err := db.Where("key = ?", k).First(&existing).Error; err != nil {
			db.Create(&models.FinderSetting{Key: k, Value: v, UpdatedAt: time.Now()})
		}
	}
}
