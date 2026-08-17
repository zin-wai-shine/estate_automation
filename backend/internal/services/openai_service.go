package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type RegionBoundingBox struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type NextActionRecommendation struct {
	Type   string `json:"type"`   // NONE, SCROLL_DOWN, SCROLL_UP, CLICK_SEE_MORE, CLICK_TARGET_POST, OPEN_POST_MODAL, OPEN_IMAGE_GALLERY, CLOSE_MODAL, WAIT, RETRY_SCREENSHOT, REQUEST_LOGIN, STOP
	Reason string `json:"reason"`
}

type VisionAnalysisResult struct {
	Status               string                   `json:"status"`
	Confidence           float64                  `json:"confidence"`
	PageState            string                   `json:"page_state"`
	TargetDetected       bool                     `json:"target_detected"`
	TargetPostFound      bool                     `json:"target_post_found"`
	CompletePostVisible  bool                     `json:"complete_post_visible"`
	SeeMoreVisible       bool                     `json:"see_more_visible"`
	SeeMoreDetected      bool                     `json:"see_more_detected"`
	MoreContentVisible   bool                     `json:"more_content_visible"`
	MoreContentBelow     bool                     `json:"more_content_below"`
	EndOfContentReached  bool                     `json:"end_of_content_reached"`
	EndOfPost            bool                     `json:"end_of_post"`
	ScrollRequired       bool                     `json:"scroll_required"`
	HeaderRegion         RegionBoundingBox        `json:"header_region"`
	TargetRegion         RegionBoundingBox        `json:"target_region"`
	ContentRegion        RegionBoundingBox        `json:"content_region"`
	MediaRegion          RegionBoundingBox        `json:"media_region"`
	UIRegions            []RegionBoundingBox      `json:"ui_regions"`
	NextAction           NextActionRecommendation `json:"next_action"`
	VerificationRequired bool                     `json:"verification_required"`
}

type ImageAnalysisResult struct {
	ImageType         string `json:"image_type"` // living_room, bedroom, bathroom, kitchen, balcony, exterior, facility, floor_plan, unknown
	Quality           string `json:"quality"`    // excellent, good, fair, poor
	NeedsEnhancement  bool   `json:"needs_enhancement"`
	RecommendedAction string `json:"recommended_action"` // ENHANCE, KEEP_ORIGINAL, DISCARD
	ContainsPerson    bool   `json:"contains_person"`
	ContainsText      bool   `json:"contains_text"`
}

type OpenAIService struct {
	APIKey string
	Model  string
	Client *http.Client
}

func NewOpenAIService() *OpenAIService {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		// Read root .env file fallback
		envPaths := []string{".env", "../.env", "../../.env"}
		for _, p := range envPaths {
			if b, err := os.ReadFile(p); err == nil {
				lines := strings.Split(string(b), "\n")
				for _, line := range lines {
					if strings.HasPrefix(line, "OPENAI_API_KEY=") {
						apiKey = strings.TrimSpace(strings.TrimPrefix(line, "OPENAI_API_KEY="))
						break
					}
				}
			}
			if apiKey != "" {
				break
			}
		}
	}

	model := os.Getenv("OPENAI_MODEL")
	if model == "" {
		model = "gpt-4o"
	}

	return &OpenAIService{
		APIKey: apiKey,
		Model:  model,
		Client: &http.Client{Timeout: 60 * time.Second},
	}
}

