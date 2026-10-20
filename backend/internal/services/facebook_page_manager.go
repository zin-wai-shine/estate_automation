package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

// Default managed Facebook Pages under the shared Meta Developer App.
const (
	DefaultFacebookPage2ID = "494870343703559"
)

// ManagedPageDTO is the safe, frontend-facing view of a managed page (never contains tokens).
type ManagedPageDTO struct {
	ID                 uint       `json:"id"`
	Slot               int        `json:"slot"`
	PageID             string     `json:"page_id"`
	Name               string     `json:"name"`
	Label              string     `json:"label"`
	PageURL            string     `json:"page_url"`
	PictureURL         string     `json:"picture_url,omitempty"`
	PictureFetchedAt   *time.Time `json:"picture_fetched_at,omitempty"`
	Category           string     `json:"category"`
	HasToken           bool       `json:"has_token"`
	TokenHint          string     `json:"token_hint"`
	TokenStatus        string     `json:"token_status"`
	TokenExpiresAt     *time.Time `json:"token_expires_at,omitempty"`
	TokenNeverExpires  bool       `json:"token_never_expires"`
	TokenExpiresInDays *int       `json:"token_expires_in_days,omitempty"`
	TokenUpdatedAt     *time.Time `json:"token_updated_at,omitempty"`
	Permissions        []string   `json:"permissions"`
	CanCreateContent   bool       `json:"can_create_content"`
	TestPassed         bool       `json:"test_passed"`
	IsConnected        bool       `json:"is_connected"`
	LastTestedAt       *time.Time `json:"last_tested_at,omitempty"`
	LastError          string     `json:"last_error,omitempty"`
	AutoPublishEnabled bool       `json:"auto_publish_enabled"`
	ReadyToPublish     bool       `json:"ready_to_publish"`
}

// PageTestResult is the outcome of a live Meta Graph API access test for one page.
type PageTestResult struct {
	Slot             int       `json:"slot"`
	PageID           string    `json:"page_id"`
	PageName         string    `json:"page_name"`
	PictureURL       string    `json:"picture_url,omitempty"`
	Connected        bool      `json:"connected"`
	Passed           bool      `json:"passed"`
	TokenStatus      string    `json:"token_status"`
	CanCreateContent bool      `json:"can_create_content"`
	Permissions      []string  `json:"permissions"`
	Message          string    `json:"message"`
	CheckedAt        time.Time `json:"checked_at"`
}

type graphAPIError struct {
	Message      string `json:"message"`
	Type         string `json:"type"`
	Code         int    `json:"code"`
	ErrorSubcode int    `json:"error_subcode"`
}

func (e *graphAPIError) Error() string {
	return fmt.Sprintf("Meta Graph API error (%d): %s", e.Code, e.Message)
}

func (e *graphAPIError) isTokenExpired() bool {
	return e.Code == 190 || e.ErrorSubcode == 463 || e.ErrorSubcode == 467 || e.ErrorSubcode == 490
}

// FacebookPageManager owns per-page token storage, validation and expiry handling.
type FacebookPageManager struct {
	httpClient *http.Client
	mu         sync.Mutex
}

var (
	pageManagerInstance *FacebookPageManager
	pageManagerOnce     sync.Once
)

func GetFacebookPageManager() *FacebookPageManager {
	pageManagerOnce.Do(func() {
		pageManagerInstance = &FacebookPageManager{
			httpClient: &http.Client{Timeout: 30 * time.Second},
		}
	})
	return pageManagerInstance
}

func isPlaceholderToken(token string) bool {
	t := strings.TrimSpace(token)
	return t == "" || strings.Contains(t, "REPLACE_WITH_")
}

// GetSystemSetting retrieves a configuration value from the system_settings database table.
func GetSystemSetting(key string) string {
	if database.DB == nil {
		return ""
	}
	var setting models.SystemSetting
	if err := database.DB.Where("key = ?", key).First(&setting).Error; err == nil {
		return strings.TrimSpace(setting.Value)
	}
	return ""
}

// SetSystemSetting updates or creates a system setting in the database.
func SetSystemSetting(key, value string) error {
	if database.DB == nil {
		return fmt.Errorf("database not available")
	}
	var setting models.SystemSetting
	err := database.DB.Where("key = ?", key).First(&setting).Error
	if err != nil {
		setting = models.SystemSetting{
			Key:   key,
			Value: value,
		}
		return database.DB.Create(&setting).Error
	}
	setting.Value = value
	return database.DB.Save(&setting).Error
}

func getMetaAppID() string {
	if val := GetSystemSetting("META_APP_ID"); val != "" {
		return val
	}
	val := strings.TrimSpace(os.Getenv("META_APP_ID"))
	if val != "" {
		return val
	}
	return DefaultMetaAppID
}

func getMetaAppSecret() string {
	if val := GetSystemSetting("META_APP_SECRET"); val != "" {
		return val
	}
	return strings.TrimSpace(os.Getenv("META_APP_SECRET"))
}

func graphVersion() string {
	_, _, version, _, _ := GetFacebookPublishService().GetConfig()
	return version
}

// graphGet performs a GET request against the Meta Graph API and decodes the JSON body into out.
func (m *FacebookPageManager) graphGet(ctx context.Context, path string, params url.Values, out interface{}) error {
	endpoint := fmt.Sprintf("%s/%s/%s?%s", MetaGraphBaseURL, graphVersion(), strings.TrimPrefix(path, "/"), params.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	resp, err := m.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("network error contacting Meta Graph API: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	var envelope struct {
		Error *graphAPIError `json:"error,omitempty"`
	}
	if json.Unmarshal(body, &envelope) == nil && envelope.Error != nil {
		return envelope.Error
	}
	if out != nil {
		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("failed to parse Meta Graph API response: %w", err)
		}
	}
	return nil
}

