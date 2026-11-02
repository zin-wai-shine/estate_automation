package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/services"
)

var sheetsService = services.NewGoogleSheetsService()

// LoadGoogleSheetHeadersRequest represents the request payload to inspect a Google Sheet.
type LoadGoogleSheetHeadersRequest struct {
	SpreadsheetURL  string `json:"spreadsheet_url"`
	SheetName       string `json:"sheet_name"`
	HeaderRow       int    `json:"header_row,omitempty"`
	CredentialsJSON string `json:"credentials_json,omitempty"`
}

// LoadGoogleSheetHeaders - POST /api/google-sheets/load-headers
func LoadGoogleSheetHeaders(c *fiber.Ctx) error {
	var req LoadGoogleSheetHeadersRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request payload: " + err.Error(),
		})
	}

	urlOrID := strings.TrimSpace(req.SpreadsheetURL)
	if urlOrID == "" {
		// Default to the provided master sheet if none specified
		urlOrID = "https://docs.google.com/spreadsheets/d/1lzY57D5ers2Xs6cvbV-skeqGSAK_jijbQJZt8Hn8udY/edit?gid=0#gid=0"
	}

	headerRow := req.HeaderRow
	if headerRow <= 0 {
		headerRow = 1
	}

	meta, err := sheetsService.LoadHeaders(c.Context(), urlOrID, req.SheetName, headerRow, req.CredentialsJSON)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success":           true,
		"spreadsheet_id":    meta.SpreadsheetID,
		"spreadsheet_title": meta.SpreadsheetTitle,
		"sheet_name":        meta.SheetName,
		"available_sheets":  meta.AvailableSheets,
		"headers":           meta.Headers,
		"header_row":        meta.HeaderRow,
		"row_count":         meta.RowCount,
		"column_count":      meta.ColumnCount,
		"service_account":   meta.ServiceAccount,
	})
}

// ProcessGoogleSheetData - POST /api/google-sheets/process
// Universal Smart Data Mapping endpoint supporting Direct, AI Extract, and Smart Auto modes,
// with Append, Update, Upsert, and Preview operations.
func ProcessGoogleSheetData(c *fiber.Ctx) error {
	var req services.ProcessGoogleSheetDataRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request payload: " + err.Error(),
		})
	}

	if strings.TrimSpace(req.SpreadsheetURL) == "" {
		req.SpreadsheetURL = "https://docs.google.com/spreadsheets/d/1lzY57D5ers2Xs6cvbV-skeqGSAK_jijbQJZt8Hn8udY/edit?gid=0#gid=0"
	}

	res, err := sheetsService.ProcessGoogleSheetData(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(res)
}

// PrepareGoogleSheetDataRequest represents the request to structure listing data to sheet headers.
type PrepareGoogleSheetDataRequest struct {
	Headers            []string `json:"headers"`
	Content            string   `json:"content"`
	CondoName          string   `json:"condo_name"`
	Images             []string `json:"images"`
	CustomInstructions string   `json:"custom_instructions"`
	Model              string   `json:"model,omitempty"`
	Provider           string   `json:"provider,omitempty"`
	PromptTemplate     string   `json:"prompt_template,omitempty"`
}

// PrepareGoogleSheetData - POST /api/google-sheets/prepare-data
func PrepareGoogleSheetData(c *fiber.Ctx) error {
	var req PrepareGoogleSheetDataRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request payload: " + err.Error(),
		})
	}

	if len(req.Headers) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Headers list cannot be empty",
		})
	}

	mapped, rowValues, err := sheetsService.PrepareDataWithAI(
		c.Context(),
		req.Headers,
		req.Content,
		req.CondoName,
		req.Images,
		req.CustomInstructions,
		req.Model,
		req.Provider,
		req.PromptTemplate,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success":     true,
		"mapped_data": mapped,
		"row_values":  rowValues,
	})
}

// AppendGoogleSheetRowRequest represents the request to write a row into the spreadsheet.
type AppendGoogleSheetRowRequest struct {
	SpreadsheetURL  string        `json:"spreadsheet_url"`
	SheetName       string        `json:"sheet_name"`
	RowValues       []interface{} `json:"row_values"`
	CredentialsJSON string        `json:"credentials_json,omitempty"`
}

// AppendGoogleSheetRow - POST /api/google-sheets/append-row
func AppendGoogleSheetRow(c *fiber.Ctx) error {
	var req AppendGoogleSheetRowRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request payload: " + err.Error(),
		})
	}

	urlOrID := strings.TrimSpace(req.SpreadsheetURL)
	if urlOrID == "" {
		urlOrID = "1lzY57D5ers2Xs6cvbV-skeqGSAK_jijbQJZt8Hn8udY"
	}

	if len(req.RowValues) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "row_values cannot be empty",
		})
	}

	result, err := sheetsService.AppendRow(c.Context(), urlOrID, req.SheetName, req.RowValues, req.CredentialsJSON)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"result":  result,
	})
}

// SyncGoogleSheetRequest represents an all-in-one sync request.
type SyncGoogleSheetRequest struct {
	SpreadsheetURL     string   `json:"spreadsheet_url"`
	SheetName          string   `json:"sheet_name"`
	Headers            []string `json:"headers"`
	Content            string   `json:"content"`
	CondoName          string   `json:"condo_name"`
	Images             []string `json:"images"`
	CustomInstructions string   `json:"custom_instructions"`
	Model              string   `json:"model,omitempty"`
	Provider           string   `json:"provider,omitempty"`
	PromptTemplate     string   `json:"prompt_template,omitempty"`
	CredentialsJSON    string   `json:"credentials_json,omitempty"`
}

// ExecuteGoogleSheetSync - POST /api/google-sheets/sync
func ExecuteGoogleSheetSync(c *fiber.Ctx) error {
	var req SyncGoogleSheetRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request payload: " + err.Error(),
		})
	}

	urlOrID := strings.TrimSpace(req.SpreadsheetURL)
	if urlOrID == "" {
		urlOrID = "1lzY57D5ers2Xs6cvbV-skeqGSAK_jijbQJZt8Hn8udY"
	}

	headers := req.Headers
	sheetName := req.SheetName

	// If headers not supplied, fetch dynamically from sheet
	if len(headers) == 0 {
		meta, err := sheetsService.LoadHeaders(c.Context(), urlOrID, sheetName, 1, req.CredentialsJSON)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false,
				"error":   "Failed to load headers from sheet: " + err.Error(),
			})
		}
		headers = meta.Headers
		if sheetName == "" {
			sheetName = meta.SheetName
		}
	}

	if len(headers) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Spreadsheet has no headers defined in Row 1. Please add column names in Row 1 of your sheet.",
		})
	}

	// AI Data Preparation
	mapped, rowValues, err := sheetsService.PrepareDataWithAI(
		c.Context(),
		headers,
		req.Content,
		req.CondoName,
		req.Images,
		req.CustomInstructions,
		req.Model,
		req.Provider,
		req.PromptTemplate,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "AI data preparation failed: " + err.Error(),
		})
	}

	// Append Row to Google Sheet
	appendRes, err := sheetsService.AppendRow(c.Context(), urlOrID, sheetName, rowValues, req.CredentialsJSON)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success":     false,
			"error":       "Failed to append row to Google Sheet: " + err.Error(),
			"mapped_data": mapped,
			"row_values":  rowValues,
		})
	}

	return c.JSON(fiber.Map{
		"success":       true,
		"headers":       headers,
		"mapped_data":   mapped,
		"row_values":    rowValues,
		"append_result": appendRes,
	})
}
