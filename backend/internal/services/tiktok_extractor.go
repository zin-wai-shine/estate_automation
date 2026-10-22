package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/utils"
)

type TikTokExtractor struct {
	httpClient *http.Client
}

func NewTikTokExtractor() *TikTokExtractor {
	return &TikTokExtractor{
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return fmt.Errorf("stopped after 10 redirects")
				}
				return nil
			},
		},
	}
}

// IsTikTokURL verifies if the given URL belongs to TikTok
func (t *TikTokExtractor) IsTikTokURL(rawURL string) bool {
	rawURL = strings.TrimSpace(rawURL)
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "https://" + rawURL
	}

	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}

	host := strings.ToLower(parsed.Hostname())
	tiktokDomains := []string{
		"tiktok.com",
		"www.tiktok.com",
		"m.tiktok.com",
		"vt.tiktok.com",
		"vm.tiktok.com",
		"tiktokv.com",
		"v.douyin.com",
	}

	for _, domain := range tiktokDomains {
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return true
		}
	}
	return false
}

// ResolveCanonicalURL resolves shortened mobile links (vt.tiktok.com / vm.tiktok.com) and cleans tracking query params
func (t *TikTokExtractor) ResolveCanonicalURL(targetURL string) (string, error) {
	targetURL = strings.TrimSpace(targetURL)
	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		targetURL = "https://" + targetURL
	}

	// If shortened mobile share URL, follow HTTP redirects to get full target URL
	if strings.Contains(targetURL, "vt.tiktok.com") || strings.Contains(targetURL, "vm.tiktok.com") {
		req, err := http.NewRequest("GET", targetURL, nil)
		if err == nil {
			req.Header.Set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1")
			resp, err := t.httpClient.Do(req)
			if err == nil {
				if resp.Request != nil && resp.Request.URL != nil {
					targetURL = resp.Request.URL.String()
				}
				resp.Body.Close()
			}
		}
	}

	parsed, err := url.Parse(targetURL)
	if err != nil {
		return targetURL, nil
	}

	// Remove tracking parameters
	q := parsed.Query()
	trackingParams := []string{
		"_r", "_d", "_t", "checksum", "sec_uid", "share_app_id",
		"sharer_language", "is_copy_url", "is_from_webapp", "sender_device",
		"mid", "preview_pb", "timestamp", "tt_from", "utm_source",
		"utm_campaign", "utm_medium",
	}
	for _, p := range trackingParams {
		q.Del(p)
	}

	parsed.Scheme = "https"
	if parsed.Host == "m.tiktok.com" {
		parsed.Host = "www.tiktok.com"
	}
	if len(q) > 0 {
		parsed.RawQuery = q.Encode()
	} else {
		parsed.RawQuery = ""
	}

	return parsed.String(), nil
}

