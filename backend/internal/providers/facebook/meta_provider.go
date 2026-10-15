package facebook

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

func (m *MetaFacebookProvider) GetProviderName() string {
	return "META_GRAPH"
}

func (m *MetaFacebookProvider) CanHandle(ctx context.Context, rawURL string) bool {
	_, _, err := m.ExtractPostID(rawURL)
	return err == nil
}

func (m *MetaFacebookProvider) HealthCheck(ctx context.Context) error {
	if m.AppID == "" || m.AppSecret == "" {
		return fmt.Errorf("META_APP_ID or META_APP_SECRET not configured")
	}
	return nil
}

func (m *MetaFacebookProvider) ImportPost(ctx context.Context, rawURL string) (*ImportPostResult, error) {
	postID, pageID, err := m.ExtractPostID(rawURL)
	if err != nil {
		return nil, fmt.Errorf("META_UNSUPPORTED_URL: %w", err)
	}

	// Returns post content
	res, err := m.GetPostPermittedContent(postID, "PAGE_ACCESS_TOKEN_PLACEHOLDER")
	if err != nil {
		return nil, err
	}

	return &ImportPostResult{
		PostID:      res.PostID,
		PageID:      pageID,
		SourceName:  "Facebook Page",
		Message:     res.Message,
		CreatedTime: res.CreatedTime,
		ImageURLs:   res.ImageURLs,
		Provider:    "META_GRAPH",
	}, nil
}

type MetaFacebookProvider struct {
	AppID        string
	AppSecret    string
	GraphVersion string
	RedirectURI  string
	HTTPClient   *http.Client
}

func getDBSetting(key string) string {
	if database.DB == nil {
		return ""
	}
	var setting models.SystemSetting
	if err := database.DB.Where("key = ?", key).First(&setting).Error; err == nil {
		return strings.TrimSpace(setting.Value)
	}
	return ""
}

func (m *MetaFacebookProvider) GetAppID() string {
	if val := getDBSetting("META_APP_ID"); val != "" {
		return val
	}
	if m.AppID != "" {
		return m.AppID
	}
	return os.Getenv("META_APP_ID")
}

func (m *MetaFacebookProvider) GetAppSecret() string {
	if val := getDBSetting("META_APP_SECRET"); val != "" {
		return val
	}
	if m.AppSecret != "" {
		return m.AppSecret
	}
	return os.Getenv("META_APP_SECRET")
}

func (m *MetaFacebookProvider) GetGraphVersion() string {
	if m.GraphVersion != "" {
		return m.GraphVersion
	}
	v := os.Getenv("META_GRAPH_VERSION")
	if v == "" {
		v = os.Getenv("META_GRAPH_API_VERSION")
	}
	if v == "" {
		return "v26.0"
	}
	if !strings.HasPrefix(v, "v") {
		return "v" + v
	}
	return v
}

func NewMetaFacebookProvider() *MetaFacebookProvider {
	appID := os.Getenv("META_APP_ID")
	appSecret := os.Getenv("META_APP_SECRET")
	graphVer := os.Getenv("META_GRAPH_VERSION")
	if graphVer == "" {
		graphVer = "v26.0"
	}
	redirectURI := os.Getenv("META_OAUTH_REDIRECT_URI")
	if redirectURI == "" {
		redirectURI = "http://localhost:8085/api/facebook/auth/callback"
	}

	return &MetaFacebookProvider{
		AppID:        appID,
		AppSecret:    appSecret,
		GraphVersion: graphVer,
		RedirectURI:  redirectURI,
		HTTPClient:   &http.Client{Timeout: 20 * time.Second},
	}
}

type TokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int64  `json:"expires_in"`
}

type PageInfo struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	AccessToken string   `json:"access_token"`
	Tasks       []string `json:"tasks"`
	Link        string   `json:"link"`
	PictureURL  string   `json:"picture_url"`
}

type PostContentResult struct {
	PostID      string    `json:"post_id"`
	Message     string    `json:"message"`
	CreatedTime time.Time `json:"created_time"`
	ImageURLs   []string  `json:"image_urls"`
}

func (m *MetaFacebookProvider) GetAuthURL(state string) string {
	// Requested scopes: pages_show_list, pages_read_engagement, pages_manage_posts
	scopes := "pages_show_list,pages_read_engagement,pages_manage_posts,public_profile"
	return fmt.Sprintf(
		"https://www.facebook.com/%s/dialog/oauth?client_id=%s&redirect_uri=%s&state=%s&scope=%s",
		m.GetGraphVersion(),
		url.QueryEscape(m.GetAppID()),
		url.QueryEscape(m.RedirectURI),
		url.QueryEscape(state),
		url.QueryEscape(scopes),
	)
}

func (m *MetaFacebookProvider) ExchangeCode(code string) (*TokenResponse, error) {
	apiURL := fmt.Sprintf(
		"https://graph.facebook.com/%s/oauth/access_token?client_id=%s&redirect_uri=%s&client_secret=%s&code=%s",
		m.GetGraphVersion(),
		url.QueryEscape(m.GetAppID()),
		url.QueryEscape(m.RedirectURI),
		url.QueryEscape(m.GetAppSecret()),
		url.QueryEscape(code),
	)

	resp, err := m.HTTPClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("network error during code exchange: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("meta token exchange error (%d): %s", resp.StatusCode, string(body))
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse token response JSON: %w", err)
	}

	return &tokenResp, nil
}

