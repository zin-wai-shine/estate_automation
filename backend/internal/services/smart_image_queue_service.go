package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"gorm.io/gorm"
)

type BatchCreateJobRequest struct {
	PropertyID               string                       `json:"property_id"`
	PropertyName             string                       `json:"property_name"`
	Images                   []models.ExtractedImage      `json:"images"`
	ProcessingMode           models.BrowserProcessingMode `json:"processing_mode"`
	LaneID                   string                       `json:"lane_id"`
	PromptTemplateID         string                       `json:"prompt_template_id"`
	PromptVersion            string                       `json:"prompt_version"`
	PromptTemplateText       string                       `json:"prompt_template_text"`
	SelectedProfile          string                       `json:"selected_profile"`
	SelectedTabGroup         string                       `json:"selected_tab_group"`
	SelectedTargetTab        string                       `json:"selected_target_tab"`
	OutputWidth              int                          `json:"output_width"`
	OutputHeight             int                          `json:"output_height"`
	StrictPreservationActive bool                         `json:"strict_preservation_active"`
	PropertyMetadata         map[string]interface{}       `json:"property_metadata"`
}

type SmartImageQueueService struct {
	db           *gorm.DB
	localEnhance *LocalImageEnhancer
	mu           sync.RWMutex
}

var (
	smartImageQueueSvcOnce sync.Once
	smartImageQueueSvcInst *SmartImageQueueService
)

func GetSmartImageQueueService() *SmartImageQueueService {
	smartImageQueueSvcOnce.Do(func() {
		smartImageQueueSvcInst = &SmartImageQueueService{
			db:           database.DB,
			localEnhance: NewLocalImageEnhancer(),
		}
	})
	return smartImageQueueSvcInst
}