// SeedDefaultPages ensures Page 1 and Page 2 exist and migrates any env/legacy tokens (encrypted).
func (m *FacebookPageManager) SeedDefaultPages() {
	if database.DB == nil {
		return
	}
	page1ID := strings.TrimSpace(os.Getenv("FACEBOOK_PAGE_ID"))
	if page1ID == "" {
		page1ID = DefaultFacebookPageID
	}
	page2ID := strings.TrimSpace(os.Getenv("FACEBOOK_PAGE_2_ID"))
	if page2ID == "" {
		page2ID = DefaultFacebookPage2ID
	}

	defaults := []struct {
		slot     int
		pageID   string
		name     string
		envToken string
	}{
		{1, page1ID, "Dot BKK Living", os.Getenv("FACEBOOK_PAGE_ACCESS_TOKEN")},
		{2, page2ID, "Bolt Haven Realty", os.Getenv("FACEBOOK_PAGE_2_ACCESS_TOKEN")},
	}

	for _, d := range defaults {
		var page models.FacebookManagedPage
		err := database.DB.Where("slot = ?", d.slot).First(&page).Error
		if err != nil {
			page = models.FacebookManagedPage{
				Slot:        d.slot,
				PageID:      d.pageID,
				Name:        d.name,
				Label:       fmt.Sprintf("Page %d", d.slot),
				PageURL:     fmt.Sprintf("https://www.facebook.com/profile.php?id=%s", d.pageID),
				TokenStatus: models.FBTokenMissing,
			}
			if createErr := database.DB.Create(&page).Error; createErr != nil {
				log.Printf("[FB Pages] failed seeding page slot %d: %v", d.slot, createErr)
				continue
			}
			log.Printf("[FB Pages] Seeded managed Facebook Page %d (ID: %s)", d.slot, d.pageID)
		} else {
			// Update unverified old placeholder IDs (61568058604134, 61593000699921) to verified Page IDs
			if (page.PageID == "61568058604134" || page.PageID == "") && d.slot == 1 {
				page.PageID = d.pageID
				page.Name = d.name
				page.PageURL = fmt.Sprintf("https://www.facebook.com/profile.php?id=%s", d.pageID)
				_ = database.DB.Save(&page)
				log.Printf("[FB Pages] Updated Slot 1 to correct Page ID: %s (%s)", d.pageID, d.name)
			} else if (page.PageID == "61593000699921" || page.PageID == "") && d.slot == 2 {
				page.PageID = d.pageID
				page.Name = d.name
				page.PageURL = fmt.Sprintf("https://www.facebook.com/profile.php?id=%s", d.pageID)
				_ = database.DB.Save(&page)
				log.Printf("[FB Pages] Updated Slot 2 to correct Page ID: %s (%s)", d.pageID, d.name)
			}
		}

		if page.EncryptedToken != "" {
			continue
		}

		// Migrate token from environment or database system_settings (only into its own page — never cross-assign)
		token := ""
		if !isPlaceholderToken(d.envToken) {
			token = strings.TrimSpace(d.envToken)
		} else if d.slot == 1 {
			if sVal := GetSystemSetting("FACEBOOK_PAGE_1_ACCESS_TOKEN"); !isPlaceholderToken(sVal) {
				token = sVal
			} else if sVal := GetSystemSetting("FACEBOOK_PAGE_ACCESS_TOKEN"); !isPlaceholderToken(sVal) {
				token = sVal
			} else {
				// Legacy single-page table fallback for Page 1 only
				var legacy models.FacebookPage
				if database.DB.Where("page_id = ?", page.PageID).First(&legacy).Error == nil && !isPlaceholderToken(legacy.PageAccessToken) {
					token = legacy.PageAccessToken
				}
			}
		} else if d.slot == 2 {
			if sVal := GetSystemSetting("FACEBOOK_PAGE_2_ACCESS_TOKEN"); !isPlaceholderToken(sVal) {
				token = sVal
			}
		}
		if token != "" {
			if err := m.storeToken(&page, token); err != nil {
				log.Printf("[FB Pages] failed migrating token for page slot %d: %v", d.slot, err)
			} else {
				log.Printf("[FB Pages] Migrated existing token for Page %d into encrypted storage", d.slot)
			}
		}
	}

	// Trigger automatic background sync to validate tokens and retrieve real Page name & profile picture from Meta
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		m.SyncAllPages(ctx)
	}()
}

func (m *FacebookPageManager) storeToken(page *models.FacebookManagedPage, token string) error {
	enc, err := EncryptToken(token)
	if err != nil {
		return err
	}
	now := time.Now()
	page.EncryptedToken = enc
	page.TokenHint = TokenHint(token)
	page.TokenStatus = models.FBTokenUntested
	page.TokenUpdatedAt = &now
	page.TokenExpiresAt = nil
	page.TestPassed = false
	page.AutoPublishEnabled = false // must re-test before auto publishing
	page.LastError = ""
	return database.DB.Save(page).Error
}

func toDTO(p models.FacebookManagedPage) ManagedPageDTO {
	perms := []string{}
	if p.Permissions != "" {
		_ = json.Unmarshal([]byte(p.Permissions), &perms)
	}
	picURL := p.PictureURL
	if picURL == "" {
		if p.Slot == 1 || p.PageID == "1287202894475973" {
			picURL = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=160&h=160&q=80"
		} else if p.Slot == 2 || p.PageID == "494870343703559" {
			picURL = "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=160&h=160&q=80"
		}
	}
	dto := ManagedPageDTO{
		ID:                 p.ID,
		Slot:               p.Slot,
		PageID:             p.PageID,
		Name:               p.Name,
		Label:              p.Label,
		PageURL:            p.PageURL,
		PictureURL:         picURL,
		PictureFetchedAt:   p.PictureFetchedAt,
		Category:           p.Category,
		HasToken:           p.EncryptedToken != "",
		TokenHint:          p.TokenHint,
		TokenStatus:        string(p.TokenStatus),
		TokenExpiresAt:     p.TokenExpiresAt,
		TokenUpdatedAt:     p.TokenUpdatedAt,
		Permissions:        perms,
		CanCreateContent:   p.CanCreateContent,
		TestPassed:         p.TestPassed,
		IsConnected:        p.IsConnected && p.TestPassed && p.TokenStatus == models.FBTokenValid,
		LastTestedAt:       p.LastTestedAt,
		LastError:          p.LastError,
		AutoPublishEnabled: p.AutoPublishEnabled,
	}
	if p.TokenExpiresAt != nil {
		days := int(time.Until(*p.TokenExpiresAt).Hours() / 24)
		dto.TokenExpiresInDays = &days
	} else if p.TestPassed {
		dto.TokenNeverExpires = true
	}
	dto.ReadyToPublish = dto.HasToken && p.TokenStatus == models.FBTokenValid && p.TestPassed
	return dto
}

// ListPages returns all managed pages ordered by slot.
func (m *FacebookPageManager) ListPages() ([]ManagedPageDTO, error) {
	if database.DB == nil {
		return []ManagedPageDTO{}, nil
	}
	var pages []models.FacebookManagedPage
	if err := database.DB.Order("slot ASC").Find(&pages).Error; err != nil {
		return nil, err
	}
	out := make([]ManagedPageDTO, 0, len(pages))
	for _, p := range pages {
		out = append(out, toDTO(p))
	}
	return out, nil
}

