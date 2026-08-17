package database

import (
	"fmt"
	"log"
	"os"

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
	)
	if err != nil {
		log.Fatalf("Failed to auto-migrate models: %v", err)
	}

	SeedAdmin(db)

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