// CreateBatchJobs creates an ordered collection of persistent jobs for a property's images.
func (s *SmartImageQueueService) CreateBatchJobs(req BatchCreateJobRequest) ([]models.ImageProcessingJob, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if req.PropertyID == "" {
		req.PropertyID = fmt.Sprintf("PROP-%d", time.Now().Unix())
	} else {
		// Delete previous jobs for this property to avoid duplicate runs or accumulated stale jobs
		_ = database.DB.Where("property_id = ?", req.PropertyID).Delete(&models.ImageProcessingJob{}).Error
	}
	if req.OutputWidth <= 0 {
		req.OutputWidth = 1080
	}
	if req.OutputHeight <= 0 {
		req.OutputHeight = 1350
	}
	if req.ProcessingMode == "" {
		req.ProcessingMode = models.ProcessingModeChromeAssisted
	}

	var createdJobs []models.ImageProcessingJob
	totalImages := len(req.Images)

	for idx, img := range req.Images {
		pos := idx + 1
		jobID := fmt.Sprintf("job-%s-%02d-%s", req.PropertyID, pos, uuid.New().String()[:6])

		// Calculate hash if available or generate stable pseudo-hash
		fileHash := img.SHA256
		if fileHash == "" && img.SourceURL != "" {
			h := sha256.Sum256([]byte(img.SourceURL))
			fileHash = hex.EncodeToString(h[:])
		}

		filePath := img.LocalPath
		if filePath == "" {
			filePath = img.StoredURL
		}

		// Resolve prompt text for this exact image position (prioritize individual image prompt, then batch prompt template)
		targetPrompt := strings.TrimSpace(img.ResolvedPrompt)
		if targetPrompt == "" {
			targetPrompt = strings.TrimSpace(req.PromptTemplateText)
		}
		if targetPrompt == "" && req.PromptTemplateID != "" {
			switch strings.TrimSpace(req.PromptTemplateID) {
			case "perspective_correction":
				targetPrompt = "Correct wide-angle optical vertical convergence: align vertical door and window lines to 90 degrees straight, neutralize barrel distortion, and preserve 100% of authentic furnishings and room dimensions."
			case "facebook_hero":
				targetPrompt = "Calibrate dynamic exposure for Facebook mobile feed: lift deep shadow details across living area, protect exterior view highlights, and boost interior warmth while preserving original staging."
			case "marketplace_hero":
				targetPrompt = "Optimize property photo for high marketplace visibility: maximize clarity on master bedroom and living room finishes, sharpen architectural edges, and output crisp {output_width}x{output_height} resolution."
			case "tiktok_hero":
				targetPrompt = "High-contrast luxury real estate presentation for vertical mobile viewing: enhance ambient lighting glow, polish reflective stone and glass surfaces, and maintain strict authentic property structure."
			case "photo_retouch":
				targetPrompt = "Professionally retouch this property photograph: enhance sharpness, clarity, dynamic range, window sky dehazing, and authentic true-daylight color accuracy. Preserve exactly the original room layout, furniture, walls, floor, and architecture without alteration."
			}
		}
		resolvedPrompt := s.ResolvePromptText(targetPrompt, req.PropertyName, req.PropertyMetadata, pos, totalImages, req.OutputWidth, req.OutputHeight)

		job := models.ImageProcessingJob{
			JobID:                    jobID,
			PropertyID:               req.PropertyID,
			PropertyName:             req.PropertyName,
			SourceImageID:            fmt.Sprintf("img-%03d", pos),
			OriginalPosition:         pos,
			SourceFilePath:           filePath,
			SourceFileURL:            img.SourceURL,
			OriginalFileHash:         fileHash,
			ProcessingMode:           req.ProcessingMode,
			LaneID:                   req.LaneID,
			PromptTemplateID:         req.PromptTemplateID,
			PromptVersion:            req.PromptVersion,
			ResolvedPrompt:           resolvedPrompt,
			SelectedProfile:          req.SelectedProfile,
			SelectedTabGroup:         req.SelectedTabGroup,
			SelectedTargetTab:        req.SelectedTargetTab,
			OutputWidth:              req.OutputWidth,
			OutputHeight:             req.OutputHeight,
			Status:                   models.ImgJobStatusPending,
			AttemptCount:             0,
			StrictPreservationActive: req.StrictPreservationActive,
		}

		if err := database.DB.Create(&job).Error; err != nil {
			return nil, fmt.Errorf("failed to persist image job %s: %w", jobID, err)
		}

		s.logJobEvent(job.JobID, "", string(models.ImgJobStatusPending), fmt.Sprintf("Job created in queue (Image %d of %d)", pos, totalImages), nil)
		createdJobs = append(createdJobs, job)
	}

	return createdJobs, nil
}

// ResolvePromptText replaces standard template variables with property context.
func (s *SmartImageQueueService) ResolvePromptText(templateText, propName string, meta map[string]interface{}, pos, total, w, h int) string {
	if templateText == "" {
		templateText = "Enhance this property photograph strictly preserving all architectural features, walls, windows, doors, furniture, and room layout. Improve sharpness, dynamic range, true daylight white balance, and noise reduction. Format output: {output_width}x{output_height} (4:5 vertical)."
	}

	title := propName
	if title == "" && meta != nil {
		if t, ok := meta["title"].(string); ok && t != "" {
			title = t
		}
	}
	if title == "" {
		title = "Luxury Modern Property"
	}

	price := "Price on Request"
	unitDetails := "Standard High-End Specification"
	if meta != nil {
		if p, ok := meta["price"].(string); ok && p != "" {
			price = p
		}
		if u, ok := meta["unit_details"].(string); ok && u != "" {
			unitDetails = u
		}
	}

	r := strings.NewReplacer(
		"{title}", title,
		"{project_name}", title,
		"{price}", price,
		"{rental_price}", price,
		"{unit_details}", unitDetails,
		"{output_width}", fmt.Sprintf("%d", w),
		"{output_height}", fmt.Sprintf("%d", h),
		"{image_position}", fmt.Sprintf("%d", pos),
		"{source_image_count}", fmt.Sprintf("%d", total),
		"{strict_structure_preservation}", "TRUE (Zero Virtual Staging / Absolute Architectural Integrity)",
	)

	return r.Replace(templateText)
}