// GetPage loads a managed page by its Facebook Page ID or Slot number.
func (m *FacebookPageManager) GetPage(pageID string) (*models.FacebookManagedPage, error) {
	if database.DB == nil {
		return nil, fmt.Errorf("database not available")
	}
	cleanID := strings.TrimSpace(pageID)
	var page models.FacebookManagedPage
	err := database.DB.Where("page_id = ?", cleanID).First(&page).Error
	if err != nil {
		if slotNum, convErr := strconv.Atoi(cleanID); convErr == nil && slotNum > 0 {
			err = database.DB.Where("slot = ?", slotNum).First(&page).Error
		}
	}
	if err != nil {
		return nil, fmt.Errorf("Facebook Page %s is not registered in Page Token management", pageID)
	}
	return &page, nil
}

// GetOrCreatePage retrieves a managed page or registers it automatically if not found.
func (m *FacebookPageManager) GetOrCreatePage(pageID string, defaultName string) (*models.FacebookManagedPage, error) {
	page, err := m.GetPage(pageID)
	if err == nil && page != nil {
		return page, nil
	}
	if database.DB == nil {
		return nil, fmt.Errorf("database not available")
	}
	cleanID := strings.TrimSpace(pageID)
	var maxSlot int
	row := database.DB.Model(&models.FacebookManagedPage{}).Select("COALESCE(MAX(slot), 0)").Row()
	_ = row.Scan(&maxSlot)
	newSlot := maxSlot + 1

	name := strings.TrimSpace(defaultName)
	if name == "" {
		name = fmt.Sprintf("Page %s", cleanID)
	}

	newPage := models.FacebookManagedPage{
		Slot:        newSlot,
		PageID:      cleanID,
		Name:        name,
		Label:       fmt.Sprintf("Page %d", newSlot),
		PageURL:     fmt.Sprintf("https://www.facebook.com/%s", cleanID),
		PictureURL:  fmt.Sprintf("https://graph.facebook.com/%s/picture?type=large", cleanID),
		TokenStatus: models.FBTokenUntested,
		IsConnected: false,
	}
	if err := database.DB.Create(&newPage).Error; err != nil {
		return nil, fmt.Errorf("failed to register Facebook Page %s: %w", cleanID, err)
	}
	return &newPage, nil
}

// UpdatePagePicture updates the picture URL of a managed page.
func (m *FacebookPageManager) UpdatePagePicture(ctx context.Context, pageID, pictureURL string) (*ManagedPageDTO, error) {
	page, err := m.GetOrCreatePage(pageID, "")
	if err != nil {
		return nil, err
	}
	page.PictureURL = strings.TrimSpace(pictureURL)
	now := time.Now()
	page.PictureFetchedAt = &now
	if database.DB != nil {
		if err := database.DB.Save(page).Error; err != nil {
			return nil, err
		}
	}
	dto := toDTO(*page)
	return &dto, nil
}

// GetDecryptedPageToken retrieves the decrypted token for inspection.
func (m *FacebookPageManager) GetDecryptedPageToken(pageID string) (string, *models.FacebookManagedPage, error) {
	page, err := m.GetPage(pageID)
	if err != nil {
		return "", nil, err
	}
	if page.EncryptedToken == "" {
		return "", page, fmt.Errorf("no token stored for this page")
	}
	token, err := DecryptToken(page.EncryptedToken)
	if err != nil || token == "" {
		return "", page, fmt.Errorf("could not decrypt token")
	}
	return token, page, nil
}

// GetPageDTO returns the safe view of a page.
func (m *FacebookPageManager) GetPageDTO(pageID string) (*ManagedPageDTO, error) {
	page, err := m.GetPage(pageID)
	if err != nil {
		return nil, err
	}
	dto := toDTO(*page)
	return &dto, nil
}

// TokenForPage returns the decrypted Page Access Token that belongs EXCLUSIVELY to pageID.
// It verifies that the token is a Page Access Token (not a User token) so publishing as the Page itself succeeds.
func (m *FacebookPageManager) TokenForPage(pageID string) (string, *models.FacebookManagedPage, error) {
	page, err := m.GetPage(pageID)
	if err != nil {
		return "", nil, err
	}
	label := pageLabel(page)
	if page.EncryptedToken == "" {
		return "", page, fmt.Errorf("%s has no Page Access Token. Add it in the Page Tokens menu", label)
	}
	if page.TokenStatus == models.FBTokenExpired {
		return "", page, fmt.Errorf("%s token has expired or was revoked. Update it in the Page Tokens menu", label)
	}
	if page.TokenStatus == models.FBTokenInvalid {
		return "", page, fmt.Errorf("%s token is invalid. Update it in the Page Tokens menu", label)
	}
	token, err := DecryptToken(page.EncryptedToken)
	if err != nil || token == "" {
		return "", page, fmt.Errorf("%s token could not be decrypted. Please save it again", label)
	}

	// Verify that the token is a true Page Access Token (GET /me returns the Page ID).
	// In Meta Graph API, unpublished photo uploads require posting as the Page itself using a Page Access Token.
	var me struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	_ = m.graphGet(context.Background(), "me", url.Values{"fields": {"id,name"}, "access_token": {token}}, &me)
	if me.ID != page.PageID {
		log.Printf("[FB Pages] Token for Page %s is a User token (/me ID=%s). Upgrading to dedicated Page Access Token...", page.PageID, me.ID)
		resolved, rErr := m.resolveTokenForPage(context.Background(), page, token)
		if rErr == nil && resolved != "" && resolved != token {
			_ = m.storeToken(page, resolved)
			_ = database.DB.Save(page)
			token = resolved
			log.Printf("[FB Pages] Upgraded stored token for Page %s (%s) to verified Page Access Token", page.PageID, page.Name)
		} else if rErr != nil {
			log.Printf("[FB Pages] Could not resolve Page Access Token for Page %s: %v", page.PageID, rErr)
		}
	}

	return token, page, nil
}

func pageLabel(p *models.FacebookManagedPage) string {
	name := p.Name
	if name == "" {
		name = p.PageID
	}
	return fmt.Sprintf("Page %d (%s)", p.Slot, name)
}

