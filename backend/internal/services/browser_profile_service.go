package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	gohttp "net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"gorm.io/gorm"
)

// BrowserTabItem represents a live discovered or registered tab.
type BrowserTabItem struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	Hostname    string `json:"hostname"`
	IsChatGPT   bool   `json:"is_chatgpt"`
	IsConnected bool   `json:"is_connected"`
	IsSelected  bool   `json:"is_selected"`
}

// BrowserGroupItem represents a discovered or bound tab group.
type BrowserGroupItem struct {
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Color     string           `json:"color"`
	IsActive  bool             `json:"is_active"`
	TabsCount int              `json:"tabs_count"`
	Tabs      []BrowserTabItem `json:"tabs"`
}

type BrowserProfileService struct {
	db *gorm.DB
	mu sync.RWMutex
}

var (
	browserProfileSvcOnce sync.Once
	browserProfileSvcInst *BrowserProfileService
)

func GetBrowserProfileService() *BrowserProfileService {
	browserProfileSvcOnce.Do(func() {
		browserProfileSvcInst = &BrowserProfileService{
			db: database.DB,
		}
		// Seed well-known local profiles if table is empty
		browserProfileSvcInst.seedDefaultProfiles()
	})
	return browserProfileSvcInst
}

// seedDefaultProfiles ensures the user's primary profiles from macOS Local State are available.
func (s *BrowserProfileService) seedDefaultProfiles() {
	if database.DB == nil {
		return
	}

	var count int64
	database.DB.Model(&models.BrowserProfile{}).Count(&count)
	if count > 0 {
		return
	}

	// Try reading host Chrome Local State if available
	discovered := s.DiscoverLocalChromeProfiles()
	if len(discovered) > 0 {
		for _, p := range discovered {
			database.DB.Create(&p)
		}
		return
	}

	// Default fallback seed based on user's known Chrome setup
	defaultProfiles := []models.BrowserProfile{
		{
			ProfileKey:    "Profile 15",
			DisplayName:   "Bolt",
			Email:         "bolt@bolthavenproperty.com",
			IntegrationID: "int-bolt-profile-15",
			Status:        "connected",
			LastSeenAt:    time.Now(),
			AssociatedTabGroups: models.JSONMap{
				"groups": []string{"Raw", "Market Place", "Bolt-Tiktok", "FB Hero", "Properties"},
			},
		},
		{
			ProfileKey:    "Profile 2",
			DisplayName:   "Zin",
			Email:         "zin@bolthavenproperty.com",
			IntegrationID: "int-zin-profile-2",
			Status:        "connected",
			LastSeenAt:    time.Now(),
			AssociatedTabGroups: models.JSONMap{
				"groups": []string{"Raw", "Market Place", "FB Hero", "Properties"},
			},
		},
		{
			ProfileKey:    "Profile 25",
			DisplayName:   "Dot",
			Email:         "dotbkkliving@gmail.com",
			IntegrationID: "int-dot-profile-25",
			Status:        "connected",
			LastSeenAt:    time.Now(),
			AssociatedTabGroups: models.JSONMap{
				"groups": []string{"Raw", "Dot-Tiktok", "Properties"},
			},
		},
		{
			ProfileKey:    "Profile 8",
			DisplayName:   "Brinx (Work)",
			Email:         "work@bolthavenproperty.com",
			IntegrationID: "int-work-profile-8",
			Status:        "registered",
			LastSeenAt:    time.Now().Add(-1 * time.Hour),
			AssociatedTabGroups: models.JSONMap{
				"groups": []string{"Market Place", "FB Hero"},
			},
		},
		{
			ProfileKey:    "Profile 4",
			DisplayName:   "Eaxy4U",
			Email:         "eaxy4u@bolthavenproperty.com",
			IntegrationID: "int-eaxy4u-profile-4",
			Status:        "registered",
			LastSeenAt:    time.Now().Add(-2 * time.Hour),
			AssociatedTabGroups: models.JSONMap{
				"groups": []string{"Raw", "Properties"},
			},
		},
		{
			ProfileKey:    "Profile 9",
			DisplayName:   "Sweetie",
			Email:         "sweetie@bolthavenproperty.com",
			IntegrationID: "int-sweetie-profile-9",
			Status:        "registered",
			LastSeenAt:    time.Now().Add(-3 * time.Hour),
			AssociatedTabGroups: models.JSONMap{
				"groups": []string{"Raw", "IG", "Properties"},
			},
		},
	}

	for _, p := range defaultProfiles {
		database.DB.Create(&p)
	}

	// Seed default processing lanes
	s.seedDefaultLanes()
}

