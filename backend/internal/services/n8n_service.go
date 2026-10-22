package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// N8NConnectionStatus represents the current state of the n8n connection.
type N8NConnectionStatus string

const (
	N8NStatusConnected    N8NConnectionStatus = "connected"
	N8NStatusDisconnected N8NConnectionStatus = "disconnected"
	N8NStatusError        N8NConnectionStatus = "error"
	N8NStatusChecking     N8NConnectionStatus = "checking"
)

// N8NWorkflow mirrors the n8n workflow list item.
type N8NWorkflow struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Active      bool      `json:"active"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Tags        []N8NTag  `json:"tags,omitempty"`
}

// N8NTag is a workflow tag from n8n.
type N8NTag struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// N8NExecution mirrors an n8n execution record.
type N8NExecution struct {
	ID           string     `json:"id"`
	Finished     bool       `json:"finished"`
	Mode         string     `json:"mode"`
	StartedAt    time.Time  `json:"startedAt"`
	StoppedAt    *time.Time `json:"stoppedAt,omitempty"`
	WorkflowID   string     `json:"workflowId"`
	WorkflowName string     `json:"workflowName,omitempty"`
	Status       string     `json:"status"`
}

// N8NStatusResponse is the response from the n8n /healthz endpoint.
type N8NStatusResponse struct {
	Status  N8NConnectionStatus `json:"status"`
	Version string              `json:"version,omitempty"`
	Message string              `json:"message,omitempty"`
}

// N8NWorkflowsResponse matches the paged workflow list from the n8n API.
type N8NWorkflowsResponse struct {
	Data          []N8NWorkflow `json:"data"`
	NextCursor    *string       `json:"nextCursor"`
}

// N8NExecutionsResponse matches the paged execution list from the n8n API.
type N8NExecutionsResponse struct {
	Data       []N8NExecution `json:"data"`
	NextCursor *string        `json:"nextCursor"`
}

// N8NService is the singleton client for n8n API communication.
type N8NService struct {
	baseURL       string
	apiKey        string
	webhookSecret string
	httpClient    *http.Client
	mu            sync.RWMutex
}

var (
	n8nServiceInstance *N8NService
	n8nOnce            sync.Once
)

// GetN8NService returns or initialises the singleton N8NService.
func GetN8NService() *N8NService {
	n8nOnce.Do(func() {
		n8nServiceInstance = &N8NService{
			baseURL:       getEnvOrDefault("N8N_BASE_URL", "http://n8n:5678"),
			apiKey:        os.Getenv("N8N_API_KEY"),
			webhookSecret: getEnvOrDefault("N8N_WEBHOOK_SECRET", ""),
			httpClient: &http.Client{
				Timeout: 30 * time.Second,
			},
		}
	})
	return n8nServiceInstance
}

// UpdateConfig allows runtime update of API key (e.g., from settings UI).
func (s *N8NService) UpdateConfig(apiKey, webhookSecret string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if apiKey != "" {
		s.apiKey = apiKey
	}
	if webhookSecret != "" {
		s.webhookSecret = webhookSecret
	}
}

// GetConfig returns current (non-secret) config values.
func (s *N8NService) GetConfig() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	hasKey := s.apiKey != ""
	return map[string]interface{}{
		"base_url":    s.baseURL,
		"has_api_key": hasKey,
	}
}

// doRequest executes an authenticated HTTP request against the n8n API.
func (s *N8NService) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	s.mu.RLock()
	apiKey := s.apiKey
	baseURL := s.baseURL
	s.mu.RUnlock()

	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(data)
	}

	url := baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if apiKey != "" {
		req.Header.Set("X-N8N-API-KEY", apiKey)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("n8n request failed: %w", err)
	}
	return resp, nil
}

// TestConnection checks n8n availability and returns status info.
func (s *N8NService) TestConnection(ctx context.Context) (*N8NStatusResponse, error) {
	resp, err := s.doRequest(ctx, http.MethodGet, "/healthz", nil)
	if err != nil {
		return &N8NStatusResponse{
			Status:  N8NStatusDisconnected,
			Message: fmt.Sprintf("Connection refused: %v", err),
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &N8NStatusResponse{
			Status:  N8NStatusError,
			Message: fmt.Sprintf("n8n returned HTTP %d: %s", resp.StatusCode, string(body)),
		}, nil
	}

	// Try to get version from /api/v1/version (requires API key)
	version := "unknown"
	if s.apiKey != "" {
		vResp, vErr := s.doRequest(ctx, http.MethodGet, "/api/v1/workflows?limit=1", nil)
		if vErr == nil && vResp.StatusCode == http.StatusOK {
			vResp.Body.Close()
			version = "accessible"
		} else if vResp != nil {
			vResp.Body.Close()
			if vResp.StatusCode == http.StatusUnauthorized {
				return &N8NStatusResponse{
					Status:  N8NStatusError,
					Message: "n8n reachable but API key is invalid or missing",
				}, nil
			}
		}
	}

	return &N8NStatusResponse{
		Status:  N8NStatusConnected,
		Version: version,
		Message: "n8n is healthy and reachable",
	}, nil
}

// GetWorkflows retrieves the list of all n8n workflows.
func (s *N8NService) GetWorkflows(ctx context.Context) ([]N8NWorkflow, error) {
	if s.apiKey == "" {
		return nil, fmt.Errorf("n8n API key is not configured")
	}

	resp, err := s.doRequest(ctx, http.MethodGet, "/api/v1/workflows?limit=100", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to reach n8n: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("invalid n8n API key")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("n8n returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result N8NWorkflowsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse workflows response: %w", err)
	}
	return result.Data, nil
}

// GetWorkflow retrieves details for a specific workflow.
func (s *N8NService) GetWorkflow(ctx context.Context, workflowID string) (map[string]interface{}, error) {
	if s.apiKey == "" {
		return nil, fmt.Errorf("n8n API key is not configured")
	}

	resp, err := s.doRequest(ctx, http.MethodGet, "/api/v1/workflows/"+workflowID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to reach n8n: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("workflow not found: %s", workflowID)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("n8n returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse workflow detail: %w", err)
	}
	return result, nil
}

// GetExecutions retrieves execution history, optionally filtered by workflowID.
func (s *N8NService) GetExecutions(ctx context.Context, workflowID string, limit int) ([]N8NExecution, error) {
	if s.apiKey == "" {
		return nil, fmt.Errorf("n8n API key is not configured")
	}
	if limit <= 0 {
		limit = 20
	}

	path := fmt.Sprintf("/api/v1/executions?limit=%d&includeData=false", limit)
	if workflowID != "" {
		path += "&workflowId=" + workflowID
	}

	resp, err := s.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to reach n8n: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("n8n returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result N8NExecutionsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse executions response: %w", err)
	}
	return result.Data, nil
}

// GetExecution retrieves a single execution's details.
func (s *N8NService) GetExecution(ctx context.Context, executionID string) (map[string]interface{}, error) {
	if s.apiKey == "" {
		return nil, fmt.Errorf("n8n API key is not configured")
	}

	resp, err := s.doRequest(ctx, http.MethodGet, "/api/v1/executions/"+executionID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to reach n8n: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("execution not found: %s", executionID)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("n8n returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse execution detail: %w", err)
	}
	return result, nil
}

// TriggerWebhook fires an n8n Webhook Trigger node with a structured payload.
// The webhookPath is the path configured in the n8n Webhook node (e.g., /property-processing).
func (s *N8NService) TriggerWebhook(ctx context.Context, webhookPath string, payload interface{}) (map[string]interface{}, error) {
	s.mu.RLock()
	baseURL := s.baseURL
	secret := s.webhookSecret
	s.mu.RUnlock()

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	url := baseURL + "/webhook/" + webhookPath
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(data))
	if err != nil {
		return nil, fmt.Errorf("failed to build webhook request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if secret != "" {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(data)
		req.Header.Set("X-BoltHaven-Signature", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("webhook request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("webhook returned HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if len(body) > 0 {
		if err := json.Unmarshal(body, &result); err != nil {
			// Non-JSON response is acceptable from some webhook configurations
			result = map[string]interface{}{"raw_response": string(body)}
		}
	}

	log.Printf("[n8n] Webhook triggered: %s → HTTP %d", webhookPath, resp.StatusCode)
	return result, nil
}

// ActivateWorkflow activates an n8n workflow by ID.
func (s *N8NService) ActivateWorkflow(ctx context.Context, workflowID string) error {
	if s.apiKey == "" {
		return fmt.Errorf("n8n API key is not configured")
	}

	resp, err := s.doRequest(ctx, http.MethodPost, "/api/v1/workflows/"+workflowID+"/activate", nil)
	if err != nil {
		return fmt.Errorf("failed to reach n8n: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("n8n returned HTTP %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// DeactivateWorkflow deactivates an n8n workflow by ID.
func (s *N8NService) DeactivateWorkflow(ctx context.Context, workflowID string) error {
	if s.apiKey == "" {
		return fmt.Errorf("n8n API key is not configured")
	}

	resp, err := s.doRequest(ctx, http.MethodPost, "/api/v1/workflows/"+workflowID+"/deactivate", nil)
	if err != nil {
		return fmt.Errorf("failed to reach n8n: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("n8n returned HTTP %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// ValidateWebhookSignature verifies that an incoming callback is genuinely from our n8n instance.
func (s *N8NService) ValidateWebhookSignature(payload []byte, signature string) bool {
	s.mu.RLock()
	secret := s.webhookSecret
	s.mu.RUnlock()

	if secret == "" || signature == "" {
		return true // Signature validation disabled when secret is not configured
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
