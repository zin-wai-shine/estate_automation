package handlers

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/services"
)

// N8NStatusCheck - GET /api/integrations/n8n/status
// Performs a live health check against the n8n instance and returns connection status.
func N8NStatusCheck(c *fiber.Ctx) error {
	svc := services.GetN8NService()
	status, err := svc.TestConnection(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Internal Server Error",
			"message": err.Error(),
		})
	}
	cfg := svc.GetConfig()
	return c.JSON(fiber.Map{
		"status":  "success",
		"data": fiber.Map{
			"connection": status,
			"config":     cfg,
		},
	})
}

// N8NListWorkflows - GET /api/integrations/n8n/workflows
// Fetches workflows from n8n API, or falls back to local database connections.
func N8NListWorkflows(c *fiber.Ctx) error {
	svc := services.GetN8NService()
	workflows, err := svc.GetWorkflows(c.Context())
	if err != nil {
		// Fallback to local connections in PostgreSQL so workflows are visible and runnable
		var conns []models.N8NWorkflowConnection
		if database.DB != nil {
			database.DB.Where("deleted_at IS NULL").Find(&conns)
		}
		if len(conns) > 0 {
			converted := make([]services.N8NWorkflow, len(conns))
			for i, conn := range conns {
				converted[i] = services.N8NWorkflow{
					ID:        conn.N8NWorkflowID,
					Name:      conn.DisplayName,
					Active:    conn.IsActive,
					CreatedAt: conn.CreatedAt,
					UpdatedAt: conn.UpdatedAt,
					Tags: []services.N8NTag{
						{ID: "webhook", Name: conn.WebhookPath},
					},
				}
			}
			return c.JSON(fiber.Map{
				"status": "success",
				"data":   converted,
				"count":  len(converted),
				"source": "local_database",
			})
		}
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "n8n Unavailable",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{
		"status": "success",
		"data":   workflows,
		"count":  len(workflows),
		"source": "n8n_api",
	})
}

// N8NGetWorkflow - GET /api/integrations/n8n/workflows/:id
// Returns details for a single n8n workflow.
func N8NGetWorkflow(c *fiber.Ctx) error {
	workflowID := c.Params("id")
	if workflowID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Workflow ID is required",
		})
	}

	svc := services.GetN8NService()
	detail, err := svc.GetWorkflow(c.Context(), workflowID)
	if err != nil {
		// Fallback to local database connection
		var conn models.N8NWorkflowConnection
		if database.DB != nil && database.DB.Where("n8n_workflow_id = ? AND deleted_at IS NULL", workflowID).First(&conn).Error == nil {
			return c.JSON(fiber.Map{
				"status": "success",
				"data": fiber.Map{
					"id":           conn.N8NWorkflowID,
					"name":         conn.DisplayName,
					"description":  conn.Description,
					"active":       conn.IsActive,
					"webhook_path": conn.WebhookPath,
					"trigger_method": conn.TriggerMethod,
					"created_at":   conn.CreatedAt,
					"updated_at":   conn.UpdatedAt,
				},
			})
		}
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "Not Found",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{
		"status": "success",
		"data":   detail,
	})
}

// N8NRunWorkflow - POST /api/integrations/n8n/workflows/:id/run
// Triggers a configured n8n workflow via its webhook and creates an execution record.
type N8NRunRequest struct {
	WebhookPath string                 `json:"webhook_path"`
	Payload     map[string]interface{} `json:"payload"`
}

