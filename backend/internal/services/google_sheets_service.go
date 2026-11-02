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
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
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
	AvailableSheets  []string `json:"available_sheets"`
	Headers          []string `json:"headers"`
	HeaderRow        int      `json:"header_row"`
	RowCount         int      `json:"row_count"`
	ColumnCount      int      `json:"column_count"`
	ServiceAccount   string   `json:"service_account"`
}

// ColumnMappingConfig represents per-column transformation and mapping configuration.
type ColumnMappingConfig struct {
	SheetColumn          string `json:"sheet_column"`
	ColumnIndex          int    `json:"column_index"`
	MappingMode          string `json:"mapping_mode"` // "auto", "direct", "ai_extract", "static", "derived", "ignore"
	SourceField          string `json:"source_field,omitempty"`
	DataType             string `json:"data_type,omitempty"` // "string", "number", "currency", "date", "boolean", "url"
	Required             bool   `json:"required,omitempty"`
	AIDescription        string `json:"ai_description,omitempty"`
	DefaultValue         string `json:"default_value,omitempty"`
	StaticValue          string `json:"static_value,omitempty"`
	Transform            string `json:"transform,omitempty"` // "trim", "uppercase", "lowercase", "clean_number", "format_currency_thb", "round"
	MissingValueHandling string `json:"missing_value_handling,omitempty"` // "empty", "default", "skip_row"
}

