package services

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"strings"
)

const encryptedTokenPrefix = "enc:v1:"

// tokenEncryptionKey derives a 32-byte AES-256 key from server-side secrets.
// Priority: FACEBOOK_TOKEN_ENCRYPTION_KEY > JWT_SECRET > static dev fallback.
func tokenEncryptionKey() []byte {
	secret := strings.TrimSpace(os.Getenv("FACEBOOK_TOKEN_ENCRYPTION_KEY"))
	if secret == "" {
		secret = strings.TrimSpace(os.Getenv("JWT_SECRET"))
	}
	if secret == "" {
		secret = "estate-automate-dev-facebook-token-key"
	}
	sum := sha256.Sum256([]byte("fb-page-token|" + secret))
	return sum[:]
}

// EncryptToken encrypts a Page Access Token with AES-256-GCM for at-rest storage.
func EncryptToken(plain string) (string, error) {
	plain = strings.TrimSpace(plain)
	if plain == "" {
		return "", fmt.Errorf("token is empty")
	}
	block, err := aes.NewCipher(tokenEncryptionKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return encryptedTokenPrefix + base64.StdEncoding.EncodeToString(sealed), nil
}

// DecryptToken reverses EncryptToken. Plain (legacy, unencrypted) values are returned as-is.
func DecryptToken(stored string) (string, error) {
	if stored == "" {
		return "", nil
	}
	if !strings.HasPrefix(stored, encryptedTokenPrefix) {
		return stored, nil
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(stored, encryptedTokenPrefix))
	if err != nil {
		return "", fmt.Errorf("corrupted token payload: %w", err)
	}
	block, err := aes.NewCipher(tokenEncryptionKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", fmt.Errorf("corrupted token payload")
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("unable to decrypt token (encryption key changed?): %w", err)
	}
	return string(plain), nil
}

// TokenHint returns a safe, non-reversible hint (last 4 chars) for UI display.
func TokenHint(token string) string {
	token = strings.TrimSpace(token)
	if len(token) <= 4 {
		return "••••"
	}
	return "••••" + token[len(token)-4:]
}
