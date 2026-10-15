package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

type RunwareService struct {
	APIKey string
	Model  string
	Client *http.Client
}

type RunwareTaskAuth struct {
	TaskType string `json:"taskType"`
	APIKey   string `json:"apiKey"`
}

type RunwareInputs struct {
	ReferenceImages []string `json:"referenceImages,omitempty"`
}

type RunwareTaskInference struct {
	TaskType        string         `json:"taskType"`
	TaskUUID        string         `json:"taskUUID"`
	Model           string         `json:"model"`
	PositivePrompt  string         `json:"positivePrompt"`
	NegativePrompt  string         `json:"negativePrompt,omitempty"`
	SeedImage       string         `json:"seedImage,omitempty"`
	InputImage      string         `json:"inputImage,omitempty"`
	ReferenceImages []string       `json:"referenceImages,omitempty"`
	Inputs          *RunwareInputs `json:"inputs,omitempty"`
	Strength        *float64       `json:"strength,omitempty"`
	Width           int            `json:"width,omitempty"`
	Height          int            `json:"height,omitempty"`
	NumberResults   int            `json:"numberResults,omitempty"`
	Steps           int            `json:"steps,omitempty"`
}

type RunwareTaskUpscale struct {
	TaskType      string `json:"taskType"`
	TaskUUID      string `json:"taskUUID"`
	InputImage    string `json:"inputImage"`
	UpscaleFactor int    `json:"upscaleFactor"`
}

// sanitizeRunwarePrompt separates positive and negative instructions, strips out excessive text,
// and ensures the positive prompt is strictly non-empty, non-whitespace, and between 2 and 2800 characters
// (comfortably beneath Runware's hard 3,000 character limit).
func sanitizeRunwarePrompt(rawPrompt string) (positive string, negative string) {
	trimmed := strings.TrimSpace(rawPrompt)
	if trimmed == "" {
		return "Ultra realistic professional architectural photo, crystal clear lighting, crisp detail, realistic textures, high resolution", ""
	}

	negativeMarkers := []string{
		"STRICT NEGATIVE INSTRUCTIONS",
		"NEGATIVE INSTRUCTIONS:",
		"NEGATIVE PROMPT:",
		"Negative prompt:",
		"Negative instructions:",
		"NEGATIVE:",
		"Negative:",
	}

	posPart := trimmed
	negPart := ""

	for _, marker := range negativeMarkers {
		idx := strings.Index(posPart, marker)
		if idx != -1 {
			negPart = strings.TrimSpace(posPart[idx+len(marker):])
			posPart = strings.TrimSpace(posPart[:idx])
			break
		}
	}

	posPart = strings.TrimRight(posPart, "-\n\r\t :")

	// Runware requires positivePrompt <= 3000 chars. We clamp to 2800 at a clean word boundary.
	if len(posPart) > 2800 {
		cutoff := 2800
		lastSpace := strings.LastIndex(posPart[:cutoff], " ")
		if lastSpace > 2000 {
			posPart = strings.TrimSpace(posPart[:lastSpace])
		} else {
			posPart = strings.TrimSpace(posPart[:cutoff])
		}
	}

	if len(posPart) < 2 {
		posPart = "Ultra realistic professional architectural photo, crystal clear lighting, crisp detail, realistic textures, high resolution"
	}

	if len(negPart) > 2800 {
		cutoff := 2800
		lastSpace := strings.LastIndex(negPart[:cutoff], " ")
		if lastSpace > 2000 {
			negPart = strings.TrimSpace(negPart[:lastSpace])
		} else {
			negPart = strings.TrimSpace(negPart[:cutoff])
		}
	}

	return posPart, negPart
}

