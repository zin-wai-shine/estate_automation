package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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

type RunwareTaskInference struct {
	TaskType       string   `json:"taskType"`
	TaskUUID       string   `json:"taskUUID"`
	Model          string   `json:"model"`
	PositivePrompt string   `json:"positivePrompt"`
	InputImage     string   `json:"inputImage,omitempty"`
	Strength       *float64 `json:"strength,omitempty"`
	Width          int      `json:"width,omitempty"`
	Height         int      `json:"height,omitempty"`
	NumberResults  int      `json:"numberResults,omitempty"`
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
		Client: &http.Client{Timeout: 60 * time.Second},
	}
}

// EnhanceImageWithRunware performs image-to-image photo enhancement via Runware REST API
func (s *RunwareService) EnhanceImageWithRunware(ctx context.Context, inputImageURL string, customPrompt string, strength float64, modelOverride string, outFilePath string) (string, error) {
	if s.APIKey == "" {
		return "", fmt.Errorf("RUNWARE_API_KEY is not configured on the server")
	}

	model := s.Model
	if modelOverride != "" {
		model = modelOverride
	}

	if strength <= 0 {
		strength = 0.35 // Preserves geometry, enhances clarity and texture
	}

	prompt := customPrompt
	if prompt == "" {
		prompt = "Ultra realistic professional architectural photo, crystal clear lighting, crisp detail, realistic textures, high resolution"
	}

	taskID := uuid.New().String()
	payload := []interface{}{
		RunwareTaskAuth{
			TaskType: "authentication",
			APIKey:   s.APIKey,
		},
		RunwareTaskInference{
			TaskType:       "imageInference",
			TaskUUID:       taskID,
			Model:          model,
			PositivePrompt: prompt,
			InputImage:     inputImageURL,
			Strength:       &strength,
			Width:          1024,
			Height:         1024,
			NumberResults:  1,
		},
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