// StartQueue begins execution on a batch by activating the first pending job.
func (s *SmartImageQueueService) StartQueue(propertyID string) (*models.ImageProcessingJob, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var firstPending models.ImageProcessingJob
	err := database.DB.Where("property_id = ? AND status = ?", propertyID, models.ImgJobStatusPending).
		Order("original_position ASC").
		First(&firstPending).Error

	if err != nil {
		return nil, fmt.Errorf("no pending jobs found for property %s: %w", propertyID, err)
	}

	targetState := models.ImgJobStatusReadyForUser
	if firstPending.ProcessingMode == models.ProcessingModeLocalEnhance {
		targetState = models.ImgJobStatusProcessingLocal
	} else if firstPending.ProcessingMode == models.ProcessingModeAuthorizedAPI {
		targetState = models.ImgJobStatusProcessingAPI
	}

	now := time.Now()
	firstPending.Status = targetState
	firstPending.StartedAt = &now
	firstPending.AttemptCount++
	database.DB.Save(&firstPending)

	s.logJobEvent(firstPending.JobID, string(models.ImgJobStatusPending), string(targetState), "Queue started; job active", nil)

	// If local mode, automatically trigger processing in background
	if firstPending.ProcessingMode == models.ProcessingModeLocalEnhance {
		go s.ExecuteLocalJob(firstPending.JobID)
	}

	return &firstPending, nil
}

// AdvanceToNextJob finishes the current job and promotes the next pending job in sequence.
func (s *SmartImageQueueService) AdvanceToNextJob(propertyID string) (*models.ImageProcessingJob, error) {
	var nextPending models.ImageProcessingJob
	err := database.DB.Where("property_id = ? AND status = ?", propertyID, models.ImgJobStatusPending).
		Order("original_position ASC").
		First(&nextPending).Error

	if err != nil {
		// All jobs processed or no more pending
		return nil, nil
	}

	targetState := models.ImgJobStatusReadyForUser
	if nextPending.ProcessingMode == models.ProcessingModeLocalEnhance {
		targetState = models.ImgJobStatusProcessingLocal
	} else if nextPending.ProcessingMode == models.ProcessingModeAuthorizedAPI {
		targetState = models.ImgJobStatusProcessingAPI
	}

	now := time.Now()
	nextPending.Status = targetState
	nextPending.StartedAt = &now
	nextPending.AttemptCount++
	database.DB.Save(&nextPending)

	s.logJobEvent(nextPending.JobID, string(models.ImgJobStatusPending), string(targetState), fmt.Sprintf("Advanced to next pending image (%d)", nextPending.OriginalPosition), nil)

	if nextPending.ProcessingMode == models.ProcessingModeLocalEnhance {
		go s.ExecuteLocalJob(nextPending.JobID)
	}

	return &nextPending, nil
}

