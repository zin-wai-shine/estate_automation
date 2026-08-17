package facebook

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type BrowserProvider struct {
	SessionActive bool
}

func NewBrowserProvider() *BrowserProvider {
	return &BrowserProvider{SessionActive: true}
}

func (b *BrowserProvider) GetProviderName() string {
	return "BROWSER"
}

func (b *BrowserProvider) CanHandle(ctx context.Context, rawURL string) bool {
	return strings.Contains(rawURL, "facebook.com") || strings.Contains(rawURL, "fb.com")
}

func (b *BrowserProvider) HealthCheck(ctx context.Context) error {
	if !b.SessionActive {
		return fmt.Errorf("REQUIRES_RECONNECT: Authorized browser session is expired or inactive")
	}
	return nil
}

func (b *BrowserProvider) ImportPost(ctx context.Context, rawURL string) (*ImportPostResult, error) {
	if strings.Contains(rawURL, "private-group-restricted") {
		return nil, fmt.Errorf("LOGIN_REQUIRED: Facebook post is inside a restricted private group. Manual fallback required")
	}

	if strings.Contains(rawURL, "blocked-captcha") {
		return nil, fmt.Errorf("CAPTCHA_DETECTED: Security check triggered on browser session. Manual fallback required")
	}

	// Permitted post extraction fixture
	return &ImportPostResult{
		PostID:      "fb_post_998822",
		PageID:      "fb_page_100063948291038",
		SourceName:  "Bangkok Real Estate Group",
		Message:     "✨ Luxury Studio Condo at Ideo Sukhumvit 93 for Rent!\n• Size: 28 sqm\n• Floor: 28th Floor\n• Price: ฿18,000 / month\n• Location: BTS Bang Chak (15m)\n• Fully Furnished & Ready to Move In!",
		CreatedTime: time.Now().Add(-2 * time.Hour),
		ImageURLs: []string{
			"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1000",
			"https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000",
			"https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1000",
		},
		Provider: "BROWSER",
	}, nil
}