func (s *BrowserProfileService) seedDefaultLanes() {
	var count int64
	database.DB.Model(&models.ProcessingLane{}).Count(&count)
	if count > 0 {
		return
	}

	defaultLanes := []models.ProcessingLane{
		{
			LaneKey:          "lane-1",
			DisplayName:      "Lane 1: Zin / Raw / Photo Enhancement",
			ProcessingMode:   models.ProcessingModeChromeAssisted,
			ProfileName:      "Zin",
			GroupName:        "Raw",
			TargetTabTitle:   "ChatGPT — Property Photo Enhancer",
			PromptTemplateID: "photo_enhancement_strict",
			OutputFormat:     "1080x1350",
			Concurrency:      1,
			Status:           "idle",
		},
		{
			LaneKey:          "lane-2",
			DisplayName:      "Lane 2: Bolt / Bolt-Tiktok / TikTok Hero",
			ProcessingMode:   models.ProcessingModeChromeAssisted,
			ProfileName:      "Bolt",
			GroupName:        "Bolt-Tiktok",
			TargetTabTitle:   "ChatGPT — TikTok Real Estate Script & Media",
			PromptTemplateID: "tiktok_hero_vertical",
			OutputFormat:     "1080x1920",
			Concurrency:      1,
			Status:           "idle",
		},
		{
			LaneKey:          "lane-3",
			DisplayName:      "Lane 3: Dot / Dot-Tiktok / TikTok Hero",
			ProcessingMode:   models.ProcessingModeChromeAssisted,
			ProfileName:      "Dot",
			GroupName:        "Dot-Tiktok",
			TargetTabTitle:   "ChatGPT — TikTok Creator Studio",
			PromptTemplateID: "tiktok_hero_vertical",
			OutputFormat:     "1080x1920",
			Concurrency:      1,
			Status:           "idle",
		},
		{
			LaneKey:          "lane-4",
			DisplayName:      "Lane 4: Zin / FB Hero / Facebook Advertisement",
			ProcessingMode:   models.ProcessingModeChromeAssisted,
			ProfileName:      "Zin",
			GroupName:        "FB Hero",
			TargetTabTitle:   "ChatGPT — Facebook Hero Design",
			PromptTemplateID: "facebook_hero_landscape",
			OutputFormat:     "1200x630",
			Concurrency:      1,
			Status:           "idle",
		},
		{
			LaneKey:          "lane-local-1",
			DisplayName:      "Lane 5: Unattended Local Engine (Fast 4:5 1080x1350)",
			ProcessingMode:   models.ProcessingModeLocalEnhance,
			ProfileName:      "Local Mac Engine",
			GroupName:        "Direct Local Batch",
			TargetTabTitle:   "Unattended Native macOS Pipeline",
			PromptTemplateID: "photo_enhancement_strict",
			OutputFormat:     "1080x1350",
			Concurrency:      2,
			Status:           "idle",
		},
	}

	for _, l := range defaultLanes {
		database.DB.Create(&l)
	}
}

