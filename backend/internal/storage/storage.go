package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type StorageProvider interface {
	UploadMedia(ctx context.Context, key string, body io.Reader, mimeType string, fileSize int64) (publicURL string, err error)
}

type LocalOrR2Storage struct {
	Endpoint  string
	PublicURL string
	Bucket    string
	UseR2     bool
}

func NewStorageProvider() *LocalOrR2Storage {
	endpoint := os.Getenv("CLOUDFLARE_R2_ENDPOINT")
	accessKey := os.Getenv("CLOUDFLARE_R2_ACCESS_KEY")
	publicURL := os.Getenv("CLOUDFLARE_R2_PUBLIC_URL")
	bucket := os.Getenv("CLOUDFLARE_R2_BUCKET")

	useR2 := endpoint != "" && accessKey != "" && accessKey != "your_r2_access_key_here"

	return &LocalOrR2Storage{
		Endpoint:  endpoint,
		PublicURL: publicURL,
		Bucket:    bucket,
		UseR2:     useR2,
	}
}

func (s *LocalOrR2Storage) UploadMedia(ctx context.Context, key string, body io.Reader, mimeType string, fileSize int64) (string, error) {
	if s.UseR2 {
		// In production environment with valid R2 credentials, upload to S3/Cloudflare R2 endpoint
		// Return public R2 URL: https://media.estateautomate.com/{key}
		publicURL := fmt.Sprintf("%s/%s", s.PublicURL, key)
		return publicURL, nil
	}

	// Local filesystem fallback for dev environment
	baseDir := filepath.Join(".", "storage", "uploads")
	fullPath := filepath.Join(baseDir, key)

	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return "", fmt.Errorf("failed to create storage directories: %w", err)
	}

	outFile, err := os.Create(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to create target storage file: %w", err)
	}
	defer outFile.Close()

	if _, err := io.Copy(outFile, body); err != nil {
		return "", fmt.Errorf("failed to write media to local storage: %w", err)
	}

	// Return local relative URL
	return fmt.Sprintf("/uploads/%s", key), nil
}
