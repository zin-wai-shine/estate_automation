package facebook

import (
	"context"
	"time"
)

type ImportPostResult struct {
	PostID      string    `json:"post_id"`
	PageID      string    `json:"page_id"`
	SourceName  string    `json:"source_name"`
	Message     string    `json:"message"`
	CreatedTime time.Time `json:"created_time"`
	ImageURLs   []string  `json:"image_urls"`
	Provider    string    `json:"provider"`
}

type FacebookImportProvider interface {
	CanHandle(ctx context.Context, rawURL string) bool
	ImportPost(ctx context.Context, rawURL string) (*ImportPostResult, error)
	HealthCheck(ctx context.Context) error
	GetProviderName() string
}
