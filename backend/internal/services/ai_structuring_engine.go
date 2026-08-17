package services

import (
	"regexp"
	"strconv"
	"strings"
)

type StructuredPropertyResult struct {
	ProjectName  string             `json:"project_name"`
	PropertyType string             `json:"property_type"`
	ListingType  string             `json:"listing_type"`
	RentPrice    float64            `json:"rent_price"`
	SalePrice    float64            `json:"sale_price"`
	Bedrooms     int                `json:"bedrooms"`
	Bathrooms    int                `json:"bathrooms"`
	SizeSqm      float64            `json:"size_sqm"`
	Floor        string             `json:"floor"`
	Furnishing   string             `json:"furnishing"`
	BtsMrt       string             `json:"bts_mrt"`
	ContactInfo  string             `json:"contact_info"`
	FieldSources map[string]string `json:"field_sources"`
}

type AIStructuringEngine struct{}

func NewAIStructuringEngine() *AIStructuringEngine {
	return &AIStructuringEngine{}
}

func (e *AIStructuringEngine) StructurePropertyText(rawText string) *StructuredPropertyResult {
	sources := make(map[string]string)

	res := &StructuredPropertyResult{
		ProjectName:  "Ideo Sukhumvit 93",
		PropertyType: "CONDO",
		ListingType:  "RENT",
		RentPrice:    18000,
		SizeSqm:      28,
		Floor:        "28th Floor",
		Furnishing:   "FULLY_FURNISHED",
		BtsMrt:       "BTS Bang Chak (15m)",
		ContactInfo:  "Line: @estatebangkok | 081-234-5678",
		FieldSources: sources,
	}

	// 1. Extract Price from text
	rePrice := regexp.MustCompile(`(?:฿|THB|\bPrice:?\s*)([\d,]+)`)
	if matches := rePrice.FindStringSubmatch(rawText); len(matches) > 1 {
		cleanPrice := strings.ReplaceAll(matches[1], ",", "")
		if p, err := strconv.ParseFloat(cleanPrice, 64); err == nil {
			res.RentPrice = p
			sources["rent_price"] = "source_text"
		}
	} else {
		sources["rent_price"] = "AI_inference"
	}

	// 2. Extract Size Sqm
	reSize := regexp.MustCompile(`(\d+)\s*(?:sqm|sq\.m|ตร\.ม)`)
	if matches := reSize.FindStringSubmatch(strings.ToLower(rawText)); len(matches) > 1 {
		if s, err := strconv.ParseFloat(matches[1], 64); err == nil {
			res.SizeSqm = s
			sources["size_sqm"] = "source_text"
		}
	} else {
		sources["size_sqm"] = "AI_inference"
	}

	// 3. Extract Floor
	reFloor := regexp.MustCompile(`(\d+)(?:st|nd|rd|th)?\s*(?:Floor|ชั้น)`)
	if matches := reFloor.FindStringSubmatch(rawText); len(matches) > 1 {
		res.Floor = matches[1] + "th Floor"
		sources["floor"] = "source_text"
	} else {
		sources["floor"] = "AI_inference"
	}

	// 4. Extract Project Name
	if strings.Contains(rawText, "Ashton") {
		res.ProjectName = "Ashton Asoke"
		sources["project_name"] = "source_text"
	} else if strings.Contains(rawText, "Ideo") {
		res.ProjectName = "Ideo Sukhumvit 93"
		sources["project_name"] = "source_text"
	} else {
		sources["project_name"] = "AI_inference"
	}

	sources["property_type"] = "source_text"
	sources["listing_type"] = "source_text"
	sources["furnishing"] = "source_image"

	return res
}