// loadImageAsDataURI loads an image from a Data URI, local disk path, or HTTP/HTTPS URL
// and converts it into a base64 Data URI while extracting its original pixel dimensions.
func loadImageAsDataURI(imageURLOrPath string) (dataURI string, width int, height int, err error) {
	var rawBytes []byte

	// 1. If already a Data URI
	if strings.HasPrefix(imageURLOrPath, "data:image/") {
		parts := strings.SplitN(imageURLOrPath, ",", 2)
		if len(parts) == 2 {
			rawBytes, err = base64.StdEncoding.DecodeString(parts[1])
			if err == nil && len(rawBytes) > 0 {
				cfg, _, decErr := image.DecodeConfig(bytes.NewReader(rawBytes))
				if decErr == nil {
					width = cfg.Width
					height = cfg.Height
				}
				return imageURLOrPath, width, height, nil
			}
		}
	}

	// 2. Resolve local file on disk
	tryPaths := []string{imageURLOrPath}

	if strings.Contains(imageURLOrPath, "/storage/") {
		idx := strings.Index(imageURLOrPath, "/storage/")
		subPath := imageURLOrPath[idx+len("/storage/"):]
		if qIdx := strings.Index(subPath, "?"); qIdx != -1 {
			subPath = subPath[:qIdx]
		}
		tryPaths = append(tryPaths,
			filepath.Join("storage", subPath),
			filepath.Join(".", "storage", subPath),
			filepath.Join("backend", "storage", subPath),
			filepath.Join("..", "backend", "storage", subPath),
		)
	}

	for _, p := range tryPaths {
		if b, err := os.ReadFile(p); err == nil && len(b) > 0 {
			rawBytes = b
			break
		}
	}

	// 3. Fallback to HTTP GET if not found locally
	if len(rawBytes) == 0 && (strings.HasPrefix(imageURLOrPath, "http://") || strings.HasPrefix(imageURLOrPath, "https://")) {
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(imageURLOrPath)
		if err == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			b, err := io.ReadAll(resp.Body)
			if err == nil && len(b) > 0 {
				rawBytes = b
			}
		}
	}

	if len(rawBytes) == 0 {
		return "", 0, 0, fmt.Errorf("could not load source image from path or URL: %s", imageURLOrPath)
	}

	cfg, _, err := image.DecodeConfig(bytes.NewReader(rawBytes))
	if err == nil {
		width = cfg.Width
		height = cfg.Height
	}

	mimeType := http.DetectContentType(rawBytes)
	if mimeType == "application/octet-stream" || !strings.HasPrefix(mimeType, "image/") {
		if bytes.HasPrefix(rawBytes, []byte("\x89PNG")) {
			mimeType = "image/png"
		} else {
			mimeType = "image/jpeg"
		}
	}

	dataURI = fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(rawBytes))
	return dataURI, width, height, nil
}

// calculateRunwareDimensions computes width and height that respect the original aspect ratio,
// conform to Runware's strict multiple-of-64 requirement, and stay within optimal resolution.
func calculateRunwareDimensions(w, h int) (int, int) {
	if w <= 0 || h <= 0 {
		return 1024, 1024
	}
	const targetMax = 1024.0
	aspect := float64(w) / float64(h)

	var targetW, targetH float64
	if aspect >= 1.0 {
		targetW = targetMax
		targetH = targetMax / aspect
	} else {
		targetH = targetMax
		targetW = targetMax * aspect
	}

	// Round to nearest multiple of 64
	finalW := int((targetW + 32) / 64) * 64
	finalH := int((targetH + 32) / 64) * 64

	if finalW < 512 {
		finalW = 512
	}
	if finalW > 1536 {
		finalW = 1536
	}
	if finalH < 512 {
		finalH = 512
	}
	if finalH > 1536 {
		finalH = 1536
	}

	return finalW, finalH
}

// nanoBananaDimensions defines the strict discrete resolution pairs allowed by Runware for Google Nano Banana models.
var nanoBananaDimensions = []struct {
	W int
	H int
}{
	{1024, 1024}, // 1:1 square
	{1200, 896},  // ~4:3 landscape
	{896, 1200},  // ~3:4 portrait
	{1264, 848},  // ~3:2 landscape
	{848, 1264},  // ~2:3 portrait
	{1152, 928},  // ~5:4 landscape
	{928, 1152},  // ~4:5 portrait
	{1376, 768},  // ~16:9 landscape
	{768, 1376},  // ~9:16 portrait
	{1584, 672},  // ~21:9 ultrawide landscape
	{2048, 512},  // 4:1 panorama
	{512, 2048},  // 1:4 tall panorama
	{3072, 384},  // banner landscape
	{384, 3072},  // banner portrait
}

// calculateNanoBananaDimensions selects the closest supported discrete resolution pair matching
// the original image aspect ratio, preventing Runware unsupportedDimensions errors.
func calculateNanoBananaDimensions(origW, origH int) (int, int) {
	if origW <= 0 || origH <= 0 {
		return 1024, 1024
	}
	targetAspect := float64(origW) / float64(origH)
	bestDiff := 999999.0
	bestW, bestH := 1024, 1024

	for _, p := range nanoBananaDimensions {
		pairAspect := float64(p.W) / float64(p.H)
		diff := math.Abs(pairAspect - targetAspect)
		if diff < bestDiff {
			bestDiff = diff
			bestW = p.W
			bestH = p.H
		}
	}
	return bestW, bestH
}

type RunwareResponseItem struct {
	TaskType       string `json:"taskType"`
	TaskUUID       string `json:"taskUUID"`
	ImageUUID      string `json:"imageUUID"`
	ImageURL       string `json:"imageURL"`
	InputImageUUID string `json:"inputImageUUID"`
	Seed           int64  `json:"seed"`
}

