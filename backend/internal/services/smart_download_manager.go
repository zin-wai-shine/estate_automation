package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

type DownloadManagerStatus struct {
	WatchDirectory   string    `json:"watch_directory"`
	IsActive         bool      `json:"is_active"`
	AutoAdvanceQueue bool      `json:"auto_advance_queue"`
	LastDetectedFile string    `json:"last_detected_file"`
	LastDetectedAt   time.Time `json:"last_detected_at"`
	ActiveJobsCount  int64     `json:"active_jobs_count"`
}

type SmartDownloadManager struct {
	watchDir         string
	autoAdvance      bool
	stopChan         chan struct{}
	mu               sync.Mutex
	isPolling        bool
	processedFiles   map[string]time.Time
	lastDetectedFile string
	lastDetectedAt   time.Time
}

var (
	smartDownloadMgrOnce sync.Once
	smartDownloadMgrInst *SmartDownloadManager
)

func GetSmartDownloadManager() *SmartDownloadManager {
	smartDownloadMgrOnce.Do(func() {
		// Default to Pictures/BoltHavenProperty/Processing or Downloads
		homeDir, _ := os.UserHomeDir()
		defaultDir := filepath.Join(homeDir, "Pictures", "BoltHavenProperty", "Processing")
		if _, err := os.Stat(defaultDir); os.IsNotExist(err) {
			_ = os.MkdirAll(defaultDir, 0755)
		}

		smartDownloadMgrInst = &SmartDownloadManager{
			watchDir:       defaultDir,
			autoAdvance:    true,
			stopChan:       make(chan struct{}),
			processedFiles: make(map[string]time.Time),
		}

		// Initialize from DB setting if present
		smartDownloadMgrInst.loadSettings()
		// Start background file scanner
		smartDownloadMgrInst.Start()
	})
	return smartDownloadMgrInst
}

func (m *SmartDownloadManager) loadSettings() {
	if database.DB == nil {
		return
	}
	var s models.DownloadWatcherSetting
	if err := database.DB.First(&s).Error; err == nil && s.WatchDirectory != "" {
		m.watchDir = s.WatchDirectory
		m.autoAdvance = s.AutoAdvanceQueue
	} else {
		// Seed default
		newSetting := models.DownloadWatcherSetting{
			WatchDirectory:   m.watchDir,
			AutoAdvanceQueue: true,
			IsActive:         true,
			UpdatedAt:        time.Now(),
		}
		database.DB.Create(&newSetting)
	}
}

func (m *SmartDownloadManager) UpdateSettings(watchDir string, autoAdvance bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if watchDir != "" {
		_ = os.MkdirAll(watchDir, 0755)
		m.watchDir = watchDir
	}
	m.autoAdvance = autoAdvance

	var s models.DownloadWatcherSetting
	if err := database.DB.First(&s).Error; err == nil {
		s.WatchDirectory = m.watchDir
		s.AutoAdvanceQueue = m.autoAdvance
		s.UpdatedAt = time.Now()
		database.DB.Save(&s)
	}

	return nil
}

func (m *SmartDownloadManager) GetStatus() DownloadManagerStatus {
	m.mu.Lock()
	defer m.mu.Unlock()

	var activeCount int64
	if database.DB != nil {
		database.DB.Model(&models.ImageProcessingJob{}).
			Where("status IN ?", []string{string(models.ImgJobStatusReadyForUser), string(models.ImgJobStatusAwaitingDownload)}).
			Count(&activeCount)
	}

	return DownloadManagerStatus{
		WatchDirectory:   m.watchDir,
		IsActive:         m.isPolling,
		AutoAdvanceQueue: m.autoAdvance,
		LastDetectedFile: m.lastDetectedFile,
		LastDetectedAt:   m.lastDetectedAt,
		ActiveJobsCount:  activeCount,
	}
}

func (m *SmartDownloadManager) Start() {
	m.mu.Lock()
	if m.isPolling {
		m.mu.Unlock()
		return
	}
	m.isPolling = true
	m.mu.Unlock()

	go m.pollWatchDirectory()
}

func (m *SmartDownloadManager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.isPolling {
		close(m.stopChan)
		m.isPolling = false
	}
}

func (m *SmartDownloadManager) pollWatchDirectory() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.scanDirectory()
		}
	}
}

