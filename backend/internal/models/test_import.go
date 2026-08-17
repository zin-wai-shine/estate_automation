package models

import (
	"time"

	"gorm.io/gorm"
)

type TestRunStatus string

const (
	TestStatusQueued                 TestRunStatus = "QUEUED"
	TestStatusRunning                TestRunStatus = "RUNNING"
	TestStatusSuccess                TestRunStatus = "SUCCESS"
	TestStatusFailed                 TestRunStatus = "FAILED"
	TestStatusLoginRequired          TestRunStatus = "FACEBOOK_SESSION_REQUIRED"
	TestStatusTargetPostNotConfirmed TestRunStatus = "TARGET_POST_NOT_CONFIRMED"
	TestStatusScopeFailed            TestRunStatus = "EXTRACTION_SCOPE_FAILED"
)

// TestImportRun corresponds to table `test_runs`
type TestImportRun struct {
	ID                    uint           `gorm:"primaryKey" json:"id"`
	TestRunID             string         `gorm:"type:varchar(64);not null;uniqueIndex" json:"test_run_id"` // e.g. TEST-20260817-0001
	FacebookURL           string         `gorm:"type:text;not null" json:"facebook_url"`
	NormalizedURL         string         `gorm:"type:varchar(255);not null;index" json:"normalized_url"`
	FinalURL              string         `gorm:"type:varchar(255)" json:"final_url"`
	SessionStatus         string         `gorm:"type:varchar(30);default:'CONNECTED'" json:"session_status"`
	TargetPostFound       bool           `gorm:"default:false" json:"target_post_found"`
	TargetPostID          string         `gorm:"type:varchar(100);index" json:"target_post_id"`
	TargetPostURL         string         `gorm:"type:text" json:"target_post_url"`
	TargetAuthor          string         `gorm:"type:varchar(255)" json:"target_author"`
	DetectionMethod       string         `gorm:"type:varchar(255)" json:"detection_method"`
	Confidence            float64        `gorm:"default:0.0" json:"confidence"`
	DetectionReason       string         `gorm:"type:text" json:"detection_reason"`
	ExtractedContent      string         `gorm:"type:text" json:"extracted_content"`
	ContentLength         int            `gorm:"default:0" json:"content_length"`
	ImageCount            int            `gorm:"default:0" json:"image_count"`
	ImagesDownloadedCount int            `gorm:"default:0" json:"images_downloaded_count"`
	ImagesValidatedCount  int            `gorm:"default:0" json:"images_validated_count"`
	Status                TestRunStatus  `gorm:"type:varchar(35);default:'QUEUED';index" json:"status"`
	ErrorCode             string         `gorm:"type:varchar(100)" json:"error_code,omitempty"`
	ErrorMessage          string         `gorm:"type:text" json:"error_message,omitempty"`
	DebugScreenshotPath   string         `gorm:"type:text" json:"debug_screenshot_path,omitempty"`
	RawDOMSnapshot        string         `gorm:"type:text" json:"raw_dom_snapshot,omitempty"`
	ExecutionDurationMs   int64          `gorm:"default:0" json:"execution_duration_ms"`
	CreatedAt             time.Time      `json:"created_at"`
	CompletedAt           *time.Time     `json:"completed_at,omitempty"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`
	Images                []TestImportImage `gorm:"foreignKey:TestRunID;references:TestRunID" json:"images,omitempty"`
}

// TestImportImage corresponds to table `test_run_images`
type TestImportImage struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	TestRunID       string    `gorm:"type:varchar(64);not null;index" json:"test_run_id"`
	TargetPostID    string    `gorm:"type:varchar(100);index" json:"target_post_id"`
	OriginalOrder   int       `gorm:"default:1" json:"original_order"`
	SourceReference string    `gorm:"type:text" json:"source_reference"`
	StorageKey      string    `gorm:"type:varchar(255);not null;index" json:"storage_key"`
	PublicURL       string    `gorm:"type:text" json:"public_url"`
	MimeType        string    `gorm:"type:varchar(50)" json:"mime_type"`
	Width           int       `json:"width"`
	Height          int       `json:"height"`
	FileSize        int64     `json:"file_size"`
	Checksum        string    `gorm:"type:varchar(64);index" json:"checksum"`
	DownloadStatus  string    `gorm:"type:varchar(30);default:'SUCCESS'" json:"download_status"`
	CreatedAt       time.Time `json:"created_at"`
}