// resolveTokenForPage verifies that token belongs to or manages page. If a USER token is
// supplied, it retrieves the page's dedicated Page Access Token from /me/accounts.
// It ensures that the returned token is ALWAYS a verified Page Access Token belonging to pageID.
func (m *FacebookPageManager) resolveTokenForPage(ctx context.Context, page *models.FacebookManagedPage, token string) (string, error) {
	pageID := strings.TrimSpace(page.PageID)
	token = strings.TrimSpace(token)
	if pageID == "" || token == "" {
		return "", fmt.Errorf("page ID and token are required")
	}

	// 1. Check /me identity: In Meta Graph API, GET /me with a Page Access Token returns the Page ID!
	var me struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	_ = m.graphGet(ctx, "me", url.Values{"fields": {"id,name"}, "access_token": {token}}, &me)
	if me.ID == pageID {
		log.Printf("[FB Pages] Token verified as Page Access Token for Page %s (%s)", pageID, me.Name)
		return token, nil
	}

	// 2. Token is not a Page Access Token for this page (likely a User Access Token).
	// Query GET /me/accounts?fields=id,name,access_token,tasks to retrieve the Page Access Token.
	accounts, err := m.fetchUserPages(ctx, token)
	if err == nil && len(accounts) > 0 {
		for _, a := range accounts {
			if a.ID == pageID {
				if a.AccessToken != "" {
					log.Printf("[FB Pages] Extracted dedicated Page Access Token from /me/accounts for Page %s (%s)", pageID, a.Name)
					return a.AccessToken, nil
				}
				return "", fmt.Errorf("user manages page %s (%s) but Meta returned no Page Access Token", pageID, a.Name)
			}
		}
	}

	// 3. Fallback: Query system User Token if configured
	userToken := m.getUserAccessToken()
	if userToken != "" && userToken != token {
		userAccounts, uErr := m.fetchUserPages(ctx, userToken)
		if uErr == nil {
			for _, a := range userAccounts {
				if a.ID == pageID && a.AccessToken != "" {
					log.Printf("[FB Pages] Extracted Page Access Token from system User Token for Page %s (%s)", pageID, a.Name)
					return a.AccessToken, nil
				}
			}
		}
	}
	// 4. If page has an old placeholder ID and accounts were discovered, map slot and return dedicated token
	if err == nil && len(accounts) > 0 {
		if (page.PageID == "61568058604134" || page.PageID == "") && page.Slot == 1 && len(accounts) >= 1 {
			match := accounts[0]
			page.PageID = match.ID
			page.Name = match.Name
			page.Category = match.Category
			if match.Picture.Data.URL != "" {
				page.PictureURL = match.Picture.Data.URL
			}
			if match.Link != "" {
				page.PageURL = match.Link
			}
			_ = database.DB.Save(page)
			log.Printf("[FB Pages] Mapped Slot 1 to discovered Page %s (%s)", match.ID, match.Name)
			if match.AccessToken != "" {
				return match.AccessToken, nil
			}
		} else if (page.PageID == "61593000699921" || page.PageID == "") && page.Slot == 2 && len(accounts) >= 2 {
			match := accounts[1]
			page.PageID = match.ID
			page.Name = match.Name
			page.Category = match.Category
			if match.Picture.Data.URL != "" {
				page.PictureURL = match.Picture.Data.URL
			}
			if match.Link != "" {
				page.PageURL = match.Link
			}
			_ = database.DB.Save(page)
			log.Printf("[FB Pages] Mapped Slot 2 to discovered Page %s (%s)", match.ID, match.Name)
			if match.AccessToken != "" {
				return match.AccessToken, nil
			}
		}
	}

	// 5. Detailed error message if access cannot be verified
	if me.Name != "" && me.ID != "" {
		return "", fmt.Errorf("this token is a User Token for \"%s\" (ID %s), but does not have permission for Page %s. Use 1-Click Auto-Import or click 'Connect Facebook Account' above", me.Name, me.ID, pageID)
	}

	return "", fmt.Errorf("invalid token or token does not have access to Facebook Page %s", pageID)
}

type userPageAccount struct {
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
}

func (m *FacebookPageManager) fetchUserPages(ctx context.Context, userToken string) ([]userPageAccount, error) {
	var all []userPageAccount
	params := url.Values{
		"fields":       {"id,name,category,access_token,tasks,link"},
		"limit":        {"100"},
		"access_token": {userToken},
	}
	var resp struct {
		Data   []userPageAccount `json:"data"`
		Paging struct {
			Cursors struct {
				After string `json:"after"`
			} `json:"cursors"`
			Next string `json:"next"`
		} `json:"paging"`
	}
	for i := 0; i < 10; i++ {
		resp.Data = nil
		resp.Paging.Next = ""
		if err := m.graphGet(ctx, "me/accounts", params, &resp); err != nil {
			log.Printf("[FB Pages] fetchUserPages error: %v", err)
			return nil, err
		}
		all = append(all, resp.Data...)
		if resp.Paging.Next == "" || resp.Paging.Cursors.After == "" {
			break
		}
		params.Set("after", resp.Paging.Cursors.After)
	}
	return all, nil
}

// exchangeLongLivedUserToken upgrades a short-lived user token when the App Secret is configured.
// Page tokens derived from a long-lived user token do not expire.
func (m *FacebookPageManager) exchangeLongLivedUserToken(ctx context.Context, userToken string) string {
	appID := getMetaAppID()
	secret := getMetaAppSecret()
	if isPlaceholderToken(secret) || secret == "your_meta_app_secret_here" {
		return userToken
	}
	var out struct {
		AccessToken string `json:"access_token"`
	}
	err := m.graphGet(ctx, "oauth/access_token", url.Values{
		"grant_type":        {"fb_exchange_token"},
		"client_id":         {appID},
		"client_secret":     {secret},
		"fb_exchange_token": {userToken},
	}, &out)
	if err != nil || out.AccessToken == "" {
		log.Printf("[FB Pages] long-lived token exchange skipped: %v", err)
		return userToken
	}
	return out.AccessToken
}

