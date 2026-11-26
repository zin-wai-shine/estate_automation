package services

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// DriveImageItem matches the frontend FolderImages item shape.
type DriveImageItem struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Size int64  `json:"size"`
	URL  string `json:"url"`
}

// DriveFolderImagesResult is returned by ListPublicFolderImages.
type DriveFolderImagesResult struct {
	Status        string           `json:"status"`
	Error         string           `json:"error,omitempty"`
	BasePath      string           `json:"basePath,omitempty"`
	MatchedFolder string           `json:"matchedFolder,omitempty"`
	FolderPath    string           `json:"folderPath,omitempty"`
	TotalFound    int              `json:"totalFound"`
	Images        []DriveImageItem `json:"images"`
}

type driveEntry struct {
	ID       string
	Name     string
	MimeType string
	Size     int64
	IsFolder bool
}

// GoogleDriveService lists and fetches images from Google Drive folders (API v3 + public embeddedfolderview fallback).
type GoogleDriveService struct {
	httpClient *http.Client
}

var (
	driveServiceInstance *GoogleDriveService
	driveServiceOnce     sync.Once
)

// NewGoogleDriveService returns the singleton GoogleDriveService instance.
func NewGoogleDriveService() *GoogleDriveService {
	driveServiceOnce.Do(func() {
		driveServiceInstance = &GoogleDriveService{
			httpClient: &http.Client{Timeout: 25 * time.Second},
		}
	})
	return driveServiceInstance
}

var (
	driveFolderURLRegex = regexp.MustCompile(`(?i)/folders/([a-zA-Z0-9_-]{10,})`)
	driveIDParamRegex   = regexp.MustCompile(`(?i)[?&]id=([a-zA-Z0-9_-]{10,})`)
	driveRawIDRegex     = regexp.MustCompile(`^[a-zA-Z0-9_-]{10,}$`)
)

// ExtractDriveFolderID parses a Google Drive folder URL or raw folder ID.
func ExtractDriveFolderID(input string) string {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return ""
	}
	if m := driveFolderURLRegex.FindStringSubmatch(trimmed); len(m) > 1 {
		return m[1]
	}
	if m := driveIDParamRegex.FindStringSubmatch(trimmed); len(m) > 1 {
		return m[1]
	}
	if driveRawIDRegex.MatchString(trimmed) {
		return trimmed
	}
	return ""
}

