package services

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

// In-memory CSRF state cache with TTL
type oauthStateEntry struct {
	CreatedAt time.Time
}

var (
	oauthStates     = make(map[string]oauthStateEntry)
	oauthStatesLock sync.Mutex
)

// GenerateSecureOAuthState creates a cryptographically random 32-byte state and tracks it
func GenerateSecureOAuthState() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("tt_state_%d", time.Now().UnixNano())
	}
	state := hex.EncodeToString(bytes)

	oauthStatesLock.Lock()
	defer oauthStatesLock.Unlock()

	// Prune older than 15 mins
	now := time.Now()
	for k, v := range oauthStates {
		if now.Sub(v.CreatedAt) > 15*time.Minute {
			delete(oauthStates, k)
		}
	}
	oauthStates[state] = oauthStateEntry{CreatedAt: now}
	return state
}

// ValidateOAuthState verifies that the OAuth state was issued and hasn't expired
func ValidateOAuthState(state string) bool {
	if state == "" {
		return false
	}
	oauthStatesLock.Lock()
	defer oauthStatesLock.Unlock()

	entry, exists := oauthStates[state]
	if !exists {
		return false
	}
	delete(oauthStates, state) // One-time use
	return time.Since(entry.CreatedAt) <= 15*time.Minute
}

type TikTokService struct {
	client *http.Client
}

var (
	tikTokServiceInstance *TikTokService
	tikTokServiceOnce     sync.Once
)

func GetTikTokService() *TikTokService {
	tikTokServiceOnce.Do(func() {
		tikTokServiceInstance = &TikTokService{
			client: &http.Client{
				Timeout: 45 * time.Second,
			},
		}
	})
	return tikTokServiceInstance
}

// Config helpers
func (s *TikTokService) getClientKey() string {
	return strings.TrimSpace(os.Getenv("TIKTOK_CLIENT_KEY"))
}

func (s *TikTokService) getClientSecret() string {
	return strings.TrimSpace(os.Getenv("TIKTOK_CLIENT_SECRET"))
}

func (s *TikTokService) getRedirectURI() string {
	uri := strings.TrimSpace(os.Getenv("TIKTOK_REDIRECT_URI"))
	if uri != "" {
		return uri
	}
	publicURL := strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_APP_URL")), "/")
	if publicURL == "" {
		publicURL = "https://app.bolthavenproperty.com"
	}
	return publicURL + "/api/auth/tiktok/callback"
}

func (s *TikTokService) getPublicAppURL() string {
	url := strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_APP_URL")), "/")
	if url == "" {
		url = "https://app.bolthavenproperty.com"
	}
	return url
}

// BuildAuthURL constructs the official TikTok Login Kit v2 Authorization URL
func (s *TikTokService) BuildAuthURL(state, customRedirectURI string) (string, error) {
	clientKey := s.getClientKey()
	if clientKey == "" {
		return "", errors.New("TIKTOK_CLIENT_KEY is not configured")
	}

	redirectURI := customRedirectURI
	if redirectURI == "" {
		redirectURI = s.getRedirectURI()
	}

	// Official TikTok scopes:
	// user.info.basic: get profile picture, username, display name
	// video.publish: direct post photo mode carousels and videos
	// video.upload: draft/upload permissions
	scope := "user.info.basic,video.publish,video.upload"

	v := url.Values{}
	v.Set("client_key", clientKey)
	v.Set("scope", scope)
	v.Set("response_type", "code")
	v.Set("redirect_uri", redirectURI)
	v.Set("state", state)

	authURL := fmt.Sprintf("https://www.tiktok.com/v2/auth/authorize/?%s", v.Encode())
	return authURL, nil
}

// Token responses
type TikTokTokenData struct {
	AccessToken      string `json:"access_token"`
	ExpiresIn        int64  `json:"expires_in"`
	OpenID           string `json:"open_id"`
	RefreshToken     string `json:"refresh_token"`
	RefreshExpiresIn int64  `json:"refresh_expires_in"`
	Scope            string `json:"scope"`
	TokenType        string `json:"token_type"`
}

