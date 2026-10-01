package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/zinwaishine/estate-automate/backend/internal/models"
)

type PropertyAIExtractor struct {
	httpClient *http.Client
}

func NewPropertyAIExtractor() *PropertyAIExtractor {
	return &PropertyAIExtractor{
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// DetectLanguages detects Thai, English, Burmese/Myanmar and other languages in caption
func (e *PropertyAIExtractor) DetectLanguages(text string) []string {
	var langs []string
	hasThai := false
	hasMyanmar := false
	hasEnglish := false

	for _, r := range text {
		if unicode.In(r, unicode.Thai) {
			hasThai = true
		} else if r >= 0x1000 && r <= 0x109F {
			hasMyanmar = true
		} else if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			hasEnglish = true
		}
	}

	if hasThai {
		langs = append(langs, "Thai")
	}
	if hasMyanmar {
		langs = append(langs, "Myanmar")
	}
	if hasEnglish {
		langs = append(langs, "English")
	}
	if len(langs) == 0 {
		langs = append(langs, "Unknown")
	}
	return langs
}

// ExtractPropertyDetails parses raw caption and images into structured PropertyDetails
func (e *PropertyAIExtractor) ExtractPropertyDetails(caption string, images []models.ExtractedImage, source *models.SourceDetails) (*models.FacebookImportResult, error) {
	languages := e.DetectLanguages(caption)

	// Result container preserving original Unicode caption
	result := &models.FacebookImportResult{
		Caption: models.CaptionDetails{
			Original:         caption,
			LanguageDetected: languages,
			Cleaned:          strings.TrimSpace(caption),
		},
		Images: images,
		Property: models.PropertyDetails{
			Currency: "THB",
		},
		Features: []string{},
		Confidence: models.ConfidenceDetails{
			ProjectName: 0.0,
			Price:       0.0,
			Bedrooms:    0.0,
			SizeSqm:     0.0,
		},
	}

	if source != nil {
		result.Source = *source
	}

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey != "" {
		aiResult, err := e.callOpenAIExtraction(caption, apiKey)
		if err == nil && aiResult != nil {
			result.Property = aiResult.Property
			result.Features = aiResult.Features
			result.Contact = aiResult.Contact
			result.Confidence = aiResult.Confidence
			if aiResult.Caption.Cleaned != "" {
				result.Caption.Cleaned = aiResult.Caption.Cleaned
			}
			return result, nil
		}
	}

	// Fallback to deterministic regex & semantic parser
	e.heuristicParse(caption, result)
	return result, nil
}

func (e *PropertyAIExtractor) callOpenAIExtraction(caption string, apiKey string) (*models.FacebookImportResult, error) {
	systemPrompt := `You are an expert real estate data extraction AI for Southeast Asia (Thailand).
CRITICAL RULES:
1. NEVER invent, hallucinate, or assume property facts.
2. If information is missing or unclear, you MUST return null.
3. Do NOT guess floor, size, building, price, project, or bedroom count unless explicitly supported in text.
4. Multilingual support: Captions may contain Thai, English, or Burmese/Myanmar. Preserve accurate understanding.
5. Return JSON matching the exact schema.`

	userPrompt := fmt.Sprintf(`Extract property listing attributes from this Facebook post caption:
"""
%s
"""

Return a valid JSON object matching this schema:
{
  "property": {
    "project_name": string or null,
    "listing_type": "RENT" or "SALE" or "RENT_AND_SALE" or null,
    "price": number or null,
    "currency": "THB",
    "bedrooms": number or null,
    "bathrooms": number or null,
    "size_sqm": number or null,
    "floor": string or null,
    "building": string or null,
    "unit_number": string or null,
    "furnished": string or null,
    "nearest_transit": string or null,
    "location": string or null,
    "move_in_status": string or null
  },
  "features": [string],
  "contact": {
    "name": string or null,
    "phone": string or null,
    "line": string or null
  },
  "caption": {
    "cleaned": string
  },
  "confidence": {
    "project_name": number between 0 and 1,
    "price": number between 0 and 1,
    "bedrooms": number between 0 and 1,
    "size_sqm": number between 0 and 1
  }
}`, caption)

	payload := map[string]any{
		"model": "gpt-4o",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"response_format": map[string]string{"type": "json_object"},
		"temperature":     0.1,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(context.Background(), "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("openai returned status %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(bodyBytes, &chatResp); err != nil || len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("failed to parse openai chat response")
	}

	content := chatResp.Choices[0].Message.Content
	var parsed models.FacebookImportResult
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return nil, err
	}

	return &parsed, nil
}

// heuristicParse applies regex & semantic extraction when offline or as fallback
func (e *PropertyAIExtractor) heuristicParse(caption string, out *models.FacebookImportResult) {
	lower := strings.ToLower(caption)

	// Listing type
	if strings.Contains(lower, "ให้เช่า") || strings.Contains(lower, "for rent") || strings.Contains(lower, "เช่า") {
		rent := "RENT"
		out.Property.ListingType = &rent
	} else if strings.Contains(lower, "ขาย") || strings.Contains(lower, "for sale") {
		sale := "SALE"
		out.Property.ListingType = &sale
	}

	// Price extraction
	rePrice := regexp.MustCompile(`(?i)(?:ราคา|ค่าเช่า|rent|price|เพียง)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,8})\s*(?:บาท|baht|thb|.-|\/เดือน|\/mo|k)`)
	if m := rePrice.FindStringSubmatch(caption); len(m) > 1 {
		cleanedNum := strings.ReplaceAll(m[1], ",", "")
		if val, err := strconv.ParseFloat(cleanedNum, 64); err == nil && val > 1000 {
			out.Property.Price = &val
			out.Confidence.Price = 0.95
		}
	}

	// Bedrooms
	reBed := regexp.MustCompile(`(?i)([0-9])\s*(?:ห้องนอน|bed|bedroom|bed room|br)`)
	if m := reBed.FindStringSubmatch(caption); len(m) > 1 {
		if beds, err := strconv.Atoi(m[1]); err == nil {
			out.Property.Bedrooms = &beds
			out.Confidence.Bedrooms = 0.95
		}
	} else if strings.Contains(lower, "studio") || strings.Contains(lower, "สตูดิโอ") {
		studio := 0
		out.Property.Bedrooms = &studio
		out.Confidence.Bedrooms = 0.9
	}

	// Bathrooms
	reBath := regexp.MustCompile(`(?i)([0-9])\s*(?:ห้องน้ำ|bath|bathroom|ba)`)
	if m := reBath.FindStringSubmatch(caption); len(m) > 1 {
		if baths, err := strconv.Atoi(m[1]); err == nil {
			out.Property.Bathrooms = &baths
		}
	}

	// Size Sqm
	reSize := regexp.MustCompile(`(?i)([0-9]+(?:\.[0-9]+)?)\s*(?:ตร\.ม\.|ตรม|sqm|sq\.m|sq\.m\.)`)
	if m := reSize.FindStringSubmatch(caption); len(m) > 1 {
		if sizeVal, err := strconv.ParseFloat(m[1], 64); err == nil && sizeVal > 10 {
			out.Property.SizeSqm = &sizeVal
			out.Confidence.SizeSqm = 0.95
		}
	}

	// Floor
	reFloor := regexp.MustCompile(`(?i)(?:ชั้น|floor|fl\.)\s*([0-9A-Za-z]+)`)
	if m := reFloor.FindStringSubmatch(caption); len(m) > 1 {
		fl := m[1]
		out.Property.Floor = &fl
	}

	// Nearest Transit (BTS / MRT)
	reTransit := regexp.MustCompile(`(?i)(?:bts|mrt)\s*([A-Za-zก-๙\s0-9]+?)(?:[\n,\.]|เพียง|ใกล้|\()`)
	if m := reTransit.FindStringSubmatch(caption); len(m) > 1 {
		transit := strings.TrimSpace(m[0])
		out.Property.NearestTransit = &transit
	}

	// Project Name detection
	reProject := regexp.MustCompile(`(?i)(?:โครงการ|condo|คอนโด|คอนโดมิเนียม)\s*([A-Za-z0-9\s]+?)(?:[\n,]|ขนาด|ชั้น|ราคา)`)
	if m := reProject.FindStringSubmatch(caption); len(m) > 1 {
		proj := strings.TrimSpace(m[1])
		if len(proj) > 2 {
			out.Property.ProjectName = &proj
			out.Confidence.ProjectName = 0.85
		}
	} else {
		// First line fallback if looks like title
		lines := strings.Split(caption, "\n")
		if len(lines) > 0 {
			firstLine := strings.TrimSpace(lines[0])
			if len(firstLine) > 5 && len(firstLine) < 80 {
				out.Property.ProjectName = &firstLine
				out.Confidence.ProjectName = 0.70
			}
		}
	}

	// Contact phone
	rePhone := regexp.MustCompile(`(?i)(?:โทร|tel|contact|เบอร์|call)\s*[:.]?\s*([0-9]{3}[-\s]?[0-9]{3}[-\s]?[0-9]{4}|[0-9]{9,10})`)
	if m := rePhone.FindStringSubmatch(caption); len(m) > 1 {
		phone := strings.TrimSpace(m[1])
		out.Contact.Phone = &phone
	}

	// Contact Line ID
	reLine := regexp.MustCompile(`(?i)(?:line|line\s*id)\s*[:.]?\s*(@?[A-Za-z0-9_.-]+)`)
	if m := reLine.FindStringSubmatch(caption); len(m) > 1 {
		line := strings.TrimSpace(m[1])
		out.Contact.Line = &line
	}
}