type RunwareErrorItem struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type RunwareResponse struct {
	Data   []RunwareResponseItem `json:"data"`
	Errors []RunwareErrorItem    `json:"errors"`
}

func NewRunwareService() *RunwareService {
	apiKey := os.Getenv("RUNWARE_API_KEY")
	model := os.Getenv("RUNWARE_MODEL")

	if apiKey == "" {
		envPaths := []string{".env", "../.env", "../../.env"}
		for _, p := range envPaths {
			if b, err := os.ReadFile(p); err == nil {
				lines := strings.Split(string(b), "\n")
				for _, line := range lines {
					trimmed := strings.TrimSpace(line)
					if strings.HasPrefix(trimmed, "RUNWARE_API_KEY=") && apiKey == "" {
						apiKey = strings.TrimSpace(strings.TrimPrefix(trimmed, "RUNWARE_API_KEY="))
					}
					if strings.HasPrefix(trimmed, "RUNWARE_MODEL=") && model == "" {
						model = strings.TrimSpace(strings.TrimPrefix(trimmed, "RUNWARE_MODEL="))
					}
				}
			}
			if apiKey != "" {
				break
			}
		}
	}

	if model == "" {
		model = "runware:100@1"
	}

	return &RunwareService{
		APIKey: apiKey,
		Model:  model,
		Client: &http.Client{Timeout: 90 * time.Second},
	}
}