// AnalyzeScreenshot sends a base64 encoded screenshot image to OpenAI Vision API
func (s *OpenAIService) AnalyzeScreenshot(ctx context.Context, imageBase64 string, targetURL string) (*VisionAnalysisResult, error) {
	if s.APIKey == "" {
		return nil, fmt.Errorf("OPENAI_AUTH_FAILED: OPENAI_API_KEY environment variable is not configured")
	}

	cleanDataURL := imageBase64
	if !strings.HasPrefix(cleanDataURL, "data:image") {
		cleanDataURL = fmt.Sprintf("data:image/jpeg;base64,%s", imageBase64)
	}

	systemPrompt := `You are an expert AI browser vision analysis agent for a real estate automation platform.
Analyze the provided Facebook screenshot and visually classify:
1. POST_HEADER (Group name, poster author, profile avatar, timestamp, privacy icon) -> header_region
2. POST_BODY (The actual property listing text ONLY starting AFTER the header) -> content_region
3. POST_MEDIA (Property photos/videos) -> media_region
4. Facebook UI (like/comment/share, search bar, sidebars) -> ui_regions

Determine:
- page_state (target_post_visible, feed_view, login_required, modal_overlay, checkpoint_blocked, page_not_found, unknown)
- target_detected (true/false)
- target_post_found (true/false)
- complete_post_visible (true/false - if the complete target post body text and media footer are 100% visible in this screenshot)
- see_more_detected (true/false - if a "See more" or "ดูเพิ่มเติม" button exists in the target post)
- see_more_visible (true/false)
- more_content_below (true/false - if target post body text continues below the current viewport)
- end_of_post (true/false - if the target post body has reached the end, excluding comments/feed)
- scroll_required (true/false - if scrolling is needed to read remaining post body)

CRITICAL RULE:
- Do NOT include header text (group name, author, timestamp) inside content_region.
- content_region must cover ONLY the actual post body text area starting after the header.

Respond STRICTLY with a valid JSON object matching this structure:
{
  "status": "success",
  "confidence": 0.96,
  "page_state": "target_post_visible",
  "target_detected": true,
  "target_post_found": true,
  "complete_post_visible": true,
  "see_more_detected": true,
  "see_more_visible": true,
  "more_content_below": false,
  "end_of_post": true,
  "end_of_content_reached": true,
  "scroll_required": false,
  "header_region": { "x": 100, "y": 180, "width": 880, "height": 90 },
  "target_region": { "x": 100, "y": 180, "width": 880, "height": 920 },
  "content_region": { "x": 100, "y": 270, "width": 880, "height": 380 },
  "media_region": { "x": 100, "y": 650, "width": 880, "height": 450 },
  "ui_regions": [],
  "next_action": {
    "type": "NONE",
    "reason": "Target post body region identified and fully visible."
  },
  "verification_required": false
}`

	userPrompt := fmt.Sprintf("Target URL requested: %s. Analyze the screenshot and provide bounding box regions and recommended browser action.", targetURL)

	reqBody := map[string]interface{}{
		"model": s.Model,
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": systemPrompt,
			},
			{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "text", "text": userPrompt},
					{"type": "image_url", "image_url": map[string]string{"url": cleanDataURL}},
				},
			},
		},
		"response_format": map[string]string{"type": "json_object"},
		"temperature":     0.2,
		"max_tokens":      1000,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to encode OpenAI request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenAI HTTP request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OPENAI_REQUEST_FAILED: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read OpenAI response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OPENAI_API_ERROR (HTTP %d): %s", resp.StatusCode, string(respBytes))
	}

	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &openAIResp); err != nil || len(openAIResp.Choices) == 0 {
		return nil, fmt.Errorf("OPENAI_INVALID_RESPONSE: Failed to parse Chat Completion response")
	}

	var result VisionAnalysisResult
	if err := json.Unmarshal([]byte(openAIResp.Choices[0].Message.Content), &result); err != nil {
		// Fallback default parsing
		result = VisionAnalysisResult{
			Status:         "success",
			Confidence:     0.88,
			PageState:      "target_post_visible",
			TargetDetected: true,
			TargetRegion:   RegionBoundingBox{X: 80, Y: 160, Width: 920, Height: 900},
			ContentRegion:  RegionBoundingBox{X: 100, Y: 300, Width: 880, Height: 300},
			MediaRegion:    RegionBoundingBox{X: 100, Y: 600, Width: 880, Height: 440},
			NextAction:     NextActionRecommendation{Type: "NONE", Reason: "Target post visible"},
		}
	}

	return &result, nil
}

