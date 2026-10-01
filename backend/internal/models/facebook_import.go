package models

import (
	"time"
)

// Standard Extraction Error Codes
const (
	ErrCodeInvalidURL             = "INVALID_URL"
	ErrCodeNotFacebookURL         = "NOT_FACEBOOK_URL"
	ErrCodeLoginRequired          = "LOGIN_REQUIRED"
	ErrCodeAccessRestricted       = "ACCESS_RESTRICTED"
	ErrCodePostNotFound           = "POST_NOT_FOUND"
	ErrCodePostRemoved            = "POST_REMOVED"
	ErrCodeTargetPostNotDetected  = "TARGET_POST_NOT_DETECTED"
	ErrCodeNoCaption              = "NO_CAPTION"
	ErrCodeNoMedia                = "NO_MEDIA"
	ErrCodeMediaDownloadFailed    = "MEDIA_DOWNLOAD_FAILED"
	ErrCodeFacebookSecurityCheck  = "FACEBOOK_SECURITY_CHECK"
	ErrCodeBrowserTimeout         = "BROWSER_TIMEOUT"
	ErrCodeAPIPermissionDenied    = "API_PERMISSION_DENIED"
	ErrCodeAPIRateLimited         = "API_RATE_LIMITED"
	ErrCodeExtractionFailed       = "EXTRACTION_FAILED"
)

// Pipeline Job Statuses
const (
	JobStateQueued            = "queued"
	JobStateResolvingURL      = "resolving_url"
	JobStateDetectingSource   = "detecting_source"
	JobStateCheckingAPI       = "checking_api"
	JobStateOpeningBrowser    = "opening_browser"
	JobStateLoginRequired     = "login_required"
	JobStateLoadingPost       = "loading_post"
	JobStateDetectingTarget   = "detecting_target"
	JobStateExtractingCaption = "extracting_caption"
	JobStateExtractingMedia   = "extracting_media"
	JobStateDownloadingMedia  = "downloading_media"
	JobStateValidating        = "validating"
	JobStateAnalyzing         = "analyzing"
	JobStateReviewReady       = "review_ready"
	JobStateCompleted         = "completed"
	JobStateFailed            = "failed"
)

// Source types
const (
	SourceTypePage      = "facebook_page"
	SourceTypeGroup     = "facebook_group"
	SourceTypeProfile   = "facebook_profile"
	SourceTypeShareLink = "facebook_share_link"
	SourceTypeUnknown   = "unknown"
)

// Extraction methods
const (
	ExtractionMethodMetaAPI        = "meta_graph_api"
	ExtractionMethodOpenClawBrowser = "openclaw_browser"
	ExtractionMethodManualFallback = "manual_fallback"
)

// ExtractedImage contains metadata for a property image
type ExtractedImage struct {
	Index           int    `json:"index"`
	FacebookPhotoID string `json:"facebook_photo_id,omitempty"`
	SourceURL       string `json:"source_url"`
	StoredURL       string `json:"stored_url"`
	LocalPath       string `json:"local_path,omitempty"`
	Width           int    `json:"width"`
	Height          int    `json:"height"`
	MimeType        string `json:"mime_type,omitempty"`
	SHA256          string `json:"sha256,omitempty"`
	FileSize        int64  `json:"file_size,omitempty"`
	Status          string `json:"status"` // "downloaded", "pending", "failed"
}

// SourceDetails provides origin information about the post
type SourceDetails struct {
	Platform         string `json:"platform"` // "facebook"
	OriginalURL      string `json:"original_url"`
	CanonicalURL     string `json:"canonical_url"`
	SourceType       string `json:"source_type"` // facebook_page, facebook_group, facebook_profile, facebook_share_link, unknown
	SourceName       string `json:"source_name"`
	PostID           string `json:"post_id"`
	CreatedTime      string `json:"created_time"`
	ExtractionMethod string `json:"extraction_method"` // meta_graph_api, openclaw_browser, manual_fallback
}