// ExtractPostID extracts the TikTok photo/video ID from the URL
func (t *TikTokExtractor) ExtractPostID(rawURL string) string {
	re := regexp.MustCompile(`/(?:video|photo|v)/(\d+)`)
	matches := re.FindStringSubmatch(rawURL)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

// ExtractUsername extracts the TikTok username (@...) from the URL
func (t *TikTokExtractor) ExtractUsername(rawURL string) string {
	re := regexp.MustCompile(`/@([a-zA-Z0-9_.-]+)`)
	matches := re.FindStringSubmatch(rawURL)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

// ExtractPost fetches the caption, metadata, and all photo/video media from a TikTok URL
func (t *TikTokExtractor) ExtractPost(targetURL string, maxImages int) (*models.FacebookImportResult, string, error) {
	if maxImages <= 0 {
		maxImages = 50
	}

	canonicalURL, err := t.ResolveCanonicalURL(targetURL)
	if err != nil || canonicalURL == "" {
		canonicalURL = targetURL
	}

	postID := t.ExtractPostID(canonicalURL)
	username := t.ExtractUsername(canonicalURL)

	// Step 1: Attempt extraction via TikWM service (fast, reliable photo carousels & full description)
	tikwmResult, tikwmErr := t.extractFromTikWM(targetURL, canonicalURL, postID, username, maxImages)
	if tikwmErr == nil && tikwmResult != nil && (tikwmResult.Caption.Original != "" || len(tikwmResult.Images) > 0) {
		return tikwmResult, "", nil
	}

	// Step 2: Attempt Browser Worker fallback via OpenClaw
	browserResult, browserErr := t.extractFromBrowserWorker(canonicalURL, maxImages)
	if browserErr == nil && browserResult != nil && (browserResult.Caption.Original != "" || len(browserResult.Images) > 0) {
		return browserResult, "", nil
	}

	// Step 3: Attempt direct HTTP extraction using web HTML hydration
	directResult, directErr := t.extractFromHTML(canonicalURL, postID, username, maxImages)
	if directErr == nil && directResult != nil && (directResult.Caption.Original != "" || len(directResult.Images) > 0) {
		return directResult, "", nil
	}

	// Step 4: Attempt oEmbed API fallback
	oembedResult, oembedErr := t.extractFromOEmbed(canonicalURL, postID, username)
	if oembedErr == nil && oembedResult != nil {
		return oembedResult, "", nil
	}

	if tikwmResult != nil {
		return tikwmResult, "", nil
	}
	if directResult != nil {
		return directResult, "", nil
	}

	return nil, models.ErrCodeExtractionFailed, fmt.Errorf("unable to extract TikTok post: %v", tikwmErr)
}

// extractFromHTML fetches the TikTok page and parses __UNIVERSAL_DATA_FOR_REHYDRATION__
func (t *TikTokExtractor) extractFromHTML(targetURL, postID, username string, maxImages int) (*models.FacebookImportResult, error) {
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9,th;q=0.8")
	req.Header.Set("Sec-Ch-Ua", "\"Chromium\";v=\"122\", \"Not(A:Brand\";v=\"24\", \"Google Chrome\";v=\"122\"")
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", "\"macOS\"")

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error %d fetching TikTok page", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	bodyStr := string(bodyBytes)

	caption := ""
	authorName := username
	var images []models.ExtractedImage

	// Look for <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">
	reScript := regexp.MustCompile(`(?s)<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>`)
	matches := reScript.FindStringSubmatch(bodyStr)
	if len(matches) > 1 {
		var rehydration map[string]any
		if err := json.Unmarshal([]byte(matches[1]), &rehydration); err == nil {
			if defaultScope, ok := rehydration["__DEFAULT_SCOPE__"].(map[string]any); ok {
				if videoDetail, ok := defaultScope["webapp.video-detail"].(map[string]any); ok {
					if itemInfo, ok := videoDetail["itemInfo"].(map[string]any); ok {
						if item, ok := itemInfo["itemStruct"].(map[string]any); ok {
							// Caption
							if desc, ok := item["desc"].(string); ok {
								caption = desc
							}
							// Author
							if author, ok := item["author"].(map[string]any); ok {
								if u, ok := author["uniqueId"].(string); ok && u != "" {
									authorName = u
								}
								if nick, ok := author["nickname"].(string); ok && nick != "" && authorName == "" {
									authorName = nick
								}
							}
							// Photo carousel post
							if imagePost, ok := item["imagePost"].(map[string]any); ok {
								if rawImgs, ok := imagePost["images"].([]any); ok {
									for idx, rawImg := range rawImgs {
										if idx >= maxImages {
											break
										}
										if imgMap, ok := rawImg.(map[string]any); ok {
											imgURL := ""
											w, h := 1080, 1080
											if imgObj, ok := imgMap["imageURL"].(map[string]any); ok {
												if urls, ok := imgObj["urlList"].([]any); ok && len(urls) > 0 {
													if s, ok := urls[0].(string); ok {
														imgURL = s
													}
												}
												if widthVal, ok := imgObj["width"].(float64); ok && widthVal > 0 {
													w = int(widthVal)
												}
												if heightVal, ok := imgObj["height"].(float64); ok && heightVal > 0 {
													h = int(heightVal)
												}
											} else if dispObj, ok := imgMap["displayImage"].(map[string]any); ok {
												if urls, ok := dispObj["urlList"].([]any); ok && len(urls) > 0 {
													if s, ok := urls[0].(string); ok {
														imgURL = s
													}
												}
											}

											if imgURL != "" {
												images = append(images, models.ExtractedImage{
													Index:     idx,
													SourceURL: imgURL,
													Width:     w,
													Height:    h,
													Status:    "verified",
												})
											}
										}
									}
								}
							}

							// If video post (or fallback cover images)
							if len(images) == 0 {
								if videoObj, ok := item["video"].(map[string]any); ok {
									coverURL := ""
									if c, ok := videoObj["originCover"].(string); ok && c != "" {
										coverURL = c
									} else if c, ok := videoObj["cover"].(string); ok && c != "" {
										coverURL = c
									} else if c, ok := videoObj["dynamicCover"].(string); ok && c != "" {
										coverURL = c
									}

									if coverURL != "" {
										images = append(images, models.ExtractedImage{
											Index:     0,
											SourceURL: coverURL,
											Width:     1080,
											Height:    1920,
											Status:    "verified",
										})
									}
								}
							}
						}
					}
				}
			}
		}
	}

	// Fallback to OpenGraph meta tags if script parsing missed
	if caption == "" {
		reOGDesc := regexp.MustCompile(`(?i)<meta\s+property="og:description"\s+content="([^"]*)"`)
		if m := reOGDesc.FindStringSubmatch(bodyStr); len(m) > 1 {
			caption = m[1]
		}
	}
	if len(images) == 0 {
		reOGImg := regexp.MustCompile(`(?i)<meta\s+property="og:image"\s+content="([^"]*)"`)
		if m := reOGImg.FindStringSubmatch(bodyStr); len(m) > 1 && m[1] != "" {
			images = append(images, models.ExtractedImage{
				Index:     0,
				SourceURL: m[1],
				Width:     1080,
				Height:    1920,
				Status:    "verified",
			})
		}
	}

	sourceTitle := "TikTok Post"
	if authorName != "" {
		sourceTitle = "@" + authorName
	}

	return &models.FacebookImportResult{
		Source: models.SourceDetails{
			Platform:         "tiktok",
			OriginalURL:      targetURL,
			CanonicalURL:     targetURL,
			SourceType:       "tiktok_post",
			SourceName:       sourceTitle,
			PostID:           postID,
			CreatedTime:      time.Now().Format(time.RFC3339),
			ExtractionMethod: "tiktok_direct",
		},
		Caption: models.CaptionDetails{
			Original: caption,
			Cleaned:  caption,
		},
		Images: images,
	}, nil
}

// extractFromBrowserWorker calls the persistent headless browser worker for JavaScript rendered DOM
func (t *TikTokExtractor) extractFromBrowserWorker(targetURL string, maxImages int) (*models.FacebookImportResult, error) {
	workerURL := utils.GetBrowserWorkerURL()
	payload := map[string]any{
		"url":        targetURL,
		"max_images": maxImages,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	resp, err := t.httpClient.Post(workerURL+"/tiktok-post-extract", "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var workerResp struct {
		Success      bool                    `json:"success"`
		Platform     string                  `json:"platform"`
		CanonicalURL string                  `json:"canonical_url"`
		SourceType   string                  `json:"source_type"`
		SourceName   string                  `json:"source_name"`
		PostID       string                  `json:"post_id"`
		Caption      string                  `json:"caption"`
		Images       []models.ExtractedImage `json:"images"`
		ErrorMessage string                  `json:"error_message,omitempty"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&workerResp); err != nil {
		return nil, err
	}

	if !workerResp.Success {
		return nil, fmt.Errorf("browser worker extraction failed: %s", workerResp.ErrorMessage)
	}

	return &models.FacebookImportResult{
		Source: models.SourceDetails{
			Platform:         "tiktok",
			OriginalURL:      targetURL,
			CanonicalURL:     workerResp.CanonicalURL,
			SourceType:       "tiktok_post",
			SourceName:       workerResp.SourceName,
			PostID:           workerResp.PostID,
			CreatedTime:      time.Now().Format(time.RFC3339),
			ExtractionMethod: "browser_worker",
		},
		Caption: models.CaptionDetails{
			Original: workerResp.Caption,
			Cleaned:  workerResp.Caption,
		},
		Images: workerResp.Images,
	}, nil
}

// extractFromOEmbed queries TikTok's official oEmbed endpoint as a lightweight fallback
func (t *TikTokExtractor) extractFromOEmbed(targetURL, postID, username string) (*models.FacebookImportResult, error) {
	oembedURL := fmt.Sprintf("https://www.tiktok.com/oembed?url=%s", url.QueryEscape(targetURL))
	resp, err := t.httpClient.Get(oembedURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("oembed returned status %d", resp.StatusCode)
	}

	var data struct {
		Title        string `json:"title"`
		AuthorName   string `json:"author_name"`
		ThumbnailURL string `json:"thumbnail_url"`
		Width        int    `json:"width"`
		Height       int    `json:"height"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	author := username
	if data.AuthorName != "" {
		author = data.AuthorName
	}

	var images []models.ExtractedImage
	if data.ThumbnailURL != "" {
		w := data.Width
		if w <= 0 {
			w = 1080
		}
		h := data.Height
		if h <= 0 {
			h = 1920
		}
		images = append(images, models.ExtractedImage{
			Index:     0,
			SourceURL: data.ThumbnailURL,
			Width:     w,
			Height:    h,
			Status:    "verified",
		})
	}

	return &models.FacebookImportResult{
		Source: models.SourceDetails{
			Platform:         "tiktok",
			OriginalURL:      targetURL,
			CanonicalURL:     targetURL,
			SourceType:       "tiktok_post",
			SourceName:       "@" + author,
			PostID:           postID,
			CreatedTime:      time.Now().Format(time.RFC3339),
			ExtractionMethod: "tiktok_oembed",
		},
		Caption: models.CaptionDetails{
			Original: data.Title,
			Cleaned:  data.Title,
		},
		Images: images,
	}, nil
}

type tikWMResponse struct {
	Code int        `json:"code"`
	Msg  string     `json:"msg"`
	Data *tikWMData `json:"data"`
}

type tikWMData struct {
	ID          string       `json:"id"`
	Region      string       `json:"region"`
	Title       string       `json:"title"`
	Cover       string       `json:"cover"`
	OriginCover string       `json:"origin_cover"`
	Images      []string     `json:"images"`
	Play        string       `json:"play"`
	WmPlay      string       `json:"wmplay"`
	Author      *tikWMAuthor `json:"author"`
}

type tikWMAuthor struct {
	ID       string `json:"id"`
	UniqueID string `json:"unique_id"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

// extractFromTikWM leverages the dedicated TikWM JSON API to extract high-definition photo carousels and full caption text
func (t *TikTokExtractor) extractFromTikWM(targetURL, canonicalURL, postID, username string, maxImages int) (*models.FacebookImportResult, error) {
	urlsToTry := []string{targetURL}
	if canonicalURL != "" && canonicalURL != targetURL {
		urlsToTry = append(urlsToTry, canonicalURL)
	}

	for _, u := range urlsToTry {
		reqURL := fmt.Sprintf("https://www.tikwm.com/api/?url=%s&count=50", url.QueryEscape(u))
		req, err := http.NewRequest("GET", reqURL, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "application/json")

		resp, err := t.httpClient.Do(req)
		if err != nil {
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		var parsed tikWMResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			continue
		}

		if parsed.Code != 0 || parsed.Data == nil {
			continue
		}

		data := parsed.Data
		pID := data.ID
		if pID == "" {
			pID = postID
		}

		authorName := username
		if data.Author != nil {
			if data.Author.Nickname != "" {
				authorName = data.Author.Nickname
			} else if data.Author.UniqueID != "" {
				authorName = data.Author.UniqueID
			}
		}
		if authorName == "" {
			authorName = "TikTok Creator"
		}

		var images []models.ExtractedImage
		if len(data.Images) > 0 {
			for idx, imgURL := range data.Images {
				if idx >= maxImages {
					break
				}
				images = append(images, models.ExtractedImage{
					Index:     idx,
					SourceURL: imgURL,
					Width:     1080,
					Height:    1920,
					Status:    "verified",
				})
			}
		} else {
			cover := data.OriginCover
			if cover == "" {
				cover = data.Cover
			}
			if cover != "" {
				images = append(images, models.ExtractedImage{
					Index:     0,
					SourceURL: cover,
					Width:     1080,
					Height:    1920,
					Status:    "verified",
				})
			}
		}

		caption := strings.TrimSpace(data.Title)

		return &models.FacebookImportResult{
			Source: models.SourceDetails{
				Platform:         "tiktok",
				OriginalURL:      targetURL,
				CanonicalURL:     canonicalURL,
				SourceType:       "tiktok_post",
				SourceName:       authorName,
				PostID:           pID,
				CreatedTime:      time.Now().UTC().Format(time.RFC3339),
				ExtractionMethod: "tiktok_direct",
			},
			Caption: models.CaptionDetails{
				Original:         caption,
				LanguageDetected: detectLanguages(caption),
				Cleaned:          caption,
			},
			Images: images,
			Confidence: models.ConfidenceDetails{
				ProjectName: 0.85,
				Price:       0.85,
			},
		}, nil
	}

	return nil, fmt.Errorf("TikWM could not extract data from provided TikTok URLs")
}

func detectLanguages(text string) []string {
	var langs []string
	hasThai := false
	hasMyanmar := false
	hasEnglish := false

	for _, r := range text {
		if unicode.In(r, unicode.Thai) {
			hasThai = true
		} else if r >= 0x1000 && r <= 0x109F {
			hasMyanmar = true
		} else if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			hasEnglish = true
		}
	}

	if hasThai {
		langs = append(langs, "Thai")
	}
	if hasMyanmar {
		langs = append(langs, "Myanmar")
	}
	if hasEnglish {
		langs = append(langs, "English")
	}
	if len(langs) == 0 {
		langs = append(langs, "Unknown")
	}
	return langs
}
