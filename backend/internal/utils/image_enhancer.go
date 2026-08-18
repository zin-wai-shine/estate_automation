package utils

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	_ "image/png"
	"math"
	"net/http"
	"os"
	"strings"
	"time"
)

// Preset options
const (
	PresetBrightAiry     = "bright_airy"
	PresetHDRInterior    = "hdr_interior"
	PresetSunsetGolden   = "sunset_golden"
	PresetCrispSharpen   = "crisp_sharpen"
	PresetSkyContrast    = "sky_contrast"
	PresetVibrantNatural = "vibrant_natural"
)

// ProcessAndSaveEnhancedImage downloads an image, applies visual enhancements, and saves it to disk.
func ProcessAndSaveEnhancedImage(imageURL string, outputFilePath string, presetID string, customInstructions string) error {
	img, err := fetchImage(imageURL)
	if err != nil {
		return fmt.Errorf("failed to fetch source image: %w", err)
	}

	enhanced := EnhancePropertyImage(img, presetID, customInstructions)

	outFile, err := os.Create(outputFilePath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %w", err)
	}
	defer outFile.Close()

	// Encode at 95% JPEG quality for ultra-sharp real estate photography
	return jpeg.Encode(outFile, enhanced, &jpeg.Options{Quality: 95})
}

// fetchImage loads image from URL, data URI, or local file
func fetchImage(src string) (image.Image, error) {
	if strings.HasPrefix(src, "data:image/") {
		parts := strings.SplitN(src, ",", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid base64 image data")
		}
		data, err := base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			return nil, err
		}
		img, _, err := image.Decode(bytes.NewReader(data))
		return img, err
	}

	if strings.HasPrefix(src, "http://") || strings.HasPrefix(src, "https://") {
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(src)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("HTTP error %d downloading image", resp.StatusCode)
		}
		img, _, err := image.Decode(resp.Body)
		return img, err
	}

	// Local file
	f, err := os.Open(src)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	img, _, err := image.Decode(f)
	return img, err
}