// SetPageToken validates ownership, encrypts and stores the token, then runs a live access test.
func (m *FacebookPageManager) SetPageToken(ctx context.Context, pageID, token string) (*PageTestResult, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fmt.Errorf("token cannot be empty")
	}
	page, err := m.GetOrCreatePage(pageID, "")
	if err != nil {
		return nil, err
	}
	pageToken, err := m.resolveTokenForPage(ctx, page, token)
	if err != nil {
		// Securely encrypt and store the token in the database even if expired or reconnect required
		m.mu.Lock()
		_ = m.storeToken(page, token)
		status := models.FBTokenReconnectRequired
		if gErr, ok := err.(*graphAPIError); ok && gErr.isTokenExpired() {
			status = models.FBTokenExpired
		} else if gErr, ok := err.(*graphAPIError); ok && gErr.Code == 100 {
			status = models.FBTokenUntested
		} else if strings.Contains(strings.ToLower(err.Error()), "expired") {
			status = models.FBTokenExpired
		}
		page.TokenStatus = status
		page.TestPassed = false
		page.IsConnected = false
		page.LastError = err.Error()
		now := time.Now()
		page.LastTestedAt = &now
		_ = database.DB.Save(page)
		m.mu.Unlock()

		return &PageTestResult{
			Slot:        page.Slot,
			PageID:      page.PageID,
			PageName:    page.Name,
			PictureURL:  page.PictureURL,
			Connected:   false,
			Passed:      false,
			TokenStatus: string(page.TokenStatus),
			Message:     err.Error(),
			CheckedAt:   time.Now(),
		}, err
	}

	m.mu.Lock()
	err = m.storeToken(page, pageToken)
	m.mu.Unlock()
	if err != nil {
		return nil, fmt.Errorf("failed to store token securely: %w", err)
	}
	return m.TestPage(ctx, page.PageID)
}

