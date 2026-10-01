package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

type FacebookGraphClient struct {
	httpClient *http.Client
}

func NewFacebookGraphClient() *FacebookGraphClient {
	return &FacebookGraphClient{
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

type GraphPostResponse struct {
	ID          string `json:"id"`
	Message     string `json:"message"`
	CreatedTime string `json:"created_time"`
	PermalinkURL string `json:"permalink_url"`
	FullPicture string `json:"full_picture"`
	Attachments struct {
		Data []struct {
			Media struct {
				Image struct {
					Src    string `json:"src"`
					Width  int    `json:"width"`
					Height int    `json:"height"`
				} `json:"image"`
			} `json:"media"`
			Subattachments struct {
				Data []struct {
					Media struct {
						Image struct {
							Src    string `json:"src"`
							Width  int    `json:"width"`
							Height int    `json:"height"`
						} `json:"image"`
					} `json:"media"`
				} `json:"data"`
			} `json:"subattachments"`
		} `json:"data"`
	} `json:"attachments"`
	Error *struct {
		Message   string `json:"message"`
		Type      string `json:"type"`
		Code      int    `json:"code"`
		ErrorSubcode int `json:"error_subcode"`
	} `json:"error,omitempty"`
}

// GetAccessToken retrieves authorized token from environment or database without exposing it
func (c *FacebookGraphClient) GetAccessToken() string {
	token := os.Getenv("FACEBOOK_GRAPH_TOKEN")
	if token != "" {
		return token
	}

	// Look up active token from FacebookAccount in database
	if database.DB != nil {
		var account models.FacebookAccount
		if err := database.DB.Where("status = ?", models.FBStatusConnected).First(&account).Error; err == nil && account.AccessToken != "" {
			return account.AccessToken
		}
		var page models.FacebookPage
		if err := database.DB.Where("is_connected = ?", true).First(&page).Error; err == nil && page.PageAccessToken != "" {
			return page.PageAccessToken
		}
	}

	return ""
}

// ExtractPost attempts to extract post details via official Meta Graph API
func (c *FacebookGraphClient) ExtractPost(postID string) (*models.FacebookImportResult, string, error) {
	token := c.GetAccessToken()
	if token == "" {
		return nil, models.ErrCodeAPIPermissionDenied, fmt.Errorf("no authorized Meta Graph API token configured")
	}

	if postID == "" {
		return nil, models.ErrCodeInvalidURL, fmt.Errorf("cannot use Meta Graph API without numeric post ID")
	}

	apiURL := fmt.Sprintf("https://graph.facebook.com/v19.0/%s?fields=id,message,created_time,permalink_url,full_picture,attachments{media,subattachments}&access_token=%s", postID, token)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, models.ErrCodeExtractionFailed, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, models.ErrCodeExtractionFailed, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, models.ErrCodeExtractionFailed, err
	}

	var graphResp GraphPostResponse
	if err := json.Unmarshal(bodyBytes, &graphResp); err != nil {
		return nil, models.ErrCodeExtractionFailed, err
	}

	if graphResp.Error != nil {
		if graphResp.Error.Code == 4 || graphResp.Error.Code == 17 {
			return nil, models.ErrCodeAPIRateLimited, fmt.Errorf("Meta API rate limited: %s", graphResp.Error.Message)
		}
		if graphResp.Error.Code == 100 || graphResp.Error.Code == 190 {
			return nil, models.ErrCodeAPIPermissionDenied, fmt.Errorf("Meta API permission denied: %s", graphResp.Error.Message)
		}
		return nil, models.ErrCodeExtractionFailed, fmt.Errorf("Meta API error: %s", graphResp.Error.Message)
	}

	// Parse images from attachments
	var images []models.ExtractedImage
	idx := 1

	for _, att := range graphResp.Attachments.Data {
		// Check subattachments (gallery photos)
		if len(att.Subattachments.Data) > 0 {
			for _, sub := range att.Subattachments.Data {
				src := sub.Media.Image.Src
				if src != "" {
					images = append(images, models.ExtractedImage{
						Index:     idx,
						SourceURL: src,
						Width:     sub.Media.Image.Width,
						Height:    sub.Media.Image.Height,
						Status:    "pending",
					})
					idx++
				}
			}
		} else if att.Media.Image.Src != "" {
			images = append(images, models.ExtractedImage{
				Index:     idx,
				SourceURL: att.Media.Image.Src,
				Width:     att.Media.Image.Width,
				Height:    att.Media.Image.Height,
				Status:    "pending",
			})
			idx++
		}
	}

	// Fallback to full_picture if no attachments
	if len(images) == 0 && graphResp.FullPicture != "" {
		images = append(images, models.ExtractedImage{
			Index:     1,
			SourceURL: graphResp.FullPicture,
			Status:    "pending",
		})
	}

	result := &models.FacebookImportResult{
		Source: models.SourceDetails{
			Platform:         "facebook",
			PostID:           graphResp.ID,
			CreatedTime:      graphResp.CreatedTime,
			CanonicalURL:     graphResp.PermalinkURL,
			ExtractionMethod: models.ExtractionMethodMetaAPI,
		},
		Caption: models.CaptionDetails{
			Original: graphResp.Message,
			Cleaned:  strings.TrimSpace(graphResp.Message),
		},
		Images: images,
	}

	return result, "", nil
}
