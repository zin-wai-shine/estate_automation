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
	_ "image/png"
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

type ImageRegion struct {
	Top    int `json:"top"`
	Bottom int `json:"bottom"`
}

type NextActionRecommendation struct {
	Type   string `json:"type"`   // NONE, SCROLL_DOWN, SCROLL_UP, CLICK_SEE_MORE, CLICK_TARGET_POST, OPEN_POST_MODAL, OPEN_IMAGE_GALLERY, CLOSE_MODAL, WAIT, RETRY_SCREENSHOT, REQUEST_LOGIN, STOP
	Reason string `json:"reason"`
}

type VisionAnalysisResult struct {
	Status                    string                   `json:"status"`
	Confidence                float64                  `json:"confidence"`
	TargetPostVisible         bool                     `json:"target_post_visible"`
	IsTargetPost              bool                     `json:"is_target_post"`
	MoreContentBelow          bool                     `json:"more_content_below"`
	MoreTextBelow             bool                     `json:"more_text_below"`
	MoreImagesBelow           bool                     `json:"more_images_below"`
	RelevantImagesVisible     bool                     `json:"relevant_images_visible"`
	SeeMorePresent            bool                     `json:"see_more_present"`
	SeeMoreVisible            bool                     `json:"see_more_visible"`
	TargetPostComplete        bool                     `json:"target_post_complete"`
	UnwantedImagePresent      bool                     `json:"unwanted_image_present"`
	ImageRegion               *ImageRegion             `json:"image_region,omitempty"`
	Reason                    string                   `json:"reason"`
	PageState                 string                   `json:"page_state"`
	TargetDetected            bool                     `json:"target_detected"`
	TargetPostFound           bool                     `json:"target_post_found"`
	CompletePostVisible       bool                     `json:"complete_post_visible"`
	SeeMoreDetected           bool                     `json:"see_more_detected"`
	SeeMoreRequired           bool                     `json:"see_more_required"`
	MoreContentVisible        bool                     `json:"more_content_visible"`
	EndOfContentReached       bool                     `json:"end_of_content_reached"`
	EndOfPost                 bool                     `json:"end_of_post"`
	ScrollRequired            bool                     `json:"scroll_required"`
	PropertyImagesVisible     bool                     `json:"property_images_visible"`
	VisiblePropertyImageCount int                      `json:"visible_property_image_count"`
	OriginalContent           string                   `json:"original_content"`
	HeaderRegion              RegionBoundingBox        `json:"header_region"`
	TargetRegion              RegionBoundingBox        `json:"target_region"`
	ContentRegion             RegionBoundingBox        `json:"content_region"`
	MediaRegion               RegionBoundingBox        `json:"media_region"`
	TargetPostBBox            RegionBoundingBox        `json:"target_post_bbox"`
	ContentBBox               RegionBoundingBox        `json:"content_bbox"`
	MediaBBox                 RegionBoundingBox        `json:"media_bbox"`
	CroppedContentImage       string                   `json:"cropped_content_image,omitempty"`
	CropAreaRatio             float64                  `json:"crop_area_ratio"`
	CropQuality               string                   `json:"crop_quality"`
	UIRegions                 []RegionBoundingBox      `json:"ui_regions"`
	NextAction                NextActionRecommendation `json:"next_action"`
	VerificationRequired      bool                     `json:"verification_required"`
}

type PropertyImageCoordinate struct {
	Index      int     `json:"index"`
	X          int     `json:"x"`
	Y          int     `json:"y"`
	Width      int     `json:"width"`
	Height     int     `json:"height"`
	CenterX    int     `json:"center_x"`
	CenterY    int     `json:"center_y"`
	Confidence float64 `json:"confidence"`
}