// EnhancePropertyImage applies computational photography enhancements based on preset or custom instructions
func EnhancePropertyImage(src image.Image, presetID string, customInstructions string) image.Image {
	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	dst := image.NewRGBA(bounds)

	// Determine enhancement parameters based on preset
	var (
		shadowLift   float64 = 0.15 // Lift dark regions
		brightness   float64 = 0.08 // Exposure boost
		contrast     float64 = 1.14 // Contrast curve
		satBoost     float64 = 1.15 // Vibrancy
		warmthRed    float64 = 1.04 // Red shift
		warmthGreen  float64 = 1.02 // Green shift
		warmthBlue   float64 = 0.98 // Blue reduction
		applySharpen bool    = true
		sharpenLevel float64 = 0.35 // Unsharp mask strength
	)

	lowerPreset := strings.ToLower(presetID)
	lowerInstructions := strings.ToLower(customInstructions)

	if strings.Contains(lowerPreset, "bright") || strings.Contains(lowerInstructions, "bright") || strings.Contains(lowerInstructions, "light") {
		shadowLift = 0.22
		brightness = 0.14
		contrast = 1.12
		satBoost = 1.10
		warmthRed = 1.02
		warmthGreen = 1.01
		warmthBlue = 1.00
		sharpenLevel = 0.30
	} else if strings.Contains(lowerPreset, "hdr") || strings.Contains(lowerPreset, "interior") || strings.Contains(lowerInstructions, "interior") || strings.Contains(lowerInstructions, "hdr") {
		shadowLift = 0.25
		brightness = 0.06
		contrast = 1.20
		satBoost = 1.22
		warmthRed = 1.08
		warmthGreen = 1.03
		warmthBlue = 0.95
		sharpenLevel = 0.40
	} else if strings.Contains(lowerPreset, "sunset") || strings.Contains(lowerPreset, "golden") || strings.Contains(lowerInstructions, "sunset") || strings.Contains(lowerInstructions, "golden") {
		shadowLift = 0.12
		brightness = 0.05
		contrast = 1.18
		satBoost = 1.28
		warmthRed = 1.15
		warmthGreen = 1.05
		warmthBlue = 0.88
		sharpenLevel = 0.30
	} else if strings.Contains(lowerPreset, "crisp") || strings.Contains(lowerPreset, "sharpen") || strings.Contains(lowerInstructions, "sharp") || strings.Contains(lowerInstructions, "4k") {
		shadowLift = 0.10
		brightness = 0.05
		contrast = 1.15
		satBoost = 1.10
		warmthRed = 1.01
		warmthGreen = 1.01
		warmthBlue = 1.00
		sharpenLevel = 0.60
	} else if strings.Contains(lowerPreset, "sky") || strings.Contains(lowerInstructions, "sky") {
		shadowLift = 0.18
		brightness = 0.10
		contrast = 1.22
		satBoost = 1.25
		warmthRed = 0.98
		warmthGreen = 1.02
		warmthBlue = 1.10
		sharpenLevel = 0.40
	} else {
		// Vibrant Natural / Custom modifier default (e.g. "Image Modifiler")
		shadowLift = 0.18
		brightness = 0.08
		contrast = 1.16
		satBoost = 1.20
		warmthRed = 1.03
		warmthGreen = 1.01
		warmthBlue = 0.99
		sharpenLevel = 0.35
	}

	// 1. Pixel-level tone-curve, intelligent sky dehazing, and warm sunlight grading
	for y := 0; y < height; y++ {
		normY := float64(y) / float64(height)
		for x := 0; x < width; x++ {
			normX := float64(x) / float64(width)

			r, g, b, a := src.At(bounds.Min.X+x, bounds.Min.Y+y).RGBA()
			rf := float64(r >> 8) / 255.0
			gf := float64(g >> 8) / 255.0
			bf := float64(b >> 8) / 255.0

			// Calculate luminance
			lum := 0.299*rf + 0.587*gf + 0.114*bf

			// A. Intelligent Sky & Window HDR Dehazing
			// Detects bright overexposed/washed-out window/sky regions (upper center/balcony)
			isSkyRegion := lum > 0.65 && normY < 0.65 && (bf >= rf-0.10)
			if isSkyRegion {
				// Dehaze & restore deep azure sky blue + cloud contrast
				skyFactor := (lum - 0.65) / 0.35
				rf -= 0.16 * skyFactor
				gf -= 0.04 * skyFactor
				bf += 0.14 * skyFactor
			}

			// B. Deepen Shadow Blacks (removes washed-out haze from dark areas)
			if lum < 0.35 {
				shadowDarken := math.Pow(lum/0.35, 1.4)
				rf *= shadowDarken
				gf *= shadowDarken
				bf *= shadowDarken
			} else {
				// Shadow lift on lower-mid tones
				shadowWeight := math.Max(0.0, 1.0-lum*1.4)
				rf += shadowLift * shadowWeight * rf
				gf += shadowLift * shadowWeight * gf
				bf += shadowLift * shadowWeight * bf
			}

			// C. Natural Sunlight Ray Gradient (warms the right wall/floor where sun enters)
			if normX > 0.45 && normY > 0.25 && lum > 0.35 && lum < 0.90 {
				sunWeight := (normX - 0.45) * 0.12
				rf += sunWeight * 1.15
				gf += sunWeight * 0.75
			}

			// D. Exposure / Brightness adjustment
			rf += brightness * (1.0 - lum*0.6)
			gf += brightness * (1.0 - lum*0.6)
			bf += brightness * (1.0 - lum*0.6)

			// E. S-Curve Dynamic Contrast
			rf = (rf-0.5)*contrast + 0.5
			gf = (gf-0.5)*contrast + 0.5
			bf = (bf-0.5)*contrast + 0.5

			// F. Saturation boost in HSL/RGB space
			avg := (rf + gf + bf) / 3.0
			rf = avg + (rf-avg)*satBoost
			gf = avg + (gf-avg)*satBoost
			bf = avg + (bf-avg)*satBoost

			// G. Warmth temperature tuning
			rf *= warmthRed
			gf *= warmthGreen
			bf *= warmthBlue

			// Clamp to [0, 1]
			rf = math.Min(math.Max(rf, 0.0), 1.0)
			gf = math.Min(math.Max(gf, 0.0), 1.0)
			bf = math.Min(math.Max(bf, 0.0), 1.0)

			dst.Set(x, y, color.RGBA{
				R: uint8(rf * 255.0),
				G: uint8(gf * 255.0),
				B: uint8(bf * 255.0),
				A: uint8(a >> 8),
			})
		}
	}

	// 2. High-pass 3x3 Convolution Sharpening (Edge and texture definition)
	if applySharpen && sharpenLevel > 0.05 {
		sharpened := image.NewRGBA(bounds)
		draw.Draw(sharpened, bounds, dst, bounds.Min, draw.Src)

		k := sharpenLevel
		centerWeight := 1.0 + 4.0*k

		for y := 1; y < height-1; y++ {
			for x := 1; x < width-1; x++ {
				cCenter := dst.RGBAAt(x, y)
				cUp := dst.RGBAAt(x, y-1)
				cDown := dst.RGBAAt(x, y+1)
				cLeft := dst.RGBAAt(x-1, y)
				cRight := dst.RGBAAt(x+1, y)

				rSharpen := float64(cCenter.R)*centerWeight - k*(float64(cUp.R)+float64(cDown.R)+float64(cLeft.R)+float64(cRight.R))
				gSharpen := float64(cCenter.G)*centerWeight - k*(float64(cUp.G)+float64(cDown.G)+float64(cLeft.G)+float64(cRight.G))
				bSharpen := float64(cCenter.B)*centerWeight - k*(float64(cUp.B)+float64(cDown.B)+float64(cLeft.B)+float64(cRight.B))

				sharpened.Set(x, y, color.RGBA{
					R: uint8(math.Min(math.Max(rSharpen, 0.0), 255.0)),
					G: uint8(math.Min(math.Max(gSharpen, 0.0), 255.0)),
					B: uint8(math.Min(math.Max(bSharpen, 0.0), 255.0)),
					A: cCenter.A,
				})
			}
		}
		return sharpened
	}

	return dst
}