// DiscoverLocalChromeProfiles reads Chrome's Local State on macOS host if accessible.
func (s *BrowserProfileService) DiscoverLocalChromeProfiles() []models.BrowserProfile {
	var profiles []models.BrowserProfile

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return profiles
	}

	localStatePath := filepath.Join(homeDir, "Library", "Application Support", "Google", "Chrome", "Local State")
	data, err := os.ReadFile(localStatePath)
	if err != nil {
		return profiles
	}

	var root map[string]interface{}
	if err := json.Unmarshal(data, &root); err != nil {
		return profiles
	}

	profileSection, ok := root["profile"].(map[string]interface{})
	if !ok {
		return profiles
	}

	infoCache, ok := profileSection["info_cache"].(map[string]interface{})
	if !ok {
		return profiles
	}

	for key, val := range infoCache {
		info, ok := val.(map[string]interface{})
		if !ok {
			continue
		}

		name, _ := info["name"].(string)
		if name == "" {
			name = key
		}
		email, _ := info["user_name"].(string)

		integrationID := fmt.Sprintf("int-%s-%s", strings.ToLower(strings.ReplaceAll(key, " ", "-")), uuid.New().String()[:8])

		profiles = append(profiles, models.BrowserProfile{
			ProfileKey:    key,
			DisplayName:   name,
			Email:         email,
			IntegrationID: integrationID,
			Status:        "connected",
			LastSeenAt:    time.Now(),
			AssociatedTabGroups: models.JSONMap{
				"groups": []string{"Raw", "Market Place", "FB Hero", "Properties"},
			},
		})
	}

	return profiles
}

// ListProfiles returns all registered profiles from the database.
func (s *BrowserProfileService) ListProfiles() ([]models.BrowserProfile, error) {
	var list []models.BrowserProfile
	err := database.DB.Order("display_name ASC").Find(&list).Error
	return list, err
}

// RegisterProfile creates or updates a registered browser profile.
func (s *BrowserProfileService) RegisterProfile(profileKey, displayName, email string) (*models.BrowserProfile, error) {
	var existing models.BrowserProfile
	res := database.DB.Where("profile_key = ? OR display_name = ?", profileKey, displayName).First(&existing)

	if res.Error == nil {
		existing.DisplayName = displayName
		if email != "" {
			existing.Email = email
		}
		existing.Status = "connected"
		existing.LastSeenAt = time.Now()
		if err := database.DB.Save(&existing).Error; err != nil {
			return nil, err
		}
		return &existing, nil
	}

	newProfile := models.BrowserProfile{
		ProfileKey:    profileKey,
		DisplayName:   displayName,
		Email:         email,
		IntegrationID: fmt.Sprintf("int-%s-%d", strings.ToLower(strings.ReplaceAll(profileKey, " ", "-")), time.Now().Unix()),
		Status:        "connected",
		LastSeenAt:    time.Now(),
		AssociatedTabGroups: models.JSONMap{
			"groups": []string{"Raw", "Market Place", "FB Hero", "Properties"},
		},
	}

	if err := database.DB.Create(&newProfile).Error; err != nil {
		return nil, err
	}
	return &newProfile, nil
}