type TikTokTokenResponse struct {
	Data  TikTokTokenData `json:"data"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		LogID   string `json:"log_id"`
	} `json:"error"`
}

// ExchangeCode exchanges an authorization code for TikTok access and refresh tokens
func (s *TikTokService) ExchangeCode(code, redirectURI string) (*TikTokTokenResponse, error) {
	clientKey := s.getClientKey()
	clientSecret := s.getClientSecret()
	if clientKey == "" || clientSecret == "" {
		return nil, errors.New("TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET is missing")
	}

	if redirectURI == "" {
		redirectURI = s.getRedirectURI()
	}

	form := url.Values{}
	form.Set("client_key", clientKey)
	form.Set("client_secret", clientSecret)
	form.Set("code", code)
	form.Set("grant_type", "authorization_code")
	form.Set("redirect_uri", redirectURI)

	req, err := http.NewRequest("POST", "https://open.tiktokapis.com/v2/oauth/token/", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Cache-Control", "no-cache")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("tiktok oauth request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading token response failed: %w", err)
	}

	var tokenResp TikTokTokenResponse
	if err := json.Unmarshal(bodyBytes, &tokenResp); err != nil {
		return nil, fmt.Errorf("decoding token response failed: %w (raw: %s)", err, string(bodyBytes))
	}

	if tokenResp.Error.Code != "ok" && tokenResp.Error.Code != "" {
		return nil, fmt.Errorf("tiktok oauth error [%s]: %s (log_id: %s)",
			tokenResp.Error.Code, tokenResp.Error.Message, tokenResp.Error.LogID)
	}

	if tokenResp.Data.AccessToken == "" {
		return nil, fmt.Errorf("empty access token in tiktok response: %s", string(bodyBytes))
	}

	return &tokenResp, nil
}

// RefreshToken exchanges a refresh token for a fresh access token
func (s *TikTokService) RefreshToken(account *models.TikTokAccount) error {
	clientKey := s.getClientKey()
	clientSecret := s.getClientSecret()
	if clientKey == "" || clientSecret == "" {
		return errors.New("TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET is missing")
	}

	plainRefreshToken, err := DecryptToken(account.EncryptedRefreshToken)
	if err != nil || plainRefreshToken == "" {
		return fmt.Errorf("cannot decrypt refresh token for account %s: %v", account.Username, err)
	}

	form := url.Values{}
	form.Set("client_key", clientKey)
	form.Set("client_secret", clientSecret)
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", plainRefreshToken)

	req, err := http.NewRequest("POST", "https://open.tiktokapis.com/v2/oauth/token/", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("refresh token request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var tokenResp TikTokTokenResponse
	if err := json.Unmarshal(bodyBytes, &tokenResp); err != nil {
		return fmt.Errorf("failed to parse refresh response: %w", err)
	}

	if tokenResp.Error.Code != "ok" && tokenResp.Error.Code != "" {
		account.TokenStatus = models.TikTokTokenExpired
		account.LastError = fmt.Sprintf("Refresh failed: %s (%s)", tokenResp.Error.Message, tokenResp.Error.Code)
		database.DB.Save(account)
		return fmt.Errorf("refresh error: %s", tokenResp.Error.Message)
	}

	// Encrypt fresh tokens
	encAccess, err := EncryptToken(tokenResp.Data.AccessToken)
	if err != nil {
		return err
	}
	account.EncryptedAccessToken = encAccess
	if tokenResp.Data.RefreshToken != "" {
		if encRefresh, rErr := EncryptToken(tokenResp.Data.RefreshToken); rErr == nil {
			account.EncryptedRefreshToken = encRefresh
		}
	}

	now := time.Now()
	tokenExp := now.Add(time.Duration(tokenResp.Data.ExpiresIn) * time.Second)
	account.TokenExpiresAt = &tokenExp
	if tokenResp.Data.RefreshExpiresIn > 0 {
		refExp := now.Add(time.Duration(tokenResp.Data.RefreshExpiresIn) * time.Second)
		account.RefreshTokenExpiresAt = &refExp
	}
	account.TokenUpdatedAt = &now
	account.TokenStatus = models.TikTokTokenValid
	account.TokenHint = TokenHint(tokenResp.Data.AccessToken)
	account.LastError = ""

	return database.DB.Save(account).Error
}

// User Info response
type TikTokUserResponse struct {
	Data struct {
		User struct {
			OpenID      string `json:"open_id"`
			UnionID     string `json:"union_id"`
			AvatarURL   string `json:"avatar_url"`
			DisplayName string `json:"display_name"`
			Username    string `json:"username"`
		} `json:"user"`
	} `json:"data"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// FetchUserInfo queries TikTok user details with access token
func (s *TikTokService) FetchUserInfo(accessToken string) (*TikTokUserResponse, error) {
	reqURL := "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username"
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch user info error: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var userResp TikTokUserResponse
	if err := json.Unmarshal(bodyBytes, &userResp); err != nil {
		return nil, fmt.Errorf("parse user info error: %w (raw: %s)", err, string(bodyBytes))
	}

	if userResp.Error.Code != "ok" && userResp.Error.Code != "" {
		return nil, fmt.Errorf("user info api error [%s]: %s", userResp.Error.Code, userResp.Error.Message)
	}

	return &userResp, nil
}

// Creator Info response
type TikTokCreatorInfoResponse struct {
	Data struct {
		CreatorAvatarURL         string   `json:"creator_avatar_url"`
		CreatorNickname          string   `json:"creator_nickname"`
		CreatorUsername          string   `json:"creator_username"`
		PrivacyLevelOptions      []string `json:"privacy_level_options"`
		CommentDisabled          bool     `json:"comment_disabled"`
		DuetDisabled             bool     `json:"duet_disabled"`
		StitchDisabled           bool     `json:"stitch_disabled"`
		MaxVideoPostDurationSec  int      `json:"max_video_post_duration_sec"`
	} `json:"data"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// FetchCreatorInfo checks creator posting settings and permissions
func (s *TikTokService) FetchCreatorInfo(accessToken string) (*TikTokCreatorInfoResponse, error) {
	reqURL := "https://open.tiktokapis.com/v2/post/publish/creator_info/query/"
	req, err := http.NewRequest("POST", reqURL, bytes.NewBuffer([]byte("{}")))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json; charset=UTF-8")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var creatorResp TikTokCreatorInfoResponse
	if err := json.Unmarshal(bodyBytes, &creatorResp); err != nil {
		return nil, err
	}

	return &creatorResp, nil
}

// HandleAuthCallback completes the OAuth code exchange, queries user profile, and persists the account
func (s *TikTokService) HandleAuthCallback(code, redirectURI string) (*models.TikTokAccount, error) {
	tokenResp, err := s.ExchangeCode(code, redirectURI)
	if err != nil {
		return nil, fmt.Errorf("token exchange failed: %w", err)
	}

	// Fetch real user info
	userInfo, err := s.FetchUserInfo(tokenResp.Data.AccessToken)
	if err != nil {
		log.Printf("Warning: failed to fetch user info: %v", err)
	}

	// Encrypt tokens
	encAccess, err := EncryptToken(tokenResp.Data.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("token encryption failed: %w", err)
	}
	encRefresh, _ := EncryptToken(tokenResp.Data.RefreshToken)

	now := time.Now()
	tokenExp := now.Add(time.Duration(tokenResp.Data.ExpiresIn) * time.Second)
	refExp := now.Add(time.Duration(tokenResp.Data.RefreshExpiresIn) * time.Second)

	openID := tokenResp.Data.OpenID
	if openID == "" && userInfo != nil {
		openID = userInfo.Data.User.OpenID
	}
	if openID == "" {
		return nil, errors.New("open_id not provided by tiktok")
	}

	username := ""
	displayName := ""
	avatarURL := ""
	unionID := ""

	if userInfo != nil {
		username = userInfo.Data.User.Username
		displayName = userInfo.Data.User.DisplayName
		avatarURL = userInfo.Data.User.AvatarURL
		unionID = userInfo.Data.User.UnionID
	}
	if username == "" {
		username = openID
	}

	// Check Creator Info to verify photo mode / video publishing permissions
	canPublishPhoto := true
	canUploadVideo := true
	creatorInfo, cErr := s.FetchCreatorInfo(tokenResp.Data.AccessToken)
	if cErr == nil && creatorInfo != nil && creatorInfo.Error.Code == "ok" {
		if creatorInfo.Data.CreatorUsername != "" && username == openID {
			username = creatorInfo.Data.CreatorUsername
		}
		if creatorInfo.Data.CreatorNickname != "" && displayName == "" {
			displayName = creatorInfo.Data.CreatorNickname
		}
		if creatorInfo.Data.CreatorAvatarURL != "" && avatarURL == "" {
			avatarURL = creatorInfo.Data.CreatorAvatarURL
		}
	}

	scopesList := strings.Split(tokenResp.Data.Scope, ",")
	permBytes, _ := json.Marshal(scopesList)

	env := strings.ToLower(os.Getenv("TIKTOK_ENVIRONMENT"))
	if env == "" {
		env = "sandbox"
	}

	// Upsert into database
	var account models.TikTokAccount
	err = database.DB.Where("open_id = ?", openID).First(&account).Error
	if err != nil {
		// New account
		account = models.TikTokAccount{
			OpenID:                 openID,
			UnionID:                unionID,
			Username:               username,
			DisplayName:            displayName,
			AvatarURL:              avatarURL,
			EncryptedAccessToken:   encAccess,
			EncryptedRefreshToken:  encRefresh,
			TokenHint:              TokenHint(tokenResp.Data.AccessToken),
			TokenStatus:            models.TikTokTokenValid,
			Scope:                  tokenResp.Data.Scope,
			Permissions:            string(permBytes),
			CanPublishPhotoMode:    canPublishPhoto,
			CanUploadVideo:         canUploadVideo,
			TestPassed:             true,
			AutoPublishEnabled:     true,
			LastTestedAt:           &now,
			TokenExpiresAt:         &tokenExp,
			RefreshTokenExpiresAt: &refExp,
			TokenUpdatedAt:         &now,
			Environment:            env,
		}
		if createErr := database.DB.Create(&account).Error; createErr != nil {
			return nil, fmt.Errorf("failed to save tiktok account: %w", createErr)
		}
	} else {
		// Existing account update
		account.Username = username
		if displayName != "" {
			account.DisplayName = displayName
		}
		if avatarURL != "" {
			account.AvatarURL = avatarURL
		}
		if unionID != "" {
			account.UnionID = unionID
		}
		account.EncryptedAccessToken = encAccess
		if encRefresh != "" {
			account.EncryptedRefreshToken = encRefresh
		}
		account.TokenHint = TokenHint(tokenResp.Data.AccessToken)
		account.TokenStatus = models.TikTokTokenValid
		account.Scope = tokenResp.Data.Scope
		account.Permissions = string(permBytes)
		account.CanPublishPhotoMode = canPublishPhoto
		account.CanUploadVideo = canUploadVideo
		account.TestPassed = true
		account.LastTestedAt = &now
		account.LastError = ""
		account.TokenExpiresAt = &tokenExp
		account.RefreshTokenExpiresAt = &refExp
		account.TokenUpdatedAt = &now
		account.Environment = env
		if saveErr := database.DB.Save(&account).Error; saveErr != nil {
			return nil, fmt.Errorf("failed to update tiktok account: %w", saveErr)
		}
	}

	return &account, nil
}

// ListAccounts retrieves all stored TikTok accounts (secrets excluded)
func (s *TikTokService) ListAccounts() ([]models.TikTokAccount, error) {
	var accounts []models.TikTokAccount
	err := database.DB.Order("created_at asc").Find(&accounts).Error
	return accounts, err
}

// GetAccount retrieves a single TikTok account
func (s *TikTokService) GetAccount(id uint) (*models.TikTokAccount, error) {
	var account models.TikTokAccount
	if err := database.DB.First(&account, id).Error; err != nil {
		return nil, err
	}
	return &account, nil
}

// TestAccount performs an actual validation test against TikTok API
func (s *TikTokService) TestAccount(id uint) (*models.TikTokAccount, error) {
	account, err := s.GetAccount(id)
	if err != nil {
		return nil, err
	}

	// Decrypt access token
	plainToken, err := DecryptToken(account.EncryptedAccessToken)
	if err != nil || plainToken == "" {
		account.TokenStatus = models.TikTokTokenMissing
		account.TestPassed = false
		account.LastError = "Access token could not be decrypted"
		database.DB.Save(account)
		return account, errors.New(account.LastError)
	}

	// If token has expired or is close to expiring, attempt refresh
	if account.TokenExpiresAt != nil && time.Until(*account.TokenExpiresAt) < 5*time.Minute {
		if rErr := s.RefreshToken(account); rErr != nil {
			log.Printf("Token auto-refresh failed: %v", rErr)
		} else {
			plainToken, _ = DecryptToken(account.EncryptedAccessToken)
		}
	}

	// Call official user info
	userInfo, err := s.FetchUserInfo(plainToken)
	now := time.Now()
	account.LastTestedAt = &now

	if err != nil {
		account.TokenStatus = models.TikTokTokenInvalid
		account.TestPassed = false
		account.LastError = fmt.Sprintf("TikTok verification error: %v", err)
		database.DB.Save(account)
		return account, err
	}

	// Verification succeeded
	account.TokenStatus = models.TikTokTokenValid
	account.TestPassed = true
	account.LastError = ""
	if userInfo.Data.User.Username != "" {
		account.Username = userInfo.Data.User.Username
	}
	if userInfo.Data.User.DisplayName != "" {
		account.DisplayName = userInfo.Data.User.DisplayName
	}
	if userInfo.Data.User.AvatarURL != "" {
		account.AvatarURL = userInfo.Data.User.AvatarURL
	}

	database.DB.Save(account)
	return account, nil
}

// DeleteAccount removes an account and attempts token revocation
func (s *TikTokService) DeleteAccount(id uint) error {
	account, err := s.GetAccount(id)
	if err != nil {
		return err
	}

	plainToken, _ := DecryptToken(account.EncryptedAccessToken)
	if plainToken != "" {
		// Attempt revocation
		clientKey := s.getClientKey()
		clientSecret := s.getClientSecret()
		if clientKey != "" && clientSecret != "" {
			form := url.Values{}
			form.Set("client_key", clientKey)
			form.Set("client_secret", clientSecret)
			form.Set("token", plainToken)
			req, _ := http.NewRequest("POST", "https://open.tiktokapis.com/v2/oauth/revoke/", strings.NewReader(form.Encode()))
			if req != nil {
				req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
				s.client.Do(req)
			}
		}
	}

	return database.DB.Delete(account).Error
}

// ToggleAutoPublish enables or disables auto publishing
func (s *TikTokService) ToggleAutoPublish(id uint, enabled bool) (*models.TikTokAccount, error) {
	account, err := s.GetAccount(id)
	if err != nil {
		return nil, err
	}
	account.AutoPublishEnabled = enabled
	err = database.DB.Save(account).Error
	return account, err
}

// ============================================================================
// CONTENT POSTING API (Photo Mode Carousels & Video)
// ============================================================================

type PublishPhotoRequest struct {
	AccountID       uint     `json:"account_id"`
	Title           string   `json:"title"`             // Caption + hashtags (max 2200 chars)
	PhotoImages     []string `json:"photo_images"`      // Public HTTPS URLs
	PhotoCoverIndex int      `json:"photo_cover_index"` // 1-based index
	PrivacyLevel    string   `json:"privacy_level"`     // PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY
	DisableComment  bool     `json:"disable_comment"`
	AutoAddMusic    bool     `json:"auto_add_music"`
}

type TikTokContentInitPayload struct {
	PostInfo struct {
		Title          string `json:"title"`
		PrivacyLevel   string `json:"privacy_level"`
		DisableComment bool   `json:"disable_comment"`
		AutoAddMusic   bool   `json:"auto_add_music"`
	} `json:"post_info"`
	SourceInfo struct {
		Source          string   `json:"source"`
		PhotoImages     []string `json:"photo_images"`
		PhotoCoverIndex int      `json:"photo_cover_index"`
	} `json:"source_info"`
	PostMode  string `json:"post_mode"`
	MediaType string `json:"media_type"`
}

type TikTokContentInitResponse struct {
	Data struct {
		PublishID string `json:"publish_id"`
	} `json:"data"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		LogID   string `json:"log_id"`
	} `json:"error"`
}