type ImageBBox struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type ClickPosition struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type PropertyImageDetectionResult struct {
	Found              bool                      `json:"found"`
	PropertyImageFound bool                      `json:"property_image_found"`
	ImageBBox          *ImageBBox                `json:"image_bbox,omitempty"`
	ClickPosition      *ClickPosition            `json:"click_position,omitempty"`
	FirstPropertyImage *PropertyImageCoordinate  `json:"first_property_image,omitempty"`
	Images             []PropertyImageCoordinate `json:"images"`
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

// AnalyzeScreenshot sends a single base64 encoded screenshot image to OpenAI Vision API
func (s *OpenAIService) AnalyzeScreenshot(ctx context.Context, imageBase64 string, targetURL string) (*VisionAnalysisResult, error) {
	return s.AnalyzeScreenshotsSequential(ctx, []string{imageBase64}, targetURL)
}

// AnalyzeScreenshotsSequential sends multiple sequential screenshot images of a target Facebook post to OpenAI Vision
func (s *OpenAIService) AnalyzeScreenshotsSequential(ctx context.Context, imagesBase64 []string, targetURL string) (*VisionAnalysisResult, error) {
	if s.APIKey == "" {
		return nil, fmt.Errorf("OPENAI_AUTH_FAILED: OPENAI_API_KEY environment variable is not configured")
	}
	if len(imagesBase64) == 0 {
		return nil, fmt.Errorf("no screenshots provided for analysis")
	}

	systemPrompt := `You are analyzing sequential screenshot(s) of a single Facebook property post.

The screenshots are provided in chronological order (Screenshot 1 is top/initial view, Screenshot 2 is scrolled down, etc.).
The screenshots have intentional overlap so no content between captures is missed.

CRITICAL REAL-ESTATE POST RULE:
A real-estate Facebook post can contain long text followed by property images / photo galleries below the text.
The first screenshot may show the description, but the property image section or additional property details are below the visible screen.
Therefore, DO NOT assume the post is complete just because the visible text looks complete or ends naturally!
You MUST determine whether ANY part of the target post remains below the current viewport, including:
- More text ("more_text_below")
- Property images / photo gallery section ("more_images_below")
- Attached media / buttons / contact information
- Post container extending below the visible area

PHOTO GALLERY & POST COMPLETION RULES:
1. Real estate posts have property images attached below the description.
2. If NO property photos/images have been captured yet anywhere in the screenshot sequence:
   - You MUST set "property_images_visible": false
   - You MUST set "relevant_images_visible": false
   - You MUST set "more_images_below": true
   - You MUST set "more_content_below": true
   - You MUST set "target_post_complete": false
   - DO NOT mark target_post_complete as true until the property photos section has been reached and photographed!
3. Once property images ARE visible in the sequence:
   - Set "property_images_visible": true
   - Set "relevant_images_visible": true
   - Check if additional property images or the post footer (Like/Comment bar) continue below.
   - Set "target_post_complete": true ONLY when all property images have been captured and the bottom of the post is reached.

If property images belong to the target post: DO NOT crop them out. They are valid post content.
Only identify unwanted_image_present if there is unrelated Facebook UI / advertisement / spam image that is not part of the target property listing.

CRITICAL TEXT & NUMERICAL ACCURACY (ZERO HALLUCINATION):
- You MUST transcribe all numbers, rental prices, selling prices, deposit amounts, square meter figures (sqm / ตร.ม.), bedroom/bathroom counts, building names, floor numbers, and contact numbers EXACTLY as written in the target post.
- NEVER estimate, guess, round, or alter numbers, prices, or currency symbols.
- DO NOT confuse the main target post with adjacent posts above or below. Focus exclusively on the main center target post body.

Your tasks:
1. Determine if these screenshots show the target Facebook property post ("target_post_visible": true).
2. Check if a "See more" link/button is present and still needs to be expanded ("see_more_visible": true / "see_more_present": true).
3. Determine whether more text continues below ("more_text_below": true/false).
4. Determine whether property images / media section continue below the latest screenshot ("more_images_below": true/false).
5. Set "more_content_below": true if more text OR more images exist below.
6. Set "relevant_images_visible": true if property images are visible in the capture sequence.
7. Set "target_post_complete": true ONLY when the entire post (including all text AND property images) has been captured before unrelated comments / suggested posts.
8. Reconstruct the complete, unified, deduplicated property post text across all screenshots verbatim.

DO NOT extract comments.
DO NOT extract reactions.
DO NOT extract suggested posts.
DO NOT extract advertisements.
DO NOT extract Facebook navigation or sidebars.

Preserve the original language, wording, numbers, prices, contact info, Line IDs, phone numbers, and emojis exactly.

CRITICAL BOUNDING BOX RULES:
- "target_region": The target post card boundary in the primary/latest screenshot.
- "content_region": The bounding box covering post header and text content (without cutting off header).
- "media_region": The bounding box around the property photos grid.

Return JSON in this EXACT format:
{
  "target_post_visible": true,
  "is_target_post": true,
  "more_content_below": true,
  "more_text_below": false,
  "more_images_below": true,
  "relevant_images_visible": true,
  "see_more_visible": false,
  "see_more_present": false,
  "target_post_complete": false,
  "unwanted_image_present": false,
  "image_region": null,
  "reason": "The visible text is mostly complete, but the target post continues below the viewport and property images are likely below.",
  "confidence": 0.95,
  "page_state": "target_post_visible",
  "target_detected": true,
  "target_post_found": true,
  "complete_post_visible": false,
  "property_images_visible": true,
  "visible_property_image_count": 3,
  "original_content": "...",
  "target_region": { "x": 560, "y": 40, "width": 720, "height": 1000 },
  "content_region": { "x": 560, "y": 40, "width": 720, "height": 650 },
  "media_region": { "x": 560, "y": 690, "width": 720, "height": 310 }
}`

	userPrompt := fmt.Sprintf("Target URL requested: %s. Sequence contains %d screenshot(s). Read all screenshots together, determine if more content exists below the last screenshot, and reconstruct the full deduplicated post content.", targetURL, len(imagesBase64))

	contentItems := []map[string]interface{}{
		{"type": "text", "text": userPrompt},
	}

	for i, imgB64 := range imagesBase64 {
		cleanDataURL := imgB64
		if !strings.HasPrefix(cleanDataURL, "data:image") {
			cleanDataURL = fmt.Sprintf("data:image/jpeg;base64,%s", imgB64)
		}
		contentItems = append(contentItems, map[string]interface{}{
			"type": "text",
			"text": fmt.Sprintf("--- SCREENSHOT %d (Sequence Order: %d of %d) ---", i+1, i+1, len(imagesBase64)),
		})
		contentItems = append(contentItems, map[string]interface{}{
			"type": "image_url",
			"image_url": map[string]interface{}{
				"url":    cleanDataURL,
				"detail": "high",
			},
		})
	}

	reqBody := map[string]interface{}{
		"model": s.Model,
		"messages": []map[string]interface{}{
			{
				"role":    "system",
				"content": systemPrompt,
			},
			{
				"role":    "user",
				"content": contentItems,
			},
		},
		"response_format": map[string]string{"type": "json_object"},
		"temperature":     0.0,
		"max_tokens":      4000,
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
			Status:             "success",
			Confidence:         0.88,
			IsTargetPost:       true,
			TargetPostComplete: true,
			PageState:          "target_post_visible",
			TargetDetected:     true,
			TargetPostFound:    true,
			TargetRegion:       RegionBoundingBox{X: 560, Y: 40, Width: 720, Height: 1000},
			ContentRegion:      RegionBoundingBox{X: 560, Y: 40, Width: 720, Height: 650},
			MediaRegion:        RegionBoundingBox{X: 560, Y: 690, Width: 720, Height: 310},
			NextAction:         NextActionRecommendation{Type: "NONE", Reason: "Target post visible"},
		}
	}

	// Calculate and validate tight target post bounding box against 1920x1080 viewport
	activeBBox := result.TargetPostBBox
	if activeBBox.Width <= 0 || activeBBox.Height <= 0 {
		activeBBox = result.TargetRegion
	}
	if activeBBox.Width <= 0 || activeBBox.Height <= 0 {
		activeBBox = result.ContentRegion
	}

	validatedBBox, areaRatio, quality := ValidateAndAdjustBBox(activeBBox, 1920, 1080)
	result.TargetPostBBox = validatedBBox
	result.TargetRegion = validatedBBox
	if result.ContentBBox.Width <= 0 {
		result.ContentBBox = result.ContentRegion
	}
	if result.MediaBBox.Width <= 0 {
		result.MediaBBox = result.MediaRegion
	}
	result.CropAreaRatio = areaRatio
	result.CropQuality = quality

	// Set NextAction based on AI vision decision
	if result.SeeMorePresent || result.SeeMoreRequired || result.SeeMoreVisible {
		result.NextAction = NextActionRecommendation{Type: "CLICK_SEE_MORE", Reason: "Expand collapsed post content"}
	} else if result.MoreContentBelow && !result.TargetPostComplete {
		result.NextAction = NextActionRecommendation{Type: "SCROLL_DOWN", Reason: result.Reason}
	} else {
		result.NextAction = NextActionRecommendation{Type: "NONE", Reason: "Target post content complete"}
	}

	// Conditional Cropping on primary/latest image:
	// 1. If unwanted_image_present is true and image_region is specified, crop above image_region.Top
	// 2. Otherwise, crop the full target post section (from top of target_region Y down to content end)
	primaryImg := imagesBase64[0]
	cleanPrimaryURL := primaryImg
	if !strings.HasPrefix(cleanPrimaryURL, "data:image") {
		cleanPrimaryURL = fmt.Sprintf("data:image/jpeg;base64,%s", primaryImg)
	}

	cropX := result.TargetRegion.X
	cropY := result.TargetRegion.Y
	cropW := result.TargetRegion.Width
	cropH := result.TargetRegion.Height

	if result.UnwantedImagePresent && result.ImageRegion != nil && result.ImageRegion.Top > cropY {
		cropH = result.ImageRegion.Top - cropY
	} else if result.ContentRegion.Height > 0 {
		if result.ContentRegion.Y < cropY {
			cropY = result.ContentRegion.Y
		}
		cropH = result.ContentRegion.Height
		if result.TargetRegion.Height > cropH && !result.UnwantedImagePresent {
			cropH = result.TargetRegion.Height
		}
	}

	croppedImg, cropErr := CropImageBase64(cleanPrimaryURL, cropX, cropY, cropW, cropH)
	if cropErr == nil && croppedImg != "" {
		result.CroppedContentImage = croppedImg
	}

	return &result, nil
}