// SyncDiscoveredProfiles scans the host macOS Chrome Local State and inserts any missing profiles.
func (s *BrowserProfileService) SyncDiscoveredProfiles() ([]models.BrowserProfile, int, error) {
	discovered := s.DiscoverLocalChromeProfiles()

	// If running in Docker / no local file found, try asking Mac companion
	if len(discovered) == 0 {
		resp, err := gohttp.Get(companionURL() + "/profiles")
		if err == nil && resp.StatusCode == 200 {
			defer resp.Body.Close()
			var compData struct {
				Status   string `json:"status"`
				Profiles []struct {
					ProfileKey  string `json:"profile_key"`
					DisplayName string `json:"display_name"`
					Email       string `json:"email"`
				} `json:"profiles"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&compData); err == nil {
				for _, cp := range compData.Profiles {
					discovered = append(discovered, models.BrowserProfile{
						ProfileKey:  cp.ProfileKey,
						DisplayName: cp.DisplayName,
						Email:       cp.Email,
						Status:      "connected",
						LastSeenAt:  time.Now(),
						AssociatedTabGroups: models.JSONMap{
							"groups": []string{"Raw", "Market Place", "FB Hero", "Properties"},
						},
					})
				}
			}
		}
	}

	addedCount := 0
	for _, dp := range discovered {
		var existing models.BrowserProfile
		err := database.DB.Where("profile_key = ?", dp.ProfileKey).First(&existing).Error
		if err != nil { // not found -> create
			if dp.IntegrationID == "" {
				dp.IntegrationID = fmt.Sprintf("int-%s-%d", strings.ToLower(strings.ReplaceAll(dp.ProfileKey, " ", "-")), time.Now().Unix())
			}
			if dp.Status == "" {
				dp.Status = "connected"
			}
			dp.LastSeenAt = time.Now()
			if dp.AssociatedTabGroups == nil {
				dp.AssociatedTabGroups = models.JSONMap{
					"groups": []string{"Raw", "Market Place", "FB Hero", "Properties"},
				}
			}
			database.DB.Create(&dp)
			addedCount++
		} else {
			// Update display name or email if existing had defaults
			if existing.Email == "" && dp.Email != "" {
				existing.Email = dp.Email
				database.DB.Model(&existing).Update("email", dp.Email)
			}
		}
	}

	all, err := s.ListProfiles()
	return all, addedCount, err
}

// LaunchOrFocusProfile launches or focuses the chosen Google Chrome profile on macOS.
// companionURL returns the base URL of the macOS companion service.
// Reads COMPANION_URL env var first; defaults to host.docker.internal:9224 (Docker) or 127.0.0.1:9224 (native).
func companionURL() string {
	if v := os.Getenv("COMPANION_URL"); v != "" {
		return v
	}
	if runtime.GOOS == "darwin" {
		return "http://127.0.0.1:9224"
	}
	// Running inside Docker on Mac — reach the host Mac companion
	return "http://host.docker.internal:9224"
}

// callCompanion is a helper that posts a JSON body to the companion service.
func callCompanion(endpoint string, payload map[string]string) error {
	bodyBytes, _ := json.Marshal(payload)
	resp, err := gohttp.Post(companionURL()+endpoint, "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("companion unreachable at %s%s: %w", companionURL(), endpoint, err)
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("companion returned HTTP %d for %s", resp.StatusCode, endpoint)
	}
	return nil
}

func (s *BrowserProfileService) LaunchOrFocusProfile(profileKey string) error {
	if runtime.GOOS == "darwin" {
		chromeBinary := "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
		cmd := exec.Command(chromeBinary, fmt.Sprintf("--profile-directory=%s", profileKey), "--load-extension=/Users/zinwaishine/Desktop/Project_EA/extension")
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("failed to open Chrome profile %s on macOS: %w", profileKey, err)
		}
		_ = exec.Command("osascript", "-e", "tell application \"Google Chrome\" to activate").Run()
		return nil
	}
	// Running in Docker — delegate to the macOS companion service
	return callCompanion("/open-profile", map[string]string{"profile_key": profileKey})
}

// LaunchProfileWithURL opens a specific URL in the given Chrome profile.
// On native macOS it uses exec; inside Docker it delegates to the companion.
func (s *BrowserProfileService) LaunchProfileWithURL(profileKey, targetURL string) error {
	if runtime.GOOS == "darwin" {
		chromeBinary := "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
		cmd := exec.Command(chromeBinary, fmt.Sprintf("--profile-directory=%s", profileKey), "--load-extension=/Users/zinwaishine/Desktop/Project_EA/extension", targetURL)
		if err := cmd.Start(); err != nil {
			return fmt.Errorf("failed to open URL in Chrome profile %s on macOS: %w", profileKey, err)
		}
		_ = exec.Command("osascript", "-e", "tell application \"Google Chrome\" to activate").Run()
		return nil
	}
	// Running in Docker — delegate to the macOS companion service
	return callCompanion("/open-url", map[string]string{"profile_key": profileKey, "url": targetURL})
}

// GetGroupsForProfile returns discovered tab groups for a given profile.
func (s *BrowserProfileService) GetGroupsForProfile(profileID uint) ([]BrowserGroupItem, error) {
	var profile models.BrowserProfile
	if err := database.DB.First(&profile, profileID).Error; err != nil {
		return nil, err
	}

	colorMap := map[string]string{
		"Enhance IMG":      "#3B82F6",
		"Enhance Img":      "#3B82F6",
		"Raw":              "#3B82F6",
		"Market Place":     "#10B981",
		"Bolt-Tiktok":      "#EC4899",
		"Dot-Tiktok":       "#8B5CF6",
		"Tiktok - BH Hero": "#EF4444",
		"Tiktok Dot Hero":  "#10B981",
		"FB Hero":          "#F59E0B",
		"IG":               "#F43F5E",
		"Properties":       "#06B6D4",
		"Facilities IMG":   "#94A3B8",
	}

	// 1. Check live groups reported to Mac companion if available
	liveURL := fmt.Sprintf("%s/profile-groups?profile_name=%s&profile_key=%s", companionURL(), url.QueryEscape(profile.DisplayName), url.QueryEscape(profile.ProfileKey))
	if resp, err := gohttp.Get(liveURL); err == nil && resp.StatusCode == 200 {
		defer resp.Body.Close()
		var liveData struct {
			Groups []BrowserGroupItem `json:"groups"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&liveData); err == nil && len(liveData.Groups) > 0 {
			return liveData.Groups, nil
		}
	}

	// 2. Extract profile-specific groups from AssociatedTabGroups in DB
	var groupNames []string
	if profile.ProfileKey == "Profile 14" || strings.Contains(strings.ToLower(profile.DisplayName), "hsu") {
		groupNames = []string{"Enhance IMG", "FB Hero", "Tiktok - BH Hero", "Tiktok Dot Hero", "Facilities IMG"}
	} else if profile.AssociatedTabGroups != nil {
		if raw, ok := profile.AssociatedTabGroups["groups"].([]interface{}); ok {
			for _, item := range raw {
				if str, ok := item.(string); ok && str != "" {
					groupNames = append(groupNames, str)
				}
			}
		}
	}

	// Default groups if none in database
	if len(groupNames) == 0 {
		groupNames = []string{"Enhance IMG", "FB Hero", "Properties"}
	}

	var result []BrowserGroupItem
	for _, name := range groupNames {
		color := colorMap[name]
		if color == "" {
			color = "#06B6D4"
		}
		tabs := s.getMockTabsForGroup(profile.DisplayName, name)
		result = append(result, BrowserGroupItem{
			ID:        fmt.Sprintf("grp-%d-%s", profileID, strings.ToLower(strings.ReplaceAll(name, " ", "-"))),
			Name:      name,
			Color:     color,
			IsActive:  true,
			TabsCount: len(tabs),
			Tabs:      tabs,
		})
	}

	return result, nil
}

// getMockTabsForGroup provides reliable realistic tabs inside each group.
func (s *BrowserProfileService) getMockTabsForGroup(profileName, groupName string) []BrowserTabItem {
	switch groupName {
	case "Enhance IMG", "Enhance Img":
		return []BrowserTabItem{
			{
				ID:          "tab-enh-1",
				Title:       "Enhance Interior Photograph — Worker #1",
				URL:         "https://chatgpt.com/c/6ad49918-a4f0-83ec-acf5-efb0ef516adc",
				Hostname:    "chatgpt.com",
				IsChatGPT:   true,
				IsConnected: true,
				IsSelected:  true,
			},
			{
				ID:          "tab-enh-2",
				Title:       "ChatGPT Conversation — Worker #2",
				URL:         "https://chatgpt.com/c/6ad4992a-66e8-83ec-9b11-c5e727e258d9",
				Hostname:    "chatgpt.com",
				IsChatGPT:   true,
				IsConnected: true,
				IsSelected:  false,
			},
			{
				ID:          "tab-enh-3",
				Title:       "Enhance interior photograph — Worker #3",
				URL:         "https://chatgpt.com/c/6ad4992b-135c-83ec-b042-8c92220921d7",
				Hostname:    "chatgpt.com",
				IsChatGPT:   true,
				IsConnected: true,
				IsSelected:  false,
			},
			{
				ID:          "tab-enh-4",
				Title:       "ChatGPT — Worker #4",
				URL:         "https://chatgpt.com/c/6ad49924-7dd0-83ec-8205-768c67420600",
				Hostname:    "chatgpt.com",
				IsChatGPT:   true,
				IsConnected: true,
				IsSelected:  false,
			},
		}
	case "Raw":
		return []BrowserTabItem{
			{
				ID:          "tab-chatgpt-enhancer",
				Title:       fmt.Sprintf("ChatGPT — %s Photo Enhancement (Room Preserving)", profileName),
				URL:         "https://chatgpt.com/c/real-estate-enhancer",
				Hostname:    "chatgpt.com",
				IsChatGPT:   true,
				IsConnected: true,
				IsSelected:  true,
			},
			{
				ID:          "tab-drive-raw",
				Title:       "Google Drive — Property Raw Photos Ingestion",
				URL:         "https://drive.google.com/drive/u/0/folders/raw-property",
				Hostname:    "drive.google.com",
				IsChatGPT:   false,
				IsConnected: true,
				IsSelected:  false,
			},
		}
	case "Bolt-Tiktok", "Dot-Tiktok":
		return []BrowserTabItem{
			{
				ID:          "tab-chatgpt-tiktok",
				Title:       fmt.Sprintf("ChatGPT — %s TikTok Real Estate Hook & Script", groupName),
				URL:         "https://chatgpt.com/c/tiktok-creator-hub",
				Hostname:    "chatgpt.com",
				IsChatGPT:   true,
				IsConnected: true,
				IsSelected:  true,
			},
			{
				ID:          "tab-capcut-web",
				Title:       "CapCut Online Video Editor",
				URL:         "https://www.capcut.com/editor",
				Hostname:    "capcut.com",
				IsChatGPT:   false,
				IsConnected: true,
				IsSelected:  false,
			},
		}
	case "FB Hero":
		return []BrowserTabItem{
			{
				ID:          "tab-chatgpt-fbhero",
				Title:       "ChatGPT — Facebook 4:5 & 16:9 Hero Graphic Creator",
				URL:         "https://chatgpt.com/c/fb-hero-graphic",
				Hostname:    "chatgpt.com",
				IsChatGPT:   true,
				IsConnected: true,
				IsSelected:  true,
			},
			{
				ID:          "tab-fb-meta-suite",
				Title:       "Meta Business Suite — BoltHaven Publisher",
				URL:         "https://business.facebook.com/latest/home",
				Hostname:    "business.facebook.com",
				IsChatGPT:   false,
				IsConnected: true,
				IsSelected:  false,
			},
		}
	default:
		return []BrowserTabItem{
			{
				ID:          "tab-chatgpt-general",
				Title:       fmt.Sprintf("ChatGPT — %s Real Estate Workspace", profileName),
				URL:         "https://chatgpt.com/",
				Hostname:    "chatgpt.com",
				IsChatGPT:   true,
				IsConnected: true,
				IsSelected:  true,
			},
		}
	}
}

// ListLanes returns all processing lanes.
func (s *BrowserProfileService) ListLanes() ([]models.ProcessingLane, error) {
	var lanes []models.ProcessingLane
	err := database.DB.Order("id ASC").Find(&lanes).Error
	return lanes, err
}

// UpdateLane saves or modifies a processing lane.
func (s *BrowserProfileService) UpdateLane(lane *models.ProcessingLane) error {
	return database.DB.Save(lane).Error
}

// StartAutomationViaCompanion asks the companion service to dispatch automation to the Chrome extension
func (s *BrowserProfileService) StartAutomationViaCompanion(profileKey, propertyID string, tabIDs []int, jobs []models.ImageProcessingJob) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"profile_key": profileKey,
		"property_id": propertyID,
		"tab_ids":     tabIDs,
		"jobs":        jobs,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	resp, err := gohttp.Post(companionURL()+"/start-automation", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("companion unreachable: %w", err)
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// StopAutomationViaCompanion tells companion to cancel automation
func (s *BrowserProfileService) StopAutomationViaCompanion() error {
	resp, err := gohttp.Post(companionURL()+"/stop-automation", "application/json", bytes.NewReader([]byte("{}")))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// GetAutomationStatus returns current automation progress from companion
func (s *BrowserProfileService) GetAutomationStatus() (map[string]interface{}, error) {
	resp, err := gohttp.Get(companionURL() + "/automation-status")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

// FocusTabGroupViaCompanion asks the companion to focus a Chrome profile and tab group
func (s *BrowserProfileService) FocusTabGroupViaCompanion(profileKey, groupName, tabID, defaultURL string, groupTabUrls []string) (map[string]interface{}, error) {
	payload := map[string]interface{}{
		"profile_key":    profileKey,
		"group_name":     groupName,
		"tab_id":         tabID,
		"url":            defaultURL,
		"group_tab_urls": groupTabUrls,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	resp, err := gohttp.Post(companionURL()+"/focus-tab-group", "application/json", bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("companion unreachable: %w", err)
	}
	defer resp.Body.Close()
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}


