package services

import (
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

type FacebookURLResolver struct {
	httpClient *http.Client
}

func NewFacebookURLResolver() *FacebookURLResolver {
	return &FacebookURLResolver{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return fmt.Errorf("stopped after 10 redirects")
				}
				return nil
			},
		},
	}
}

// IsFacebookURL verifies that the URL domain belongs to Facebook
func (r *FacebookURLResolver) IsFacebookURL(rawURL string) bool {
	rawURL = strings.TrimSpace(rawURL)
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "https://" + rawURL
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}

	host := strings.ToLower(parsed.Hostname())
	facebookDomains := []string{
		"facebook.com",
		"www.facebook.com",
		"m.facebook.com",
		"web.facebook.com",
		"mbasic.facebook.com",
		"touch.facebook.com",
		"fb.com",
		"www.fb.com",
		"fb.watch",
		"fb.me",
	}

	for _, domain := range facebookDomains {
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return true
		}
	}
	return false
}

// NormalizeURL strips tracking parameters while preserving important post query params (like fbid, id, story_fbid)
func (r *FacebookURLResolver) NormalizeURL(rawURL string) (string, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return "", fmt.Errorf("empty URL provided")
	}

	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "https://" + rawURL
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("invalid URL syntax: %w", err)
	}

	// Clean tracking params
	q := parsed.Query()
	trackingParams := []string{
		"fbclid", "ref", "__cft__", "__tn__", "mibextid", "rdid", "eid",
		"paipv", "locale", "source", "refsrc", "_rdr", "fs", "focus_composer",
	}
	for _, p := range trackingParams {
		q.Del(p)
	}

	// Keep scheme as https and normalize host to www.facebook.com unless fb.watch / fb.me
	parsed.Scheme = "https"
	if parsed.Host != "fb.watch" && parsed.Host != "fb.me" {
		parsed.Host = "www.facebook.com"
	}

	// Rebuild query
	if len(q) > 0 {
		parsed.RawQuery = q.Encode()
	} else {
		parsed.RawQuery = ""
	}

	return parsed.String(), nil
}

// ResolveCanonicalURL resolves redirect or share links to the final canonical post URL
func (r *FacebookURLResolver) ResolveCanonicalURL(rawURL string) (string, error) {
	normURL, err := r.NormalizeURL(rawURL)
	if err != nil {
		return "", err
	}

	// If it's a share link or shortener, resolve via HTTP HEAD/GET
	isShareLink := strings.Contains(normURL, "/share/") ||
		strings.Contains(normURL, "fb.watch") ||
		strings.Contains(normURL, "fb.me")

	if isShareLink {
		req, err := http.NewRequest("GET", normURL, nil)
		if err == nil {
			req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
			req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
			req.Header.Set("Accept-Language", "en-US,en;q=0.9")

			resp, err := r.httpClient.Do(req)
			if err == nil && resp != nil {
				defer resp.Body.Close()
				finalURL := resp.Request.URL.String()
				if finalURL != "" && finalURL != normURL && !strings.Contains(finalURL, "login.php") {
					resolvedNorm, rErr := r.NormalizeURL(finalURL)
					if rErr == nil {
						return resolvedNorm, nil
					}
				}
			}
		}
	}

	return normURL, nil
}

// ExtractPostID attempts to extract the unique Facebook post ID from various URL patterns
func (r *FacebookURLResolver) ExtractPostID(targetURL string) string {
	// Pattern 1: /posts/{post_id}
	rePosts := regexp.MustCompile(`/posts/([0-9a-zA-Z_-]+)`)
	if m := rePosts.FindStringSubmatch(targetURL); len(m) > 1 {
		return m[1]
	}

	// Pattern 2: /permalink/{post_id}
	rePermalink := regexp.MustCompile(`/permalink/([0-9a-zA-Z_-]+)`)
	if m := rePermalink.FindStringSubmatch(targetURL); len(m) > 1 {
		return m[1]
	}

	// Pattern 3: fbid={post_id} or story_fbid={post_id}
	reFbid := regexp.MustCompile(`[?&](?:fbid|story_fbid)=([0-9]+)`)
	if m := reFbid.FindStringSubmatch(targetURL); len(m) > 1 {
		return m[1]
	}

	// Pattern 4: /photos/{post_id} or /photo/?fbid={post_id}
	rePhoto := regexp.MustCompile(`/photo(?:s)?/([0-9a-zA-Z_-]+)`)
	if m := rePhoto.FindStringSubmatch(targetURL); len(m) > 1 {
		return m[1]
	}

	// Pattern 5: /share/p/{post_id}
	reShare := regexp.MustCompile(`/share/p/([0-9a-zA-Z_-]+)`)
	if m := reShare.FindStringSubmatch(targetURL); len(m) > 1 {
		return m[1]
	}

	return ""
}
