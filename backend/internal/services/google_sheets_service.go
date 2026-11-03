package services

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// GoogleServiceAccountKey models the Google Cloud service account JSON file.
type GoogleServiceAccountKey struct {
	Type                    string `json:"type"`
	ProjectID               string `json:"project_id"`
	PrivateKeyID            string `json:"private_key_id"`
	PrivateKey              string `json:"private_key"`
	ClientEmail             string `json:"client_email"`
	ClientID                string `json:"client_id"`
	AuthURI                 string `json:"auth_uri"`
	TokenURI                string `json:"token_uri"`
	AuthProviderX509CertURL string `json:"auth_provider_x509_cert_url"`
	ClientX509CertURL       string `json:"client_x509_cert_url"`
}

// GoogleSheetsService handles authentication and operations with Google Sheets API v4.
type GoogleSheetsService struct {
	cachedToken     string
	tokenExpiry     time.Time
	mu              sync.RWMutex
	credentialsPath string
}

var (
	sheetsServiceInstance *GoogleSheetsService
	sheetsServiceOnce     sync.Once
)

// NewGoogleSheetsService returns the singleton GoogleSheetsService instance.
func NewGoogleSheetsService() *GoogleSheetsService {
	sheetsServiceOnce.Do(func() {
		// Look for service account in standard locations
		paths := []string{
			"backend/data/google_service_account.json",
			"data/google_service_account.json",
			"/app/data/google_service_account.json",
		}
		var validPath string
		for _, p := range paths {
			if _, err := os.Stat(p); err == nil {
				validPath = p
				break
			}
		}
		if validPath == "" {
			validPath = "backend/data/google_service_account.json"
		}
		sheetsServiceInstance = &GoogleSheetsService{
			credentialsPath: validPath,
		}
	})
	return sheetsServiceInstance
}

// ExtractSpreadsheetID parses a raw URL or ID to return the clean Google Spreadsheet ID.
func ExtractSpreadsheetID(rawInput string) string {
	rawInput = strings.TrimSpace(rawInput)
	if rawInput == "" {
		return ""
	}
	// Regex matching /d/([a-zA-Z0-9-_]+)
	re := regexp.MustCompile(`/d/([a-zA-Z0-9-_]+)`)
	matches := re.FindStringSubmatch(rawInput)
	if len(matches) > 1 {
		return matches[1]
	}
	// Fallback: check if the string itself is a valid spreadsheet ID (letters, numbers, hyphens, underscores)
	if regexp.MustCompile(`^[a-zA-Z0-9-_]{20,}$`).MatchString(rawInput) {
		return rawInput
	}
	return rawInput
}

// ExtractSheetGID parses the numeric gid parameter (tab ID) from a Google Sheets URL.
// Returns -1 if no gid is present.
func ExtractSheetGID(rawInput string) int {
	rawInput = strings.TrimSpace(rawInput)
	if rawInput == "" {
		return -1
	}
	re := regexp.MustCompile(`[?&#]gid=([0-9]+)`)
	matches := re.FindStringSubmatch(rawInput)
	if len(matches) > 1 {
		if id, err := strconv.Atoi(matches[1]); err == nil {
			return id
		}
	}
	return -1
}

// LoadCredentials loads the service account key from disk or environment.
func (s *GoogleSheetsService) LoadCredentials() (*GoogleServiceAccountKey, error) {
	// First check environment variable override
	if envCreds := os.Getenv("GOOGLE_SERVICE_ACCOUNT_JSON"); envCreds != "" {
		var creds GoogleServiceAccountKey
		if err := json.Unmarshal([]byte(envCreds), &creds); err == nil && creds.PrivateKey != "" {
			return &creds, nil
		}
	}

	// Read file from disk
	data, err := os.ReadFile(s.credentialsPath)
	if err != nil {
		// Try alternative root directory paths
		altPaths := []string{
			"data/google_service_account.json",
			"/app/data/google_service_account.json",
			filepath.Join(os.Getenv("HOME"), ".gemini/google_service_account.json"),
		}
		for _, alt := range altPaths {
			if d, e := os.ReadFile(alt); e == nil {
				data = d
				err = nil
				s.credentialsPath = alt
				break
			}
		}
		if err != nil {
			return nil, fmt.Errorf("google service account file not found: %w", err)
		}
	}

	var creds GoogleServiceAccountKey
	if err := json.Unmarshal(data, &creds); err != nil {
		return nil, fmt.Errorf("invalid google service account JSON: %w", err)
	}

	if creds.PrivateKey == "" || creds.ClientEmail == "" {
		return nil, fmt.Errorf("service account missing private_key or client_email")
	}

	return &creds, nil
}