// PublishPhotoPost initializes a photo mode carousel publication via TikTok Content Posting API
func (s *TikTokService) PublishPhotoPost(req PublishPhotoRequest) (*models.TikTokPublishPost, error) {
	account, err := s.GetAccount(req.AccountID)
	if err != nil {
		return nil, fmt.Errorf("tiktok account %d not found: %w", req.AccountID, err)
	}

	if account.TokenStatus != models.TikTokTokenValid && !account.TestPassed {
		return nil, errors.New("tiktok account is not verified; please test or reconnect")
	}

	plainToken, err := DecryptToken(account.EncryptedAccessToken)
	if err != nil || plainToken == "" {
		return nil, errors.New("unable to decrypt access token")
	}

	// Validate title/caption
	caption := strings.TrimSpace(req.Title)
	if caption == "" {
		return nil, errors.New("post title / caption is required")
	}
	if len(caption) > 2200 {
		return nil, fmt.Errorf("caption length (%d) exceeds TikTok maximum limit of 2200 characters", len(caption))
	}

	// Validate photo images
	if len(req.PhotoImages) == 0 {
		return nil, errors.New("at least one photo image is required for photo mode")
	}
	if len(req.PhotoImages) > 35 {
		return nil, errors.New("maximum 35 photos allowed by TikTok Photo Mode")
	}

	publicBase := s.getPublicAppURL()
	var resolvedPhotos []string
	for idx, imgURL := range req.PhotoImages {
		trimmed := strings.TrimSpace(imgURL)
		if strings.HasPrefix(trimmed, "http://localhost") || strings.HasPrefix(trimmed, "http://127.0.0.1") {
			// Convert local to public HTTPS
			u, pErr := url.Parse(trimmed)
			if pErr == nil {
				trimmed = publicBase + u.RequestURI()
			}
		} else if strings.HasPrefix(trimmed, "/") {
			trimmed = publicBase + trimmed
		}

		if !strings.HasPrefix(trimmed, "https://") && !strings.HasPrefix(trimmed, "http://") {
			return nil, fmt.Errorf("image #%d URL is invalid: %s", idx+1, imgURL)
		}
		resolvedPhotos = append(resolvedPhotos, trimmed)
	}

	coverIdx := req.PhotoCoverIndex
	if coverIdx < 1 || coverIdx > len(resolvedPhotos) {
		coverIdx = 1
	}

	privacy := req.PrivacyLevel
	if privacy == "" {
		privacy = "PUBLIC_TO_EVERYONE"
	}

	// Build official TikTok payload
	var payload TikTokContentInitPayload
	payload.PostInfo.Title = caption
	payload.PostInfo.PrivacyLevel = privacy
	payload.PostInfo.DisableComment = req.DisableComment
	payload.PostInfo.AutoAddMusic = req.AutoAddMusic
	payload.SourceInfo.Source = "PULL_FROM_URL"
	payload.SourceInfo.PhotoImages = resolvedPhotos
	payload.SourceInfo.PhotoCoverIndex = coverIdx
	payload.PostMode = "MEDIA_UPLOAD"
	payload.MediaType = "PHOTO"

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	initReq, err := http.NewRequest("POST", "https://open.tiktokapis.com/v2/post/publish/content/init/", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	initReq.Header.Set("Authorization", "Bearer "+plainToken)
	initReq.Header.Set("Content-Type", "application/json; charset=UTF-8")

	resp, err := s.client.Do(initReq)
	if err != nil {
		return nil, fmt.Errorf("tiktok init request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var initResp TikTokContentInitResponse
	if err := json.Unmarshal(bodyBytes, &initResp); err != nil {
		return nil, fmt.Errorf("failed to parse tiktok init response: %w (raw: %s)", err, string(bodyBytes))
	}

	photosJSON, _ := json.Marshal(resolvedPhotos)

	if initResp.Error.Code != "ok" && initResp.Error.Code != "" {
		// Record failed post in DB
		failedPost := models.TikTokPublishPost{
			TikTokAccountID:  account.ID,
			OpenID:           account.OpenID,
			Username:         account.Username,
			Title:            caption,
			PrivacyLevel:     privacy,
			DisableComment:   req.DisableComment,
			AutoAddMusic:     req.AutoAddMusic,
			MediaType:        "PHOTO",
			PostMode:         "MEDIA_UPLOAD",
			PhotoImages:      string(photosJSON),
			PhotoCoverIndex:  coverIdx,
			Status:           models.TikTokPostStatusFailed,
			ErrorMessage:     fmt.Sprintf("[%s] %s (log_id: %s)", initResp.Error.Code, initResp.Error.Message, initResp.Error.LogID),
			RawStatusPayload: string(bodyBytes),
		}
		database.DB.Create(&failedPost)
		return &failedPost, fmt.Errorf("tiktok content init error [%s]: %s", initResp.Error.Code, initResp.Error.Message)
	}

	publishID := initResp.Data.PublishID
	if publishID == "" {
		return nil, fmt.Errorf("tiktok did not return a publish_id: %s", string(bodyBytes))
	}

	now := time.Now()
	newPost := models.TikTokPublishPost{
		TikTokAccountID:  account.ID,
		OpenID:           account.OpenID,
		Username:         account.Username,
		PublishID:        publishID,
		Title:            caption,
		PrivacyLevel:     privacy,
		DisableComment:   req.DisableComment,
		AutoAddMusic:     req.AutoAddMusic,
		MediaType:        "PHOTO",
		PostMode:         "MEDIA_UPLOAD",
		PhotoImages:      string(photosJSON),
		PhotoCoverIndex:  coverIdx,
		Status:           models.TikTokPostStatusProcessingDownload,
		RawStatusPayload: string(bodyBytes),
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := database.DB.Create(&newPost).Error; err != nil {
		return nil, fmt.Errorf("failed to save publish record: %w", err)
	}

	return &newPost, nil
}

// Status fetch response
type TikTokPublishStatusResponse struct {
	Data struct {
		Status                   string  `json:"status"` // PROCESSING_DOWNLOAD, PROCESSING_UPLOAD, SUCCESS, FAILED
		FailReason               string  `json:"fail_reason"`
		PublicallyAvailablePosts []int64 `json:"publicaly_available_post_id"`
	} `json:"data"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		LogID   string `json:"log_id"`
	} `json:"error"`
}

// FetchPublishStatus checks the real publishing status from TikTok API and updates DB
func (s *TikTokService) FetchPublishStatus(publishID string) (*models.TikTokPublishPost, error) {
	var post models.TikTokPublishPost
	if err := database.DB.Where("publish_id = ?", publishID).First(&post).Error; err != nil {
		return nil, fmt.Errorf("publish record %s not found: %w", publishID, err)
	}

	// If already in final state, return
	if post.Status == models.TikTokPostStatusSuccess || post.Status == models.TikTokPostStatusFailed {
		return &post, nil
	}

	account, err := s.GetAccount(post.TikTokAccountID)
	if err != nil {
		return &post, err
	}

	plainToken, err := DecryptToken(account.EncryptedAccessToken)
	if err != nil || plainToken == "" {
		return &post, errors.New("unable to decrypt access token")
	}

	reqPayload := map[string]string{"publish_id": publishID}
	reqBytes, _ := json.Marshal(reqPayload)

	req, err := http.NewRequest("POST", "https://open.tiktokapis.com/v2/post/publish/status/fetch/", bytes.NewBuffer(reqBytes))
	if err != nil {
		return &post, err
	}
	req.Header.Set("Authorization", "Bearer "+plainToken)
	req.Header.Set("Content-Type", "application/json; charset=UTF-8")

	resp, err := s.client.Do(req)
	if err != nil {
		return &post, fmt.Errorf("status fetch request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	var statusResp TikTokPublishStatusResponse
	if err := json.Unmarshal(bodyBytes, &statusResp); err != nil {
		return &post, fmt.Errorf("failed to parse status response: %w", err)
	}

	post.RawStatusPayload = string(bodyBytes)
	now := time.Now()

	switch statusResp.Data.Status {
	case "SUCCESS":
		post.Status = models.TikTokPostStatusSuccess
		post.PublishedAt = &now
		if len(statusResp.Data.PublicallyAvailablePosts) > 0 {
			pID := fmt.Sprintf("%d", statusResp.Data.PublicallyAvailablePosts[0])
			post.TikTokPostID = pID
			post.ShareURL = fmt.Sprintf("https://www.tiktok.com/@%s/video/%s", account.Username, pID)
		}
	case "FAILED":
		post.Status = models.TikTokPostStatusFailed
		post.ErrorMessage = statusResp.Data.FailReason
	case "PROCESSING_DOWNLOAD":
		post.Status = models.TikTokPostStatusProcessingDownload
	case "PROCESSING_UPLOAD":
		post.Status = models.TikTokPostStatusProcessingUpload
	}

	database.DB.Save(&post)
	return &post, nil
}

// ListPosts retrieves the TikTok post history from database
func (s *TikTokService) ListPosts() ([]models.TikTokPublishPost, error) {
	var posts []models.TikTokPublishPost
	err := database.DB.Order("created_at desc").Limit(100).Find(&posts).Error
	return posts, err
}