func N8NRunWorkflow(c *fiber.Ctx) error {
	workflowID := c.Params("id")
	if workflowID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Workflow ID is required",
		})
	}

	var req N8NRunRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Invalid request body",
		})
	}

	if req.WebhookPath == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "webhook_path is required to trigger the workflow",
		})
	}

	// Extract user info from JWT claims (set by middleware)
	userID, _ := c.Locals("user_id").(uint)

	// Generate a correlation ID to track this execution end-to-end
	correlationID := uuid.New().String()
	now := time.Now()

	// Build the structured payload
	if req.Payload == nil {
		req.Payload = map[string]interface{}{}
	}
	req.Payload["execution_id"] = correlationID
	req.Payload["source"] = "BoltHavenProperty"

	// Create pending execution record in PostgreSQL
	var record models.N8NExecutionRecord
	if database.DB != nil {
		record = models.N8NExecutionRecord{
			CorrelationID:     correlationID,
			N8NWorkflowID:     workflowID,
			TriggerSource:     "dashboard",
			TriggeredByUserID: userID,
			Status:            models.N8NExecStatusPending,
			StartedAt:         &now,
			InputSummary: models.JSONMap{
				"webhook_path": req.WebhookPath,
				"keys":         fmt.Sprintf("%d fields", len(req.Payload)),
			},
		}
		database.DB.Create(&record)
	}

	// Fire the webhook
	svc := services.GetN8NService()
	result, err := svc.TriggerWebhook(c.Context(), req.WebhookPath, req.Payload)

	if err != nil {
		// Update execution record to failed
		if database.DB != nil && record.ID > 0 {
			completed := time.Now()
			database.DB.Model(&record).Updates(map[string]interface{}{
				"status":       models.N8NExecStatusFailed,
				"error_message": err.Error(),
				"completed_at": completed,
				"duration_ms":  completed.Sub(now).Milliseconds(),
			})
		}
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":          "Workflow Trigger Failed",
			"message":        err.Error(),
			"correlation_id": correlationID,
		})
	}

	// Mark as running or success (if webhook returned immediate synchronized execution output)
	execStatus := models.N8NExecStatusRunning
	var completed *time.Time
	var durationMs int64
	if st, ok := result["status"].(string); (ok && st == "success") || result["normalized_property"] != nil {
		execStatus = models.N8NExecStatusSuccess
		nowCompleted := time.Now()
		completed = &nowCompleted
		durationMs = nowCompleted.Sub(now).Milliseconds()
	}

	if database.DB != nil && record.ID > 0 {
		updates := map[string]interface{}{
			"status":         execStatus,
			"output_summary": models.JSONMap{"webhook_response": result},
			"duration_ms":    durationMs,
		}
		if completed != nil {
			updates["completed_at"] = completed
		}
		database.DB.Model(&record).Updates(updates)
	}

	return c.JSON(fiber.Map{
		"status":           "success",
		"message":          "Workflow executed successfully.",
		"correlation_id":   correlationID,
		"execution_status": string(execStatus),
		"webhook_response": result,
	})
}

// N8NListExecutions - GET /api/integrations/n8n/executions
// Returns the combined execution list from both PostgreSQL records and n8n API.
func N8NListExecutions(c *fiber.Ctx) error {
	workflowID := c.Query("workflow_id", "")
	limitStr := c.Query("limit", "20")
	limit := 20
	fmt.Sscanf(limitStr, "%d", &limit)
	if limit > 100 {
		limit = 100
	}

	// Fetch local execution records from PostgreSQL
	var localRecords []models.N8NExecutionRecord
	if database.DB != nil {
		q := database.DB.Order("created_at DESC").Limit(limit)
		if workflowID != "" {
			q = q.Where("n8n_workflow_id = ?", workflowID)
		}
		q.Find(&localRecords)
	}

	// Also try fetching from n8n API (non-fatal if unavailable)
	svc := services.GetN8NService()
	n8nExecutions, _ := svc.GetExecutions(c.Context(), workflowID, limit)

	return c.JSON(fiber.Map{
		"status": "success",
		"data": fiber.Map{
			"local_records": localRecords,
			"n8n_executions": n8nExecutions,
		},
	})
}

// N8NGetExecution - GET /api/integrations/n8n/executions/:id
// Returns details for a single execution from n8n.
func N8NGetExecution(c *fiber.Ctx) error {
	executionID := c.Params("id")
	if executionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Execution ID is required",
		})
	}

	svc := services.GetN8NService()
	detail, err := svc.GetExecution(c.Context(), executionID)
	if err != nil {
		// Also look up in local DB by correlation ID
		if database.DB != nil {
			var record models.N8NExecutionRecord
			if err2 := database.DB.Where("correlation_id = ? OR n8n_execution_id = ?", executionID, executionID).First(&record).Error; err2 == nil {
				return c.JSON(fiber.Map{
					"status": "success",
					"data":   record,
					"source": "local_record",
				})
			}
		}
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "Not Found",
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data":   detail,
		"source": "n8n_api",
	})
}