func (m *SmartDownloadManager) scanDirectory() {
	dirsToScan := []string{m.watchDir}
	if homeDir, err := os.UserHomeDir(); err == nil {
		dlDir := filepath.Join(homeDir, "Downloads")
		if dlDir != m.watchDir {
			dirsToScan = append(dirsToScan, dlDir)
		}
	}

	for _, dir := range dirsToScan {
		if dir == "" {
			continue
		}
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}

			name := entry.Name()
			lowerName := strings.ToLower(name)

			// 1. Skip temporary / incomplete Chrome download files
			if strings.HasSuffix(lowerName, ".crdownload") ||
				strings.HasSuffix(lowerName, ".tmp") ||
				strings.HasPrefix(lowerName, ".") ||
				strings.HasSuffix(lowerName, ".part") {
				continue
			}

			// 2. Validate valid image extension
			if !strings.HasSuffix(lowerName, ".png") &&
				!strings.HasSuffix(lowerName, ".jpg") &&
				!strings.HasSuffix(lowerName, ".jpeg") &&
				!strings.HasSuffix(lowerName, ".webp") {
				continue
			}

			info1, err := entry.Info()
			if err != nil || info1.Size() == 0 {
				continue
			}

			// In Downloads folder, focus on enhanced images or newly created files within the last 15 mins
			if dir != m.watchDir {
				if !strings.HasPrefix(lowerName, "enhanced") && time.Since(info1.ModTime()) > 15*time.Minute {
					continue
				}
			}

			filePath := filepath.Join(dir, name)

			m.mu.Lock()
			if _, exists := m.processedFiles[filePath]; exists {
				m.mu.Unlock()
				continue
			}
			m.mu.Unlock()

			// 3. Check file stability (ensure writer has closed the file)
			time.Sleep(200 * time.Millisecond)
			info2, err := os.Stat(filePath)
			if err != nil || info2.Size() != info1.Size() {
				continue // File is still being written
			}

			// 4. File is complete! Process and match to active job
			m.handleNewCompletedFile(filePath, name)
		}
	}
}

func (m *SmartDownloadManager) handleNewCompletedFile(srcPath, fileName string) {
	// Find currently active awaiting job
	var activeJob models.ImageProcessingJob
	err := database.DB.Where("status IN ?", []string{
		string(models.ImgJobStatusReadyForUser),
		string(models.ImgJobStatusAwaitingDownload),
	}).Order("original_position ASC").First(&activeJob).Error

	if err != nil {
		// No active job awaiting download right now
		return
	}

	// Read image dimensions and calculate hash
	f, err := os.Open(srcPath)
	if err != nil {
		return
	}
	defer f.Close()

	hasher := sha256.New()
	cfg, _, decodeErr := image.DecodeConfig(io.TeeReader(f, hasher))
	if decodeErr != nil {
		return // Not a valid image
	}

	checksum := hex.EncodeToString(hasher.Sum(nil))

	// Predictable destination: storage/uploads/properties/<prop-id>/enhanced/
	destDir := fmt.Sprintf("./storage/uploads/properties/%s/enhanced", activeJob.PropertyID)
	_ = os.MkdirAll(destDir, 0755)

	ext := filepath.Ext(fileName)
	if ext == "" {
		ext = ".png"
	}
	destFileName := fmt.Sprintf("enhanced_%02d_%s%s", activeJob.OriginalPosition, activeJob.JobID[:8], ext)
	destPath := filepath.Join(destDir, destFileName)

	// Copy file safely (never delete original without explicit user configuration)
	if err := copyFile(srcPath, destPath); err != nil {
		fmt.Printf("[DOWNLOAD_MGR] Failed to copy file to destination: %v\n", err)
		return
	}

	publicURL := fmt.Sprintf("http://localhost:8085/storage/uploads/properties/%s/enhanced/%s", activeJob.PropertyID, destFileName)

	m.mu.Lock()
	m.processedFiles[srcPath] = time.Now()
	m.lastDetectedFile = fileName
	m.lastDetectedAt = time.Now()
	m.mu.Unlock()

	// Complete the active job in queue and automatically advance
	qSvc := GetSmartImageQueueService()
	_ = qSvc.CompleteJobWithFile(activeJob.JobID, destPath, publicURL, checksum, cfg.Width, cfg.Height)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}
