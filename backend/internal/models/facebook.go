package models

import (
	"time"

	"gorm.io/gorm"
)

type FacebookConnectionStatus string

const (
	FBStatusConnected    FacebookConnectionStatus = "CONNECTED"
	FBStatusExpired      FacebookConnectionStatus = "EXPIRED"
	FBStatusDisconnected FacebookConnectionStatus = "DISCONNECTED"
)

type SessionStatus string

const (
	SessionDisconnected        SessionStatus = "DISCONNECTED"
	SessionConnecting          SessionStatus = "CONNECTING"
	SessionLoginRequired       SessionStatus = "LOGIN_REQUIRED"
	SessionAuthenticating      SessionStatus = "AUTHENTICATING"
	SessionConnected           SessionStatus = "CONNECTED"
	SessionExpired             SessionStatus = "EXPIRED"
	SessionReconnectRequired  SessionStatus = "RECONNECT_REQUIRED"
	SessionBlocked             SessionStatus = "BLOCKED"
	SessionError               SessionStatus = "ERROR"
)

type ImportStatus string

const (
	ImportPending        ImportStatus = "PENDING"
	ImportSuccess        ImportStatus = "SUCCESS"
	ImportFailed         ImportStatus = "FAILED"
	ImportManualRequired ImportStatus = "MANUAL_REQUIRED"
	ImportBlocked        ImportStatus = "BLOCKED"
)

type JobStatus string

const (
	JobStatusNew                     JobStatus = "NEW"
	JobStatusQueued                  JobStatus = "QUEUED"
	JobStatusProcessing              JobStatus = "PROCESSING"
	JobStatusStartingBrowser         JobStatus = "STARTING_BROWSER"
	JobStatusSessionCheck            JobStatus = "SESSION_CHECK"
	JobStatusOpeningFacebook         JobStatus = "OPENING_FACEBOOK"
	JobStatusOpeningPost             JobStatus = "OPENING_POST"
	JobStatusVerifyingPost           JobStatus = "VERIFYING_POST"
	JobStatusExtractingContent       JobStatus = "EXTRACTING_CONTENT"
	JobStatusExtractingImages        JobStatus = "EXTRACTING_IMAGES"
	JobStatusDownloadingImages       JobStatus = "DOWNLOADING_IMAGES"
	JobStatusSavingAssets            JobStatus = "SAVING_ASSETS"
	JobStatusImportComplete          JobStatus = "IMPORT_COMPLETE"
	JobStatusSuccess                 JobStatus = "SUCCESS"
	JobStatusManualRequired          JobStatus = "MANUAL_REQUIRED"
	JobStatusLoginRequired           JobStatus = "LOGIN_REQUIRED"
	JobStatusReconnectRequired       JobStatus = "RECONNECT_REQUIRED"
	JobStatusCaptchaBlocked          JobStatus = "CAPTCHA_BLOCKED"
	JobStatusAccessDenied            JobStatus = "ACCESS_DENIED"
	JobStatusTargetPostNotConfirmed  JobStatus = "TARGET_POST_NOT_CONFIRMED"
	JobStatusFailed                  JobStatus = "FAILED"
	JobStatusCancelled               JobStatus = "CANCELLED"
)

type ImageStatus string

const (
	ImageStatusOriginal  ImageStatus = "ORIGINAL"
	ImageStatusEnhanced  ImageStatus = "ENHANCED"
	ImageStatusWatermark ImageStatus = "WATERMARKED"
	ImageStatusPurged    ImageStatus = "PURGED"
)

// FacebookAccount holds Meta OAuth connection for a user
type FacebookAccount struct {
	ID             uint                     `gorm:"primaryKey" json:"id"`
	UserID         uint                     `gorm:"not null;index" json:"user_id"`
	FacebookUserID string                   `gorm:"type:varchar(100);not null" json:"facebook_user_id"`
	Name           string                   `gorm:"type:varchar(255);not null" json:"name"`
	AccessToken    string                   `gorm:"type:text;not null" json:"-"` // Encrypted / Secret
	TokenType      string                   `gorm:"type:varchar(50);default:'bearer'" json:"token_type"`
	ExpiresAt      time.Time                `json:"expires_at"`
	Status         FacebookConnectionStatus `gorm:"type:varchar(20);default:'CONNECTED'" json:"status"`
	CreatedAt      time.Time                `json:"created_at"`
	UpdatedAt      time.Time                `json:"updated_at"`
	DeletedAt      gorm.DeletedAt           `gorm:"index" json:"-"`
	Pages          []FacebookPage           `gorm:"foreignKey:FacebookAccountID" json:"pages,omitempty"`
}

