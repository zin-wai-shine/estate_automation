package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// N8NExecutionStatus tracks the application-side status of a triggered automation.
type N8NExecutionStatus string

const (
	N8NExecStatusPending   N8NExecutionStatus = "pending"
	N8NExecStatusRunning   N8NExecutionStatus = "running"
	N8NExecStatusSuccess   N8NExecutionStatus = "success"
	N8NExecStatusFailed    N8NExecutionStatus = "failed"
	N8NExecStatusUnknown   N8NExecutionStatus = "unknown"
	N8NExecStatusCancelled N8NExecutionStatus = "cancelled"
)

// JSONMap is a GORM-compatible type for storing JSON blobs.
type JSONMap map[string]interface{}

func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return "{}", nil
	}
	data, err := json.Marshal(j)
	return string(data), err
}

func (j *JSONMap) Scan(src interface{}) error {
	switch v := src.(type) {
	case string:
		return json.Unmarshal([]byte(v), j)
	case []byte:
		return json.Unmarshal(v, j)
	}
	return fmt.Errorf("unsupported type: %T", src)
}

// N8NWorkflowConnection stores the mapping between a BoltHaven workflow node
// and a specific n8n workflow, including how it should be triggered.
type N8NWorkflowConnection struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	N8NWorkflowID   string         `gorm:"column:n8n_workflow_id;type:varchar(100);not null;index" json:"n8n_workflow_id"`
	DisplayName     string         `gorm:"type:varchar(255);not null" json:"display_name"`
	Description     string         `gorm:"type:text" json:"description"`
	WebhookPath     string         `gorm:"type:varchar(255)" json:"webhook_path"`
	TriggerMethod   string         `gorm:"type:varchar(50);default:'webhook'" json:"trigger_method"`
	IsActive        bool           `gorm:"default:true" json:"is_active"`
	InputMapping    JSONMap        `gorm:"type:jsonb" json:"input_mapping"`
	OutputMapping   JSONMap        `gorm:"type:jsonb" json:"output_mapping"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

func (N8NWorkflowConnection) TableName() string {
	return "n8n_workflow_connections"
}

// N8NExecutionRecord tracks every time BoltHaven triggered an n8n workflow.
type N8NExecutionRecord struct {
	ID                uint               `gorm:"primaryKey" json:"id"`
	CorrelationID     string             `gorm:"type:varchar(100);uniqueIndex;not null" json:"correlation_id"`
	N8NWorkflowID     string             `gorm:"column:n8n_workflow_id;type:varchar(100);not null;index" json:"n8n_workflow_id"`
	WorkflowName      string             `gorm:"type:varchar(255)" json:"workflow_name"`
	N8NExecutionID    string             `gorm:"column:n8n_execution_id;type:varchar(100);index" json:"n8n_execution_id"`
	TriggerSource     string             `gorm:"type:varchar(100)" json:"trigger_source"`
	TriggeredByUserID uint               `gorm:"index" json:"triggered_by_user_id"`
	Status            N8NExecutionStatus `gorm:"type:varchar(30);default:'pending'" json:"status"`
	InputSummary      JSONMap            `gorm:"type:jsonb" json:"input_summary"`
	OutputSummary     JSONMap            `gorm:"type:jsonb" json:"output_summary"`
	ErrorMessage      string             `gorm:"type:text" json:"error_message"`
	StartedAt         *time.Time         `json:"started_at"`
	CompletedAt       *time.Time         `json:"completed_at"`
	DurationMs        int64              `json:"duration_ms"`
	CreatedAt         time.Time          `json:"created_at"`
	UpdatedAt         time.Time          `json:"updated_at"`
}

func (N8NExecutionRecord) TableName() string {
	return "n8n_execution_records"
}

// N8NAutomationSetting stores configurable integration settings.
type N8NAutomationSetting struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Key         string    `gorm:"type:varchar(100);uniqueIndex;not null" json:"key"`
	Value       string    `gorm:"type:text" json:"value"`
	Description string    `gorm:"type:text" json:"description"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (N8NAutomationSetting) TableName() string {
	return "n8n_automation_settings"
}