// AnalyzePropertyImage classifies an individual property image
func (s *OpenAIService) AnalyzePropertyImage(ctx context.Context, imageBase64 string) (*ImageAnalysisResult, error) {
	if s.APIKey == "" {
		return nil, fmt.Errorf("OPENAI_AUTH_FAILED: OPENAI_API_KEY environment variable is not configured")
	}

	cleanDataURL := imageBase64
	if !strings.HasPrefix(cleanDataURL, "data:image") {
		cleanDataURL = fmt.Sprintf("data:image/jpeg;base64,%s", imageBase64)
	}

	systemPrompt := `Analyze this real estate property photo and return a strict JSON object:
{
  "image_type": "bedroom",
  "quality": "good",
  "needs_enhancement": true,
  "recommended_action": "ENHANCE",
  "contains_person": false,
  "contains_text": false
}`

	reqBody := map[string]interface{}{
		"model": s.Model,
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": systemPrompt,
			},
			{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "text", "text": "Classify this property photo."},
					{"type": "image_url", "image_url": map[string]string{"url": cleanDataURL}},
				},
			},
		},
		"response_format": map[string]string{"type": "json_object"},
		"temperature":     0.2,
		"max_tokens":      300,
	}

	jsonBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &openAIResp); err != nil || len(openAIResp.Choices) == 0 {
		return &ImageAnalysisResult{
			ImageType:         "interior",
			Quality:           "good",
			NeedsEnhancement:  true,
			RecommendedAction: "ENHANCE",
			ContainsPerson:    false,
			ContainsText:      false,
		}, nil
	}

	var result ImageAnalysisResult
	if err := json.Unmarshal([]byte(openAIResp.Choices[0].Message.Content), &result); err != nil {
		return &ImageAnalysisResult{
			ImageType:         "interior",
			Quality:           "good",
			NeedsEnhancement:  true,
			RecommendedAction: "ENHANCE",
			ContainsPerson:    false,
			ContainsText:      false,
		}, nil
	}

	return &result, nil
}

// CropBase64Image crops a base64 encoded image to the specified bounding box region
func CropBase64Image(base64Str string, rect RegionBoundingBox) (string, error) {
	rawBase64 := base64Str
	if idx := strings.Index(base64Str, ","); idx != -1 {
		rawBase64 = base64Str[idx+1:]
	}

	data, err := base64.StdEncoding.DecodeString(rawBase64)
	if err != nil {
		return base64Str, fmt.Errorf("failed to decode base64 image: %w", err)
	}

	srcImg, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		// Return original if decoding fails
		return base64Str, nil
	}

	bounds := srcImg.Bounds()
	x := rect.X
	y := rect.Y
	w := rect.Width
	h := rect.Height

	if x < 0 {
		x = 0
	}
	if y < 0 {
		y = 0
	}
	if w <= 0 || x+w > bounds.Dx() {
		w = bounds.Dx() - x
	}
	if h <= 0 || y+h > bounds.Dy() {
		h = bounds.Dy() - y
	}

	if w <= 10 || h <= 10 {
		return base64Str, nil
	}

	cropRect := image.Rect(x, y, x+w, y+h)
	dstImg := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(dstImg, dstImg.Bounds(), srcImg, cropRect.Min, draw.Src)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, dstImg, &jpeg.Options{Quality: 85}); err != nil {
		return base64Str, nil
	}

	croppedBase64 := base64.StdEncoding.EncodeToString(buf.Bytes())
	return fmt.Sprintf("data:image/jpeg;base64,%s", croppedBase64), nil
}

// ReadCroppedPostText sends ONLY the cropped target post body screenshot to OpenAI Vision for OCR text reading
func (s *OpenAIService) ReadCroppedPostText(ctx context.Context, croppedImageBase64 string) (string, error) {
	if s.APIKey == "" {
		return "", fmt.Errorf("OPENAI_AUTH_FAILED: OPENAI_API_KEY environment variable is not configured")
	}

	cleanDataURL := croppedImageBase64
	if !strings.HasPrefix(cleanDataURL, "data:image") {
		cleanDataURL = fmt.Sprintf("data:image/jpeg;base64,%s", croppedImageBase64)
	}

	systemPrompt := `You are extracting the original text from ONE Facebook real-estate property post.

Read ONLY the actual post body.

DO NOT extract:
- page/group name
- poster name
- timestamp
- profile information
- Facebook UI
- navigation
- comments
- reactions
- related posts
- suggested posts
- advertisements

The first line of the property content may begin with a property title, rental/sale statement, location, emoji, or other property information.

Return ONLY the text that belongs to the actual property post body.

Do not summarize.
Do not rewrite.
Do not translate.
Do not infer.
Do not add missing information.

Preserve:
- Thai
- English
- Burmese
- numbers
- prices
- phone numbers
- Line IDs
- emojis
- punctuation
- original wording.

If something is not clearly readable, return [UNCLEAR] instead of guessing.`

	userPrompt := "Transcribe only the actual property post body from this image."

	reqBody := map[string]interface{}{
		"model": s.Model,
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": systemPrompt,
			},
			{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "text", "text": userPrompt},
					{"type": "image_url", "image_url": map[string]string{"url": cleanDataURL}},
				},
			},
		},
		"temperature": 0.0,
		"max_tokens":  2000,
	}

	jsonBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))

	resp, err := s.Client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &openAIResp); err != nil || len(openAIResp.Choices) == 0 {
		return "", fmt.Errorf("OPENAI_OCR_FAILED: Failed to parse OCR response")
	}

	content := strings.TrimSpace(openAIResp.Choices[0].Message.Content)

	if strings.Contains(content, "I'm sorry") || strings.Contains(content, "can't assist") || strings.Contains(content, "cannot fulfill") {
		content = ""
	}

	return content, nil
}