// FacebookPage holds managed Facebook Page access details
type FacebookPage struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	FacebookAccountID uint      `gorm:"not null;index" json:"facebook_account_id"`
	PageID            string    `gorm:"type:varchar(100);not null;index" json:"page_id"`
	Name              string    `gorm:"type:varchar(255);not null" json:"name"`
	Category          string    `gorm:"type:varchar(100)" json:"category"`
	PageAccessToken   string    `gorm:"type:text;not null" json:"-"` // Secret Page Access Token
	IsConnected       bool      `gorm:"default:true" json:"is_connected"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// FacebookImportJob manages background job queue idempotency & retries
type FacebookImportJob struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	PropertyID    uint      `gorm:"not null;index" json:"property_id"`
	SourceURL     string    `gorm:"type:text;not null" json:"source_url"`
	NormalizedURL string    `gorm:"type:varchar(255);not null;index" json:"normalized_url"`
	Provider      string    `gorm:"type:varchar(50);not null" json:"provider"` // META_GRAPH, BROWSER, MOCK, MANUAL
	Status        JobStatus `gorm:"type:varchar(30);default:'NEW';index" json:"status"`
	Attempts      int       `gorm:"default:0" json:"attempts"`
	ErrorCode     string    `gorm:"type:varchar(100)" json:"error_code,omitempty"`
	ErrorMessage  string    `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// BrowserSession stores state of persistent authenticated browser session profile
type BrowserSession struct {
	ID                 uint          `gorm:"primaryKey" json:"id"`
	UserID             uint          `gorm:"not null;index" json:"user_id"`
	Provider           string        `gorm:"type:varchar(50);default:'PLAYWRIGHT_CHROMIUM'" json:"provider"`
	AccountDisplayName string        `gorm:"type:varchar(255)" json:"account_display_name"`
	SessionStatus      SessionStatus `gorm:"type:varchar(30);default:'CONNECTED';index" json:"session_status"`
	ProfileIdentifier  string        `gorm:"type:varchar(255);not null" json:"profile_identifier"`
	LastConnectedAt    *time.Time    `json:"last_connected_at,omitempty"`
	LastVerifiedAt     *time.Time    `json:"last_verified_at,omitempty"`
	LastUsedAt         *time.Time    `json:"last_used_at,omitempty"`
	ExpiresAt          *time.Time    `json:"expires_at,omitempty"`
	LastError          string        `gorm:"type:text" json:"last_error,omitempty"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at"`
}

// ImportSource stores original source snapshot
type ImportSource struct {
	ID                uint         `gorm:"primaryKey" json:"id"`
	PropertyID        uint         `gorm:"not null;index" json:"property_id"`
	FacebookURL       string       `gorm:"type:text;not null" json:"facebook_url"`
	NormalizedURL     string       `gorm:"type:varchar(255);index" json:"normalized_url"`
	FacebookPostID    string       `gorm:"type:varchar(100);index" json:"facebook_post_id"`
	FacebookPageID    string       `gorm:"type:varchar(100);index" json:"facebook_page_id"`
	SourceType        string       `gorm:"type:varchar(50);default:'FACEBOOK_POST'" json:"source_type"`
	SourceName        string       `gorm:"type:varchar(255)" json:"source_name"`
	OriginalContent   string       `gorm:"type:text" json:"original_content"`
	OriginalTimestamp *time.Time   `json:"original_timestamp,omitempty"`
	ImportTimestamp   time.Time    `json:"import_timestamp"`
	Provider          string       `gorm:"type:varchar(50)" json:"provider"`
	ImportStatus      ImportStatus `gorm:"type:varchar(30);default:'PENDING';index" json:"import_status"`
	ImportError       string       `gorm:"type:text" json:"import_error,omitempty"`
	CreatedAt         time.Time    `json:"created_at"`
	UpdatedAt         time.Time    `json:"updated_at"`
}

// PropertyImage holds downloaded image metadata in Cloudflare R2 / S3 storage
type PropertyImage struct {
	ID               uint        `gorm:"primaryKey" json:"id"`
	PropertyID       uint        `gorm:"not null;index" json:"property_id"`
	SourceURL        string      `gorm:"type:text" json:"source_url"`
	StorageKey       string      `gorm:"type:varchar(255);not null;index" json:"storage_key"`
	PublicURL        string      `gorm:"type:text" json:"public_url"`
	OriginalFilename string      `gorm:"type:varchar(255)" json:"original_filename"`
	MimeType         string      `gorm:"type:varchar(50)" json:"mime_type"`
	FileSize         int64       `json:"file_size"`
	Width            int         `json:"width"`
	Height           int         `json:"height"`
	SortOrder        int         `gorm:"default:0" json:"sort_order"`
	Checksum         string      `gorm:"type:varchar(64);index" json:"checksum"` // SHA-256 for deduplication
	Provider         string      `gorm:"type:varchar(50)" json:"provider"`
	Status           ImageStatus `gorm:"type:varchar(20);default:'ORIGINAL'" json:"status"`
	CreatedAt        time.Time   `json:"created_at"`
}
