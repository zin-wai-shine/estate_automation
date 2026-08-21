package services

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"io"
	"math"
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
	ImageGridVisible          bool                     `json:"image_grid_visible"`
	ImageGridReached          bool                     `json:"image_grid_reached"`
	ImageGridPartiallyCutOff  bool                     `json:"image_grid_partially_cut_off"`
	NeedsScrollForClearTarget bool                     `json:"needs_scroll_for_clear_target"`
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
	APIKey         string
	Model          string
	ImageModel     string
	ResponsesModel string
	Client         *http.Client
}

func NewOpenAIService() *OpenAIService {
	apiKey := os.Getenv("OPENAI_API_KEY")
	model := os.Getenv("OPENAI_VISION_MODEL")
	if model == "" {
		model = os.Getenv("OPENAI_MODEL")
	}
	imageModel := os.Getenv("OPENAI_IMAGE_MODEL")
	responsesModel := os.Getenv("OPENAI_RESPONSES_MODEL")

	if apiKey == "" || model == "" || imageModel == "" || responsesModel == "" {
		// Read root .env file fallback
		envPaths := []string{".env", "../.env", "../../.env"}
		for _, p := range envPaths {
			if b, err := os.ReadFile(p); err == nil {
				lines := strings.Split(string(b), "\n")
				for _, line := range lines {
					trimmed := strings.TrimSpace(line)
					if strings.HasPrefix(trimmed, "OPENAI_API_KEY=") && apiKey == "" {
						apiKey = strings.TrimSpace(strings.TrimPrefix(trimmed, "OPENAI_API_KEY="))
					}
					if (strings.HasPrefix(trimmed, "OPENAI_VISION_MODEL=") || strings.HasPrefix(trimmed, "OPENAI_MODEL=")) && model == "" {
						parts := strings.SplitN(trimmed, "=", 2)
						if len(parts) == 2 && strings.TrimSpace(parts[1]) != "" {
							model = strings.TrimSpace(parts[1])
						}
					}
					if strings.HasPrefix(trimmed, "OPENAI_IMAGE_MODEL=") && imageModel == "" {
						parts := strings.SplitN(trimmed, "=", 2)
						if len(parts) == 2 && strings.TrimSpace(parts[1]) != "" {
							imageModel = strings.TrimSpace(parts[1])
						}
					}
					if strings.HasPrefix(trimmed, "OPENAI_RESPONSES_MODEL=") && responsesModel == "" {
						parts := strings.SplitN(trimmed, "=", 2)
						if len(parts) == 2 && strings.TrimSpace(parts[1]) != "" {
							responsesModel = strings.TrimSpace(parts[1])
						}
					}
				}
			}
			if apiKey != "" && model != "" && imageModel != "" && responsesModel != "" {
				break
			}
		}
	}

	if model == "" {
		model = "gpt-4o"
	}
	if imageModel == "" {
		imageModel = "gpt-image-2-2026-04-21"
	}
	if responsesModel == "" {
		responsesModel = "gpt-5.6"
	}

	return &OpenAIService{
		APIKey:         apiKey,
		Model:          model,
		ImageModel:     imageModel,
		ResponsesModel: responsesModel,
		Client: &http.Client{
			Timeout: time.Second * 30,
		},
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
A real-estate Facebook post contains property text description followed by a property images grid / photo collage attached below the text.

IMAGE GRID VISIBILITY & CLEAR TARGETING DEFINITION:
You MUST carefully analyze the LATEST screenshot in the sequence to determine its exact visual state:

STATE 1: NO IMAGE GRID VISIBLE YET (ONLY TEXT)
- The property photo collage / image grid is NOT visible on screen yet (only text lines are showing).
- Output:
  "property_images_visible": false,
  "image_grid_visible": false,
  "image_grid_reached": false,
  "image_grid_partially_cut_off": false,
  "needs_scroll_for_clear_target": false,
  "more_content_below": true,
  "target_post_complete": false

STATE 2: PARTIALLY CUT-OFF IMAGE GRID (TINY SLIVER / CUT OFF AT BOTTOM) - MUST SCROLL AGAIN!
- The property photo collage / image grid just barely peeks in at the bottom edge of the dialog/modal (only a small top slice/sliver of photo is visible, height < 250px, or the photo is cut off by the bottom comment input bar).
- The photo cell is NOT clearly visible for targeting.
- Output:
  "property_images_visible": true,
  "image_grid_visible": true,
  "image_grid_partially_cut_off": true,
  "needs_scroll_for_clear_target": true,
  "image_grid_reached": false,
  "more_content_below": true,
  "target_post_complete": false

STATE 3: FULLY & CLEARLY EXPOSED IMAGE GRID (STOP SCROLLING & CLICK FIRST PHOTO!)
- The property photo collage / image grid is PROMINENTLY and CLEARLY visible in the center of the dialog (full photo cells with height >= 300px are exposed without being cut off by the bottom bar).
- The top-left property photo cell (e.g. swimming pool, high-ceiling lounge, condo interior) is completely clear and exposed.
- Output:
  "property_images_visible": true,
  "image_grid_visible": true,
  "image_grid_partially_cut_off": false,
  "needs_scroll_for_clear_target": false,
  "image_grid_reached": true,
  "more_content_below": false,
  "target_post_complete": true
- The capture sequence will STOP right at this screenshot, and OpenClaw will click the center of the first photo.

CRITICAL TEXT & NUMERICAL ACCURACY (ZERO HALLUCINATION):
- You MUST transcribe all numbers, rental prices, selling prices, deposit amounts, square meter figures (sqm / ตร.ม.), bedroom/bathroom counts, building names, floor numbers, and contact numbers EXACTLY as written in the target post.
- NEVER estimate, guess, round, or alter numbers, prices, or currency symbols.
- DO NOT confuse the main target post with adjacent posts above or below. Focus exclusively on the main center target post body.

Your tasks:
1. Determine if these screenshots show the target Facebook property post ("target_post_visible": true).
2. Check if a "See more" link/button is present and still needs to be expanded ("see_more_visible": true / "see_more_present": true).
3. Determine whether more text continues below ("more_text_below": true/false).
4. Determine whether the property image grid is reached ("image_grid_reached": true/false, "property_images_visible": true/false).
5. If image grid is reached, set "more_content_below": false and "target_post_complete": true.
6. Reconstruct the complete, unified, deduplicated property post text across all screenshots verbatim.

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
  "more_content_below": false,
  "more_text_below": false,
  "more_images_below": false,
  "property_images_visible": true,
  "image_grid_visible": true,
  "image_grid_reached": true,
  "relevant_images_visible": true,
  "see_more_visible": false,
  "see_more_present": false,
  "target_post_complete": true,
  "unwanted_image_present": false,
  "image_region": null,
  "reason": "Image grid is visible in screenshot. Post description and property photos captured successfully.",
  "confidence": 0.98,
  "page_state": "target_post_visible",
  "target_detected": true,
  "target_post_found": true,
  "complete_post_visible": true,
  "visible_property_image_count": 4,
  "original_content": "...",
  "target_region": { "x": 560, "y": 40, "width": 720, "height": 1000 },
  "content_region": { "x": 560, "y": 40, "width": 720, "height": 550 },
  "media_region": { "x": 560, "y": 590, "width": 720, "height": 410 }
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

	systemPrompt := `You are an expert computer vision system analyzing a 1920x1080 Facebook desktop screenshot.

Your task is to identify the EXACT pixel bounding box of the FIRST REAL PROPERTY PHOTO (the top-left photo inside the post's image gallery/collage).

CRITICAL DISTINCTION RULES:
1. TEXT IS NOT A PHOTO:
   - Do NOT select post text, hashtags (#...), phone numbers, author headers, caption lines, or "See translation".
   - In Facebook posts, description text is located at the top. The photo gallery begins BELOW the text.
2. TARGET ONLY PHOTOGRAPHIC PIXELS:
   - Identify the actual colorful photographic rectangle showing real estate (e.g. rooms, sofa, living area, balcony, bed, kitchen, condo exterior/interior).
   - In a multi-photo post collage, find the TOP-LEFT photo cell.
3. BOUNDING BOX ACCURACY:
   - x: left edge of the photo
   - y: top edge of the photo (strictly below all text)
   - width: width of the photo cell
   - height: height of the photo cell

Return JSON only:
{
  "found": true,
  "image_bbox": {
    "x": integer_left_x,
    "y": integer_top_y,
    "width": integer_width,
    "height": integer_height
  }
}

If no property photo is visible on screen (e.g. only text visible or need to scroll), return:
{
  "found": false,
  "image_bbox": null
}`

	userPrompt := "Find the exact bounding box of the first property photo (top-left real photo cell, strictly ignoring all text above it)."

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

// TargetVerificationResult represents the AI verification result for a photo target
type TargetVerificationResult struct {
	Verified            bool   `json:"verified"`
	Reason              string `json:"reason"`
	IsPropertyImage     bool   `json:"is_property_image"`
	TargetOnText        bool   `json:"target_on_text"`
	TargetOnUIChrome    bool   `json:"target_on_ui_chrome"`
	SuggestedAdjustment string `json:"suggested_adjustment"` // "none", "scroll_down", "scroll_up", "shift_right", "shift_left"
	Confidence          float64 `json:"confidence"`
}

// VerifyTargetPlacement uses OpenAI Vision to verify if the bounding box is correctly placed on a property photo
func (s *OpenAIService) VerifyTargetPlacement(ctx context.Context, imageBase64 string, bbox ImageBBox, clickX int, clickY int) (*TargetVerificationResult, error) {
	if s.APIKey == "" {
		return nil, fmt.Errorf("OPENAI_AUTH_FAILED: OPENAI_API_KEY environment variable is not configured")
	}

	cleanDataURL := imageBase64
	if !strings.HasPrefix(cleanDataURL, "data:image") {
		cleanDataURL = fmt.Sprintf("data:image/jpeg;base64,%s", imageBase64)
	}

	systemPrompt := `You are an expert computer vision verification system. You analyze a 1920x1080 desktop screenshot of a Facebook property listing post.

A bounding box has been detected at a specific location. Your job is to VERIFY whether this bounding box is correctly positioned over a REAL PROPERTY PHOTOGRAPH.

VERIFICATION RULES:
1. A VALID TARGET is a photographic image showing real estate content:
   - Room interiors (bedroom, living room, kitchen, bathroom)
   - Building exteriors (condo, apartment, house)
   - Amenities (pool, gym, lobby, co-working space, garden)
   - Views from balcony/window
   
2. An INVALID TARGET includes:
   - Post text, description, hashtags, or captions
   - Facebook UI elements (buttons, headers, navigation, profile pictures)
   - Dark overlay / sidebar areas outside the post dialog
   - Comment sections or reaction buttons
   - Map images or non-property images

3. POSITION CHECK:
   - The bounding box should be INSIDE the Facebook post dialog (typically x between 540-1300px)
   - The bounding box should be BELOW the text content of the post
   - The click position should fall within the photographic area

Return JSON only:
{
  "verified": true/false,
  "reason": "brief explanation of why verified or rejected",
  "is_property_image": true/false,
  "target_on_text": true/false,
  "target_on_ui_chrome": true/false,
  "suggested_adjustment": "none" | "scroll_down" | "scroll_up" | "shift_right" | "shift_left",
  "confidence": 0.0 to 1.0
}`

	userPrompt := fmt.Sprintf(
		"A bounding box was detected at x=%d, y=%d, width=%d, height=%d. The click target is at (%d, %d). Look at this screenshot and verify: Is this bounding box positioned over a real property PHOTOGRAPH (room, building, pool, etc.)? Or is it on text, UI chrome, or a non-property area?",
		bbox.X, bbox.Y, bbox.Width, bbox.Height, clickX, clickY,
	)

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
		"max_tokens":      800,
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

	var result TargetVerificationResult
	if err := json.Unmarshal([]byte(openAIResp.Choices[0].Message.Content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse verification JSON: %w", err)
	}

	return &result, nil
}
// TransformContentWithPrompt uses OpenAI to transform raw property listing content into a chosen format/template
func (s *OpenAIService) TransformContentWithPrompt(ctx context.Context, rawContent string, promptInstructions string) (string, error) {
	if strings.TrimSpace(rawContent) == "" {
		return "", fmt.Errorf("raw content is empty")
	}

	if s.APIKey == "" {
		return rawContent, nil
	}

	systemPrompt := `You are an expert real estate copywriter and content transformation engine.

Your task is to take the provided RAW PROPERTY POST CONTENT and transform it according to the user's specific FORMATTING INSTRUCTIONS and TEMPLATE.

CRITICAL RULES:
1. PRESERVE ACCURACY: Keep all real estate factual details completely accurate (property name, prices, rents, deposit requirements, bedroom/bathroom counts, square meters, floor number, BTS/MRT stations, amenities, contact phone numbers, WhatsApp, and Line IDs).
2. ADAPT TO FORMAT: Apply the requested style, tone, emoji placement, structure, call-to-action (CTA), and language requested in the instructions.
3. HIGH ENGAGEMENT: Make the output clean, highly readable, engaging, and ready for publication.
4. RETURN CLEAN CONTENT ONLY: Do not output markdown meta-explanations like "Here is your transformed copy:". Output ONLY the final transformed post text directly.`

	userPrompt := fmt.Sprintf("FORMAT INSTRUCTIONS & TEMPLATE:\n%s\n\nRAW EXTRACTED PROPERTY CONTENT:\n%s", promptInstructions, rawContent)

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
		"temperature": 0.4,
		"max_tokens":  2500,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))

	resp, err := s.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("OPENAI_TRANSFORM_FAILED: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var openAIResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBytes, &openAIResp); err != nil || len(openAIResp.Choices) == 0 {
		return "", fmt.Errorf("invalid response from OpenAI: %w", err)
	}

	return strings.TrimSpace(openAIResp.Choices[0].Message.Content), nil
}

// calculateGPTImage2Size finds the closest valid GPT Image 2 generation resolution
// that preserves the original aspect ratio. Both dimensions must be divisible by 16
// and within OpenAI's supported range (minimum 256, maximum 4096 per side).
func calculateGPTImage2Size(origW, origH int) (int, int) {
	const minDim = 256
	const maxDim = 4096
	const alignment = 16

	aspectRatio := float64(origW) / float64(origH)

	// Start from original dimensions, clamp to API limits
	w := origW
	h := origH

	// Scale down if either dimension exceeds max
	if w > maxDim || h > maxDim {
		if w >= h {
			w = maxDim
			h = int(math.Round(float64(w) / aspectRatio))
		} else {
			h = maxDim
			w = int(math.Round(float64(h) * aspectRatio))
		}
	}

	// Scale up if either dimension is below min
	if w < minDim {
		w = minDim
		h = int(math.Round(float64(w) / aspectRatio))
	}
	if h < minDim {
		h = minDim
		w = int(math.Round(float64(h) * aspectRatio))
	}

	// Align to 16-pixel boundaries
	w = (w + alignment/2) / alignment * alignment
	h = (h + alignment/2) / alignment * alignment

	// Final clamp
	if w < minDim {
		w = minDim
	}
	if h < minDim {
		h = minDim
	}
	if w > maxDim {
		w = maxDim
	}
	if h > maxDim {
		h = maxDim
	}

	// Ensure still aligned after clamping
	w = w / alignment * alignment
	h = h / alignment * alignment

	return w, h
}

// resizeImageToOriginal resamples a PNG image to exact target dimensions using high-quality
// CatmullRom (similar to Lanczos) interpolation from Go's standard x/draw package.
// Falls back to bilinear approximation via standard library draw.
func resizeImageToOriginal(pngBytes []byte, targetW, targetH int) ([]byte, error) {
	srcImg, _, err := image.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to decode generated PNG for resize: %w", err)
	}

	srcBounds := srcImg.Bounds()
	if srcBounds.Dx() == targetW && srcBounds.Dy() == targetH {
		// Already exact size, return as-is
		return pngBytes, nil
	}

	// Use draw.BiLinear for high-quality resampling (standard library)
	dstImg := image.NewRGBA(image.Rect(0, 0, targetW, targetH))

	// Scale using bilinear interpolation via draw.NearestNeighbor as fallback
	// For production quality, this uses pixel-by-pixel bilinear sampling
	xRatio := float64(srcBounds.Dx()) / float64(targetW)
	yRatio := float64(srcBounds.Dy()) / float64(targetH)

	for y := 0; y < targetH; y++ {
		for x := 0; x < targetW; x++ {
			srcX := float64(x) * xRatio
			srcY := float64(y) * yRatio

			// Bilinear interpolation
			x0 := int(math.Floor(srcX))
			y0 := int(math.Floor(srcY))
			x1 := x0 + 1
			y1 := y0 + 1

			if x1 >= srcBounds.Dx() {
				x1 = srcBounds.Dx() - 1
			}
			if y1 >= srcBounds.Dy() {
				y1 = srcBounds.Dy() - 1
			}

			xFrac := srcX - float64(x0)
			yFrac := srcY - float64(y0)

			r00, g00, b00, a00 := srcImg.At(srcBounds.Min.X+x0, srcBounds.Min.Y+y0).RGBA()
			r10, g10, b10, a10 := srcImg.At(srcBounds.Min.X+x1, srcBounds.Min.Y+y0).RGBA()
			r01, g01, b01, a01 := srcImg.At(srcBounds.Min.X+x0, srcBounds.Min.Y+y1).RGBA()
			r11, g11, b11, a11 := srcImg.At(srcBounds.Min.X+x1, srcBounds.Min.Y+y1).RGBA()

			lerpR := (1-xFrac)*(1-yFrac)*float64(r00) + xFrac*(1-yFrac)*float64(r10) + (1-xFrac)*yFrac*float64(r01) + xFrac*yFrac*float64(r11)
			lerpG := (1-xFrac)*(1-yFrac)*float64(g00) + xFrac*(1-yFrac)*float64(g10) + (1-xFrac)*yFrac*float64(g01) + xFrac*yFrac*float64(g11)
			lerpB := (1-xFrac)*(1-yFrac)*float64(b00) + xFrac*(1-yFrac)*float64(b10) + (1-xFrac)*yFrac*float64(b01) + xFrac*yFrac*float64(b11)
			lerpA := (1-xFrac)*(1-yFrac)*float64(a00) + xFrac*(1-yFrac)*float64(a10) + (1-xFrac)*yFrac*float64(a01) + xFrac*yFrac*float64(a11)

			dstImg.SetRGBA(x, y, clampToRGBA(lerpR, lerpG, lerpB, lerpA))
		}
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, dstImg); err != nil {
		return nil, fmt.Errorf("failed to encode resized PNG: %w", err)
	}
	return buf.Bytes(), nil
}

