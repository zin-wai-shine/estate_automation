package services

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

type FacebookSourceDetector struct{}

func NewFacebookSourceDetector() *FacebookSourceDetector {
	return &FacebookSourceDetector{}
}

// DetectSource determines whether a Facebook URL represents a Group, Page, Profile, or Share link
func (d *FacebookSourceDetector) DetectSource(targetURL string) (sourceType string, sourceName string) {
	parsed, err := url.Parse(targetURL)
	if err != nil {
		return models.SourceTypeUnknown, ""
	}

	path := parsed.Path

	// 1. Check for Facebook Group
	if strings.Contains(path, "/groups/") {
		reGroup := regexp.MustCompile(`/groups/([^/]+)`)
		if m := reGroup.FindStringSubmatch(path); len(m) > 1 {
			name := m[1]
			// Clean up if numeric ID
			return models.SourceTypeGroup, "Facebook Group: " + strings.ReplaceAll(name, ".", " ")
		}
		return models.SourceTypeGroup, "Facebook Group"
	}

	// 2. Check for Share link
	if strings.Contains(path, "/share/") {
		return models.SourceTypeShareLink, "Facebook Share Link"
	}

	// 3. Check for User Profile
	if strings.Contains(path, "/profile.php") || strings.Contains(path, "/people/") {
		idVal := parsed.Query().Get("id")
		if idVal != "" {
			return models.SourceTypeProfile, "Facebook Profile (" + idVal + ")"
		}
		return models.SourceTypeProfile, "Facebook Profile"
	}

	// 4. Check for Page / Standard post
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) >= 2 {
		firstSegment := parts[0]
		// Exclude generic system paths
		if firstSegment != "watch" && firstSegment != "events" && firstSegment != "marketplace" && firstSegment != "photo" && firstSegment != "photos" {
			return models.SourceTypePage, "Facebook Page: " + strings.ReplaceAll(firstSegment, ".", " ")
		}
	}

	if strings.Contains(path, "/photo") || strings.Contains(path, "/photos") {
		return models.SourceTypePage, "Facebook Photo Post"
	}

	return models.SourceTypeUnknown, "Facebook Post"
}