// ListPublicFolderImages resolves folderName / subPath inside driveURL and returns image items.
func (s *GoogleDriveService) ListPublicFolderImages(ctx context.Context, driveURL, folderName, subPath string, maxCount int) (*DriveFolderImagesResult, error) {
	rootID := ExtractDriveFolderID(driveURL)
	if rootID == "" {
		return &DriveFolderImagesResult{
			Status:   "not_found",
			Error:    "Invalid Google Drive folder URL or ID",
			BasePath: driveURL,
			Images:   []DriveImageItem{},
		}, nil
	}

	token, _ := NewGoogleSheetsService().GetDriveReadOnlyToken(ctx)
	listChildren := func(parentID string) ([]driveEntry, error) {
		if token != "" {
			if entries, err := s.listChildrenViaAPI(ctx, token, parentID); err == nil {
				return entries, nil
			}
		}
		return s.listChildrenViaEmbeddedView(ctx, parentID)
	}

	targetID := rootID
	matchedFolder := "Google Drive"

	rawFolderName := strings.TrimSpace(folderName)
	if rawFolderName != "" {
		children, err := listChildren(rootID)
		if err != nil {
			return &DriveFolderImagesResult{
				Status:   "not_found",
				Error:    fmt.Sprintf("Unable to access Google Drive folder (make sure it is shared as Anyone with the link): %v", err),
				BasePath: driveURL,
				Images:   []DriveImageItem{},
			}, nil
		}
		match := matchDriveSubfolder(children, rawFolderName)
		if match == nil {
			return &DriveFolderImagesResult{
				Status:   "not_found",
				Error:    fmt.Sprintf(`No folder matching "%s" in Google Drive`, rawFolderName),
				BasePath: driveURL,
				Images:   []DriveImageItem{},
			}, nil
		}
		targetID = match.ID
		matchedFolder = match.Name
	}

	cleanSub := strings.Trim(strings.TrimSpace(subPath), "/")
	if cleanSub != "" {
		segments := strings.Split(cleanSub, "/")
		for _, seg := range segments {
			seg = strings.TrimSpace(seg)
			if seg == "" {
				continue
			}
			children, err := listChildren(targetID)
			if err != nil {
				return &DriveFolderImagesResult{
					Status:   "not_found",
					Error:    fmt.Sprintf(`Failed to open subfolder "%s": %v`, seg, err),
					BasePath: driveURL,
					Images:   []DriveImageItem{},
				}, nil
			}
			subMatch := matchDriveSubfolder(children, seg)
			if subMatch == nil {
				return &DriveFolderImagesResult{
					Status:   "not_found",
					Error:    fmt.Sprintf(`No subfolder matching "%s" inside "%s"`, seg, matchedFolder),
					BasePath: driveURL,
					Images:   []DriveImageItem{},
				}, nil
			}
			targetID = subMatch.ID
			if matchedFolder == "Google Drive" {
				matchedFolder = subMatch.Name
			} else {
				matchedFolder = matchedFolder + "/" + subMatch.Name
			}
		}
	}

	entries, err := listChildren(targetID)
	if err != nil {
		return &DriveFolderImagesResult{
			Status:   "not_found",
			Error:    fmt.Sprintf("Unable to read Google Drive folder contents (ensure sharing is Anyone with the link): %v", err),
			BasePath: driveURL,
			Images:   []DriveImageItem{},
		}, nil
	}

	var imageEntries []driveEntry
	for _, e := range entries {
		if e.IsFolder {
			continue
		}
		if isDriveImageEntry(e) {
			imageEntries = append(imageEntries, e)
		}
	}

	sort.Slice(imageEntries, func(i, j int) bool {
		return strings.ToLower(imageEntries[i].Name) < strings.ToLower(imageEntries[j].Name)
	})

	totalFound := len(imageEntries)
	if maxCount > 0 && len(imageEntries) > maxCount {
		imageEntries = imageEntries[:maxCount]
	}

	images := make([]DriveImageItem, 0, len(imageEntries))
	for _, e := range imageEntries {
		images = append(images, DriveImageItem{
			Name: e.Name,
			Path: e.ID,
			Size: e.Size,
			URL:  "/api/google-drive/image?fileId=" + url.QueryEscape(e.ID),
		})
	}

	return &DriveFolderImagesResult{
		Status:        "ok",
		BasePath:      driveURL,
		MatchedFolder: matchedFolder,
		FolderPath:    "https://drive.google.com/drive/folders/" + targetID,
		TotalFound:    totalFound,
		Images:        images,
	}, nil
}

func matchDriveSubfolder(entries []driveEntry, query string) *driveEntry {
	needle := strings.ToLower(strings.TrimSpace(query))
	if needle == "" {
		return nil
	}
	for i := range entries {
		if entries[i].IsFolder && strings.ToLower(entries[i].Name) == needle {
			return &entries[i]
		}
	}
	for i := range entries {
		if !entries[i].IsFolder {
			continue
		}
		lower := strings.ToLower(entries[i].Name)
		if strings.Contains(lower, needle) || strings.Contains(needle, lower) {
			return &entries[i]
		}
	}
	return nil
}

func isDriveImageEntry(e driveEntry) bool {
	if strings.HasPrefix(strings.ToLower(e.MimeType), "image/") {
		return true
	}
	ext := strings.ToLower(filepath.Ext(e.Name))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return true
	}
	return false
}