// N8NGetSettings - GET /api/integrations/n8n/settings
// Returns current integration settings (sanitised — no secrets).
func N8NGetSettings(c *fiber.Ctx) error {
	svc := services.GetN8NService()
	cfg := svc.GetConfig()

	var settings []models.N8NAutomationSetting
	if database.DB != nil {
		database.DB.Find(&settings)
	}

	return c.JSON(fiber.Map{
		"status": "success",
		"data": fiber.Map{
			"config":   cfg,
			"settings": settings,
		},
	})
}

// N8NUpdateSettings - PUT /api/integrations/n8n/settings
// Updates runtime integration settings (admin only).
type N8NUpdateSettingsRequest struct {
	APIKey        string `json:"api_key,omitempty"`
	WebhookSecret string `json:"webhook_secret,omitempty"`
}

func N8NUpdateSettings(c *fiber.Ctx) error {
	var req N8NUpdateSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Invalid request body",
		})
	}

	svc := services.GetN8NService()
	svc.UpdateConfig(req.APIKey, req.WebhookSecret)

	// Persist API key in settings table (masked for security)
	if req.APIKey != "" && database.DB != nil {
		database.DB.Save(&models.N8NAutomationSetting{
			Key:         "n8n_api_key_configured",
			Value:       "true",
			Description: "Whether n8n API key has been configured via settings",
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Settings updated successfully",
	})
}

// N8NActivateWorkflow - POST /api/integrations/n8n/workflows/:id/activate
func N8NActivateWorkflow(c *fiber.Ctx) error {
	workflowID := c.Params("id")
	svc := services.GetN8NService()
	if err := svc.ActivateWorkflow(c.Context(), workflowID); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":   "Activation Failed",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{"status": "success", "message": "Workflow activated"})
}

// N8NDeactivateWorkflow - POST /api/integrations/n8n/workflows/:id/deactivate
func N8NDeactivateWorkflow(c *fiber.Ctx) error {
	workflowID := c.Params("id")
	svc := services.GetN8NService()
	if err := svc.DeactivateWorkflow(c.Context(), workflowID); err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":   "Deactivation Failed",
			"message": err.Error(),
		})
	}
	return c.JSON(fiber.Map{"status": "success", "message": "Workflow deactivated"})
}

// N8NWebhookCallback - POST /api/integrations/n8n/callback
// Receives authenticated result callbacks from n8n workflows and updates execution records.
func N8NWebhookCallback(c *fiber.Ctx) error {
	signature := c.Get("X-BoltHaven-Signature")
	body := c.Body()

	svc := services.GetN8NService()
	if !svc.ValidateWebhookSignature(body, signature) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Invalid webhook signature",
		})
	}

	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Invalid JSON payload",
		})
	}

	correlationID, _ := payload["execution_id"].(string)
	if correlationID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "execution_id is required in callback payload",
		})
	}

	status, _ := payload["status"].(string)
	if status == "" {
		status = "success"
	}

	if database.DB != nil {
		var record models.N8NExecutionRecord
		if err := database.DB.Where("correlation_id = ?", correlationID).First(&record).Error; err == nil {
			completed := time.Now()
			execStatus := models.N8NExecStatusSuccess
			if status == "error" || status == "failed" {
				execStatus = models.N8NExecStatusFailed
			}

			errorMsg := ""
			if errVal, ok := payload["error"].(string); ok {
				errorMsg = errVal
			}

			var durationMs int64
			if record.StartedAt != nil {
				durationMs = completed.Sub(*record.StartedAt).Milliseconds()
			}

			database.DB.Model(&record).Updates(map[string]interface{}{
				"status":         execStatus,
				"completed_at":   completed,
				"duration_ms":    durationMs,
				"error_message":  errorMsg,
				"output_summary": models.JSONMap{"result": payload},
			})
		}
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Callback received and processed",
	})
}