// ExecuteLocalJob processes a single job using the native local image enhancement engine.
func (s *SmartImageQueueService) ExecuteLocalJob(jobID string) error {
	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err != nil {
		return err
	}

	s.TransitionJobState(jobID, models.ImgJobStatusProcessingLocal, "Executing deterministic local image enhancement")

	// Destination path in predictable property directory: storage/uploads/properties/<prop-id>/enhanced/
	destDir := fmt.Sprintf("./storage/uploads/properties/%s/enhanced", job.PropertyID)
	destFileName := fmt.Sprintf("enhanced_%02d_%s.png", job.OriginalPosition, job.JobID[:8])
	destPath := fmt.Sprintf("%s/%s", destDir, destFileName)

	cfg := LocalImageEnhanceConfig{
		TargetWidth:        job.OutputWidth,
		TargetHeight:       job.OutputHeight,
		StrictPreservation: job.StrictPreservationActive,
		SharpenAmount:      0.35,
		ExposureLift:       0.12,
		ContrastFactor:     1.12,
		WhiteBalanceFix:    true,
	}

	source := job.SourceFilePath
	if source == "" {
		source = job.SourceFileURL
	}

	res, err := s.localEnhance.EnhanceImage(source, destPath, cfg)
	if err != nil {
		s.FailJob(jobID, fmt.Sprintf("Local image enhancement failed: %v", err))
		return err
	}

	// Record validated output
	publicURL := fmt.Sprintf("http://localhost:8085/storage/uploads/properties/%s/enhanced/%s", job.PropertyID, destFileName)
	now := time.Now()

	job.Status = models.ImgJobStatusCompleted
	job.OutputFilePath = destPath
	job.OutputFileURL = publicURL
	job.OutputFileHash = res.Checksum
	job.CompletedAt = &now
	database.DB.Save(&job)

	// Persist in ProcessedImageOutput table
	outputRecord := models.ProcessedImageOutput{
		PropertyID:      job.PropertyID,
		JobID:           job.JobID,
		OriginalImageID: job.SourceImageID,
		OutputType:      "enhanced",
		OutputOrder:     job.OriginalPosition,
		Width:           res.Width,
		Height:          res.Height,
		Format:          res.Format,
		Checksum:        res.Checksum,
		FilePath:        destPath,
		FileURL:         publicURL,
		CreatedAt:       now,
	}
	database.DB.Create(&outputRecord)

	s.logJobEvent(job.JobID, string(models.ImgJobStatusProcessingLocal), string(models.ImgJobStatusCompleted), "Local enhancement completed and validated", models.JSONMap{
		"output_url":      publicURL,
		"checksum":        res.Checksum,
		"processing_time": res.ProcessingMs,
	})

	// Advance to next image automatically in unattended mode
	s.AdvanceToNextJob(job.PropertyID)
	return nil
}

// CompleteJobWithFile associates a manually downloaded or companion-delivered file with the active job.
func (s *SmartImageQueueService) CompleteJobWithFile(jobID, filePath, fileURL, checksum string, width, height int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err != nil {
		return err
	}

	now := time.Now()
	prevState := string(job.Status)
	job.Status = models.ImgJobStatusCompleted
	job.OutputFilePath = filePath
	job.OutputFileURL = fileURL
	job.OutputFileHash = checksum
	job.OutputWidth = width
	job.OutputHeight = height
	job.CompletedAt = &now
	database.DB.Save(&job)

	outputRecord := models.ProcessedImageOutput{
		PropertyID:      job.PropertyID,
		JobID:           job.JobID,
		OriginalImageID: job.SourceImageID,
		OutputType:      "enhanced",
		OutputOrder:     job.OriginalPosition,
		Width:           width,
		Height:          height,
		Format:          "png",
		Checksum:        checksum,
		FilePath:        filePath,
		FileURL:         fileURL,
		CreatedAt:       now,
	}
	database.DB.Create(&outputRecord)

	s.logJobEvent(job.JobID, prevState, string(models.ImgJobStatusCompleted), "Job completed with validated download", models.JSONMap{
		"output_url": fileURL,
		"checksum":   checksum,
		"width":      width,
		"height":     height,
	})

	// Automatically promote next pending job
	go s.AdvanceToNextJob(job.PropertyID)
	return nil
}

func (s *SmartImageQueueService) TransitionJobState(jobID string, targetState models.ImageJobStatus, message string) {
	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err == nil {
		prev := string(job.Status)
		job.Status = targetState
		database.DB.Save(&job)
		s.logJobEvent(jobID, prev, string(targetState), message, nil)
	}
}

func (s *SmartImageQueueService) FailJob(jobID, errMsg string) {
	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err == nil {
		prev := string(job.Status)
		job.Status = models.ImgJobStatusFailed
		job.ErrorMessage = errMsg
		database.DB.Save(&job)
		s.logJobEvent(jobID, prev, string(models.ImgJobStatusFailed), errMsg, nil)
	}
}

func (s *SmartImageQueueService) PauseJob(jobID string) error {
	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err != nil {
		return err
	}
	prev := string(job.Status)
	job.Status = models.ImgJobStatusPending // Paused back to pending or paused
	database.DB.Save(&job)
	s.logJobEvent(jobID, prev, "PAUSED", "Job paused by user", nil)
	return nil
}