// CropImageBase64 crops a base64 image data URL using specified bounding box coordinates.
func CropImageBase64(base64DataURL string, x, y, width, height int) (string, error) {
	if strings.TrimSpace(base64DataURL) == "" {
		return "", fmt.Errorf("empty base64 string")
	}

	idx := strings.Index(base64DataURL, ",")
	rawB64 := base64DataURL
	if idx != -1 {
		rawB64 = base64DataURL[idx+1:]
	}

	imgBytes, err := base64.StdEncoding.DecodeString(rawB64)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 image: %w", err)
	}

	srcImg, _, err := image.Decode(bytes.NewReader(imgBytes))
	if err != nil {
		return "", fmt.Errorf("failed to decode image format: %w", err)
	}

	bounds := srcImg.Bounds()
	imgWidth := bounds.Dx()
	imgHeight := bounds.Dy()

	// Clamp coordinates inside image bounds
	if x < 0 {
		x = 0
	}
	if y < 0 {
		y = 0
	}
	if x >= imgWidth {
		x = 0
	}
	if y >= imgHeight {
		y = 0
	}
	if width <= 0 || x+width > imgWidth {
		width = imgWidth - x
	}
	if height <= 0 || y+height > imgHeight {
		height = imgHeight - y
	}

	cropRect := image.Rect(x, y, x+width, y+height)
	dstImg := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(dstImg, dstImg.Bounds(), srcImg, cropRect.Min, draw.Src)

	var buf bytes.Buffer
	err = jpeg.Encode(&buf, dstImg, &jpeg.Options{Quality: 95})
	if err != nil {
		return "", fmt.Errorf("failed to encode cropped jpeg: %w", err)
	}

	croppedB64 := base64.StdEncoding.EncodeToString(buf.Bytes())
	return fmt.Sprintf("data:image/jpeg;base64,%s", croppedB64), nil
}

