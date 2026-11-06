package handlers

import (
	"fmt"
	"log"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/services"
)

var sheetsService = services.NewGoogleSheetsService()

// LoadGoogleSheetHeadersRequest represents the request payload to inspect a Google Sheet.
type LoadGoogleSheetHeadersRequest struct {
	SpreadsheetURL  string `json:"spreadsheet_url"`
	SheetName       string `json:"sheet_name"`
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

	meta, err := sheetsService.LoadHeaders(c.Context(), urlOrID, req.SheetName, req.CredentialsJSON)
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
		"headers":           meta.Headers,
		"row_count":         meta.RowCount,
		"column_count":      meta.ColumnCount,
		"service_account":   meta.ServiceAccount,
	})
}

// FetchGoogleSheetRowsRequest represents the request to fetch all rows from Google Sheet
type FetchGoogleSheetRowsRequest struct {
	SpreadsheetURL  string `json:"spreadsheet_url"`
	SheetName       string `json:"sheet_name"`
	CredentialsJSON string `json:"credentials_json,omitempty"`
	Limit           int    `json:"limit,omitempty"`
}

// FetchGoogleSheetRows - POST /api/google-sheets/fetch-rows
func FetchGoogleSheetRows(c *fiber.Ctx) error {
	var req FetchGoogleSheetRowsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   "Invalid request payload: " + err.Error(),
		})
	}

	urlOrID := strings.TrimSpace(req.SpreadsheetURL)
	if urlOrID == "" {
		urlOrID = "https://docs.google.com/spreadsheets/d/1lzY57D5ers2Xs6cvbV-skeqGSAK_jijbQJZt8Hn8udY/edit?gid=0#gid=0"
	}

	result, err := sheetsService.FetchAllRows(c.Context(), urlOrID, req.SheetName, req.CredentialsJSON, req.Limit)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false,
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success":           true,
		"spreadsheet_id":    result.SpreadsheetID,
		"spreadsheet_title": result.SpreadsheetTitle,
		"sheet_name":        result.SheetName,
		"headers":           result.Headers,
		"rows":              result.Rows,
		"total_rows":        result.TotalRows,
		"service_account":   result.ServiceAccount,
	})
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
	PostURL            string   `json:"post_url,omitempty"`
	SourceURL          string   `json:"source_url,omitempty"`
	Link               string   `json:"link,omitempty"`
	CodeFormat         string   `json:"code_format,omitempty"`
	AutoGenerateCode   *bool    `json:"auto_generate_code,omitempty"`
	ListingCode        string   `json:"listing_code,omitempty"`
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

	effectiveLink := req.PostURL
	if effectiveLink == "" {
		effectiveLink = req.SourceURL
	}
	if effectiveLink == "" {
		effectiveLink = req.Link
	}

	autoGen := true
	if req.AutoGenerateCode != nil {
		autoGen = *req.AutoGenerateCode
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
		effectiveLink,
		req.CodeFormat,
		autoGen,
		req.ListingCode,
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
	PostURL            string   `json:"post_url,omitempty"`
	SourceURL          string   `json:"source_url,omitempty"`
	Link               string   `json:"link,omitempty"`
	CodeFormat         string   `json:"code_format,omitempty"`
	AutoGenerateCode   *bool    `json:"auto_generate_code,omitempty"`
	ListingCode        string   `json:"listing_code,omitempty"`
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

	// If URL has a gid parameter, automatically resolve the sheet tab name from that tab
	targetGID := services.ExtractSheetGID(urlOrID)
	if targetGID >= 0 {
		meta, err := sheetsService.LoadHeaders(c.Context(), urlOrID, "", req.CredentialsJSON)
		if err == nil && meta != nil && meta.SheetName != "" {
			sheetName = meta.SheetName
			if len(headers) == 0 {
				headers = meta.Headers
			}
		}
	}

	// If headers not supplied, fetch dynamically from sheet
	if len(headers) == 0 {
		meta, err := sheetsService.LoadHeaders(c.Context(), urlOrID, sheetName, req.CredentialsJSON)
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

	effectiveLink := req.PostURL
	if effectiveLink == "" {
		effectiveLink = req.SourceURL
	}
	if effectiveLink == "" {
		effectiveLink = req.Link
	}

	autoGen := true
	if req.AutoGenerateCode != nil {
		autoGen = *req.AutoGenerateCode
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
		effectiveLink,
		req.CodeFormat,
		autoGen,
		req.ListingCode,
	)
	if err != nil {
		log.Printf("[ExecuteGoogleSheetSync] PrepareDataWithAI error: %v (model: %s, link: %s)", err, req.Model, effectiveLink)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "AI data preparation failed: " + err.Error(),
		})
	}

	// Append Row to Google Sheet
	appendRes, err := sheetsService.AppendRow(c.Context(), urlOrID, sheetName, rowValues, req.CredentialsJSON)
	if err != nil {
		log.Printf("[ExecuteGoogleSheetSync] AppendRow error: %v (urlOrID: %s, sheet: %s)", err, urlOrID, sheetName)
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
		"sheet_name":    sheetName,
		"mapped_data":   mapped,
		"row_values":    rowValues,
		"append_result": appendRes,
	})
}

// DeleteGoogleSheetRowRequest payload for deleting a previously added row
type DeleteGoogleSheetRowRequest struct {
	SpreadsheetURL  string `json:"spreadsheet_url"`
	SheetName       string `json:"sheet_name"`
	RowIndex        *int   `json:"row_index"`
	ListingCode     string `json:"listing_code"`
	CredentialsJSON string `json:"credentials_json"`
}

// DeleteGoogleSheetRow - POST /api/google-sheets/delete-row
func DeleteGoogleSheetRow(c *fiber.Ctx) error {
	var req DeleteGoogleSheetRowRequest
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

	targetRowIdx := -1
	if req.RowIndex != nil {
		targetRowIdx = *req.RowIndex
	}

	res, err := sheetsService.DeleteRow(c.Context(), urlOrID, req.SheetName, targetRowIdx, req.ListingCode, req.CredentialsJSON)
	if err != nil {
		log.Printf("[DeleteGoogleSheetRow] DeleteRow error: %v (urlOrID: %s, sheet: %s, rowIdx: %d, code: %s)", err, urlOrID, req.SheetName, targetRowIdx, req.ListingCode)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "Failed to delete row from Google Sheet: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": fmt.Sprintf("Row #%v successfully deleted from '%v'!", res["deleted_row_num"], res["sheet_name"]),
		"result":  res,
	})
}
