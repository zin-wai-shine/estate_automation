package handlers

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/gofiber/fiber/v2"
)

var workflowMutex sync.Mutex

func getWorkflowConfigFilePath() string {
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "data"
	}
	_ = os.MkdirAll(dataDir, 0755)
	return filepath.Join(dataDir, "workflow_config.json")
}

// GetWorkflowConfig retrieves saved workflow map config
func GetWorkflowConfig(c *fiber.Ctx) error {
	workflowMutex.Lock()
	defer workflowMutex.Unlock()

	filePath := getWorkflowConfigFilePath()
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return c.JSON(fiber.Map{
			"has_saved_config": false,
		})
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to read workflow config",
		})
	}

	var rawConfig map[string]interface{}
	if err := json.Unmarshal(data, &rawConfig); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to parse workflow config",
		})
	}

	rawConfig["has_saved_config"] = true
	return c.JSON(rawConfig)
}

// SaveWorkflowConfig persists updated workflow map config (nodes, path switches, layout)
func SaveWorkflowConfig(c *fiber.Ctx) error {
	workflowMutex.Lock()
	defer workflowMutex.Unlock()

	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request payload",
		})
	}

	filePath := getWorkflowConfigFilePath()
	mergedConfig := make(map[string]interface{})

	// Read existing configuration if present to merge keys cleanly
	if existingData, err := os.ReadFile(filePath); err == nil {
		_ = json.Unmarshal(existingData, &mergedConfig)
	}

	// Merge incoming payload into existing configuration so keys like workflow_formats and facebook_import_workflow never wipe each other
	for k, v := range payload {
		mergedConfig[k] = v
	}

	data, err := json.MarshalIndent(mergedConfig, "", "  ")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to serialize workflow config",
		})
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to save workflow config file",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Workflow map configuration saved successfully",
	})
}