// base64UrlEncode encodes bytes to base64url without padding.
func base64UrlEncode(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}

// generateTokenForCreds signs a JWT and exchanges it for an OAuth2 access token with Google.
func (s *GoogleSheetsService) generateTokenForCreds(ctx context.Context, creds *GoogleServiceAccountKey) (string, error) {
	now := time.Now().Unix()
	exp := now + 3600 // 1 hour validity

	// Construct JWT Header & Claims
	headerJSON := `{"alg":"RS256","typ":"JWT"}`
	claims := map[string]interface{}{
		"iss":   creds.ClientEmail,
		"scope": "https://www.googleapis.com/auth/spreadsheets",
		"aud":   "https://oauth2.googleapis.com/token",
		"exp":   exp,
		"iat":   now,
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("failed to marshal JWT claims: %w", err)
	}

	signingInput := fmt.Sprintf("%s.%s", base64UrlEncode([]byte(headerJSON)), base64UrlEncode(claimsJSON))

	// Parse RSA Private Key
	block, _ := pem.Decode([]byte(creds.PrivateKey))
	if block == nil {
		return "", fmt.Errorf("failed to decode PEM block containing private key")
	}

	var parsedKey *rsa.PrivateKey
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		var ok bool
		parsedKey, ok = key.(*rsa.PrivateKey)
		if !ok {
			return "", fmt.Errorf("PKCS8 key is not RSA")
		}
	} else if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		parsedKey = key
	} else {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	// Sign with SHA-256
	hashed := sha256.Sum256([]byte(signingInput))
	signature, err := rsa.SignPKCS1v15(rand.Reader, parsedKey, crypto.SHA256, hashed[:])
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	signedJWT := fmt.Sprintf("%s.%s", signingInput, base64UrlEncode(signature))

	// Exchange JWT for access token at oauth2.googleapis.com
	tokenURL := creds.TokenURI
	if tokenURL == "" {
		tokenURL = "https://oauth2.googleapis.com/token"
	}

	formValues := url.Values{}
	formValues.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	formValues.Set("assertion", signedJWT)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(formValues.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to post token request to google: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("google token exchange failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		TokenType   string `json:"token_type"`
	}
	if err := json.Unmarshal(bodyBytes, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse google token response: %w", err)
	}

	return tokenResp.AccessToken, nil
}

// GetTokenAndCreds returns an OAuth2 token and client email, checking custom credentials JSON first.
func (s *GoogleSheetsService) GetTokenAndCreds(ctx context.Context, customCredsJSON string) (string, string, error) {
	if strings.TrimSpace(customCredsJSON) != "" {
		var creds GoogleServiceAccountKey
		if err := json.Unmarshal([]byte(customCredsJSON), &creds); err != nil {
			return "", "", fmt.Errorf("invalid custom service account JSON: %w", err)
		}
		if creds.PrivateKey == "" || creds.ClientEmail == "" {
			return "", "", fmt.Errorf("uploaded service account JSON is missing client_email or private_key")
		}
		token, err := s.generateTokenForCreds(ctx, &creds)
		if err != nil {
			return "", "", err
		}
		return token, creds.ClientEmail, nil
	}

	token, err := s.GetAccessToken(ctx)
	if err != nil {
		return "", "", err
	}
	creds, _ := s.LoadCredentials()
	serviceEmail := ""
	if creds != nil {
		serviceEmail = creds.ClientEmail
	}
	return token, serviceEmail, nil
}

// GetAccessToken generates an OAuth2 access token for Google Sheets API using RS256 JWT.
func (s *GoogleSheetsService) GetAccessToken(ctx context.Context) (string, error) {
	s.mu.RLock()
	if s.cachedToken != "" && time.Now().Before(s.tokenExpiry.Add(-2*time.Minute)) {
		token := s.cachedToken
		s.mu.RUnlock()
		return token, nil
	}
	s.mu.RUnlock()

	s.mu.Lock()
	defer s.mu.Unlock()

	// Double check under write lock
	if s.cachedToken != "" && time.Now().Before(s.tokenExpiry.Add(-2*time.Minute)) {
		return s.cachedToken, nil
	}

	creds, err := s.LoadCredentials()
	if err != nil {
		return "", err
	}

	token, err := s.generateTokenForCreds(ctx, creds)
	if err != nil {
		return "", err
	}

	s.cachedToken = token
	s.tokenExpiry = time.Now().Add(55 * time.Minute)
	return s.cachedToken, nil
}

// SheetMetadata represents high-level info and extracted column headers from a spreadsheet.
type SheetMetadata struct {
	SpreadsheetID    string   `json:"spreadsheet_id"`
	SpreadsheetTitle string   `json:"spreadsheet_title"`
	SheetName        string   `json:"sheet_name"`
	SheetID          int      `json:"sheet_id"`
	Headers          []string `json:"headers"`
	RowCount         int      `json:"row_count"`
	ColumnCount      int      `json:"column_count"`
	ServiceAccount   string   `json:"service_account"`
}

// LoadHeaders retrieves the sheet metadata and Row 1 column headers.
func (s *GoogleSheetsService) LoadHeaders(ctx context.Context, spreadsheetInput string, sheetNameOpt string, customCredsJSON string) (*SheetMetadata, error) {
	spreadsheetID := ExtractSpreadsheetID(spreadsheetInput)
	if spreadsheetID == "" {
		return nil, fmt.Errorf("invalid spreadsheet URL or ID provided")
	}

	token, serviceEmail, err := s.GetTokenAndCreds(ctx, customCredsJSON)
	if err != nil {
		return nil, fmt.Errorf("authentication error: %w", err)
	}

	// Fetch spreadsheet metadata with grid data
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s?includeGridData=true", spreadsheetID)
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch spreadsheet from Google Sheets API: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		var gErr struct {
			Error struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
				Status  string `json:"status"`
			} `json:"error"`
		}
		_ = json.Unmarshal(bodyBytes, &gErr)
		if gErr.Error.Message != "" {
			return nil, fmt.Errorf("Google Sheets API error: %s (Status: %s)", gErr.Error.Message, gErr.Error.Status)
		}
		return nil, fmt.Errorf("Google Sheets API error (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var sheetResp struct {
		Properties struct {
			Title string `json:"title"`
		} `json:"properties"`
		Sheets []struct {
			Properties struct {
				SheetID int    `json:"sheetId"`
				Title   string `json:"title"`
				Grid    struct {
					RowCount    int `json:"rowCount"`
					ColumnCount int `json:"columnCount"`
				} `json:"gridProperties"`
			} `json:"properties"`
			Data []struct {
				RowData []struct {
					Values []struct {
						FormattedValue string `json:"formattedValue"`
						UserEntered    struct {
							StringValue string `json:"stringValue"`
						} `json:"userEnteredValue"`
					} `json:"values"`
				} `json:"rowData"`
			} `json:"data"`
		} `json:"sheets"`
	}

	if err := json.Unmarshal(bodyBytes, &sheetResp); err != nil {
		return nil, fmt.Errorf("failed to parse Google Sheets response: %w", err)
	}

	if len(sheetResp.Sheets) == 0 {
		return nil, fmt.Errorf("spreadsheet contains no sheets")
	}

	// Target sheet resolution: prioritize matching GID from URL if present, otherwise sheetNameOpt
	targetGID := ExtractSheetGID(spreadsheetInput)
	targetSheetIndex := -1

	if targetGID >= 0 {
		for i, sh := range sheetResp.Sheets {
			if sh.Properties.SheetID == targetGID {
				targetSheetIndex = i
				break
			}
		}
	}

	if targetSheetIndex < 0 && sheetNameOpt != "" {
		for i, sh := range sheetResp.Sheets {
			if strings.EqualFold(sh.Properties.Title, sheetNameOpt) {
				targetSheetIndex = i
				break
			}
		}
	}

	if targetSheetIndex < 0 {
		targetSheetIndex = 0
	}

	chosenSheet := sheetResp.Sheets[targetSheetIndex]
	headers := []string{}

	if len(chosenSheet.Data) > 0 && len(chosenSheet.Data[0].RowData) > 0 {
		firstRow := chosenSheet.Data[0].RowData[0].Values
		for _, v := range firstRow {
			val := strings.TrimSpace(v.FormattedValue)
			if val == "" {
				val = strings.TrimSpace(v.UserEntered.StringValue)
			}
			if val != "" {
				headers = append(headers, val)
			}
		}
	}

	return &SheetMetadata{
		SpreadsheetID:    spreadsheetID,
		SpreadsheetTitle: sheetResp.Properties.Title,
		SheetName:        chosenSheet.Properties.Title,
		SheetID:          chosenSheet.Properties.SheetID,
		Headers:          headers,
		RowCount:         chosenSheet.Properties.Grid.RowCount,
		ColumnCount:      chosenSheet.Properties.Grid.ColumnCount,
		ServiceAccount:   serviceEmail,
	}, nil
}

