package models

import (
	"time"

	"gorm.io/gorm"
)

// TikTokTokenStatus tracks validity of stored tokens
type TikTokTokenStatus string

const (
	TikTokTokenMissing          TikTokTokenStatus = "MISSING"
	TikTokTokenUntested         TikTokTokenStatus = "UNTESTED"
	TikTokTokenValid            TikTokTokenStatus = "VALID"
	TikTokTokenExpired          TikTokTokenStatus = "EXPIRED"
	TikTokTokenInvalid          TikTokTokenStatus = "INVALID"
	TikTokTokenReconnectRequired TikTokTokenStatus = "RECONNECT_REQUIRED"
)

// TikTokPostPublishStatus defines the lifecycle of a post published via TikTok Content Posting API
type TikTokPostPublishStatus string

const (
	TikTokPostStatusDraft              TikTokPostPublishStatus = "DRAFT"
	TikTokPostStatusQueued             TikTokPostPublishStatus = "QUEUED"
	TikTokPostStatusProcessingDownload TikTokPostPublishStatus = "PROCESSING_DOWNLOAD"
	TikTokPostStatusProcessingUpload   TikTokPostPublishStatus = "PROCESSING_UPLOAD"
	TikTokPostStatusSuccess            TikTokPostPublishStatus = "SUCCESS"
	TikTokPostStatusFailed             TikTokPostPublishStatus = "FAILED"
	TikTokPostStatusCancelled          TikTokPostPublishStatus = "CANCELLED"
)

// TikTokAccount stores authorized TikTok account credentials and profile details
type TikTokAccount struct {
	ID                     uint              `gorm:"primaryKey" json:"id"`
	OpenID                 string            `gorm:"type:varchar(128);not null;uniqueIndex" json:"open_id"`
	UnionID                string            `gorm:"type:varchar(128);index" json:"union_id"`
	Username               string            `gorm:"type:varchar(100);not null" json:"username"`
	DisplayName            string            `gorm:"type:varchar(255)" json:"display_name"`
	AvatarURL              string            `gorm:"type:text" json:"avatar_url"`
	EncryptedAccessToken   string            `gorm:"type:text" json:"-"` // AES-256-GCM encrypted, never exposed
	EncryptedRefreshToken  string            `gorm:"type:text" json:"-"` // AES-256-GCM encrypted, never exposed
	TokenHint              string            `gorm:"type:varchar(30)" json:"token_hint"`
	TokenStatus            TikTokTokenStatus `gorm:"type:varchar(30);default:'UNTESTED'" json:"token_status"`
	Scope                  string            `gorm:"type:text" json:"scope"`
	Permissions            string            `gorm:"type:text" json:"permissions"` // JSON array
	CanPublishPhotoMode    bool              `gorm:"default:true" json:"can_publish_photo_mode"`
	CanUploadVideo         bool              `gorm:"default:true" json:"can_upload_video"`
	TestPassed             bool              `gorm:"default:false" json:"test_passed"`
	AutoPublishEnabled     bool              `gorm:"default:true" json:"auto_publish_enabled"`
	LastTestedAt           *time.Time        `json:"last_tested_at,omitempty"`
	LastError              string            `gorm:"type:text" json:"last_error,omitempty"`
	TokenExpiresAt         *time.Time        `json:"token_expires_at,omitempty"`
	RefreshTokenExpiresAt *time.Time        `json:"refresh_token_expires_at,omitempty"`
	TokenUpdatedAt         *time.Time        `json:"token_updated_at,omitempty"`
	Environment            string            `gorm:"type:varchar(20);default:'sandbox'" json:"environment"`
	FollowerCount          int64             `gorm:"default:0" json:"follower_count"`
	CreatedAt              time.Time         `json:"created_at"`
	UpdatedAt              time.Time         `json:"updated_at"`
	DeletedAt              gorm.DeletedAt    `gorm:"index" json:"-"`
}

// TikTokPublishPost tracks photo carousel or video publications via TikTok Content Posting API
type TikTokPublishPost struct {
	ID               uint                    `gorm:"primaryKey" json:"id"`
	TikTokAccountID  uint                    `gorm:"not null;index" json:"tiktok_account_id"`
	OpenID           string                  `gorm:"type:varchar(128);index" json:"open_id"`
	Username         string                  `gorm:"type:varchar(100)" json:"username"`
	PublishID        string                  `gorm:"type:varchar(128);uniqueIndex" json:"publish_id"`
	Title            string                  `gorm:"type:text;not null" json:"title"` // Caption + hashtags
	PrivacyLevel     string                  `gorm:"type:varchar(50);default:'PUBLIC_TO_EVERYONE'" json:"privacy_level"`
	DisableComment   bool                    `gorm:"default:false" json:"disable_comment"`
	AutoAddMusic     bool                    `gorm:"default:true" json:"auto_add_music"`
	MediaType        string                  `gorm:"type:varchar(20);default:'PHOTO'" json:"media_type"` // PHOTO or VIDEO
	PostMode         string                  `gorm:"type:varchar(50);default:'MEDIA_UPLOAD'" json:"post_mode"`
	PhotoImages      string                  `gorm:"type:text" json:"photo_images"` // JSON string array of public HTTPS URLs
	PhotoCoverIndex  int                     `gorm:"default:1" json:"photo_cover_index"`
	Status           TikTokPostPublishStatus `gorm:"type:varchar(35);default:'QUEUED';index" json:"status"`
	TikTokPostID     string                  `gorm:"type:varchar(100);index" json:"tiktok_post_id,omitempty"`
	ShareURL         string                  `gorm:"type:text" json:"share_url,omitempty"`
	ErrorMessage     string                  `gorm:"type:text" json:"error_message,omitempty"`
	RawStatusPayload string                  `gorm:"type:text" json:"raw_status_payload,omitempty"`
	PublishedAt      *time.Time              `json:"published_at,omitempty"`
	CreatedAt        time.Time               `json:"created_at"`
	UpdatedAt        time.Time               `json:"updated_at"`
}
