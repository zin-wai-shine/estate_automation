package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type GoogleAIService struct {
	client  *http.Client
	apiKey  string
	model   string
}

type GeminiGenerateRequest struct {
	Contents []GeminiContent `json:"contents"`
}

type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiGenerateResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

func NewGoogleAIService() *GoogleAIService {
	apiKey := os.Getenv("GEMINI_API_KEY")

	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-flash-latest"
	}

	return &GoogleAIService{
		client: &http.Client{Timeout: 60 * time.Second},
		apiKey: apiKey,
		model:  model,
	}
}

// GenerateContent calls Google Gemini API to format and modify raw content using the given prompt template
func (s *GoogleAIService) GenerateContent(templateText string, rawContent string, apiKeyOverride string, modelOverride string) (string, error) {
	key := s.apiKey
	if apiKeyOverride != "" {
		key = apiKeyOverride
	}

	if key == "" {
		return "", fmt.Errorf("GEMINI_API_KEY is not configured")
	}

	// Models to try in order of capability
	modelsToTry := []string{"gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash"}
	if modelOverride != "" {
		modelsToTry = append([]string{modelOverride}, modelsToTry...)
	}

	// Build combined prompt
	var fullPrompt strings.Builder
	if strings.TrimSpace(templateText) != "" {
		fullPrompt.WriteString("=== TEMPLATE & INSTRUCTIONS ===\n")
		fullPrompt.WriteString(templateText)
		fullPrompt.WriteString("\n\n")
	}

	fullPrompt.WriteString("=== RAW EXTRACTED FACEBOOK CONTENT ===\n")
	fullPrompt.WriteString(rawContent)
	fullPrompt.WriteString("\n\n")
	fullPrompt.WriteString("=== TASK ===\n")
	fullPrompt.WriteString("Transform and format the raw Facebook content according to the template instructions above.\n")
	fullPrompt.WriteString("Ensure all core property details (price, condo/project name, size, floor, bedrooms, contact details) remain accurate.\n")
	fullPrompt.WriteString("Generate the polished, ready-to-publish listing copy directly without unnecessary conversational preamble.")

	reqBody := GeminiGenerateRequest{
		Contents: []GeminiContent{
			{
				Parts: []GeminiPart{
					{Text: fullPrompt.String()},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	var lastErr error
	for _, m := range modelsToTry {
		endpoint := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", m, key)
		req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(bodyBytes))
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := s.client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		var geminiResp GeminiGenerateResponse
		if err := json.Unmarshal(respBody, &geminiResp); err != nil {
			lastErr = fmt.Errorf("failed to decode response: %w", err)
			continue
		}

		if geminiResp.Error != nil {
			lastErr = fmt.Errorf("Google AI error (%s): %s", m, geminiResp.Error.Message)
			// Try next model if 404 or 503
			if geminiResp.Error.Code == 404 || geminiResp.Error.Code == 503 {
				continue
			}
			return "", lastErr
		}

		if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
			resultText := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
			if resultText != "" {
				return resultText, nil
			}
		}

		lastErr = fmt.Errorf("model %s returned empty candidates", m)
	}

	return "", lastErr
}
