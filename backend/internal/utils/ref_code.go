package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"unicode"
)

// GeneratePropertyRefCode creates a standardized reference code in the format:
// [CONDO_PREFIX]-[5_OR_6_DIGITS]-[5_OR_6_LETTERS]
// Example: BHV-52784-MQKRN or UE-58291-KLPXZ
func GeneratePropertyRefCode(condoName string) string {
	prefix := extractCondoPrefix(condoName)
	if prefix == "" {
		prefix = "BHV"
	}

	// 5 or 6 digits (e.g. 52784 or 527841)
	digits := generateRandomDigits(5)

	// 5 or 6 uppercase letters (A-Z)
	letters := generateRandomLetters(5)

	return fmt.Sprintf("%s-%s-%s", prefix, digits, letters)
}

// extractCondoPrefix extracts 2-4 uppercase initial letters from condo name
func extractCondoPrefix(name string) string {
	clean := strings.TrimSpace(name)
	if clean == "" {
		return "BHV"
	}

	// Remove punctuation and special symbols
	reg := regexp.MustCompile(`[^a-zA-Z0-9\s]`)
	clean = reg.ReplaceAllString(clean, " ")
	words := strings.Fields(clean)

	var initials []rune
	for _, w := range words {
		// Ignore common filler words
		lower := strings.ToLower(w)
		if lower == "condo" || lower == "the" || lower == "at" || lower == "for" || lower == "rent" || lower == "sale" {
			continue
		}
		r := []rune(w)
		if len(r) > 0 && unicode.IsLetter(r[0]) {
			initials = append(initials, unicode.ToUpper(r[0]))
		}
		if len(initials) >= 4 {
			break
		}
	}

	// If fewer than 2 letters, take first 2-3 letters of the first meaningful word
	if len(initials) < 2 {
		for _, w := range words {
			if len(w) >= 2 {
				initials = nil
				for _, r := range w {
					if unicode.IsLetter(r) {
						initials = append(initials, unicode.ToUpper(r))
					}
					if len(initials) >= 3 {
						break
					}
				}
				break
			}
		}
	}

	if len(initials) == 0 {
		return "BHV"
	}

	return string(initials)
}

// generateRandomDigits generates n random numeric characters [0-9]
func generateRandomDigits(n int) string {
	const digits = "0123456789"
	result := make([]byte, n)
	for i := range result {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			result[i] = digits[i%len(digits)]
		} else {
			result[i] = digits[num.Int64()]
		}
	}
	// Ensure first digit is non-zero
	if result[0] == '0' {
		result[0] = '5'
	}
	return string(result)
}

// generateRandomLetters generates n random uppercase letters [A-Z]
func generateRandomLetters(n int) string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	result := make([]byte, n)
	for i := range result {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		if err != nil {
			result[i] = letters[i%len(letters)]
		} else {
			result[i] = letters[num.Int64()]
		}
	}
	return string(result)
}