// ImportFromUserToken retrieves each managed page's OWN Page Access Token from a user token.
func (m *FacebookPageManager) ImportFromUserToken(ctx context.Context, userToken string) ([]PageTestResult, error) {
	userToken = strings.TrimSpace(userToken)
	if userToken == "" {
		return nil, fmt.Errorf("user access token is required")
	}
	longLived := m.exchangeLongLivedUserToken(ctx, userToken)
	_ = SetSystemSetting("META_USER_ACCESS_TOKEN", longLived)

	accounts, err := m.fetchUserPages(ctx, longLived)
	if err != nil {
		return nil, fmt.Errorf("failed to list pages for this user token: %w", err)
	}
	if len(accounts) == 0 {
		return nil, fmt.Errorf("no authorized Facebook Pages found for this user token. Make sure it has 'pages_show_list' and 'pages_manage_posts' permissions")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	var pages []models.FacebookManagedPage
	database.DB.Order("slot ASC").Find(&pages)

	existingMap := make(map[string]*models.FacebookManagedPage)
	for i := range pages {
		existingMap[pages[i].PageID] = &pages[i]
	}

	var results []PageTestResult
	for idx, acc := range accounts {
		if acc.AccessToken == "" {
			continue
		}

		var targetPage *models.FacebookManagedPage

		// Match existing by ID
		if existing, found := existingMap[acc.ID]; found {
			targetPage = existing
		} else {
			// Match slot 1 or slot 2 if unconfigured or old placeholder
			if idx == 0 {
				for i := range pages {
					if pages[i].Slot == 1 {
						targetPage = &pages[i]
						break
					}
				}
			} else if idx == 1 {
				for i := range pages {
					if pages[i].Slot == 2 {
						targetPage = &pages[i]
						break
					}
				}
			}

			// If still not matched, allocate next slot
			if targetPage == nil {
				var maxSlot int
				row := database.DB.Model(&models.FacebookManagedPage{}).Select("COALESCE(MAX(slot), 0)").Row()
				_ = row.Scan(&maxSlot)
				newSlot := maxSlot + 1
				newPage := models.FacebookManagedPage{
					Slot:        newSlot,
					PageID:      acc.ID,
					Name:        acc.Name,
					Label:       fmt.Sprintf("Page %d", newSlot),
					PageURL:     acc.Link,
					Category:    acc.Category,
					PictureURL:  acc.Picture.Data.URL,
					TokenStatus: models.FBTokenUntested,
					IsConnected: true,
				}
				if err := database.DB.Create(&newPage).Error; err == nil {
					targetPage = &newPage
				}
			}
		}

		if targetPage == nil {
			continue
		}

		targetPage.PageID = acc.ID
		if acc.Name != "" {
			targetPage.Name = acc.Name
		}
		if acc.Category != "" {
			targetPage.Category = acc.Category
		}
		if acc.Picture.Data.URL != "" {
			targetPage.PictureURL = acc.Picture.Data.URL
			now := time.Now()
			targetPage.PictureFetchedAt = &now
		}
		if acc.Link != "" {
			targetPage.PageURL = acc.Link
		}
		targetPage.IsConnected = true

		if storeErr := m.storeToken(targetPage, acc.AccessToken); storeErr != nil {
			log.Printf("[FB Pages] failed storing token for page %s: %v", acc.ID, storeErr)
			continue
		}
		_ = database.DB.Save(targetPage)

		res, testErr := m.TestPage(ctx, targetPage.PageID)
		if testErr != nil {
			results = append(results, PageTestResult{Slot: targetPage.Slot, PageID: targetPage.PageID, PageName: targetPage.Name, Message: testErr.Error(), CheckedAt: time.Now()})
			continue
		}
		results = append(results, *res)
	}

	return results, nil
}

// TestPage verifies the page's own token against Meta Graph API and records the outcome.
// Automatically retrieves real Facebook Page name and profile picture logo.
func (m *FacebookPageManager) TestPage(ctx context.Context, pageID string) (*PageTestResult, error) {
	page, err := m.GetOrCreatePage(pageID, "")
	if err != nil {
		return nil, err
	}
	now := time.Now()
	result := &PageTestResult{
		Slot:        page.Slot,
		PageID:      page.PageID,
		PageName:    page.Name,
		PictureURL:  page.PictureURL,
		Connected:   false,
		Permissions: []string{},
		CheckedAt:   now,
	}

	save := func() {
		page.LastTestedAt = &now
		page.TestPassed = result.Passed
		page.IsConnected = result.Connected
		page.CanCreateContent = result.CanCreateContent
		permsJSON, _ := json.Marshal(result.Permissions)
		page.Permissions = string(permsJSON)
		if !result.Passed {
			page.AutoPublishEnabled = false
			page.LastError = result.Message
		} else {
			page.LastError = ""
		}
		page.TokenStatus = models.FacebookTokenStatus(result.TokenStatus)
		database.DB.Save(page)
	}

	if page.EncryptedToken == "" {
		result.TokenStatus = string(models.FBTokenMissing)
		result.Connected = false
		result.Passed = false
		result.Message = "Token Missing: No Page Access Token stored for this page."
		save()
		return result, nil
	}
	token, decErr := DecryptToken(page.EncryptedToken)
	if decErr != nil || token == "" {
		result.TokenStatus = string(models.FBTokenReconnectRequired)
		result.Connected = false
		result.Passed = false
		result.Message = "Reconnect Required: Stored token could not be decrypted. Please save it again."
		save()
		return result, nil
	}

	var info struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Link     string `json:"link"`
		Category string `json:"category"`
		Picture  struct {
			Data struct {
				URL          string `json:"url"`
				IsSilhouette bool   `json:"is_silhouette"`
			} `json:"data"`
		} `json:"picture"`
	}

	// 1. Retrieve Page ID, name, and profile picture using:
	// GET /{page-id}?fields=id,name,picture (never request tasks directly from the Page node)
	gErr := m.graphGet(ctx, page.PageID, url.Values{
		"fields":       {"id,name,picture.type(large){url,is_silhouette},link,category"},
		"access_token": {token},
	}, &info)

	if gErr != nil {
		result.Connected = false
		result.Passed = false
		if ge, ok := gErr.(*graphAPIError); ok && ge.isTokenExpired() {
			result.TokenStatus = string(models.FBTokenReconnectRequired)
			result.Message = fmt.Sprintf("Reconnect Required: Token expired or revoked (code %d). Generate a new Page Access Token.", ge.Code)
		} else if ge, ok := gErr.(*graphAPIError); ok && ge.Code == 100 {
			// For Graph API error #100 caused by an invalid field, display "API Request Error" instead
			result.TokenStatus = string(page.TokenStatus)
			if result.TokenStatus == "" || result.TokenStatus == string(models.FBTokenMissing) {
				result.TokenStatus = string(models.FBTokenUntested)
			}
			result.Message = fmt.Sprintf("API Request Error: (%d) %s", ge.Code, ge.Message)
		} else if ge, ok := gErr.(*graphAPIError); ok && (ge.Code == 190 || ge.Code == 102 || (ge.Code >= 200 && ge.Code <= 299)) {
			// Authentication or authorization has actually failed
			result.TokenStatus = string(models.FBTokenReconnectRequired)
			result.Message = fmt.Sprintf("Reconnect Required: %s", ge.Message)
		} else if ge, ok := gErr.(*graphAPIError); ok {
			result.TokenStatus = string(page.TokenStatus)
			if result.TokenStatus == "" {
				result.TokenStatus = string(models.FBTokenUntested)
			}
			result.Message = fmt.Sprintf("API Request Error: (%d) %s", ge.Code, ge.Message)
		} else {
			// Network error: preserve previous token status, but connection verification fails
			result.TokenStatus = string(page.TokenStatus)
			if result.TokenStatus == "" || result.TokenStatus == string(models.FBTokenValid) {
				result.TokenStatus = string(models.FBTokenUntested)
			}
			result.Message = fmt.Sprintf("Network error connecting to Meta Graph API: %v", gErr)
		}
		save()
		return result, nil
	}

	if info.ID != "" && info.ID != page.PageID {
		result.TokenStatus = string(models.FBTokenReconnectRequired)
		result.Connected = false
		result.Passed = false
		result.Message = fmt.Sprintf("Token resolves to a different page (%s). Tokens must not be mixed between pages.", info.ID)
		save()
		return result, nil
	}

	// Automatically update real Page name & Profile Picture from Meta
	if info.Name != "" {
		page.Name = info.Name
		result.PageName = info.Name
	}
	if info.Picture.Data.URL != "" {
		page.PictureURL = info.Picture.Data.URL
		result.PictureURL = info.Picture.Data.URL
		page.PictureFetchedAt = &now
	}
	if info.Link != "" {
		page.PageURL = info.Link
	}
	if info.Category != "" {
		page.Category = info.Category
	}

	// 2. Retrieve Page permissions, tasks, and validate posting capabilities
	var pageTasks []string
	hasCreateContent := false
	hasManagePosts := false
	permMap := make(map[string]bool)

	// Retrieve Page permissions, tasks, and tokens using GET /me/accounts with User Token
	userToken := m.getUserAccessToken()
	if userToken != "" {
		accounts, accErr := m.fetchUserPages(ctx, userToken)
		if accErr == nil {
			for _, a := range accounts {
				if a.ID == page.PageID {
					pageTasks = a.Tasks
					for _, t := range a.Tasks {
						permMap[t] = true
						tu := strings.ToUpper(t)
						if tu == "CREATE_CONTENT" || tu == "PROFILE_PLUS_CREATE_CONTENT" || tu == "PROFILE_PLUS_POST" || tu == "MANAGE" || tu == "MODERATE" || tu == "POST" {
							hasCreateContent = true
						}
					}
					// Ensure stored token is the dedicated Page Access Token (never a User token)
					var meCheck struct {
						ID string `json:"id"`
					}
					_ = m.graphGet(ctx, "me", url.Values{"fields": {"id"}, "access_token": {token}}, &meCheck)
					if a.AccessToken != "" && (page.EncryptedToken == "" || meCheck.ID != page.PageID) {
						_ = m.storeToken(page, a.AccessToken)
						token = a.AccessToken
						page.TokenHint = TokenHint(a.AccessToken)
						log.Printf("[FB Pages] Stored verified Page Access Token for Page %s (%s)", page.PageID, a.Name)
					}
					break
				}
			}
		}

		// Validate pages_manage_posts using granted User Token permissions
		var permsResp struct {
			Data []struct {
				Permission string `json:"permission"`
				Status     string `json:"status"`
			} `json:"data"`
		}
		if err := m.graphGet(ctx, "me/permissions", url.Values{"access_token": {userToken}}, &permsResp); err == nil {
			for _, p := range permsResp.Data {
				if p.Status == "granted" {
					permMap[p.Permission] = true
					if p.Permission == "pages_manage_posts" {
						hasManagePosts = true
					}
				}
			}
		}
	}

	// Validate pages_manage_posts using appropriate token debugging on the Page Access Token
	appID := getMetaAppID()
	secret := getMetaAppSecret()
	page.TokenExpiresAt = nil
	debugChecked := false
	if !isPlaceholderToken(secret) && secret != "your_meta_app_secret_here" {
		var dbg struct {
			Data struct {
				IsValid   bool     `json:"is_valid"`
				ExpiresAt int64    `json:"expires_at"`
				Scopes    []string `json:"scopes"`
			} `json:"data"`
		}
		if m.graphGet(ctx, "debug_token", url.Values{"input_token": {token}, "access_token": {appID + "|" + secret}}, &dbg) == nil {
			debugChecked = true
			if dbg.Data.ExpiresAt > 0 {
				exp := time.Unix(dbg.Data.ExpiresAt, 0)
				page.TokenExpiresAt = &exp
			}
			for _, s := range dbg.Data.Scopes {
				permMap[s] = true
				if s == "pages_manage_posts" {
					hasManagePosts = true
				}
			}
		}
	}

	for p := range permMap {
		result.Permissions = append(result.Permissions, p)
	}

	// Verify CREATE_CONTENT or PROFILE_PLUS_CREATE_CONTENT access (or pages_manage_posts)
	if hasCreateContent || hasManagePosts {
		result.CanCreateContent = true
	} else if len(pageTasks) == 0 && (!debugChecked || hasManagePosts) {
		// Standalone page token with verified access to the page node
		result.CanCreateContent = true
	} else {
		result.CanCreateContent = false
	}

	result.TokenStatus = string(models.FBTokenValid)
	result.Passed = result.CanCreateContent
	result.Connected = result.CanCreateContent
	if result.Passed {
		result.Message = fmt.Sprintf("Access verified for \"%s\". Connected to Meta Graph API.", result.PageName)
	} else {
		result.Message = "Connected to page, but token lacks posting permission (pages_manage_posts / CREATE_CONTENT)."
	}
	save()
	return result, nil
}

