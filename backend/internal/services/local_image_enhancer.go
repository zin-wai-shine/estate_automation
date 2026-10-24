package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type LocalImageEnhanceConfig struct {
	TargetWidth        int     `json:"target_width"`         // Default 1080
	TargetHeight       int     `json:"target_height"`        // Default 1350 (4:5)
	StrictPreservation bool    `json:"strict_preservation"`  // Must preserve 100% room structure
	SharpenAmount      float64 `json:"sharpen_amount"`       // 0.0 to 1.0 (default 0.35)
	ExposureLift       float64 `json:"exposure_lift"`        // 0.0 to 0.5 (default 0.15 shadow recovery)
	ContrastFactor     float64 `json:"contrast_factor"`      // 1.0 to 1.5 (default 1.12)
	WhiteBalanceFix    bool    `json:"white_balance_fix"`    // Natural daylight calibration
}

type LocalImageEnhanceResult struct {
	OutputPath   string `json:"output_path"`
	OutputURL    string `json:"output_url"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	Checksum     string `json:"checksum"`
	Format       string `json:"format"`
	ProcessingMs int64  `json:"processing_ms"`
}

// LocalImageEnhancer performs deterministic, non-destructive real estate photo enhancement.
type LocalImageEnhancer struct{}

func NewLocalImageEnhancer() *LocalImageEnhancer {
	return &LocalImageEnhancer{}
}

// EnhanceImage loads an original photograph, applies architectural-preserving technical enhancements,
// exports to 1080x1350 (4:5) master format, and computes cryptographic verification checksums.
func (e *LocalImageEnhancer) EnhanceImage(sourcePathOrURL, outputFilePath string, cfg LocalImageEnhanceConfig) (*LocalImageEnhanceResult, error) {
	start := time.Now()

	if cfg.TargetWidth <= 0 {
		cfg.TargetWidth = 1080
	}
	if cfg.TargetHeight <= 0 {
		cfg.TargetHeight = 1350
	}
	if cfg.SharpenAmount <= 0 {
		cfg.SharpenAmount = 0.35
	}
	if cfg.ContrastFactor <= 0 {
		cfg.ContrastFactor = 1.12
	}
	if cfg.ExposureLift <= 0 {
		cfg.ExposureLift = 0.12
	}

	// 1. Load source image
	srcImg, _, err := e.loadSourceImage(sourcePathOrURL)
	if err != nil {
		return nil, fmt.Errorf("failed to load source image: %w", err)
	}

	// 2. High-quality aspect-ratio fit into target dimensions with neutral background padding
	scaledImg := e.fitAndScale(srcImg, cfg.TargetWidth, cfg.TargetHeight)

	// 3. Technical dynamic range enhancement (Shadow lift, contrast, color temperature)
	colorEnhanced := e.adjustToneAndExposure(scaledImg, cfg.ExposureLift, cfg.ContrastFactor, cfg.WhiteBalanceFix)

	// 4. Edge crisping & sharpness refinement (Preserving fine architectural texture)
	finalImg := e.applyUnsharpMask(colorEnhanced, cfg.SharpenAmount)

	// 5. Ensure output directory exists
	if err := os.MkdirAll(filepath.Dir(outputFilePath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	// 6. Encode to master file (PNG for master quality, or JPEG if requested)
	outFile, err := os.Create(outputFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create destination file: %w", err)
	}
	defer outFile.Close()

	hasher := sha256.New()
	multiWriter := io.MultiWriter(outFile, hasher)

	isJPEG := strings.HasSuffix(strings.ToLower(outputFilePath), ".jpg") || strings.HasSuffix(strings.ToLower(outputFilePath), ".jpeg")
	if isJPEG {
		err = jpeg.Encode(multiWriter, finalImg, &jpeg.Options{Quality: 96})
	} else {
		err = png.Encode(multiWriter, finalImg)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to encode output image: %w", err)
	}

	checksum := hex.EncodeToString(hasher.Sum(nil))
	processingMs := time.Since(start).Milliseconds()

	return &LocalImageEnhanceResult{
		OutputPath:   outputFilePath,
		Width:        cfg.TargetWidth,
		Height:       cfg.TargetHeight,
		Checksum:     checksum,
		Format:       map[bool]string{true: "jpeg", false: "png"}[isJPEG],
		ProcessingMs: processingMs,
	}, nil
}

func (e *LocalImageEnhancer) loadSourceImage(pathOrURL string) (image.Image, string, error) {
	if strings.HasPrefix(pathOrURL, "http://") || strings.HasPrefix(pathOrURL, "https://") {
		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Get(pathOrURL)
		if err != nil {
			return nil, "", err
		}
		defer resp.Body.Close()
		return image.Decode(resp.Body)
	}

	file, err := os.Open(pathOrURL)
	if err != nil {
		return nil, "", err
	}
	defer file.Close()
	return image.Decode(file)
}

// fitAndScale scales src into targetWidth x targetHeight preserving aspect ratio and centering it.
func (e *LocalImageEnhancer) fitAndScale(src image.Image, targetWidth, targetHeight int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))

	// Fill background with elegant subtle dark slate tone
	draw.Draw(dst, dst.Bounds(), &image.Uniform{color.RGBA{R: 15, G: 23, B: 42, A: 255}}, image.Point{}, draw.Src)

	srcBounds := src.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()
	if srcW == 0 || srcH == 0 {
		return dst
	}

	scaleW := float64(targetWidth) / float64(srcW)
	scaleH := float64(targetHeight) / float64(srcH)

	// Pick scale that fits entirely within target box
	scale := math.Min(scaleW, scaleH)
	scaledW := int(math.Round(float64(srcW) * scale))
	scaledH := int(math.Round(float64(srcH) * scale))

	offsetX := (targetWidth - scaledW) / 2
	offsetY := (targetHeight - scaledH) / 2

	// Bilinear interpolation scaling
	for y := 0; y < scaledH; y++ {
		srcY := float64(y) / scale
		y0 := int(math.Floor(srcY))
		y1 := int(math.Min(float64(y0+1), float64(srcH-1)))
		fy := srcY - float64(y0)

		for x := 0; x < scaledW; x++ {
			srcX := float64(x) / scale
			x0 := int(math.Floor(srcX))
			x1 := int(math.Min(float64(x0+1), float64(srcW-1)))
			fx := srcX - float64(x0)

			c00 := src.At(srcBounds.Min.X+x0, srcBounds.Min.Y+y0)
			c10 := src.At(srcBounds.Min.X+x1, srcBounds.Min.Y+y0)
			c01 := src.At(srcBounds.Min.X+x0, srcBounds.Min.Y+y1)
			c11 := src.At(srcBounds.Min.X+x1, srcBounds.Min.Y+y1)

			r00, g00, b00, a00 := c00.RGBA()
			r10, g10, b10, a10 := c10.RGBA()
			r01, g01, b01, a01 := c01.RGBA()
			r11, g11, b11, a11 := c11.RGBA()

			interp := func(v00, v10, v01, v11 uint32) uint8 {
				top := float64(v00)*(1.0-fx) + float64(v10)*fx
				bot := float64(v01)*(1.0-fx) + float64(v11)*fx
				val := top*(1.0-fy) + bot*fy
				return uint8(math.Min(255, math.Max(0, val/257.0)))
			}

			dst.SetRGBA(offsetX+x, offsetY+y, color.RGBA{
				R: interp(r00, r10, r01, r11),
				G: interp(g00, g10, g01, g11),
				B: interp(b00, b10, b01, b11),
				A: interp(a00, a10, a01, a11),
			})
		}
	}

	return dst
}

// adjustToneAndExposure lifts deep interior shadows and normalizes color temperature.
func (e *LocalImageEnhancer) adjustToneAndExposure(src *image.RGBA, exposureLift, contrastFactor float64, whiteBalanceFix bool) *image.RGBA {
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	dst := image.NewRGBA(bounds)

	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := src.RGBAAt(x, y)
			if c.A == 0 {
				dst.SetRGBA(x, y, c)
				continue
			}

			rf := float64(c.R) / 255.0
			gf := float64(c.G) / 255.0
			bf := float64(c.B) / 255.0

			// 1. Shadow recovery (lift dark areas, preserve highlights)
			shadowWeightR := (1.0 - rf) * exposureLift
			shadowWeightG := (1.0 - gf) * exposureLift
			shadowWeightB := (1.0 - bf) * exposureLift

			rf = math.Min(1.0, rf+shadowWeightR)
			gf = math.Min(1.0, gf+shadowWeightG)
			bf = math.Min(1.0, bf+shadowWeightB)

			// 2. Contrast adjustment centered at 0.5
			rf = (rf-0.5)*contrastFactor + 0.5
			gf = (gf-0.5)*contrastFactor + 0.5
			bf = (bf-0.5)*contrastFactor + 0.5

			// 3. True-to-life white balance calibration (cool down yellow indoor light slightly towards crisp 5500K daylight)
			if whiteBalanceFix {
				rf = rf * 0.98
				bf = math.Min(1.0, bf*1.04)
			}

			clamp := func(val float64) uint8 {
				if val < 0 {
					return 0
				}
				if val > 1.0 {
					return 255
				}
				return uint8(math.Round(val * 255.0))
			}

			dst.SetRGBA(x, y, color.RGBA{
				R: clamp(rf),
				G: clamp(gf),
				B: clamp(bf),
				A: c.A,
			})
		}
	}

	return dst
}

// applyUnsharpMask applies edge crisping to enhance architectural textures (wood, marble, glass).
func (e *LocalImageEnhancer) applyUnsharpMask(src *image.RGBA, amount float64) *image.RGBA {
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	dst := image.NewRGBA(bounds)

	// 3x3 Laplacian edge kernel
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			if x == 0 || x == w-1 || y == 0 || y == h-1 {
				dst.SetRGBA(x, y, src.RGBAAt(x, y))
				continue
			}

			orig := src.RGBAAt(x, y)
			up := src.RGBAAt(x, y-1)
			down := src.RGBAAt(x, y+1)
			left := src.RGBAAt(x-1, y)
			right := src.RGBAAt(x+1, y)

			calc := func(c, u, d, l, r uint8) uint8 {
				edge := 4.0*float64(c) - float64(u) - float64(d) - float64(l) - float64(r)
				sharpened := float64(c) + edge*amount*0.25
				if sharpened < 0 {
					return 0
				}
				if sharpened > 255 {
					return 255
				}
				return uint8(math.Round(sharpened))
			}

			dst.SetRGBA(x, y, color.RGBA{
				R: calc(orig.R, up.R, down.R, left.R, right.R),
				G: calc(orig.G, up.G, down.G, left.G, right.G),
				B: calc(orig.B, up.B, down.B, left.B, right.B),
				A: orig.A,
			})
		}
	}

	return dst
}
