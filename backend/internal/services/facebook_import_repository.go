package services

import (
	"fmt"
	"sync"
	"time"

	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

type FacebookImportRepository struct {
	mu   sync.RWMutex
	jobs map[string]*models.ExtractionJob
}

var (
	repoInstance *FacebookImportRepository
	repoOnce     sync.Once
)

func GetFacebookImportRepository() *FacebookImportRepository {
	repoOnce.Do(func() {
		repoInstance = &FacebookImportRepository{
			jobs: make(map[string]*models.ExtractionJob),
		}
	})
	return repoInstance
}

func (r *FacebookImportRepository) CreateJob(sourceURL string, canonicalURL string, method string, sourceType string) *models.ExtractionJob {
	r.mu.Lock()
	defer r.mu.Unlock()

	jobID := fmt.Sprintf("FB-%s-%04d", time.Now().Format("20060102-150405"), len(r.jobs)+1)
	now := time.Now()

	job := &models.ExtractionJob{
		JobID:        jobID,
		SourceURL:    sourceURL,
		CanonicalURL: canonicalURL,
		Status:       models.JobStateQueued,
		SourceType:   sourceType,
		Method:       method,
		Errors:       []string{},
		Logs: []models.ActivityLog{
			{
				Timestamp: now.Format("15:04:05"),
				Message:   "URL received",
				Level:     "info",
			},
		},
		CreatedAt: now,
		UpdatedAt: now,
	}

	r.jobs[jobID] = job
	return job
}

func (r *FacebookImportRepository) GetJob(jobID string) (*models.ExtractionJob, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	job, exists := r.jobs[jobID]
	if !exists {
		return nil, false
	}
	// Return a copy
	jobCopy := *job
	return &jobCopy, true
}

func (r *FacebookImportRepository) UpdateJobStatus(jobID string, status string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if job, exists := r.jobs[jobID]; exists {
		job.Status = status
		job.UpdatedAt = time.Now()
	}
}

func (r *FacebookImportRepository) AddJobLog(jobID string, level string, message string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if job, exists := r.jobs[jobID]; exists {
		job.Logs = append(job.Logs, models.ActivityLog{
			Timestamp: time.Now().Format("15:04:05"),
			Message:   message,
			Level:     level,
		})
		job.UpdatedAt = time.Now()
	}
}

func (r *FacebookImportRepository) SetJobResult(jobID string, result *models.FacebookImportResult) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if job, exists := r.jobs[jobID]; exists {
		job.Result = result
		job.CaptionFound = result.Caption.Original != ""
		job.ImagesFound = len(result.Images)
		downloadedCount := 0
		for _, img := range result.Images {
			if img.Status == "downloaded" {
				downloadedCount++
			}
		}
		job.ImagesDownloaded = downloadedCount
		job.Status = models.JobStateReviewReady
		job.UpdatedAt = time.Now()
	}
}

func (r *FacebookImportRepository) SetJobError(jobID string, code string, message string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if job, exists := r.jobs[jobID]; exists {
		job.Status = models.JobStateFailed
		job.ErrorCode = code
		job.ErrorMessage = message
		job.Errors = append(job.Errors, fmt.Sprintf("[%s] %s", code, message))
		job.Logs = append(job.Logs, models.ActivityLog{
			Timestamp: time.Now().Format("15:04:05"),
			Message:   fmt.Sprintf("Failed: %s", message),
			Level:     "error",
		})
		job.UpdatedAt = time.Now()
	}
}