func (s *GoogleDriveService) listChildrenViaAPI(ctx context.Context, token, parentID string) ([]driveEntry, error) {
	q := fmt.Sprintf("'%s' in parents and trashed = false", parentID)
	apiURL := "https://www.googleapis.com/drive/v3/files?" + url.Values{
		"q":                         {q},
		"fields":                    {"files(id,name,mimeType,size)"},
		"pageSize":                  {"200"},
		"supportsAllDrives":         {"true"},
		"includeItemsFromAllDrives": {"true"},
	}.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("drive api %d: %s", resp.StatusCode, string(body))
	}

	var parsed struct {
		Files []struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			MimeType string `json:"mimeType"`
			Size     string `json:"size"`
		} `json:"files"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}

	out := make([]driveEntry, 0, len(parsed.Files))
	for _, f := range parsed.Files {
		sz, _ := strconv.ParseInt(f.Size, 10, 64)
		out = append(out, driveEntry{
			ID:       f.ID,
			Name:     f.Name,
			MimeType: f.MimeType,
			Size:     sz,
			IsFolder: f.MimeType == "application/vnd.google-apps.folder",
		})
	}
	return out, nil
}

var (
	embeddedEntryRegex = regexp.MustCompile(`id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<div[^>]*class="flip-entry-title"[^>]*>([^<]+)</div>`)
)

func (s *GoogleDriveService) listChildrenViaEmbeddedView(ctx context.Context, folderID string) ([]driveEntry, error) {
	viewURL := fmt.Sprintf("https://drive.google.com/embeddedfolderview?id=%s#list", url.QueryEscape(folderID))
	req, err := http.NewRequestWithContext(ctx, "GET", viewURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("folder returned HTTP %d (verify it is shared as Anyone with the link)", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	htmlStr := string(body)

	matches := embeddedEntryRegex.FindAllStringSubmatch(htmlStr, -1)
	out := make([]driveEntry, 0, len(matches))
	seen := make(map[string]bool)
	for _, m := range matches {
		id := m[1]
		href := m[2]
		title := strings.TrimSpace(html.UnescapeString(m[3]))
		if id == "" || title == "" || seen[id] {
			continue
		}
		seen[id] = true
		isFolder := strings.Contains(href, "/folders/") || strings.Contains(href, "embeddedfolderview")
		out = append(out, driveEntry{
			ID:       id,
			Name:     title,
			IsFolder: isFolder,
		})
	}
	return out, nil
}

// FetchImageBytes downloads an image file from Google Drive (API v3 first, then public download fallback).
func (s *GoogleDriveService) FetchImageBytes(ctx context.Context, fileID string) ([]byte, string, error) {
	cleanID := strings.TrimSpace(fileID)
	if !driveRawIDRegex.MatchString(cleanID) {
		return nil, "", fmt.Errorf("invalid fileId")
	}

	if token, err := NewGoogleSheetsService().GetDriveReadOnlyToken(ctx); err == nil && token != "" {
		apiURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files/%s?alt=media&supportsAllDrives=true", url.PathEscape(cleanID))
		req, _ := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		if resp, err := s.httpClient.Do(req); err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				data, err := io.ReadAll(resp.Body)
				if err == nil && len(data) > 0 {
					ct := resp.Header.Get("Content-Type")
					if ct == "" {
						ct = http.DetectContentType(data)
					}
					return data, ct, nil
				}
			}
		}
	}

	// Fallback for public files without Drive API enabled
	publicURLs := []string{
		fmt.Sprintf("https://lh3.googleusercontent.com/d/%s=s0", url.PathEscape(cleanID)),
		fmt.Sprintf("https://drive.google.com/uc?export=download&id=%s", url.QueryEscape(cleanID)),
	}
	for _, targetURL := range publicURLs {
		req, err := http.NewRequestWithContext(ctx, "GET", targetURL, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
		resp, err := s.httpClient.Do(req)
		if err != nil {
			continue
		}
		data, readErr := io.ReadAll(resp.Body)
		ct := resp.Header.Get("Content-Type")
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK && readErr == nil && len(data) > 0 && !strings.Contains(strings.ToLower(ct), "text/html") {
			if ct == "" {
				ct = http.DetectContentType(data)
			}
			return data, ct, nil
		}
	}

	return nil, "", fmt.Errorf("failed to download image from Google Drive")
}