// RefreshPageInfo explicitly refreshes a page's real name, profile picture, and connection status from Meta.
func (m *FacebookPageManager) RefreshPageInfo(ctx context.Context, pageID string) (*PageTestResult, error) {
	return m.TestPage(ctx, pageID)
}

// RefreshAllPages refreshes information for all managed pages in parallel.
func (m *FacebookPageManager) RefreshAllPages(ctx context.Context) []PageTestResult {
	return m.TestAllPages(ctx)
}

// SyncAllPages runs a background sync across all pages.
func (m *FacebookPageManager) SyncAllPages(ctx context.Context) []PageTestResult {
	return m.TestAllPages(ctx)
}

func (m *FacebookPageManager) getUserAccessToken() string {
	userToken := GetSystemSetting("META_USER_ACCESS_TOKEN")
	if userToken == "" && database.DB != nil {
		var acc models.FacebookAccount
		if database.DB.Where("status = ?", models.FBStatusConnected).Order("id DESC").First(&acc).Error == nil {
			if dec, err := DecryptToken(acc.AccessToken); err == nil && dec != "" {
				userToken = dec
			} else {
				userToken = acc.AccessToken
			}
		}
	}
	if userToken == "" {
		userToken = GetSystemSetting("FACEBOOK_PAGE_1_ACCESS_TOKEN")
	}
	return strings.TrimSpace(userToken)
}

// DiscoveredPageDTO presents safe page discovery data without exposing tokens.
type DiscoveredPageDTO struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Tasks       []string `json:"tasks"`
	Link        string   `json:"link"`
	PictureURL  string   `json:"picture_url"`
	IsConnected bool     `json:"is_connected"`
	CanPublish  bool     `json:"can_publish"`
}

// GetAuthorizedAccounts calls GET /me/accounts?fields=id,name,category,access_token,tasks,link,picture.type(large){url}
func (m *FacebookPageManager) GetAuthorizedAccounts(ctx context.Context, userToken string) ([]userPageAccount, error) {
	userToken = strings.TrimSpace(userToken)
	if userToken == "" {
		userToken = m.getUserAccessToken()
	}
	if userToken == "" {
		return nil, fmt.Errorf("no authorized Facebook session found; please connect your Facebook account")
	}
	return m.fetchUserPages(ctx, userToken)
}

// GetDiscoveredPages returns safe discovered page data without exposing access tokens
func (m *FacebookPageManager) GetDiscoveredPages(ctx context.Context, userToken string) ([]DiscoveredPageDTO, error) {
	accounts, err := m.GetAuthorizedAccounts(ctx, userToken)
	if err != nil {
		return nil, err
	}

	var managed []models.FacebookManagedPage
	if database.DB != nil {
		database.DB.Find(&managed)
	}
	managedMap := make(map[string]models.FacebookManagedPage)
	for _, mp := range managed {
		managedMap[mp.PageID] = mp
	}

	out := make([]DiscoveredPageDTO, 0, len(accounts))
	for _, a := range accounts {
		canPub := false
		for _, t := range a.Tasks {
			tu := strings.ToUpper(t)
			if tu == "CREATE_CONTENT" || tu == "PROFILE_PLUS_CREATE_CONTENT" || tu == "PROFILE_PLUS_POST" || tu == "MANAGE" || tu == "MODERATE" || tu == "POST" {
				canPub = true
				break
			}
		}
		if len(a.Tasks) == 0 {
			canPub = true
		}

		mp, exists := managedMap[a.ID]
		isConnected := exists && mp.IsConnected && mp.TestPassed

		pic := a.Picture.Data.URL
		if pic == "" && exists {
			pic = mp.PictureURL
		}

		out = append(out, DiscoveredPageDTO{
			ID:          a.ID,
			Name:        a.Name,
			Category:    a.Category,
			Tasks:       a.Tasks,
			Link:        a.Link,
			PictureURL:  pic,
			IsConnected: isConnected,
			CanPublish:  canPub,
		})
	}
	return out, nil
}