func (m *MetaFacebookProvider) GetLongLivedToken(shortToken string) (*TokenResponse, error) {
	apiURL := fmt.Sprintf(
		"https://graph.facebook.com/%s/oauth/access_token?grant_type=fb_exchange_token&client_id=%s&client_secret=%s&fb_exchange_token=%s",
		m.GetGraphVersion(),
		url.QueryEscape(m.GetAppID()),
		url.QueryEscape(m.GetAppSecret()),
		url.QueryEscape(shortToken),
	)

	resp, err := m.HTTPClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("network error during long-lived token exchange: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read long-lived token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("meta long-lived token exchange error (%d): %s", resp.StatusCode, string(body))
	}

	var tokenResp TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to parse long-lived token JSON: %w", err)
	}

	return &tokenResp, nil
}

func (m *MetaFacebookProvider) GetConnectedPages(userToken string) ([]PageInfo, error) {
	apiURL := fmt.Sprintf(
		"https://graph.facebook.com/%s/me/accounts?fields=id,name,category,access_token,tasks,link,picture.type(large){url}&access_token=%s",
		m.GetGraphVersion(),
		url.QueryEscape(userToken),
	)

	resp, err := m.HTTPClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("network error fetching pages: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read accounts response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("meta fetch pages error (%d): %s", resp.StatusCode, string(body))
	}

	var raw struct {
		Data []struct {
			ID          string   `json:"id"`
			Name        string   `json:"name"`
			Category    string   `json:"category"`
			AccessToken string   `json:"access_token"`
			Tasks       []string `json:"tasks"`
			Link        string   `json:"link"`
			Picture     struct {
				Data struct {
					URL string `json:"url"`
				} `json:"data"`
			} `json:"picture"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse pages JSON: %w", err)
	}

	out := make([]PageInfo, 0, len(raw.Data))
	for _, item := range raw.Data {
		out = append(out, PageInfo{
			ID:          item.ID,
			Name:        item.Name,
			Category:    item.Category,
			AccessToken: item.AccessToken,
			Tasks:       item.Tasks,
			Link:        item.Link,
			PictureURL:  item.Picture.Data.URL,
		})
	}
	return out, nil
}

func (m *MetaFacebookProvider) ExtractPostID(facebookURL string) (string, string, error) {
	if strings.TrimSpace(facebookURL) == "" {
		return "", "", fmt.Errorf("empty facebook url")
	}

	// Pattern 1: https://www.facebook.com/100063948291038/posts/123456789
	reNum := regexp.MustCompile(`/(\d+)/posts/(\d+|pfbid[a-zA-Z0-9]+)`)
	matches := reNum.FindStringSubmatch(facebookURL)
	if len(matches) == 3 {
		return fmt.Sprintf("%s_%s", matches[1], matches[2]), matches[1], nil
	}

	// Pattern 2: https://www.facebook.com/permalink.php?story_fbid=123456789&id=100063948291038
	reQuery := regexp.MustCompile(`story_fbid=([0-9a-zA-Z]+).*id=(\d+)`)
	matchesQ := reQuery.FindStringSubmatch(facebookURL)
	if len(matchesQ) == 3 {
		return fmt.Sprintf("%s_%s", matchesQ[2], matchesQ[1]), matchesQ[2], nil
	}

	// Pattern 3: https://www.facebook.com/PageName/posts/pfbid02...
	reSlug := regexp.MustCompile(`/([a-zA-Z0-9\.-]+)/posts/([a-zA-Z0-9]+)`)
	matchesS := reSlug.FindStringSubmatch(facebookURL)
	if len(matchesS) == 3 {
		return fmt.Sprintf("%s_%s", matchesS[1], matchesS[2]), matchesS[1], nil
	}

	return "", "", fmt.Errorf("unrecognized Facebook URL pattern. Supported: facebook.com/{PageID}/posts/{PostID}")
}

func (m *MetaFacebookProvider) GetPostPermittedContent(postID string, pageAccessToken string) (*PostContentResult, error) {
	fields := "id,message,created_time,attachments{media,subattachments}"
	apiURL := fmt.Sprintf(
		"https://graph.facebook.com/%s/%s?fields=%s&access_token=%s",
		m.GraphVersion,
		url.QueryEscape(postID),
		url.QueryEscape(fields),
		url.QueryEscape(pageAccessToken),
	)

	resp, err := m.HTTPClient.Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("network error fetching post: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read post response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("FACEBOOK_PERMISSION_DENIED (%d): %s", resp.StatusCode, string(body))
	}

	var rawResponse struct {
		ID          string `json:"id"`
		Message     string `json:"message"`
		CreatedTime string `json:"created_time"`
		Attachments struct {
			Data []struct {
				Media struct {
					Image struct {
						Src string `json:"src"`
					} `json:"image"`
				} `json:"media"`
				Subattachments struct {
					Data []struct {
						Media struct {
							Image struct {
								Src string `json:"src"`
							} `json:"image"`
						} `json:"media"`
					} `json:"data"`
				} `json:"subattachments"`
			} `json:"data"`
		} `json:"attachments"`
	}

	if err := json.Unmarshal(body, &rawResponse); err != nil {
		return nil, fmt.Errorf("failed to parse post content JSON: %w", err)
	}

	var imageURLs []string
	for _, att := range rawResponse.Attachments.Data {
		if att.Media.Image.Src != "" {
			imageURLs = append(imageURLs, att.Media.Image.Src)
		}
		for _, sub := range att.Subattachments.Data {
			if sub.Media.Image.Src != "" {
				imageURLs = append(imageURLs, sub.Media.Image.Src)
			}
		}
	}

	createdTime, _ := time.Parse(time.RFC3339, rawResponse.CreatedTime)
	if createdTime.IsZero() {
		createdTime = time.Now()
	}

	return &PostContentResult{
		PostID:      rawResponse.ID,
		Message:     rawResponse.Message,
		CreatedTime: createdTime,
		ImageURLs:   imageURLs,
	}, nil
}
