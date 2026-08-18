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

// EnhancePropertyImage applies clean photographic tone mapping, exposure balancing, and 4K texture sharpening
func EnhancePropertyImage(src image.Image, presetID string, customInstructions string) image.Image {
	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	dst := image.NewRGBA(bounds)

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, b, a := src.At(bounds.Min.X+x, bounds.Min.Y+y).RGBA()
			rf := float64(r >> 8) / 255.0
			gf := float64(g >> 8) / 255.0
			bf := float64(b >> 8) / 255.0

			// Luminance
			lum := 0.299*rf + 0.587*gf + 0.114*bf

			// 1. Natural Exposure & Shadow Lifting
			// Smoothly lifts dark shadows without clipping or introducing noise
			if lum < 0.40 {
				shadowWeight := (0.40 - lum) / 0.40
				rf += 0.12 * shadowWeight * rf
				gf += 0.12 * shadowWeight * gf
				bf += 0.12 * shadowWeight * bf
			}

			// 2. Gentle S-Curve Dynamic Contrast
			rf = (rf-0.5)*1.12 + 0.5
			gf = (gf-0.5)*1.12 + 0.5
			bf = (bf-0.5)*1.12 + 0.5

			// 3. Subtle Natural Vibrancy (true to real room colors)
			avg := (rf + gf + bf) / 3.0
			rf = avg + (rf-avg)*1.10
			gf = avg + (gf-avg)*1.10
			bf = avg + (bf-avg)*1.10

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

	// 4. High-Precision 3x3 Convolution Texture Sharpening (Edge and texture definition)
	sharpened := image.NewRGBA(bounds)
	draw.Draw(sharpened, bounds, dst, bounds.Min, draw.Src)

	k := 0.35 // Unsharp mask strength
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