// ConnectSelectedPages links and enables user-selected pages
func (m *FacebookPageManager) ConnectSelectedPages(ctx context.Context, pageIDs []string, userToken string) ([]PageTestResult, error) {
	accounts, err := m.GetAuthorizedAccounts(ctx, userToken)
	if err != nil {
		return nil, err
	}

	accMap := make(map[string]userPageAccount)
	for _, a := range accounts {
		accMap[a.ID] = a
	}

	var results []PageTestResult
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, pid := range pageIDs {
		pid = strings.TrimSpace(pid)
		if pid == "" {
			continue
		}
		account, found := accMap[pid]
		if !found || account.AccessToken == "" {
			continue
		}

		var page models.FacebookManagedPage
		err := database.DB.Where("page_id = ?", pid).First(&page).Error
		if err != nil {
			var candidate models.FacebookManagedPage
			foundSlot := false
			// Reuse Slot 1 or Slot 2 if unconfigured or old placeholder
			if database.DB.Where("slot = 1 AND (page_id = '61568058604134' OR is_connected = false OR encrypted_token = '')").First(&candidate).Error == nil {
				page = candidate
				foundSlot = true
			} else if database.DB.Where("slot = 2 AND (page_id = '61593000699921' OR is_connected = false OR encrypted_token = '')").First(&candidate).Error == nil {
				page = candidate
				foundSlot = true
			}

			if foundSlot {
				page.PageID = pid
				page.Name = account.Name
				page.PageURL = account.Link
				page.Category = account.Category
				if account.Picture.Data.URL != "" {
					page.PictureURL = account.Picture.Data.URL
				}
				page.TokenStatus = models.FBTokenUntested
				page.IsConnected = true
				database.DB.Save(&page)
			} else {
				var maxSlot int
				row := database.DB.Model(&models.FacebookManagedPage{}).Select("COALESCE(MAX(slot), 0)").Row()
				_ = row.Scan(&maxSlot)
				newSlot := maxSlot + 1

				page = models.FacebookManagedPage{
					Slot:        newSlot,
					PageID:      pid,
					Name:        account.Name,
					Label:       fmt.Sprintf("Page %d", newSlot),
					PageURL:     account.Link,
					Category:    account.Category,
					PictureURL:  account.Picture.Data.URL,
					TokenStatus: models.FBTokenUntested,
					IsConnected: true,
				}
				if err := database.DB.Create(&page).Error; err != nil {
					log.Printf("[FB Pages] failed creating page for %s: %v", pid, err)
					continue
				}
			}
		} else {
			page.Name = account.Name
			page.Category = account.Category
			if account.Picture.Data.URL != "" {
				page.PictureURL = account.Picture.Data.URL
			}
			if account.Link != "" {
				page.PageURL = account.Link
			}
			page.IsConnected = true
		}

		if err := m.storeToken(&page, account.AccessToken); err != nil {
			log.Printf("[FB Pages] failed storing token for %s: %v", pid, err)
			continue
		}

		testRes, _ := m.TestPage(ctx, pid)
		if testRes != nil {
			results = append(results, *testRes)
		}
	}
	return results, nil
}

// DisconnectPage marks a page as disconnected and disables automatic publishing
func (m *FacebookPageManager) DisconnectPage(ctx context.Context, pageID string) (*ManagedPageDTO, error) {
	page, err := m.GetPage(pageID)
	if err != nil {
		return nil, err
	}
	page.IsConnected = false
	page.AutoPublishEnabled = false
	if err := database.DB.Save(page).Error; err != nil {
		return nil, err
	}
	dto := toDTO(*page)
	return &dto, nil
}

// TestAllPages runs an access test on each managed page independently.
func (m *FacebookPageManager) TestAllPages(ctx context.Context) []PageTestResult {
	var pages []models.FacebookManagedPage
	if database.DB == nil {
		return nil
	}
	database.DB.Order("slot ASC").Find(&pages)
	results := make([]PageTestResult, len(pages))
	var wg sync.WaitGroup
	for i, p := range pages {
		wg.Add(1)
		go func(i int, pageID string) {
			defer wg.Done()
			res, err := m.TestPage(ctx, pageID)
			if err != nil || res == nil {
				results[i] = PageTestResult{PageID: pageID, Message: fmt.Sprintf("%v", err), CheckedAt: time.Now()}
				return
			}
			results[i] = *res
		}(i, p.PageID)
	}
	wg.Wait()
	return results
}

// SetAutoPublish toggles automatic (scheduled) publishing. Enabling requires a passed test.
func (m *FacebookPageManager) SetAutoPublish(pageID string, enabled bool) (*ManagedPageDTO, error) {
	page, err := m.GetPage(pageID)
	if err != nil {
		return nil, err
	}
	if enabled && !(page.TestPassed && page.TokenStatus == models.FBTokenValid && page.EncryptedToken != "") {
		return nil, fmt.Errorf("%s must pass an access test before automatic publishing can be enabled", pageLabel(page))
	}
	page.AutoPublishEnabled = enabled
	if err := database.DB.Save(page).Error; err != nil {
		return nil, err
	}
	dto := toDTO(*page)
	return &dto, nil
}

// UpdateLabel changes the display label for a page.
func (m *FacebookPageManager) UpdateLabel(pageID, label string) (*ManagedPageDTO, error) {
	page, err := m.GetPage(pageID)
	if err != nil {
		return nil, err
	}
	label = strings.TrimSpace(label)
	if label == "" {
		label = fmt.Sprintf("Page %d", page.Slot)
	}
	if len(label) > 100 {
		label = label[:100]
	}
	page.Label = label
	if err := database.DB.Save(page).Error; err != nil {
		return nil, err
	}
	dto := toDTO(*page)
	return &dto, nil
}

// RemoveToken deletes the stored token for one page only.
func (m *FacebookPageManager) RemoveToken(pageID string) (*ManagedPageDTO, error) {
	page, err := m.GetPage(pageID)
	if err != nil {
		return nil, err
	}
	page.EncryptedToken = ""
	page.TokenHint = ""
	page.TokenStatus = models.FBTokenMissing
	page.TokenExpiresAt = nil
	page.TestPassed = false
	page.CanCreateContent = false
	page.AutoPublishEnabled = false
	if err := database.DB.Save(page).Error; err != nil {
		return nil, err
	}
	dto := toDTO(*page)
	return &dto, nil
}

// MarkTokenExpired flags a page's token as expired and disables automatic publishing for it.
func (m *FacebookPageManager) MarkTokenExpired(pageID, reason string) {
	page, err := m.GetPage(pageID)
	if err != nil {
		return
	}
	page.TokenStatus = models.FBTokenExpired
	page.TestPassed = false
	page.AutoPublishEnabled = false
	page.LastError = reason
	database.DB.Save(page)
	log.Printf("[FB Pages] %s token marked EXPIRED: %s", pageLabel(page), reason)
}

// RunHealthCheck re-validates every stored token so expired tokens are caught before publishing.
func (m *FacebookPageManager) RunHealthCheck(ctx context.Context) {
	if database.DB == nil {
		return
	}
	var pages []models.FacebookManagedPage
	database.DB.Where("encrypted_token <> ''").Find(&pages)
	for _, p := range pages {
		if p.TokenStatus == models.FBTokenExpired || p.TokenStatus == models.FBTokenInvalid {
			continue
		}
		res, err := m.TestPage(ctx, p.PageID)
		if err == nil && res != nil && !res.Passed {
			log.Printf("[FB Pages] Health check: Page %d (%s) failed: %s", p.Slot, p.PageID, res.Message)
		}
	}
}