// AppendRow appends a slice of values to the specified sheet.
func (s *GoogleSheetsService) AppendRow(ctx context.Context, spreadsheetInput string, sheetNameOpt string, values []interface{}, customCredsJSON string) (map[string]interface{}, error) {
	spreadsheetID := ExtractSpreadsheetID(spreadsheetInput)
	if spreadsheetID == "" {
		return nil, fmt.Errorf("invalid spreadsheet URL or ID provided")
	}

	token, _, err := s.GetTokenAndCreds(ctx, customCredsJSON)
	if err != nil {
		return nil, fmt.Errorf("authentication error: %w", err)
	}

	targetGID := ExtractSheetGID(spreadsheetInput)
	sheetName := "Sheet1"
	if sheetNameOpt != "" {
		sheetName = sheetNameOpt
	}

	var sheetMeta *SheetMetadata
	// If GID is present in URL or sheet name not explicit, resolve sheet metadata
	if targetGID >= 0 || sheetNameOpt == "" {
		meta, err := s.LoadHeaders(ctx, spreadsheetInput, sheetNameOpt, customCredsJSON)
		if err == nil && meta != nil {
			sheetMeta = meta
			if meta.SheetName != "" {
				sheetName = meta.SheetName
			}
		}
	} else {
		meta, err := s.LoadHeaders(ctx, spreadsheetInput, sheetName, customCredsJSON)
		if err == nil && meta != nil {
			sheetMeta = meta
		}
	}

	// Range to append to
	var escapedSheet string
	if strings.Contains(sheetName, " ") || strings.Contains(sheetName, "-") || strings.Contains(sheetName, "'") {
		cleanName := strings.ReplaceAll(sheetName, "'", "''")
		escapedSheet = url.PathEscape(fmt.Sprintf("'%s'", cleanName))
	} else {
		escapedSheet = url.PathEscape(sheetName)
	}
	// Use insertDataOption=OVERWRITE to fill empty rows cleanly without copying header format
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s!A1:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE", spreadsheetID, escapedSheet)

	payload := map[string]interface{}{
		"majorDimension": "ROWS",
		"values": [][]interface{}{
			values,
		},
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute append request: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Google Sheets append failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var appendResult map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &appendResult); err != nil {
		return nil, err
	}

	// Format the newly appended row(s) to guarantee pure white background and normal (non-bold, non-italic) font.
	sheetID := int64(0)
	if targetGID >= 0 {
		sheetID = int64(targetGID)
	}
	numCols := len(values)
	if sheetMeta != nil {
		sheetID = int64(sheetMeta.SheetID)
		if int(sheetMeta.ColumnCount) > numCols {
			numCols = int(sheetMeta.ColumnCount)
		}
	}

	startRowIdx, endRowIdx := -1, -1
	if updates, ok := appendResult["updates"].(map[string]interface{}); ok {
		if updatedRange, ok := updates["updatedRange"].(string); ok {
			startRowIdx, endRowIdx = parseRowIndicesFromRange(updatedRange)
		}
	}

	if startRowIdx >= 1 && endRowIdx >= startRowIdx {
		_ = s.FormatRowsSimple(ctx, spreadsheetID, sheetID, startRowIdx, endRowIdx, numCols, token)
	}

	return appendResult, nil
}

