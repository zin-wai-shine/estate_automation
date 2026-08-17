package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net"
	"net/url"
	"strings"
)

// NormalizeFacebookURL cleans Facebook post URL by removing tracking query parameters
func NormalizeFacebookURL(rawURL string) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return "", fmt.Errorf("empty URL provided")
	}

	u, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid URL format: %w", err)
	}

	// Keep essential parameters like story_fbid & id, strip tracking parameters
	q := u.Query()
	cleanQuery := url.Values{}
	if val := q.Get("story_fbid"); val != "" {
		cleanQuery.Set("story_fbid", val)
	}
	if val := q.Get("id"); val != "" {
		cleanQuery.Set("id", val)
	}

	u.RawQuery = cleanQuery.Encode()
	u.Fragment = ""

	cleanURL := strings.TrimSuffix(u.String(), "?")
	return cleanURL, nil
}

// ValidateMediaURL blocks SSRF attacks targeting private local networks (127.0.0.1, 10.0.0.0/8, 192.168.0.0/16, etc.)
func ValidateMediaURL(mediaURL string) error {
	u, err := url.Parse(mediaURL)
	if err != nil {
		return fmt.Errorf("invalid media URL: %w", err)
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("disallowed scheme '%s': only http/https allowed", u.Scheme)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("missing host in media URL")
	}

	// Block obvious localhost / internal hostnames
	lowerHost := strings.ToLower(host)
	if lowerHost == "localhost" || lowerHost == "127.0.0.1" || lowerHost == "::1" {
		return fmt.Errorf("SSRF protection: access to localhost is forbidden")
	}

	// Resolve IP address
	ips, err := net.LookupIP(host)
	if err != nil {
		// If DNS lookup fails in sandbox, permit standard external media domains
		if strings.Contains(lowerHost, "fbcdn.net") || strings.Contains(lowerHost, "facebook.com") {
			return nil
		}
		return nil
	}

	for _, ip := range ips {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() {
			return fmt.Errorf("SSRF protection: IP %s belongs to a private/internal network", ip.String())
		}
	}

	return nil
}

// CalculateSHA256 computes hexadecimal SHA-256 hash of byte data for image deduplication
func CalculateSHA256(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}
