package facebook

import (
	"context"
	"time"
)

type ManualProvider struct{}

func NewManualProvider() *ManualProvider {
	return &ManualProvider{}
}

func (m *ManualProvider) GetProviderName() string {
	return "MANUAL"
}

func (m *ManualProvider) CanHandle(ctx context.Context, rawURL string) bool {
	return true
}

func (m *ManualProvider) HealthCheck(ctx context.Context) error {
	return nil
}

func (m *ManualProvider) ImportPost(ctx context.Context, rawURL string) (*ImportPostResult, error) {
	return &ImportPostResult{
		PostID:      "manual_entry",
		PageID:      "manual_source",
		SourceName:  "Manual Fallback Entry",
		Message:     "Manual Property Entry",
		CreatedTime: time.Now(),
		ImageURLs:   []string{},
		Provider:    "MANUAL",
	}, nil
}