// EnhanceImageWithRunware performs image-to-image photo enhancement or upscaling via Runware REST API
func (s *RunwareService) EnhanceImageWithRunware(ctx context.Context, inputImageURL string, customPrompt string, strength float64, modelOverride string, outFilePath string) (string, error) {
	if s.APIKey == "" {
		return "", fmt.Errorf("RUNWARE_API_KEY is not configured on the server")
	}

	model := s.Model
	if modelOverride != "" {
		model = modelOverride
	}

	// Normalize Nano Banana model names if shorthand is provided
	loweredModel := strings.ToLower(model)
	if strings.Contains(loweredModel, "nano-banana") || strings.Contains(loweredModel, "nanobanana") || strings.Contains(loweredModel, "nano_banana") {
		if strings.Contains(loweredModel, "lite") {
			model = "google:nano-banana@2-lite"
		} else {
			model = "google:nano-banana@2.1"
		}
	}

	// 1. Prepare Base64 Data URI from local storage or URL so Runware cloud servers can access it directly
	dataURI, origW, origH, err := loadImageAsDataURI(inputImageURL)
	if err != nil {
		return "", fmt.Errorf("failed to load input image: %w", err)
	}

	var taskPayload interface{}

	// 2. Determine if user selected Upscaling or Image-to-Image Inference
	isUpscale := model == "runware:upscale" || model == "upscale" || strings.Contains(strings.ToLower(model), "upscale")
	if isUpscale {
		taskPayload = RunwareTaskUpscale{
			TaskType:      "upscale",
			TaskUUID:      uuid.New().String(),
			InputImage:    dataURI,
			UpscaleFactor: 2,
		}
	} else {
		isNanoBanana := strings.HasPrefix(model, "google:nano-banana") ||
			strings.Contains(strings.ToLower(model), "nano-banana") ||
			strings.Contains(strings.ToLower(model), "nanobanana")

		var calcW, calcH int
		if isNanoBanana {
			calcW, calcH = calculateNanoBananaDimensions(origW, origH)
		} else {
			calcW, calcH = calculateRunwareDimensions(origW, origH)
		}
		positivePrompt, negativePrompt := sanitizeRunwarePrompt(customPrompt)

		inferenceTask := RunwareTaskInference{
			TaskType:      "imageInference",
			TaskUUID:      uuid.New().String(),
			Model:         model,
			Width:         calcW,
			Height:        calcH,
			NumberResults: 1,
		}

		if isNanoBanana {
			// Google Nano Banana (e.g. google:nano-banana@2.1) does NOT support the 'strength', 'seedImage', or 'inputImage' parameters.
			// Passing 'strength' causes Runware error (unsupportedParameter): Unsupported use of 'strength' parameter.
			// Instead, input images must be provided in inputs.referenceImages, and negative constraints must be provided
			// inline at the end of positivePrompt rather than via a dedicated negativePrompt field.
			if negativePrompt != "" && !strings.Contains(strings.ToLower(positivePrompt), "negative prompt") {
				combined := positivePrompt + "\n\nNegative prompt: " + negativePrompt
				if len(combined) > 2800 {
					cutoff := 2800
					lastSpace := strings.LastIndex(combined[:cutoff], " ")
					if lastSpace > 2000 {
						combined = strings.TrimSpace(combined[:lastSpace])
					} else {
						combined = strings.TrimSpace(combined[:cutoff])
					}
				}
				positivePrompt = combined
			}

			inferenceTask.PositivePrompt = positivePrompt
			inferenceTask.Inputs = &RunwareInputs{
				ReferenceImages: []string{dataURI},
			}
			inferenceTask.ReferenceImages = []string{dataURI}
			// Note: Strength remains nil, SeedImage and InputImage remain empty, NegativePrompt remains empty
		} else {
			// Standard diffusion photo enhancement (SD, SDXL, FLUX img2img)
			if strength <= 0 {
				strength = 0.25 // Optimal baseline preserving 100% room geometry
			} else if strength > 0.40 {
				strength = 0.35 // Upper safety clamp to prevent replacing the room entirely
			}

			if negativePrompt == "" {
				negativePrompt = "blurry, noise, low quality, artifacts, distorted architecture, different room, altered furniture, changed layout, cartoon, painting, 3d render, oversaturated, deformed"
			}

			inferenceTask.PositivePrompt = positivePrompt
			inferenceTask.NegativePrompt = negativePrompt
			inferenceTask.SeedImage = dataURI
			inferenceTask.InputImage = dataURI
			inferenceTask.Strength = &strength

			// FLUX.1 Schnell is optimized for exactly 4 steps
			if model == "runware:101@1" {
				inferenceTask.Steps = 4
			}
		}

		taskPayload = inferenceTask
	}

	payload := []interface{}{
		RunwareTaskAuth{
			TaskType: "authentication",
			APIKey:   s.APIKey,
		},
		taskPayload,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal Runware request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.runware.ai/v1", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.APIKey)

	resp, err := s.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("Runware API request failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var runwareResp RunwareResponse
	if err := json.Unmarshal(respBytes, &runwareResp); err != nil {
		return "", fmt.Errorf("failed to decode Runware response: %w", err)
	}

	if len(runwareResp.Errors) > 0 {
		firstErr := runwareResp.Errors[0]
		// If Runware rejects dimensions, automatically retry with the best discrete supported dimensions or 1024x1024
		if firstErr.Code == "unsupportedDimensions" {
			retryW, retryH := calculateNanoBananaDimensions(origW, origH)
			if it, ok := taskPayload.(RunwareTaskInference); ok {
				if it.Width == retryW && it.Height == retryH {
					retryW, retryH = 1024, 1024
				}
				it.Width = retryW
				it.Height = retryH
				it.TaskUUID = uuid.New().String()
				taskPayload = it

				retryPayload := []interface{}{
					RunwareTaskAuth{
						TaskType: "authentication",
						APIKey:   s.APIKey,
					},
					taskPayload,
				}
				if rBytes, mErr := json.Marshal(retryPayload); mErr == nil {
					if rReq, rErr := http.NewRequestWithContext(ctx, "POST", "https://api.runware.ai/v1", bytes.NewBuffer(rBytes)); rErr == nil {
						rReq.Header.Set("Content-Type", "application/json")
						rReq.Header.Set("Authorization", "Bearer "+s.APIKey)
						if rResp, doErr := s.Client.Do(rReq); doErr == nil {
							defer rResp.Body.Close()
							if rb, readErr := io.ReadAll(rResp.Body); readErr == nil {
								var retryRunwareResp RunwareResponse
								if decErr := json.Unmarshal(rb, &retryRunwareResp); decErr == nil && len(retryRunwareResp.Data) > 0 && retryRunwareResp.Data[0].ImageURL != "" {
									runwareResp = retryRunwareResp
								}
							}
						}
					}
				}
			}
		}
	}

	if len(runwareResp.Errors) > 0 {
		return "", fmt.Errorf("Runware error (%s): %s", runwareResp.Errors[0].Code, runwareResp.Errors[0].Message)
	}

	if len(runwareResp.Data) == 0 || runwareResp.Data[0].ImageURL == "" {
		return "", fmt.Errorf("Runware returned no image output")
	}

	imageURL := runwareResp.Data[0].ImageURL

	if outFilePath != "" {
		_ = os.MkdirAll(filepath.Dir(outFilePath), 0755)
		imgResp, err := http.Get(imageURL)
		if err == nil && imgResp.StatusCode == http.StatusOK {
			defer imgResp.Body.Close()
			imgBytes, err := io.ReadAll(imgResp.Body)
			if err == nil {
				_ = os.WriteFile(outFilePath, imgBytes, 0644)
			}
		}
	}

	return imageURL, nil
}