// FormatRowsSimple formats a row range to pure white background (#ffffff) and normal (non-bold, non-italic) text.
func (s *GoogleSheetsService) FormatRowsSimple(ctx context.Context, spreadsheetID string, sheetID int64, startRowIndex, endRowIndex, numCols int, token string) error {
	batchURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s:batchUpdate", spreadsheetID)

	gridRange := map[string]interface{}{
		"sheetId":          sheetID,
		"startRowIndex":    startRowIndex,
		"endRowIndex":      endRowIndex,
		"startColumnIndex": 0,
	}
	if numCols > 0 {
		gridRange["endColumnIndex"] = numCols
	}

	reqPayload := map[string]interface{}{
		"requests": []map[string]interface{}{
			{
				"repeatCell": map[string]interface{}{
					"range": gridRange,
					"cell": map[string]interface{}{
						"userEnteredFormat": map[string]interface{}{
							"backgroundColor": map[string]interface{}{
								"red":   1.0,
								"green": 1.0,
								"blue":  1.0,
							},
							"textFormat": map[string]interface{}{
								"bold":   false,
								"italic": false,
							},
						},
					},
					"fields": "userEnteredFormat(backgroundColor,textFormat.bold,textFormat.italic)",
				},
			},
		},
	}

	body, err := json.Marshal(reqPayload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", batchURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

// parseRowIndicesFromRange parses 0-indexed start and end row indices from a range string like "Sheet6!A2:J2" or "'Sheet 1'!A10:H12"
func parseRowIndicesFromRange(rangeStr string) (int, int) {
	exclamationIdx := strings.LastIndex(rangeStr, "!")
	cellRange := rangeStr
	if exclamationIdx >= 0 {
		cellRange = rangeStr[exclamationIdx+1:]
	}
	parts := strings.Split(cellRange, ":")
	if len(parts) == 0 {
		return -1, -1
	}

	extractNum := func(s string) int {
		numStr := ""
		for _, r := range s {
			if r >= '0' && r <= '9' {
				numStr += string(r)
			}
		}
		if numStr == "" {
			return -1
		}
		n, _ := strconv.Atoi(numStr)
		return n
	}

	startRow := extractNum(parts[0])
	endRow := startRow
	if len(parts) > 1 {
		endRow = extractNum(parts[1])
	}

	if startRow <= 0 {
		return -1, -1
	}

	// 0-indexed GridRange: startRowIndex is startRow - 1, endRowIndex is endRow (exclusive)
	return startRow - 1, endRow
}

func cryptoRandInt(max int) int {
	if max <= 0 {
		return 0
	}
	n, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
	if err != nil {
		return 0
	}
	return int(n.Int64())
}

// GenerateUniqueCode generates a unique listing code based on a pattern such as "AAA-######-AA" or "[3L]-[6D]-[2L]"
func GenerateUniqueCode(pattern string) string {
	pattern = strings.TrimSpace(pattern)
	if pattern == "" {
		pattern = "AAA-######-AA"
	}

	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	const digits = "0123456789"

	hasTokens := regexp.MustCompile(`(?i)[\[{](\d+)[A-Za-z#0][\]}]`).MatchString(pattern)
	result := pattern

	// Replace bracketed tokens: [3L] or {3L} (random letters)
	letterTokenRe := regexp.MustCompile(`(?i)[\[{](\d+)[LA][\]}]`)
	result = letterTokenRe.ReplaceAllStringFunc(result, func(m string) string {
		sub := letterTokenRe.FindStringSubmatch(m)
		if len(sub) > 1 {
			count, _ := strconv.Atoi(sub[1])
			if count > 0 && count <= 50 {
				var sb strings.Builder
				for i := 0; i < count; i++ {
					sb.WriteByte(letters[cryptoRandInt(len(letters))])
				}
				return sb.String()
			}
		}
		return m
	})

	// Replace bracketed tokens: [6D] or {6D} (random digits)
	digitTokenRe := regexp.MustCompile(`(?i)[\[{](\d+)[DN#0][\]}]`)
	result = digitTokenRe.ReplaceAllStringFunc(result, func(m string) string {
		sub := digitTokenRe.FindStringSubmatch(m)
		if len(sub) > 1 {
			count, _ := strconv.Atoi(sub[1])
			if count > 0 && count <= 50 {
				var sb strings.Builder
				for i := 0; i < count; i++ {
					sb.WriteByte(digits[cryptoRandInt(len(digits))])
				}
				return sb.String()
			}
		}
		return m
	})

	if !hasTokens {
		var sb strings.Builder
		for _, ch := range result {
			if ch == 'A' {
				sb.WriteByte(letters[cryptoRandInt(len(letters))])
			} else if ch == '#' {
				sb.WriteByte(digits[cryptoRandInt(len(digits))])
			} else {
				sb.WriteRune(ch)
			}
		}
		return sb.String()
	}

	return result
}

// PrepareDataWithAI prompts Gemini or OpenAI to extract data matching the sheet's exact headers.
func (s *GoogleSheetsService) PrepareDataWithAI(
	ctx context.Context,
	headers []string,
	rawContent string,
	condoName string,
	images []string,
	customInstructions string,
	model string,
	provider string,
	promptTemplate string,
	postURL string,
	codeFormat string,
	autoGenerateCode bool,
	listingCode string,
) (map[string]interface{}, []interface{}, error) {
	if len(headers) == 0 {
		return nil, nil, fmt.Errorf("no headers provided to map data against")
	}

	selectedModel := strings.TrimSpace(model)
	if selectedModel == "" {
		selectedModel = "gemini-flash-latest"
	}
	selectedProvider := strings.ToLower(strings.TrimSpace(provider))
	if selectedProvider == "" {
		if strings.HasPrefix(selectedModel, "gpt-") || strings.HasPrefix(selectedModel, "o1") || strings.HasPrefix(selectedModel, "o3") {
			selectedProvider = "openai"
		} else {
			selectedProvider = "google_ai"
		}
	}

	headersList := strings.Join(headers, ", ")
	templateGuidance := ""
	if strings.TrimSpace(promptTemplate) != "" {
		templateGuidance = fmt.Sprintf("\n\nCustom Prompt Instructions / Field Mapping Rules:\n%s", strings.TrimSpace(promptTemplate))
	}

	activeCodeGuidance := ""
	if strings.TrimSpace(listingCode) != "" {
		activeCodeGuidance = fmt.Sprintf("\nActive Dynamic Listing Code: \"%s\"\n(For 'Code' column or property ID, strictly use this exact code).", strings.TrimSpace(listingCode))
	}

	systemPrompt := fmt.Sprintf(`You are an expert real estate data parser and listing analyst.
Your task is to analyze the property listing content and link, then map it into a clean JSON object matching these exact spreadsheet column headers:
[%s]

Condo / Project Name (if known): "%s"
Source / Post Link (if available): "%s"
Number of Available Photos: %d%s
%s

Guidelines:
1. Return ONLY a valid, parseable JSON object where each key corresponds EXACTLY to one of the spreadsheet column headers listed above.
2. The columns are dynamic and may vary across spreadsheets. Follow the provided column names strictly.
3. If any column relates to a URL, post link, or original link (such as "Original Link", "Post Link", "Source URL", "URL", or "Link"), populate it with the provided Source / Post Link.
4. For numeric fields (price, size, rent, floor), provide clean numbers or formatted strings as appropriate.
5. For "Owner/Agent" (or similar column): Strictly output ONLY either "Owner" or "Agent" (do not include names or extra words). If the content mentions or includes "owner" (e.g. owner post, เจ้าของ, direct owner), output "Owner"; otherwise output "Agent".
6. Put any personal names, agent/owner names, phone numbers, Line ID, or contact details into "Contact Info" instead.
7. If an image or media column exists, put a summary or the first photo URL if available.
8. If a field cannot be determined from the listing content or link, use an empty string "" or "N/A".
9. Do NOT include markdown blocks or any conversational text outside of the JSON object.
%s`, headersList, condoName, strings.TrimSpace(postURL), len(images), activeCodeGuidance, templateGuidance, customInstructions)

	aiSvc := NewGoogleAIService()
	var generatedJSON string
	var err error

	if selectedProvider == "openai" {
		generatedJSON, err = aiSvc.GenerateContentWithOpenAI(systemPrompt, rawContent, "", selectedModel)
	} else {
		generatedJSON, err = aiSvc.GenerateContent(systemPrompt, rawContent, "", selectedModel)
		if err != nil {
			log.Printf("[GoogleSheets] %s mapping error: %v; trying fallback...", selectedModel, err)
			generatedJSON, err = aiSvc.GenerateContentWithOpenAI(systemPrompt, rawContent, "", "gpt-4o-mini")
		}
	}
	if err != nil {
		return nil, nil, fmt.Errorf("AI parsing failed: %w", err)
	}

	// Clean JSON markdown fences & extract valid JSON block
	cleanJSON := strings.TrimSpace(generatedJSON)
	if strings.HasPrefix(cleanJSON, "```") {
		lines := strings.Split(cleanJSON, "\n")
		if len(lines) > 2 {
			cleanJSON = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}
	cleanJSON = strings.TrimSpace(cleanJSON)
	startIdx := strings.Index(cleanJSON, "{")
	endIdx := strings.LastIndex(cleanJSON, "}")
	if startIdx != -1 && endIdx != -1 && endIdx > startIdx {
		cleanJSON = cleanJSON[startIdx : endIdx+1]
	}

	var mappedData map[string]interface{}
	if err := json.Unmarshal([]byte(cleanJSON), &mappedData); err != nil {
		return nil, nil, fmt.Errorf("failed to parse AI JSON response: %w (raw response: %s)", err, cleanJSON)
	}

	// Build row values strictly in the order of the headers
	rowValues := make([]interface{}, len(headers))
	trimmedPostURL := strings.TrimSpace(postURL)

	for i, header := range headers {
		val, exists := mappedData[header]
		if !exists {
			// Case-insensitive lookup
			for k, v := range mappedData {
				if strings.EqualFold(k, header) {
					val = v
					exists = true
					break
				}
			}
		}

		// Safeguard for Link / URL / Source columns:
		// When the user specifies an Original Link / URL column, ensure it receives the exact social post link
		lowerH := strings.ToLower(strings.TrimSpace(header))
		if (strings.Contains(lowerH, "link") || strings.Contains(lowerH, "url") || strings.Contains(lowerH, "source")) && trimmedPostURL != "" {
			valStr := ""
			if val != nil {
				valStr = strings.TrimSpace(fmt.Sprintf("%v", val))
			}
			if !exists || val == nil || valStr == "" || strings.EqualFold(valStr, "n/a") || strings.EqualFold(valStr, "null") {
				val = trimmedPostURL
				mappedData[header] = trimmedPostURL
				exists = true
			}
		}

		// Safeguard for Code column:
		// Auto-generate a dynamic unique code (e.g. AEA-123456-GE) or preserve active listing code
		if lowerH == "code" || lowerH == "listing code" || lowerH == "property code" || lowerH == "unit code" || lowerH == "id" || lowerH == "listing id" {
			valStr := ""
			if val != nil {
				valStr = strings.TrimSpace(fmt.Sprintf("%v", val))
			}
			if strings.TrimSpace(listingCode) != "" {
				val = strings.TrimSpace(listingCode)
				mappedData[header] = val
				exists = true
			} else if autoGenerateCode || !exists || val == nil || valStr == "" || strings.EqualFold(valStr, "n/a") || strings.EqualFold(valStr, "null") {
				uniqueCode := GenerateUniqueCode(codeFormat)
				val = uniqueCode
				mappedData[header] = uniqueCode
				exists = true
			}
		}

		// Safeguard for Owner / Agent column:
		// Must strictly output either "Owner" or "Agent"
		if lowerH == "owner/agent" || lowerH == "owner or agent" || lowerH == "agent/owner" || lowerH == "owner" || lowerH == "agent" || strings.Contains(lowerH, "owner") {
			valStr := ""
			if val != nil {
				valStr = strings.TrimSpace(fmt.Sprintf("%v", val))
			}
			valLower := strings.ToLower(valStr)
			contentLower := strings.ToLower(rawContent)
			if strings.Contains(valLower, "owner") || strings.Contains(contentLower, "owner") || strings.Contains(rawContent, "เจ้าของ") {
				val = "Owner"
			} else {
				val = "Agent"
			}
			mappedData[header] = val
			exists = true
		}

		if exists && val != nil {
			rowValues[i] = val
		} else {
			rowValues[i] = ""
		}
	}

	return mappedData, rowValues, nil
}
