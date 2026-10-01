package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

type FacebookMediaDownloader struct {
	httpClient *http.Client
	storageDir string
}

func NewFacebookMediaDownloader(storageDir string) *FacebookMediaDownloader {
	if storageDir == "" {
		storageDir = "./storage/uploads/facebook-import"
	}
	_ = os.MkdirAll(storageDir, 0755)

	return &FacebookMediaDownloader{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		storageDir: storageDir,
	}
}

// DownloadPostImages downloads all discovered image assets, stores them locally, and handles deduplication
func (d *FacebookMediaDownloader) DownloadPostImages(jobID string, rawImages []models.ExtractedImage) ([]models.ExtractedImage, error) {
	jobDir := filepath.Join(d.storageDir, jobID)
	if err := os.MkdirAll(jobDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory for job %s: %w", jobID, err)
	}

	var downloaded []models.ExtractedImage
	seenHashes := make(map[string]bool)
	targetIndex := 1

	for _, raw := range rawImages {
		if raw.SourceURL == "" {
			continue
		}

		// Download binary stream
		req, err := http.NewRequest("GET", raw.SourceURL, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
		req.Header.Set("Referer", "https://www.facebook.com/")

		resp, err := d.httpClient.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			if resp != nil {
				resp.Body.Close()
			}
			continue
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil || len(bodyBytes) == 0 {
			continue
		}

		// Compute SHA256 checksum
		hash := sha256.Sum256(bodyBytes)
		hashStr := hex.EncodeToString(hash[:])

		// Deduplicate: If image hash already seen in this import, do not duplicate
		if seenHashes[hashStr] {
			continue
		}
		seenHashes[hashStr] = true

		// Detect real image dimensions
		reader := strings.NewReader(string(bodyBytes))
		cfg, format, err := image.DecodeConfig(reader)
		w, h := raw.Width, raw.Height
		if err == nil && cfg.Width > 0 && cfg.Height > 0 {
			w = cfg.Width
			h = cfg.Height
		}

		ext := ".jpg"
		if format == "png" {
			ext = ".png"
		} else if format == "webp" {
			ext = ".webp"
		}

		filename := fmt.Sprintf("image_%03d%s", targetIndex, ext)
		destPath := filepath.Join(jobDir, filename)

		if err := os.WriteFile(destPath, bodyBytes, 0644); err != nil {
			continue
		}

		storedURL := fmt.Sprintf("/storage/uploads/facebook-import/%s/%s", jobID, filename)

		downloaded = append(downloaded, models.ExtractedImage{
			Index:           targetIndex,
			FacebookPhotoID: raw.FacebookPhotoID,
			SourceURL:       raw.SourceURL,
			StoredURL:       storedURL,
			LocalPath:       destPath,
			Width:           w,
			Height:          h,
			MimeType:        "image/" + format,
			SHA256:          hashStr,
			FileSize:        int64(len(bodyBytes)),
			Status:          "downloaded",
		})

		targetIndex++
	}

	return downloaded, nil
}

// SaveUploadedFile saves an uploaded file from manual fallback
func (d *FacebookMediaDownloader) SaveUploadedFile(jobID string, index int, filename string, content []byte) (*models.ExtractedImage, error) {
	jobDir := filepath.Join(d.storageDir, jobID)
	if err := os.MkdirAll(jobDir, 0755); err != nil {
		return nil, err
	}

	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".jpg"
	}
	savedFilename := fmt.Sprintf("image_%03d%s", index, ext)
	destPath := filepath.Join(jobDir, savedFilename)

	if err := os.WriteFile(destPath, content, 0644); err != nil {
		return nil, err
	}

	hash := sha256.Sum256(content)
	hashStr := hex.EncodeToString(hash[:])

	reader := strings.NewReader(string(content))
	cfg, format, _ := image.DecodeConfig(reader)

	storedURL := fmt.Sprintf("/storage/uploads/facebook-import/%s/%s", jobID, savedFilename)

	return &models.ExtractedImage{
		Index:     index,
		SourceURL: "manual_upload",
		StoredURL: storedURL,
		LocalPath: destPath,
		Width:     cfg.Width,
		Height:    cfg.Height,
		MimeType:  "image/" + format,
		SHA256:    hashStr,
		FileSize:  int64(len(content)),
		Status:    "downloaded",
	}, nil
}