func (s *SmartImageQueueService) ResumeJob(jobID string) error {
	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err != nil {
		return err
	}
	prev := string(job.Status)
	target := models.ImgJobStatusReadyForUser
	if job.ProcessingMode == models.ProcessingModeLocalEnhance {
		target = models.ImgJobStatusProcessingLocal
	}
	job.Status = target
	database.DB.Save(&job)
	s.logJobEvent(jobID, prev, string(target), "Job resumed", nil)

	if job.ProcessingMode == models.ProcessingModeLocalEnhance {
		go s.ExecuteLocalJob(job.JobID)
	}
	return nil
}

func (s *SmartImageQueueService) SkipJob(jobID string) error {
	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err != nil {
		return err
	}
	prev := string(job.Status)
	job.Status = models.ImgJobStatusSkipped
	database.DB.Save(&job)
	s.logJobEvent(jobID, prev, string(models.ImgJobStatusSkipped), "Job skipped by user", nil)

	go s.AdvanceToNextJob(job.PropertyID)
	return nil
}

func (s *SmartImageQueueService) RetryJob(jobID string) error {
	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err != nil {
		return err
	}
	prev := string(job.Status)
	target := models.ImgJobStatusReadyForUser
	if job.ProcessingMode == models.ProcessingModeLocalEnhance {
		target = models.ImgJobStatusProcessingLocal
	}
	job.Status = target
	job.ErrorMessage = ""
	job.AttemptCount++
	database.DB.Save(&job)
	s.logJobEvent(jobID, prev, string(target), fmt.Sprintf("Retrying job (Attempt %d)", job.AttemptCount), nil)

	if job.ProcessingMode == models.ProcessingModeLocalEnhance {
		go s.ExecuteLocalJob(job.JobID)
	}
	return nil
}

func (s *SmartImageQueueService) CancelJob(jobID string) error {
	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err != nil {
		return err
	}
	prev := string(job.Status)
	job.Status = models.ImgJobStatusCancelled
	database.DB.Save(&job)
	s.logJobEvent(jobID, prev, string(models.ImgJobStatusCancelled), "Job cancelled", nil)
	return nil
}

// CancelAllActiveJobs cancels all pending/ready/processing jobs (optionally scoped to a propertyID).
func (s *SmartImageQueueService) CancelAllActiveJobs(propertyID string) int64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	query := database.DB.Model(&models.ImageProcessingJob{}).Where("status IN ?", []models.ImageJobStatus{
		models.ImgJobStatusPending,
		models.ImgJobStatusReadyForUser,
		models.ImgJobStatusProcessingLocal,
		models.ImgJobStatusProcessingAPI,
	})
	if propertyID != "" {
		query = query.Where("property_id = ?", propertyID)
	}
	res := query.Updates(map[string]interface{}{
		"status":        models.ImgJobStatusCancelled,
		"error_message": "Stopped by user",
	})
	return res.RowsAffected
}

func (s *SmartImageQueueService) GetQueue(propertyID string) ([]models.ImageProcessingJob, error) {
	if propertyID == "" {
		return []models.ImageProcessingJob{}, nil
	}
	var jobs []models.ImageProcessingJob
	err := database.DB.Where("property_id = ?", propertyID).Order("original_position ASC").Find(&jobs).Error
	return jobs, err
}

func (s *SmartImageQueueService) GetJob(jobID string) (*models.ImageProcessingJob, []models.JobEvent, error) {
	var job models.ImageProcessingJob
	if err := database.DB.Where("job_id = ?", jobID).First(&job).Error; err != nil {
		return nil, nil, err
	}

	var events []models.JobEvent
	database.DB.Where("job_id = ?", jobID).Order("created_at ASC").Find(&events)
	return &job, events, nil
}

func (s *SmartImageQueueService) logJobEvent(jobID, from, to, msg string, meta models.JSONMap) {
	event := models.JobEvent{
		JobID:     jobID,
		FromState: from,
		ToState:   to,
		Message:   msg,
		Metadata:  meta,
		CreatedAt: time.Now(),
	}
	database.DB.Create(&event)
}