// LoadHeaders retrieves the sheet metadata and column headers from the specified header row (1-based, default 1).
func (s *GoogleSheetsService) LoadHeaders(ctx context.Context, spreadsheetInput string, sheetNameOpt string, headerRowOpt int, customCredsJSON string) (*SheetMetadata, error) {
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

	availableSheets := make([]string, 0, len(sheetResp.Sheets))
	for _, sh := range sheetResp.Sheets {
		if sh.Properties.Title != "" {
			availableSheets = append(availableSheets, sh.Properties.Title)
		}
	}

	// Target specific sheet or default to first sheet
	targetSheetIndex := 0
	if sheetNameOpt != "" {
		for i, sh := range sheetResp.Sheets {
			if strings.EqualFold(sh.Properties.Title, sheetNameOpt) {
				targetSheetIndex = i
				break
			}
		}
	}

	chosenSheet := sheetResp.Sheets[targetSheetIndex]
	headers := []string{}

	headerRow := headerRowOpt
	if headerRow <= 0 {
		headerRow = 1
	}
	rowIndex := headerRow - 1

	if len(chosenSheet.Data) > 0 && len(chosenSheet.Data[0].RowData) > rowIndex {
		targetRow := chosenSheet.Data[0].RowData[rowIndex].Values
		for _, v := range targetRow {
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
		AvailableSheets:  availableSheets,
		Headers:          headers,
		HeaderRow:        headerRow,
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

	sheetName := "Sheet1"
	if sheetNameOpt != "" {
		sheetName = sheetNameOpt
	}

	// Range to append to
	escapedSheet := url.PathEscape(sheetName)
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS", spreadsheetID, escapedSheet)

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

	return appendResult, nil
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

	systemPrompt := fmt.Sprintf(`You are an expert real estate data parser and listing analyst.
Your task is to parse the property listing content and map it into a JSON object matching these exact spreadsheet column headers:
[%s]

Condo / Project Name (if known): "%s"
Number of Available Photos: %d
%s

Guidelines:
1. Return ONLY a valid, parseable JSON object where each key corresponds EXACTLY to one of the spreadsheet column headers listed above.
2. For numeric fields (price, size, rent), provide clean numbers or formatted strings as appropriate.
3. If an image or media column exists, put a summary or the first photo URL if available.
4. If a field cannot be determined from the listing, use an empty string "" or "N/A".
5. Do NOT include markdown blocks or any conversational text outside of the JSON object.
%s`, headersList, condoName, len(images), templateGuidance, customInstructions)

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

	// Clean JSON markdown fences
	cleanJSON := strings.TrimSpace(generatedJSON)
	if strings.HasPrefix(cleanJSON, "```") {
		lines := strings.Split(cleanJSON, "\n")
		if len(lines) > 2 {
			cleanJSON = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}

	var mappedData map[string]interface{}
	if err := json.Unmarshal([]byte(cleanJSON), &mappedData); err != nil {
		return nil, nil, fmt.Errorf("failed to parse AI JSON response: %w (raw response: %s)", err, cleanJSON)
	}

	// Build row values strictly in the order of the headers
	rowValues := make([]interface{}, len(headers))
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
		if exists && val != nil {
			rowValues[i] = val
		} else {
			rowValues[i] = ""
		}
	}

	return mappedData, rowValues, nil
}

// ReadRows fetches all row values from the specified sheet.
func (s *GoogleSheetsService) ReadRows(ctx context.Context, spreadsheetInput string, sheetNameOpt string, customCredsJSON string) ([][]string, error) {
	spreadsheetID := ExtractSpreadsheetID(spreadsheetInput)
	if spreadsheetID == "" {
		return nil, fmt.Errorf("invalid spreadsheet URL or ID provided")
	}

	token, _, err := s.GetTokenAndCreds(ctx, customCredsJSON)
	if err != nil {
		return nil, fmt.Errorf("authentication error: %w", err)
	}

	sheetName := "Sheet1"
	if sheetNameOpt != "" {
		sheetName = sheetNameOpt
	}

	escapedSheet := url.PathEscape(sheetName)
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s?valueRenderOption=FORMATTED_VALUE", spreadsheetID, escapedSheet)

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch rows: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Google Sheets read failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var valResp struct {
		Values [][]interface{} `json:"values"`
	}
	if err := json.Unmarshal(bodyBytes, &valResp); err != nil {
		return nil, fmt.Errorf("failed to parse values response: %w", err)
	}

	result := make([][]string, len(valResp.Values))
	for r, row := range valResp.Values {
		strRow := make([]string, len(row))
		for c, cell := range row {
			if cell != nil {
				strRow[c] = fmt.Sprintf("%v", cell)
			}
		}
		result[r] = strRow
	}

	return result, nil
}

// UpdateRow updates a specific 1-based row index in the sheet.
func (s *GoogleSheetsService) UpdateRow(ctx context.Context, spreadsheetInput string, sheetNameOpt string, rowNum int, values []interface{}, customCredsJSON string) error {
	spreadsheetID := ExtractSpreadsheetID(spreadsheetInput)
	if spreadsheetID == "" {
		return fmt.Errorf("invalid spreadsheet URL or ID provided")
	}

	token, _, err := s.GetTokenAndCreds(ctx, customCredsJSON)
	if err != nil {
		return fmt.Errorf("authentication error: %w", err)
	}

	sheetName := "Sheet1"
	if sheetNameOpt != "" {
		sheetName = sheetNameOpt
	}

	escapedSheet := url.PathEscape(sheetName)
	rangeStr := fmt.Sprintf("%s!A%d", escapedSheet, rowNum)
	apiURL := fmt.Sprintf("https://sheets.googleapis.com/v4/spreadsheets/%s/values/%s?valueInputOption=USER_ENTERED", spreadsheetID, rangeStr)

	payload := map[string]interface{}{
		"majorDimension": "ROWS",
		"values": [][]interface{}{
			values,
		},
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", apiURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute update request: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Google Sheets update failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// ProcessGoogleSheetDataRequest holds all configuration for Smart Data Mapping & Execution.
type ProcessGoogleSheetDataRequest struct {
	SpreadsheetURL     string                `json:"spreadsheet_url"`
	SheetName          string                `json:"sheet_name"`
	HeaderRow          int                   `json:"header_row"`
	Mode               string                `json:"mode"`      // "smart_auto" (default), "direct", "ai_extract"
	Operation          string                `json:"operation"` // "append" (default), "update", "upsert", "preview"
	MatchColumns       []string              `json:"match_columns"`
	PreserveNonEmpty   bool                  `json:"preserve_non_empty"`
	ColumnMappings     []ColumnMappingConfig `json:"column_mappings"`
	IncomingData       map[string]interface{}`json:"incoming_data"`
	RawContent         string                `json:"raw_content"`
	CondoName          string                `json:"condo_name"`
	Images             []string              `json:"images"`
	CustomInstructions string                `json:"custom_instructions"`
	Model              string                `json:"model,omitempty"`
	Provider           string                `json:"provider,omitempty"`
	PromptTemplate     string                `json:"prompt_template,omitempty"`
	CredentialsJSON    string                `json:"credentials_json,omitempty"`
}

// ProcessGoogleSheetResult represents the outcome of the universal sheet processing.
type ProcessGoogleSheetResult struct {
	Success          bool                   `json:"success"`
	Mode             string                 `json:"mode"`
	Operation        string                 `json:"operation"`
	SpreadsheetTitle string                 `json:"spreadsheet_title,omitempty"`
	SheetName        string                 `json:"sheet_name"`
	Headers          []string               `json:"headers"`
	MappedData       map[string]interface{} `json:"mapped_data"`
	RowValues        []interface{}          `json:"row_values"`
	RowNumber        int                    `json:"row_number,omitempty"`
	AIInvoked        bool                   `json:"ai_invoked"`
	ExecutionSummary string                 `json:"execution_summary"`
	Error            string                 `json:"error,omitempty"`
}

// resolveDotPath navigates nested map structures via dot paths (e.g. "property.code").
func resolveDotPath(data map[string]interface{}, path string) (interface{}, bool) {
	if path == "" || data == nil {
		return nil, false
	}
	parts := strings.Split(path, ".")
	var current interface{} = data
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if m, ok := current.(map[string]interface{}); ok {
			val, exists := m[part]
			if !exists {
				// Case-insensitive match fallback
				found := false
				for k, v := range m {
					if strings.EqualFold(k, part) {
						val = v
						found = true
						break
					}
				}
				if !found {
					return nil, false
				}
			}
			current = val
		} else {
			return nil, false
		}
	}
	if current == nil {
		return nil, false
	}
	if str, ok := current.(string); ok && strings.TrimSpace(str) == "" {
		return nil, false
	}
	return current, true
}

// heuristicLookup searches common property fields when no explicit dot path is specified.
func heuristicLookup(data map[string]interface{}, colName string) (interface{}, bool) {
	if data == nil {
		return nil, false
	}
	cleaned := strings.ToLower(regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(colName, ""))

	var candidates []string
	switch {
	case strings.Contains(cleaned, "code") || strings.Contains(cleaned, "ref") || strings.Contains(cleaned, "id"):
		candidates = []string{"code", "property_code", "property.code", "property.property_code", "id", "ref"}
	case strings.Contains(cleaned, "project") || strings.Contains(cleaned, "condo") || strings.Contains(cleaned, "building"):
		candidates = []string{"project", "project_name", "condo_name", "property.project_name", "property.project", "title"}
	case strings.Contains(cleaned, "room") || strings.Contains(cleaned, "bed") || strings.Contains(cleaned, "type"):
		candidates = []string{"room_type", "bedrooms", "bedroom", "property.room_type", "property.bedrooms"}
	case strings.Contains(cleaned, "size") || strings.Contains(cleaned, "sqm") || strings.Contains(cleaned, "area"):
		candidates = []string{"size", "size_sqm", "area", "property.size", "property.size_sqm"}
	case strings.Contains(cleaned, "floor"):
		candidates = []string{"floor", "floor_level", "property.floor"}
	case strings.Contains(cleaned, "price") || strings.Contains(cleaned, "rent"):
		candidates = []string{"price", "rental_price", "property.price", "property.rental_price"}
	case strings.Contains(cleaned, "bts") || strings.Contains(cleaned, "mrt") || strings.Contains(cleaned, "station"):
		candidates = []string{"station", "bts_mrt", "bts", "mrt", "property.station", "property.bts_mrt"}
	case strings.Contains(cleaned, "owner") || strings.Contains(cleaned, "agent"):
		candidates = []string{"owner", "agent", "agent_name", "property.agent_name", "contact_person"}
	case strings.Contains(cleaned, "contact") || strings.Contains(cleaned, "phone") || strings.Contains(cleaned, "line"):
		candidates = []string{"contact", "phone", "contact_info", "tel", "line_id", "property.contact_info"}
	case strings.Contains(cleaned, "link") || strings.Contains(cleaned, "url") || strings.Contains(cleaned, "source"):
		candidates = []string{"url", "link", "source_url", "original_link", "property.source_url"}
	default:
		candidates = []string{strings.ToLower(colName), strings.ReplaceAll(strings.ToLower(colName), " ", "_")}
	}

	for _, c := range candidates {
		if val, ok := resolveDotPath(data, c); ok && val != nil {
			return val, true
		}
	}
	return nil, false
}

// applyTransform applies formatting transformations to a field value.
func applyTransform(val interface{}, transform string) interface{} {
	if val == nil {
		return ""
	}
	strVal := fmt.Sprintf("%v", val)
	switch transform {
	case "uppercase":
		return strings.ToUpper(strVal)
	case "lowercase":
		return strings.ToLower(strVal)
	case "trim":
		return strings.TrimSpace(strVal)
	case "clean_number":
		return regexp.MustCompile(`[^-0-9.]`).ReplaceAllString(strVal, "")
	case "format_currency_thb":
		numOnly := regexp.MustCompile(`[^-0-9.]`).ReplaceAllString(strVal, "")
		if numOnly != "" {
			return numOnly + " THB"
		}
		return strVal
	case "round":
		var f float64
		if _, err := fmt.Sscanf(strVal, "%f", &f); err == nil {
			return fmt.Sprintf("%.0f", f)
		}
		return strVal
	default:
		return val
	}
}

// ProcessGoogleSheetData runs the universal smart data mapping pipeline.
func (s *GoogleSheetsService) ProcessGoogleSheetData(ctx context.Context, req ProcessGoogleSheetDataRequest) (*ProcessGoogleSheetResult, error) {
	spreadsheetID := ExtractSpreadsheetID(req.SpreadsheetURL)
	if spreadsheetID == "" {
		return nil, fmt.Errorf("invalid spreadsheet URL or ID provided")
	}

	mode := strings.ToLower(strings.TrimSpace(req.Mode))
	if mode == "" {
		mode = "smart_auto"
	}
	operation := strings.ToLower(strings.TrimSpace(req.Operation))
	if operation == "" {
		operation = "append"
	}

	headerRow := req.HeaderRow
	if headerRow <= 0 {
		headerRow = 1
	}

	// Load sheet schema & headers
	meta, err := s.LoadHeaders(ctx, spreadsheetID, req.SheetName, headerRow, req.CredentialsJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to load spreadsheet schema: %w", err)
	}

	headers := meta.Headers
	if len(headers) == 0 {
		return nil, fmt.Errorf("spreadsheet has no column headers detected at row %d", headerRow)
	}

	// Build map of user-defined column configurations by header name
	mappingByCol := make(map[string]ColumnMappingConfig)
	for _, m := range req.ColumnMappings {
		mappingByCol[strings.TrimSpace(m.SheetColumn)] = m
	}

	mappedData := make(map[string]interface{})
	columnsNeedingAI := []string{}
	aiColumnHints := make(map[string]string)

	// Step 1: Evaluate Direct / Static / Configured Mappings
	for _, header := range headers {
		cfg, hasCfg := mappingByCol[header]
		if !hasCfg {
			// Case-insensitive lookup fallback
			for k, v := range mappingByCol {
				if strings.EqualFold(k, header) {
					cfg = v
					hasCfg = true
					break
				}
			}
		}

		mapMode := "auto"
		if hasCfg && cfg.MappingMode != "" {
			mapMode = cfg.MappingMode
		}

		if mapMode == "ignore" {
			mappedData[header] = ""
			continue
		}

		if mapMode == "static" {
			mappedData[header] = cfg.StaticValue
			continue
		}

		// Direct or Auto Mode: Check incoming structured data
		var resolvedVal interface{}
		var resolved bool

		if hasCfg && cfg.SourceField != "" {
			resolvedVal, resolved = resolveDotPath(req.IncomingData, cfg.SourceField)
		} else if mode != "ai_extract" {
			// Try heuristic matching
			resolvedVal, resolved = heuristicLookup(req.IncomingData, header)
		}

		if resolved && resolvedVal != nil {
			if cfg.Transform != "" {
				resolvedVal = applyTransform(resolvedVal, cfg.Transform)
			}
			mappedData[header] = resolvedVal
		} else {
			// Field is not directly available
			if mode == "direct" || mapMode == "direct" {
				if cfg.DefaultValue != "" {
					mappedData[header] = cfg.DefaultValue
				} else {
					mappedData[header] = ""
				}
			} else {
				// Mark for AI Extraction
				columnsNeedingAI = append(columnsNeedingAI, header)
				if cfg.AIDescription != "" {
					aiColumnHints[header] = cfg.AIDescription
				}
			}
		}
	}

	// Step 2: AI Extraction if needed
	aiInvoked := false
	if len(columnsNeedingAI) > 0 && mode != "direct" {
		rawText := strings.TrimSpace(req.RawContent)
		if rawText == "" && req.IncomingData != nil {
			// Try caption or description from incoming data
			if c, ok := resolveDotPath(req.IncomingData, "caption"); ok {
				rawText = fmt.Sprintf("%v", c)
			} else if d, ok := resolveDotPath(req.IncomingData, "description"); ok {
				rawText = fmt.Sprintf("%v", d)
			}
		}

		if rawText != "" {
			aiInvoked = true
			var instructionsBuilder strings.Builder
			instructionsBuilder.WriteString(fmt.Sprintf("Spreadsheet: %s\nTarget Columns to Extract (%d):\n", meta.SpreadsheetTitle, len(columnsNeedingAI)))
			for _, col := range columnsNeedingAI {
				hint := aiColumnHints[col]
				if hint != "" {
					instructionsBuilder.WriteString(fmt.Sprintf("- %s: %s\n", col, hint))
				} else {
					instructionsBuilder.WriteString(fmt.Sprintf("- %s\n", col))
				}
			}

			if req.CustomInstructions != "" {
				instructionsBuilder.WriteString(fmt.Sprintf("\nUser Mapping Instructions:\n%s\n", req.CustomInstructions))
			}

			selectedModel := req.Model
			if selectedModel == "" {
				selectedModel = "gemini-1.5-flash"
			}

			extracted, _, err := s.PrepareDataWithAI(
				ctx,
				columnsNeedingAI,
				rawText,
				req.CondoName,
				req.Images,
				instructionsBuilder.String(),
				selectedModel,
				req.Provider,
				req.PromptTemplate,
			)
			if err != nil {
				log.Printf("[GoogleSheet] AI extraction error: %v", err)
			} else {
				// Merge AI extracted fields without overwriting valid structured data
				for _, col := range columnsNeedingAI {
					val, exists := extracted[col]
					if !exists {
						for k, v := range extracted {
							if strings.EqualFold(k, col) {
								val = v
								exists = true
								break
							}
						}
					}
					if exists && val != nil {
						cfg := mappingByCol[col]
						if cfg.Transform != "" {
							val = applyTransform(val, cfg.Transform)
						}
						mappedData[col] = val
					} else {
						cfg := mappingByCol[col]
						if cfg.DefaultValue != "" {
							mappedData[col] = cfg.DefaultValue
						} else {
							mappedData[col] = ""
						}
					}
				}
			}
		} else {
			// No raw text available to extract from; fill defaults
			for _, col := range columnsNeedingAI {
				cfg := mappingByCol[col]
				if cfg.DefaultValue != "" {
					mappedData[col] = cfg.DefaultValue
				} else {
					mappedData[col] = ""
				}
			}
		}
	}

	// Build row values strictly in the order of sheet headers
	rowValues := make([]interface{}, len(headers))
	for i, hdr := range headers {
		val, exists := mappedData[hdr]
		if !exists || val == nil {
			val = ""
		}
		rowValues[i] = val
	}

	result := &ProcessGoogleSheetResult{
		Success:          true,
		Mode:             mode,
		Operation:        operation,
		SpreadsheetTitle: meta.SpreadsheetTitle,
		SheetName:        meta.SheetName,
		Headers:          headers,
		MappedData:       mappedData,
		RowValues:        rowValues,
		AIInvoked:        aiInvoked,
	}

	// Preview operation: return without writing
	if operation == "preview" {
		result.ExecutionSummary = fmt.Sprintf("Preview generated for %d columns (AI Invoked: %t)", len(headers), aiInvoked)
		return result, nil
	}

	// Step 3: Write Operations (Append, Update, Upsert)
	if operation == "append" {
		appendRes, err := s.AppendRow(ctx, spreadsheetID, meta.SheetName, rowValues, req.CredentialsJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to append row: %w", err)
		}
		result.ExecutionSummary = fmt.Sprintf("Appended 1 row to '%s' (AI Invoked: %t)", meta.SheetName, aiInvoked)
		if updates, ok := appendRes["updates"].(map[string]interface{}); ok {
			if updatedRange, ok := updates["updatedRange"].(string); ok {
				result.ExecutionSummary += fmt.Sprintf(" - %s", updatedRange)
			}
		}
		return result, nil
	}

	// Update or Upsert operation
	matchCols := req.MatchColumns
	if len(matchCols) == 0 {
		// Default to first column if no match column specified
		matchCols = []string{headers[0]}
	}

	existingRows, err := s.ReadRows(ctx, spreadsheetID, meta.SheetName, req.CredentialsJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to read existing sheet rows for matching: %w", err)
	}

	// Map match column names to their 0-based indices in headers
	matchIndices := make(map[string]int)
	for _, mc := range matchCols {
		for i, h := range headers {
			if strings.EqualFold(strings.TrimSpace(h), strings.TrimSpace(mc)) {
				matchIndices[mc] = i
				break
			}
		}
	}

	matchingRowIndex := -1 // 1-based row index in sheet
	// Start scanning after headerRow
	for r := headerRow; r < len(existingRows); r++ {
		row := existingRows[r]
		allMatched := true
		for mc, colIdx := range matchIndices {
			expectedVal := strings.TrimSpace(fmt.Sprintf("%v", mappedData[mc]))
			var actualVal string
			if colIdx < len(row) {
				actualVal = strings.TrimSpace(row[colIdx])
			}
			if expectedVal == "" || !strings.EqualFold(expectedVal, actualVal) {
				allMatched = false
				break
			}
		}
		if allMatched {
			matchingRowIndex = r + 1 // 1-based index
			break
		}
	}

	if matchingRowIndex > 0 {
		// Found existing row: perform Update
		finalUpdateRow := make([]interface{}, len(headers))
		existingMatchedRow := existingRows[matchingRowIndex-1]

		for i, hdr := range headers {
			newVal := mappedData[hdr]
			strNewVal := strings.TrimSpace(fmt.Sprintf("%v", newVal))
			if req.PreserveNonEmpty && strNewVal == "" && i < len(existingMatchedRow) {
				// Keep existing sheet value
				finalUpdateRow[i] = existingMatchedRow[i]
			} else {
				finalUpdateRow[i] = newVal
			}
		}

		err := s.UpdateRow(ctx, spreadsheetID, meta.SheetName, matchingRowIndex, finalUpdateRow, req.CredentialsJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to update row %d: %w", matchingRowIndex, err)
		}
		result.RowNumber = matchingRowIndex
		result.RowValues = finalUpdateRow
		result.ExecutionSummary = fmt.Sprintf("Updated existing row %d in '%s' (AI Invoked: %t)", matchingRowIndex, meta.SheetName, aiInvoked)
		return result, nil
	}

	// No matching row found
	if operation == "upsert" {
		appendRes, err := s.AppendRow(ctx, spreadsheetID, meta.SheetName, rowValues, req.CredentialsJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to append upserted row: %w", err)
		}
		result.ExecutionSummary = fmt.Sprintf("No existing match found. Appended new row to '%s' (AI Invoked: %t)", meta.SheetName, aiInvoked)
		if updates, ok := appendRes["updates"].(map[string]interface{}); ok {
			if updatedRange, ok := updates["updatedRange"].(string); ok {
				result.ExecutionSummary += fmt.Sprintf(" - %s", updatedRange)
			}
		}
		return result, nil
	}

	return nil, fmt.Errorf("no matching row found in sheet to update matching on columns: %v", matchCols)
}