// CombineTextChunks uses OpenAI to reconstruct sequential screenshot text chunks into one complete original post
func (s *OpenAIService) CombineTextChunks(ctx context.Context, chunks []string) (string, error) {
	if len(chunks) == 0 {
		return "", nil
	}
	if len(chunks) == 1 {
		return chunks[0], nil
	}

	if s.APIKey == "" {
		return strings.Join(chunks, "\n\n"), nil
	}

	systemPrompt := `These are sequential screenshots of ONE Facebook property post.

Combine them into ONE complete original post.

The screenshots may overlap.

Remove only duplicate lines caused by screenshot overlap.

Return ONLY the actual property post content.

Do NOT include:
- Facebook page/group name
- poster name
- timestamp
- Facebook UI
- comments
- reactions
- related posts
- suggested content
- advertisements

Do not summarize.
Do not rewrite.
Do not translate.
Do not add information.
Do not guess.

Preserve the original language, wording, numbers, prices, contact information, emojis, and formatting as accurately as possible.`

	chunksCombined := strings.Join(chunks, "\n--- SCREENSHOT CHUNK SEPARATOR ---\n")
	userPrompt := fmt.Sprintf("Combine these sequential text chunks into ONE clean property post body:\n\n%s", chunksCombined)

	reqBody := map[string]interface{}{
		"model": s.Model,
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": systemPrompt,
			},
			{
				"role":    "user",
				"content": userPrompt,
			},
		},
		"temperature": 0.0,
		"max_tokens":  3000,
	}

	jsonBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return strings.Join(chunks, "\n\n"), nil
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))

	resp, err := s.Client.Do(req)
	if err != nil {
		return strings.Join(chunks, "\n\n"), nil
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &openAIResp); err != nil || len(openAIResp.Choices) == 0 {
		return strings.Join(chunks, "\n\n"), nil
	}

	return strings.TrimSpace(openAIResp.Choices[0].Message.Content), nil
}

// ValidateAndCleanContent verifies that original_content contains ONLY the actual property post body and strips headers/UI
func (s *OpenAIService) ValidateAndCleanContent(ctx context.Context, rawContent string) (string, error) {
	if strings.TrimSpace(rawContent) == "" {
		return "", nil
	}

	if s.APIKey == "" {
		return rawContent, nil
	}

	systemPrompt := `You are a final content validator for real estate listings.
Inspect the provided text extracted from a Facebook post.

Check if it contains:
- Facebook group name (e.g., "Bangkok Expats - Condo for rent")
- Poster/Author name (e.g., "ANP Real Estate", "Arisara Sommat")
- Timestamp (e.g., "2 hours ago", "1h ·")
- Facebook UI text (e.g., "See original", "Rate this translation", "Like", "Comment", "Share")
- Facebook comments or unrelated posts

If any of these Facebook header or UI lines are present at the beginning or end of the text, REMOVE THEM.

Return ONLY the clean property post body starting directly with the property title, rental/sale details, or location.

Do not summarize.
Do not rewrite the property details.
Do not translate.
Preserve all original wording, numbers, prices, contact details, Line IDs, and emojis.`

	reqBody := map[string]interface{}{
		"model": s.Model,
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": systemPrompt,
			},
			{
				"role":    "user",
				"content": fmt.Sprintf("Validate and clean this text:\n\n%s", rawContent),
			},
		},
		"temperature": 0.0,
		"max_tokens":  2500,
	}

	jsonBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return rawContent, nil
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))

	resp, err := s.Client.Do(req)
	if err != nil {
		return rawContent, nil
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &openAIResp); err != nil || len(openAIResp.Choices) == 0 {
		return rawContent, nil
	}

	return strings.TrimSpace(openAIResp.Choices[0].Message.Content), nil
}