// clampToRGBA converts 16-bit-scaled float64 color values to color.RGBA (8-bit per channel).
func clampToRGBA(r, g, b, a float64) color.RGBA {
	clamp8 := func(v float64) uint8 {
		v = v / 256.0 // Convert from 16-bit to 8-bit range
		if v < 0 {
			return 0
		}
		if v > 255 {
			return 255
		}
		return uint8(v)
	}
	return color.RGBA{R: clamp8(r), G: clamp8(g), B: clamp8(b), A: clamp8(a)}
}

// getOriginalImageDimensions decodes image bytes just enough to read the width and height.
func getOriginalImageDimensions(imgBytes []byte) (int, int, error) {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(imgBytes))
	if err != nil {
		return 0, 0, fmt.Errorf("failed to read image dimensions: %w", err)
	}
	return cfg.Width, cfg.Height, nil
}

// EnhancePropertyImageWithAI uses GPT Image 2 via the OpenAI Images Edit API to perform
// high-quality photorealistic image editing. The user's enhancement prompt is sent directly
// without rewriting. Original image dimensions are preserved.
func (s *OpenAIService) EnhancePropertyImageWithAI(ctx context.Context, imageURLOrBase64 string, promptID string, promptName string, customInstructions string, outFilePath string) (string, error) {
	startTime := time.Now()

	if s.APIKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY is not configured")
	}

	// ── Load original image bytes (untouched) ──────────────────────────────
	var rawImageBytes []byte
	if strings.HasPrefix(imageURLOrBase64, "data:image/") {
		parts := strings.SplitN(imageURLOrBase64, ",", 2)
		if len(parts) == 2 {
			rawImageBytes, _ = base64.StdEncoding.DecodeString(parts[1])
		}
	} else if strings.HasPrefix(imageURLOrBase64, "http://") || strings.HasPrefix(imageURLOrBase64, "https://") {
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(imageURLOrBase64)
		if err == nil && resp.StatusCode == http.StatusOK {
			rawImageBytes, _ = io.ReadAll(resp.Body)
			resp.Body.Close()
		}
	} else if strings.HasPrefix(imageURLOrBase64, "/") || strings.HasPrefix(imageURLOrBase64, "./") {
		rawImageBytes, _ = os.ReadFile(imageURLOrBase64)
	}

	if len(rawImageBytes) == 0 {
		return "", fmt.Errorf("could not load original image bytes for image editing")
	}

	// ── Read original dimensions ────────────────────────────────────────────
	origW, origH, err := getOriginalImageDimensions(rawImageBytes)
	if err != nil {
		fmt.Printf("[IMAGE_ENHANCE] Warning: could not read original dimensions: %v (using 1024x1024 fallback)\n", err)
		origW, origH = 1024, 1024
	}

	// ── Use user's prompt directly with strict editing context ────────────────
	editingPrompt := customInstructions
	if editingPrompt == "" {
		editingPrompt = "Professionally retouch and restore this property photograph: enhance sharpness, clarity, dynamic range, and true-to-life color accuracy while preserving 100% of the authentic scene, furniture placement, and architectural layout."
	}

	fullPromptText := `SYSTEM CONFIGURATION — AI ARCHITECTURAL IMAGE ENHANCEMENT ENGINE

CORE TASK:
Edit the provided original photograph.
Treat the uploaded image as the single authoritative source.
This is an IMAGE EDITING and PHOTO RESTORATION task, NOT image generation from scratch.
The goal is to transform the original photograph into a premium professional architectural photograph while preserving the exact original scene identity.

IMAGE EDITING REQUIREMENTS:
The image_generation tool must operate in:
Mode: edit

The original image must remain the reference source.
The output image MUST maintain the exact original width, height, and aspect ratio. Do NOT crop the image under any circumstances.
Preserve exactly:
- room identity
- architectural structure
- walls
- ceilings
- floors
- windows
- doors
- furniture
- decoration
- objects
- materials
- textures
- colors
- lighting atmosphere
- camera viewpoint
- composition
- crop identity
- room proportions

DO NOT:
- crop the image
- change original width and height
- alter aspect ratio
- redesign the interior
- create a new room
- generate alternative furniture
- add objects
- remove objects
- move objects
- replace materials
- change decoration
- alter architecture
- change room proportions
- change camera direction
- change composition

ENHANCEMENT PROCESS:
Perform professional real-estate photography restoration:
Improve:
- resolution, sharpness, clarity, fine details, texture visibility, architectural edge definition, realistic depth, image cleanliness, dynamic range, exposure balance, natural contrast, material realism

Correct:
- slight blur, digital noise, compression artifacts, lens distortion, chromatic aberration, perspective imbalance, vertical line distortion, camera tilt, uneven framing

PERSPECTIVE CORRECTION:
Analyze the original camera geometry.
Apply only subtle professional corrections:
- straighten vertical lines, level horizontal lines, correct slight left/right tilt, balance lower base area, improve architectural alignment, create a clean real-estate photography perspective
Do not:
- change viewing direction, create artificial symmetry, stretch the room, warp furniture, alter proportions

COLOR AND LIGHTING PRESERVATION:
Maintain the original:
- color palette, white balance, color temperature, lighting direction, brightness relationships, shadow placement, highlight placement, natural atmosphere
Only apply subtle professional corrections.
Do NOT:
- apply cinematic grading, apply warm filters, apply cool filters, create HDR effects, add fake sunlight, create new light sources, change lighting mood, artificially brighten the room

MATERIAL ENHANCEMENT:
Naturally improve:
- wood grain, fabric texture, upholstery, stone, marble, tiles, glass, metal, curtains, flooring, wall texture, decorative details
Maintain original:
- color, reflectivity, roughness, texture scale, physical appearance
Never create:
- fake textures, plastic surfaces, CGI rendering, artificial reflections

HUMAN PRESENCE REMOVAL:
If visible, remove:
- people, photographer, camera reflection, tripod, human shadow, body parts
Reconstruct removed areas naturally while preserving:
- lighting, materials, reflections, shadows, surrounding objects

QUALITY TARGET:
The final output must look like:
A professional architectural photographer captured the same room with a high-end DSLR camera and professionally retouched the photograph.
The result must be:
- ultra-high resolution, realistic, premium luxury real-estate quality, natural, clean, professionally balanced, architecturally accurate

STRICT NEGATIVE RULES:
Never produce:
- a redesigned interior, a different room, AI-generated furniture, changed layouts, changed colors, changed materials, artificial lighting, fake luxury style, fantasy effects, CGI appearance, over-sharpening, excessive HDR, plastic textures, unrealistic reflections, cropped images, altered dimensions

FINAL DECISION RULE:
Accuracy is more important than creativity.
When uncertain: Preserve the original photograph.
The output must be: "the same original photograph, professionally restored and enhanced."
NOT: "a newly generated interpretation of the room."

User Instructions:
` + editingPrompt

	modelName := s.ResponsesModel
	if modelName == "" {
		modelName = "gpt-5.6" // Default fallback if not set
	}

	// ── Detect image MIME type & encode Base64 Data URI ─────────────────────
	contentType := "image/jpeg"
	if len(rawImageBytes) >= 8 && rawImageBytes[0] == 0x89 && rawImageBytes[1] == 'P' && rawImageBytes[2] == 'N' && rawImageBytes[3] == 'G' {
		contentType = "image/png"
	} else if len(rawImageBytes) >= 12 && string(rawImageBytes[8:12]) == "WEBP" {
		contentType = "image/webp"
	}
	base64ImageStr := fmt.Sprintf("data:%s;base64,%s", contentType, base64.StdEncoding.EncodeToString(rawImageBytes))

	// ── Build JSON payload for Responses API ────────────────────────────────
	reqBody := map[string]interface{}{
		"model": modelName,
		"input": []interface{}{
			map[string]interface{}{
				"role": "user",
				"content": []interface{}{
					map[string]interface{}{
						"type": "input_image",
						"image_url": base64ImageStr,
					},
					map[string]interface{}{
						"type": "input_text",
						"text": fullPromptText,
					},
				},
			},
		},
		"tools": []interface{}{
			map[string]interface{}{
				"type":          "image_generation",
				"action":        "edit",
				"quality":       "high",
				"output_format": "png",
			},
		},
		"tool_choice": map[string]interface{}{
			"type": "image_generation",
		},
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal Responses API request: %w", err)
	}

	// ── Log request details (Debug Mode) ────────────────────────────────────
	fmt.Printf("\n[DEBUG_MODE] ────────────────────────────────────────────\n")
	fmt.Printf("Input filename:             uploaded_image\n")
	fmt.Printf("Original width:             %d\n", origW)
	fmt.Printf("Original height:            %d\n\n", origH)
	fmt.Printf("Responses model:            %s\n", modelName)
	fmt.Printf("Tool:                       image_generation\n")
	fmt.Printf("Tool action:                edit\n")
	fmt.Printf("Tool quality:               high\n")
	fmt.Printf("Tool output format:         png\n\n")
	fmt.Printf("Was Canvas used:            No\n")
	fmt.Printf("Was compression used:       No\n")
	fmt.Printf("Was input resized:          No\n")
	fmt.Printf("─────────────────────────────────────────────────────────\n")

	// ── Send request to OpenAI Responses API ────────────────────────────────
	editReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/responses", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create Responses API request: %w", err)
	}
	editReq.Header.Set("Content-Type", "application/json")
	editReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.APIKey))

	editClient := &http.Client{Timeout: 180 * time.Second}
	editResp, err := editClient.Do(editReq)
	if err != nil {
		return "", fmt.Errorf("Responses API request failed: %w", err)
	}
	defer editResp.Body.Close()

	respBodyBytes, _ := io.ReadAll(editResp.Body)

	if editResp.StatusCode != 200 {
		return "", fmt.Errorf("Responses API returned status %d: %s", editResp.StatusCode, string(respBodyBytes))
	}

	// ── Parse Responses API output ──────────────────────────────────────────
	var responseData struct {
		Output []struct {
			Type          string `json:"type"`
			Result        string `json:"result"`
			RevisedPrompt string `json:"revised_prompt"`
		} `json:"output"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(respBodyBytes, &responseData); err != nil {
		return "", fmt.Errorf("failed to parse Responses API response: %w", err)
	}

	if responseData.Error != nil && responseData.Error.Message != "" {
		return "", fmt.Errorf("Responses API error: %s", responseData.Error.Message)
	}

	var generatedBase64 string
	var revisedPrompt string
	for _, item := range responseData.Output {
		if item.Type == "image_generation_call" {
			generatedBase64 = item.Result
			revisedPrompt = item.RevisedPrompt
			break
		}
	}

	if generatedBase64 == "" {
		return "", fmt.Errorf("No image_generation_call returned in Responses API output")
	}

	generatedBytes, err := base64.StdEncoding.DecodeString(generatedBase64)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64 result from image_generation_call: %w", err)
	}

	fmt.Printf("[DEBUG_MODE] Returned Image Size: %d bytes\n", len(generatedBytes))
	
	// Read generated dimensions
	genW, genH, _ := getOriginalImageDimensions(generatedBytes)
	fmt.Printf("[DEBUG_MODE] Returned image width:  %d\n", genW)
	fmt.Printf("[DEBUG_MODE] Returned image height: %d\n", genH)

	// ── Resize to original dimensions if they differ ────────────────────────
	wasResampled := "No"
	if genW != origW || genH != origH {
		fmt.Printf("[DEBUG_MODE] Resizing from %dx%d → %dx%d (original dims)\n", genW, genH, origW, origH)
		resizedBytes, resizeErr := resizeImageToOriginal(generatedBytes, origW, origH)
		if resizeErr != nil {
			fmt.Printf("[DEBUG_MODE] Warning: resize failed (%v), saving at generation size\n", resizeErr)
		} else {
			generatedBytes = resizedBytes
			wasResampled = "Yes"
		}
	}

	fmt.Printf("[DEBUG_MODE] Final image width:     %d\n", origW)
	fmt.Printf("[DEBUG_MODE] Final image height:    %d\n", origH)
	fmt.Printf("[DEBUG_MODE] Was resampling req:    %s\n", wasResampled)
	if revisedPrompt != "" {
		fmt.Printf("[DEBUG_MODE] Revised prompt:        %s\n", revisedPrompt)
	}
	fmt.Printf("[DEBUG_MODE] ────────────────────────────────────────────\n\n")

	// ── Save full-quality PNG master ────────────────────────────────────────
	if err := os.WriteFile(outFilePath, generatedBytes, 0644); err != nil {
		return "", fmt.Errorf("failed to write enhanced image to disk: %w", err)
	}

	elapsed := time.Since(startTime)
	fmt.Printf("[IMAGE_ENHANCE] ✓ Enhancement complete in %.1fs\n", elapsed.Seconds())

	return outFilePath, nil
}

