package models

import (
	"time"
)

// Owner Classification Types
const (
	ClassificationOwnerClaimed  = "OWNER_CLAIMED"
	ClassificationLikelyOwner   = "LIKELY_OWNER"
	ClassificationAgent         = "AGENT"
	ClassificationAgency        = "PROPERTY_AGENCY"
	ClassificationUnclear       = "UNCLEAR"
)

// Pipeline Job Statuses
const (
	FinderJobStatusReady          = "READY"
	FinderJobStatusConnected      = "CONNECTED"
	FinderJobStatusDisconnected   = "DISCONNECTED"
	FinderJobStatusCollecting     = "COLLECTING"
	FinderJobStatusProcessing     = "PROCESSING"
	FinderJobStatusCompleted      = "COMPLETED"
	FinderJobStatusPartialSuccess = "PARTIAL_SUCCESS"
	FinderJobStatusFailed         = "FAILED"
	FinderJobStatusAuthRequired   = "AUTHORIZATION_REQUIRED"
)

// FinderProject represents a condominium project search target with keyword rules
type FinderProject struct {
	ID                     uint      `gorm:"primaryKey" json:"id"`
	ProjectName            string    `gorm:"size:255;not null;index" json:"project_name"`
	ThaiName               string    `gorm:"size:255;index" json:"thai_name"`
	EnglishName            string    `gorm:"size:255;index" json:"english_name"`
	AlternativeSpellings   string    `gorm:"type:text" json:"alternative_spellings"` // Comma or JSON
	KeywordsThai           string    `gorm:"type:text" json:"keywords_thai"`
	KeywordsEnglish        string    `gorm:"type:text" json:"keywords_english"`
	PropertyType           string    `gorm:"size:50;default:'CONDO'" json:"property_type"` // CONDO, TOWNHOUSE, etc.
	ListingType            string    `gorm:"size:50;default:'ANY'" json:"listing_type"`    // RENT, SALE, ANY
	TargetMinPrice         float64   `gorm:"default:0" json:"target_min_price"`
	TargetMaxPrice         float64   `gorm:"default:0" json:"target_max_price"`
	TargetMinSizeSqm       float64   `gorm:"default:0" json:"target_min_size_sqm"`
	TargetMaxSizeSqm       float64   `gorm:"default:0" json:"target_max_size_sqm"`
	OwnerKeywords          string    `gorm:"type:text" json:"owner_keywords"`
	AgentExclusionKeywords string    `gorm:"type:text" json:"agent_exclusion_keywords"`
	ImageAnalysisEnabled   bool      `gorm:"default:true" json:"image_analysis_enabled"`
	Enabled                bool      `gorm:"default:true;index" json:"enabled"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

// FinderSource represents an authorized collection source or adapter
type FinderSource struct {
	ID                  uint       `gorm:"primaryKey" json:"id"`
	SourceType          string     `gorm:"size:100;not null" json:"source_type"` // authorized_import, manual_entry, local_browser, meta_page
	SourceName          string     `gorm:"size:255;not null" json:"source_name"`
	SourceURL           string     `gorm:"type:text" json:"source_url"`
	AuthorizationStatus string     `gorm:"size:50;default:'authorized'" json:"authorization_status"` // authorized, pending, disconnected, limited
	Enabled             bool       `gorm:"default:true" json:"enabled"`
	LastCheckedAt       *time.Time `json:"last_checked_at,omitempty"`
	LastError           string     `gorm:"type:text" json:"last_error,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

// FinderPost represents a normalized Facebook post record
type FinderPost struct {
	ID                uint            `gorm:"primaryKey" json:"id"`
	Source            string          `gorm:"size:50;default:'facebook'" json:"source"`
	SourceType        string          `gorm:"size:100;default:'authorized_import'" json:"source_type"` // manual_input, url_import, authorized_import, browser_session
	SourceGroup       string          `gorm:"size:255" json:"source_group"`
	SourcePostID      string          `gorm:"size:255;index" json:"post_id"`
	PostURL           string          `gorm:"type:text" json:"post_url"`
	PostText          string          `gorm:"type:text" json:"post_text"`
	Images            string          `gorm:"type:text" json:"images"` // JSON array of string URLs/base64
	AuthorDisplayName string          `gorm:"size:255" json:"author_display_name"`
	ContentHash       string          `gorm:"size:64;index" json:"content_hash"` // SHA256 of text/url for duplicate detection
	PublishedAt       *time.Time      `json:"published_at,omitempty"`
	CollectedAt       time.Time       `gorm:"index" json:"collected_at"`
	CollectionMethod  string          `gorm:"size:100" json:"collection_method"` // manual_paste, user_url, authorized_page, local_browser
	PermissionsStatus string          `gorm:"size:50;default:'authorized'" json:"permissions_status"`
	IsDuplicate       bool            `gorm:"default:false;index" json:"is_duplicate"`
	IsRelevant        bool            `gorm:"default:false;index" json:"is_relevant"`
	MatchedProjectID  *uint           `gorm:"index" json:"matched_project_id,omitempty"`
	Project           *FinderProject  `gorm:"foreignKey:MatchedProjectID" json:"project,omitempty"`
	Analysis          *FinderAnalysis `gorm:"foreignKey:PostID" json:"analysis,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

// FinderAnalysis stores the deep AI analysis, classification, and OCR extraction
type FinderAnalysis struct {
	ID                  uint       `gorm:"primaryKey" json:"id"`
	PostID              uint       `gorm:"uniqueIndex;not null" json:"post_id"`
	ProjectID           *uint      `gorm:"index" json:"project_id,omitempty"`
	OwnerClassification string     `gorm:"size:50;default:'UNCLEAR';index" json:"owner_classification"` // OWNER_CLAIMED, LIKELY_OWNER, AGENT, PROPERTY_AGENCY, UNCLEAR
	Confidence          float64    `gorm:"default:0" json:"confidence"`                                // 0.0 to 1.0
	PropertyType        string     `gorm:"size:50" json:"property_type"`
	ListingType         string     `gorm:"size:50;index" json:"listing_type"` // RENT, SALE, BOTH, UNCLEAR
	Bedrooms            *int       `json:"bedrooms,omitempty"`
	Bathrooms           *int       `json:"bathrooms,omitempty"`
	Floor               string     `gorm:"size:100" json:"floor,omitempty"`
	Building            string     `gorm:"size:100" json:"building,omitempty"`
	Parking             string     `gorm:"size:100" json:"parking,omitempty"`
	ProjectMatchStatus  string     `gorm:"size:50;default:'UNMATCHED'" json:"project_match_status,omitempty"`
	SizeSqm             *float64   `json:"size_sqm,omitempty"`
	RentalPrice         *float64   `json:"rental_price,omitempty"`
	SalePrice           *float64   `json:"sale_price,omitempty"`
	Furniture           string     `gorm:"type:text" json:"furniture,omitempty"`
	AvailableDate       string     `gorm:"size:100" json:"available_date,omitempty"`
	ContactInfo         string     `gorm:"type:text" json:"contact_info,omitempty"`
	ImportantConditions string     `gorm:"type:text" json:"important_conditions,omitempty"`
	Evidence            string     `gorm:"type:text" json:"evidence,omitempty"`
	Reasons             string     `gorm:"type:text" json:"reasons,omitempty"`
	MissingInfo         string     `gorm:"type:text" json:"missing_info,omitempty"`
	OCRText             string     `gorm:"type:text" json:"ocr_text,omitempty"`
	ImageAnalyzed       bool       `gorm:"default:false" json:"image_analyzed"`
	AnalysisStatus      string     `gorm:"size:50;default:'COMPLETED'" json:"analysis_status"`
	AnalyzedAt          time.Time  `json:"analyzed_at"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

// FinderJob records background job execution and errors
type FinderJob struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	PostID       uint       `gorm:"index" json:"post_id"`
	JobType      string     `gorm:"size:50;not null" json:"job_type"` // text_analysis, ocr_analysis, full_pipeline
	Status       string     `gorm:"size:50;default:'READY';index" json:"status"`
	Attempts     int        `gorm:"default:0" json:"attempts"`
	ErrorMessage string     `gorm:"type:text" json:"error_message,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// FinderSetting stores feature configuration and credentials
type FinderSetting struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Key       string    `gorm:"size:100;uniqueIndex;not null" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