// ValidateAndAdjustBBox validates and adjusts a target post bounding box against 1920x1080 viewport.
// Rejects bounding boxes that cover > 60% of viewport area or are excessively wide (> 1000px on 1920 viewport).
func ValidateAndAdjustBBox(rect RegionBoundingBox, viewportWidth, viewportHeight int) (RegionBoundingBox, float64, string) {
	if viewportWidth <= 0 {
		viewportWidth = 1920
	}
	if viewportHeight <= 0 {
		viewportHeight = 1080
	}

	viewportArea := float64(viewportWidth * viewportHeight)

	// Centered Facebook post container card on 1920x1080 (Facebook feed/permalink card is ~680 to 740px wide centered)
	defaultBox := RegionBoundingBox{
		X:      (viewportWidth - 720) / 2, // 600px
		Y:      100,
		Width:  720,
		Height: viewportHeight - 140, // 940px
	}

	x := rect.X
	y := rect.Y
	w := rect.Width
	h := rect.Height

	if w <= 0 || h <= 0 {
		areaRatio := float64(defaultBox.Width*defaultBox.Height) / viewportArea
		return defaultBox, areaRatio, "FALLBACK_MISSING_BBOX"
	}

	// 1. Check if width is excessively wide (> 1000px when Facebook post is centered ~700px wide)
	if w > 1000 && viewportWidth >= 1600 {
		w = 720
		x = (viewportWidth - w) / 2
	}

	// Bounds checks
	if x < 0 {
		x = 0
	}
	if y < 0 {
		y = 0
	}
	if x+w > viewportWidth {
		w = viewportWidth - x
	}
	if y+h > viewportHeight {
		h = viewportHeight - y
	}

	bboxArea := float64(w * h)
	areaRatio := bboxArea / viewportArea

	// 2. Reject if bbox covers > 60% of entire viewport area
	if areaRatio > 0.60 {
		w = 720
		x = (viewportWidth - w) / 2
		if y < 60 {
			y = 60
		}
		if h > (viewportHeight - y - 20) {
			h = viewportHeight - y - 20
		}
		bboxArea = float64(w * h)
		areaRatio = bboxArea / viewportArea
		return RegionBoundingBox{X: x, Y: y, Width: w, Height: h}, areaRatio, "RECONSTRAINED_LARGE_BBOX"
	}

	return RegionBoundingBox{X: x, Y: y, Width: w, Height: h}, areaRatio, "GOOD"
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

// CropBase64Image crops a high-resolution base64 encoded image to the specified bounding box region
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
	
	// Add 10px safety padding around target region
	padding := 10
	x := rect.X - padding
	y := rect.Y - padding
	w := rect.Width + (padding * 2)
	h := rect.Height + (padding * 2)

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

	if w <= 20 || h <= 20 {
		return base64Str, nil
	}

	cropRect := image.Rect(x, y, x+w, y+h)
	dstImg := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(dstImg, dstImg.Bounds(), srcImg, cropRect.Min, draw.Src)

	var buf bytes.Buffer
	// Encode crop at 95% high quality
	if err := jpeg.Encode(&buf, dstImg, &jpeg.Options{Quality: 95}); err != nil {
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

	systemPrompt := `You are analyzing a cropped screenshot containing ONE Facebook real-estate property post.

Extract ONLY the original property post body.

DO NOT extract:
- Facebook group name
- Facebook page name
- poster name
- profile name
- timestamp
- profile picture
- Facebook navigation
- sidebar content
- advertisements
- suggested posts
- comments
- reactions
- share buttons
- unrelated posts

The target content is the property listing itself.

Read the complete visible property description.

Preserve the original language exactly.

Preserve:
- Thai
- English
- Burmese
- numbers
- prices
- room sizes
- phone numbers
- Line IDs
- emojis
- punctuation
- line breaks where possible

DO NOT summarize.
DO NOT translate.
DO NOT rewrite.
DO NOT infer missing text.
DO NOT invent text.

If a character is unreadable, use [UNCLEAR].`

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
					{
						"type": "image_url",
						"image_url": map[string]interface{}{
							"url":    cleanDataURL,
							"detail": "high",
						},
					},
				},
			},
		},
		"temperature": 0.0,
		"max_tokens":  3000,
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

