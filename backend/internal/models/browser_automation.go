package models

import (
	"time"

	"gorm.io/gorm"
)

// BrowserProcessingMode defines the operational engine for the External Browser node.
type BrowserProcessingMode string

const (
	ProcessingModeChromeAssisted BrowserProcessingMode = "chrome_assisted"
	ProcessingModeLocalEnhance   BrowserProcessingMode = "local_enhance"
	ProcessingModeAuthorizedAPI  BrowserProcessingMode = "authorized_api"
)

// ImageJobStatus defines the discrete state machine for an image processing job.
type ImageJobStatus string

const (
	ImgJobStatusPending          ImageJobStatus = "PENDING"
	ImgJobStatusPreparing        ImageJobStatus = "PREPARING"
	ImgJobStatusReadyForUser     ImageJobStatus = "READY_FOR_USER"
	ImgJobStatusAwaitingDownload ImageJobStatus = "AWAITING_DOWNLOAD"
	ImgJobStatusProcessingLocal  ImageJobStatus = "PROCESSING_LOCAL"
	ImgJobStatusProcessingAPI    ImageJobStatus = "PROCESSING_API"
	ImgJobStatusValidating       ImageJobStatus = "VALIDATING"
	ImgJobStatusCompleted        ImageJobStatus = "COMPLETED"
	ImgJobStatusFailed           ImageJobStatus = "FAILED"
	ImgJobStatusSkipped          ImageJobStatus = "SKIPPED"
	ImgJobStatusCancelled        ImageJobStatus = "CANCELLED"
)