// PropertyDetails holds AI structured property attributes
type PropertyDetails struct {
	ProjectName    *string  `json:"project_name"`
	ListingType    *string  `json:"listing_type"` // "RENT", "SALE", "RENT_AND_SALE"
	Price          *float64 `json:"price"`
	Currency       string   `json:"currency"` // Default "THB"
	Bedrooms       *int     `json:"bedrooms"`
	Bathrooms      *int     `json:"bathrooms"`
	SizeSqm        *float64 `json:"size_sqm"`
	Floor          *string  `json:"floor"`
	Building       *string  `json:"building"`
	UnitNumber     *string  `json:"unit_number"`
	Furnished      *string  `json:"furnished"`
	NearestTransit *string  `json:"nearest_transit"`
	Location       *string  `json:"location"`
	MoveInStatus   *string  `json:"move_in_status"`
}

// ContactDetails holds listing poster contact information
type ContactDetails struct {
	Name  *string `json:"name"`
	Phone *string `json:"phone"`
	Line  *string `json:"line"`
}

// CaptionDetails holds raw and cleaned caption preserving original Unicode
type CaptionDetails struct {
	Original         string   `json:"original"`
	LanguageDetected []string `json:"language_detected"`
	Cleaned          string   `json:"cleaned"`
}

// ConfidenceDetails provides extraction confidence scores
type ConfidenceDetails struct {
	ProjectName float64 `json:"project_name"`
	Price       float64 `json:"price"`
	Bedrooms    float64 `json:"bedrooms"`
	SizeSqm     float64 `json:"size_sqm"`
}

// FacebookImportResult is the structured result returned after extraction & AI analysis
type FacebookImportResult struct {
	Source     SourceDetails     `json:"source"`
	Property   PropertyDetails   `json:"property"`
	Features   []string          `json:"features"`
	Contact    ContactDetails    `json:"contact"`
	Caption    CaptionDetails    `json:"caption"`
	Images     []ExtractedImage  `json:"images"`
	Confidence ConfidenceDetails `json:"confidence"`
	RawData    map[string]any    `json:"raw_data,omitempty"`
}

// ActivityLog records a timestamped extraction event without secrets
type ActivityLog struct {
	Timestamp string `json:"timestamp"`
	Message   string `json:"message"`
	Level     string `json:"level"` // "info", "warn", "error", "success"
}

// ExtractionJob represents an asynchronous or synchronous extraction job
type ExtractionJob struct {
	JobID            string                `json:"job_id"`
	SourceURL        string                `json:"source_url"`
	CanonicalURL     string                `json:"canonical_url"`
	Status           string                `json:"status"`
	SourceType       string                `json:"source_type"`
	Method           string                `json:"method"`
	CaptionFound     bool                  `json:"caption_found"`
	ImagesFound      int                   `json:"images_found"`
	ImagesDownloaded int                   `json:"images_downloaded"`
	ErrorCode        string                `json:"error_code,omitempty"`
	ErrorMessage     string                `json:"error_message,omitempty"`
	Errors           []string              `json:"errors"`
	Logs             []ActivityLog         `json:"logs"`
	Result           *FacebookImportResult `json:"result,omitempty"`
	CreatedAt        time.Time             `json:"created_at"`
	UpdatedAt        time.Time             `json:"updated_at"`
}

// Request and Response payloads
type ResolveURLRequest struct {
	URL string `json:"url"`
}

type ResolveURLResponse struct {
	Success      bool   `json:"success"`
	OriginalURL  string `json:"original_url"`
	CanonicalURL string `json:"canonical_url"`
	SourceType   string `json:"source_type"`
	PostID       string `json:"post_id,omitempty"`
	ErrorCode    string `json:"error_code,omitempty"`
	ErrorMessage string `json:"error_message,omitempty"`
}

type ExtractRequest struct {
	URL            string `json:"url"`
	PreferredMethod string `json:"preferred_method,omitempty"` // "auto", "meta_graph_api", "openclaw_browser", "manual_fallback"
	MaxImages      int    `json:"max_images,omitempty"`
}

type AnalyzeRequest struct {
	JobID   string          `json:"job_id,omitempty"`
	Caption string          `json:"caption"`
	Images  []ExtractedImage `json:"images,omitempty"`
	Source  *SourceDetails  `json:"source,omitempty"`
}

type SaveToInboxRequest struct {
	JobID       string           `json:"job_id,omitempty"`
	Result      FacebookImportResult `json:"result"`
	AutoPublish bool             `json:"auto_publish,omitempty"`
}