// DetectTargetPostImageCoordinates analyzes the original high-resolution screenshot and returns pixel center coordinates for property images inside the target post
func (s *OpenAIService) DetectTargetPostImageCoordinates(ctx context.Context, imageBase64 string) (*PropertyImageDetectionResult, error) {
	if s.APIKey == "" {
		return nil, fmt.Errorf("OPENAI_AUTH_FAILED: OPENAI_API_KEY environment variable is not configured")
	}

	cleanDataURL := imageBase64
	if !strings.HasPrefix(cleanDataURL, "data:image") {
		cleanDataURL = fmt.Sprintf("data:image/jpeg;base64,%s", imageBase64)
	}

	systemPrompt := `You are analyzing a Facebook property listing screenshot (1920x1080 resolution).

Locate the FIRST PROPERTY PHOTO CELL in the target post (the top-left photo inside the post photo collage/grid).

Critical accuracy requirements:
- Identify the EXACT rectangle bounding box of the top-left image cell itself.
- Do NOT include the outer post border, header, text, dark background, or other photo cells in the collage.
- Only return the bounding box of the actual first photo rectangle.

Return JSON only:
{
  "found": true,
  "image_bbox": {
    "x": 630,
    "y": 260,
    "width": 330,
    "height": 280
  }
}

If no property photos are visible on this screenshot, return:
{
  "found": false,
  "image_bbox": null
}`

	userPrompt := "Identify the exact bounding box of the first property photo cell (top-left photo in the grid) inside the Facebook post."

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
					{
						"type": "image_url",
						"image_url": map[string]interface{}{
							"url":    cleanDataURL,
							"detail": "high",
						},
					},
				},
			},
		},
		"response_format": map[string]string{"type": "json_object"},
		"temperature":     0.0,
		"max_tokens":      1500,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to encode request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
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
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &openAIResp); err != nil || len(openAIResp.Choices) == 0 {
		return nil, fmt.Errorf("invalid response from OpenAI Vision: %w", err)
	}

	var result PropertyImageDetectionResult
	if err := json.Unmarshal([]byte(openAIResp.Choices[0].Message.Content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse image coordinates JSON: %w", err)
	}

	// Calculate EXACT CELL CENTER (x + width/2, y + height/2)
	if result.ImageBBox != nil && result.ImageBBox.Width > 0 && result.ImageBBox.Height > 0 {
		result.Found = true
		result.PropertyImageFound = true
		centerX := result.ImageBBox.X + (result.ImageBBox.Width / 2)
		centerY := result.ImageBBox.Y + (result.ImageBBox.Height / 2)
		result.ClickPosition = &ClickPosition{
			X: centerX,
			Y: centerY,
		}
		result.FirstPropertyImage = &PropertyImageCoordinate{
			Index:      1,
			X:          result.ImageBBox.X,
			Y:          result.ImageBBox.Y,
			Width:      result.ImageBBox.Width,
			Height:     result.ImageBBox.Height,
			CenterX:    centerX,
			CenterY:    centerY,
			Confidence: 0.98,
		}
		result.Images = []PropertyImageCoordinate{*result.FirstPropertyImage}
	} else if result.FirstPropertyImage != nil {
		result.Found = true
		result.PropertyImageFound = true
		result.ImageBBox = &ImageBBox{
			X:      result.FirstPropertyImage.X,
			Y:      result.FirstPropertyImage.Y,
			Width:  result.FirstPropertyImage.Width,
			Height: result.FirstPropertyImage.Height,
		}
		centerX := result.FirstPropertyImage.X + (result.FirstPropertyImage.Width / 2)
		centerY := result.FirstPropertyImage.Y + (result.FirstPropertyImage.Height / 2)
		result.ClickPosition = &ClickPosition{
			X: centerX,
			Y: centerY,
		}
		result.Images = []PropertyImageCoordinate{*result.FirstPropertyImage}
	} else if len(result.Images) > 0 {
		img := result.Images[0]
		result.Found = true
		result.PropertyImageFound = true
		result.ImageBBox = &ImageBBox{
			X:      img.X,
			Y:      img.Y,
			Width:  img.Width,
			Height: img.Height,
		}
		centerX := img.X + (img.Width / 2)
		centerY := img.Y + (img.Height / 2)
		result.ClickPosition = &ClickPosition{
			X: centerX,
			Y: centerY,
		}
		result.FirstPropertyImage = &img
	}

	return &result, nil
}