// BrowserProfile represents a registered Google Chrome profile on the user's computer.
type BrowserProfile struct {
	ID                  uint           `gorm:"primaryKey" json:"id"`
	ProfileKey          string         `gorm:"type:varchar(100);not null;index" json:"profile_key"` // e.g. "Profile 15", "Default"
	DisplayName         string         `gorm:"type:varchar(255);not null" json:"display_name"`      // e.g. "Bolt", "Zin", "Work"
	Email               string         `gorm:"type:varchar(255)" json:"email"`
	IntegrationID       string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"integration_id"`
	Status              string         `gorm:"type:varchar(50);default:'registered'" json:"status"` // "connected", "registered", "disconnected"
	LastSeenAt          time.Time      `json:"last_seen_at"`
	AssociatedTabGroups JSONMap        `gorm:"type:jsonb" json:"associated_tab_groups"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

func (BrowserProfile) TableName() string {
	return "browser_profiles"
}

// BrowserGroupBinding persists the logical mapping between a Chrome profile and a tab group.
type BrowserGroupBinding struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	ProfileID      uint           `gorm:"not null;index" json:"profile_id"`
	GroupName      string         `gorm:"type:varchar(150);not null;index" json:"group_name"` // e.g. "Raw", "Market Place", "Bolt-Tiktok"
	GroupColor     string         `gorm:"type:varchar(50)" json:"group_color"`
	TargetTabURL   string         `gorm:"type:text" json:"target_tab_url"`
	TargetTabTitle string         `gorm:"type:varchar(255)" json:"target_tab_title"`
	IsActive       bool           `gorm:"default:true" json:"is_active"`
	LastBoundAt    time.Time      `json:"last_bound_at"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

func (BrowserGroupBinding) TableName() string {
	return "browser_group_bindings"
}

// ProcessingLane represents a dedicated processing lane with assigned profile, group, and prompt.
type ProcessingLane struct {
	ID               uint                  `gorm:"primaryKey" json:"id"`
	LaneKey          string                `gorm:"type:varchar(100);uniqueIndex;not null" json:"lane_key"` // e.g. "lane-1", "lane-2"
	DisplayName      string                `gorm:"type:varchar(255);not null" json:"display_name"`
	ProcessingMode   BrowserProcessingMode `gorm:"type:varchar(50);default:'chrome_assisted'" json:"processing_mode"`
	ProfileID        uint                  `gorm:"index" json:"profile_id"`
	ProfileName      string                `gorm:"type:varchar(150)" json:"profile_name"`
	GroupName        string                `gorm:"type:varchar(150)" json:"group_name"`
	TargetTabTitle   string                `gorm:"type:varchar(255)" json:"target_tab_title"`
	PromptTemplateID string                `gorm:"type:varchar(100)" json:"prompt_template_id"`
	OutputFormat     string                `gorm:"type:varchar(50);default:'1080x1350'" json:"output_format"`
	Concurrency      int                   `gorm:"default:1" json:"concurrency"`
	Status           string                `gorm:"type:varchar(50);default:'idle'" json:"status"` // "idle", "processing", "paused"
	RetryPolicy      JSONMap               `gorm:"type:jsonb" json:"retry_policy"`
	CreatedAt        time.Time             `json:"created_at"`
	UpdatedAt        time.Time             `json:"updated_at"`
	DeletedAt        gorm.DeletedAt        `gorm:"index" json:"-"`
}

func (ProcessingLane) TableName() string {
	return "processing_lanes"
}

// ImageProcessingJob represents an individual image queue job for property photo enhancement.
type ImageProcessingJob struct {
	ID                       uint                  `gorm:"primaryKey" json:"id"`
	JobID                    string                `gorm:"type:varchar(100);uniqueIndex;not null" json:"job_id"`
	PropertyID               string                `gorm:"type:varchar(150);not null;index" json:"property_id"`
	PropertyName             string                `gorm:"type:varchar(255)" json:"property_name"`
	SourceImageID            string                `gorm:"type:varchar(100);not null" json:"source_image_id"`
	OriginalPosition         int                   `gorm:"not null" json:"original_position"` // 1, 2, 3... preserves image order
	SourceFilePath           string                `gorm:"type:text" json:"source_file_path"`
	SourceFileURL            string                `gorm:"type:text" json:"source_file_url"`
	OriginalFileHash         string                `gorm:"type:varchar(100)" json:"original_file_hash"`
	ProcessingMode           BrowserProcessingMode `gorm:"type:varchar(50);default:'chrome_assisted'" json:"processing_mode"`
	LaneID                   string                `gorm:"type:varchar(100)" json:"lane_id"`
	PromptTemplateID         string                `gorm:"type:varchar(100)" json:"prompt_template_id"`
	PromptVersion            string                `gorm:"type:varchar(50)" json:"prompt_version"`
	ResolvedPrompt           string                `gorm:"type:text" json:"resolved_prompt"`
	SelectedProfile          string                `gorm:"type:varchar(150)" json:"selected_profile"`
	SelectedTabGroup         string                `gorm:"type:varchar(150)" json:"selected_tab_group"`
	SelectedTargetTab        string                `gorm:"type:varchar(255)" json:"selected_target_tab"`
	OutputFileRef            string                `gorm:"type:varchar(255)" json:"output_file_ref"`
	OutputFilePath           string                `gorm:"type:text" json:"output_file_path"`
	OutputFileURL            string                `gorm:"type:text" json:"output_file_url"`
	OutputWidth              int                   `json:"output_width"`
	OutputHeight             int                   `json:"output_height"`
	OutputFileHash           string                `gorm:"type:varchar(100)" json:"output_file_hash"`
	Status                   ImageJobStatus        `gorm:"type:varchar(50);default:'PENDING';index" json:"status"`
	AttemptCount             int                   `gorm:"default:0" json:"attempt_count"`
	ErrorMessage             string                `gorm:"type:text" json:"error_message"`
	StrictPreservationActive bool                  `gorm:"default:true" json:"strict_preservation_active"`
	StartedAt                *time.Time            `json:"started_at"`
	CompletedAt              *time.Time            `json:"completed_at"`
	CreatedAt                time.Time             `json:"created_at"`
	UpdatedAt                time.Time             `json:"updated_at"`
	DeletedAt                gorm.DeletedAt        `gorm:"index" json:"-"`
}

func (ImageProcessingJob) TableName() string {
	return "image_processing_jobs"
}

// JobEvent records state transitions and audit logs for an image job.
type JobEvent struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	JobID     string    `gorm:"type:varchar(100);not null;index" json:"job_id"`
	FromState string    `gorm:"type:varchar(50)" json:"from_state"`
	ToState   string    `gorm:"type:varchar(50)" json:"to_state"`
	Message   string    `gorm:"type:text" json:"message"`
	Metadata  JSONMap   `gorm:"type:jsonb" json:"metadata"`
	CreatedAt time.Time `json:"created_at"`
}

func (JobEvent) TableName() string {
	return "job_events"
}

// ProcessedImageOutput tracks validated output image assets linked to listings and workflows.
type ProcessedImageOutput struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	PropertyID      string    `gorm:"type:varchar(150);not null;index" json:"property_id"`
	JobID           string    `gorm:"type:varchar(100);not null;index" json:"job_id"`
	OriginalImageID string    `gorm:"type:varchar(100);not null" json:"original_image_id"`
	OutputType      string    `gorm:"type:varchar(100);default:'enhanced'" json:"output_type"` // enhanced, facebook_hero, tiktok_hero, etc.
	OutputOrder     int       `gorm:"not null" json:"output_order"`
	Width           int       `json:"width"`
	Height          int       `json:"height"`
	Format          string    `gorm:"type:varchar(50);default:'png'" json:"format"`
	Checksum        string    `gorm:"type:varchar(100)" json:"checksum"`
	FilePath        string    `gorm:"type:text;not null" json:"file_path"`
	FileURL         string    `gorm:"type:text;not null" json:"file_url"`
	CreatedAt       time.Time `json:"created_at"`
}

func (ProcessedImageOutput) TableName() string {
	return "processed_image_outputs"
}

// DownloadWatcherSetting persists configurations for local macOS folder monitoring.
type DownloadWatcherSetting struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	WatchDirectory     string    `gorm:"type:text;not null" json:"watch_directory"`
	AutoAdvanceQueue   bool      `gorm:"default:true" json:"auto_advance_queue"`
	TargetFormat       string    `gorm:"type:varchar(50);default:'1080x1350'" json:"target_format"`
	TargetAspectRatio  string    `gorm:"type:varchar(50);default:'4:5'" json:"target_aspect_ratio"`
	StrictPreservation bool      `gorm:"default:true" json:"strict_preservation"`
	LastDetectedFile   string    `gorm:"type:text" json:"last_detected_file"`
	LastDetectedAt     time.Time `json:"last_detected_at"`
	IsActive           bool      `gorm:"default:true" json:"is_active"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (DownloadWatcherSetting) TableName() string {
	return "download_watcher_settings"
}
