/**
 * n8n Integration API Service
 * Communicates with Go backend /api/integrations/n8n/* routes.
 * Never calls n8n directly — always goes through the Go backend.
 */

import { apiUrl } from './apiClient';

export type N8NConnectionStatus = 'connected' | 'disconnected' | 'error' | 'checking';

export interface N8NStatus {
  status: N8NConnectionStatus;
  version?: string;
  message?: string;
}

export interface N8NWorkflowTag {
  id: string;
  name: string;
}

export interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: N8NWorkflowTag[];
}

export interface N8NExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  workflowName?: string;
  status: string;
}

export interface N8NLocalRecord {
  id: number;
  correlation_id: string;
  n8n_workflow_id: string;
  workflow_name: string;
  n8n_execution_id: string;
  trigger_source: string;
  triggered_by_user_id: number;
  status: string;
  input_summary: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  error_message: string;
  started_at?: string;
  completed_at?: string;
  duration_ms: number;
  created_at: string;
  updated_at: string;
}

export interface N8NRunResult {
  correlation_id: string;
  execution_status: string;
  message: string;
  webhook_response?: Record<string, unknown>;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('estate_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const err = json as { message?: string; error?: string };
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }

  return (json as { data: T }).data ?? (json as T);
}

// ----- Connection Status -----

export async function checkN8NStatus(): Promise<{ connection: N8NStatus; config: Record<string, unknown> }> {
  const res = await fetch(apiUrl('/api/integrations/n8n/status'), {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse(res);
}

// ----- Workflows -----

export async function listN8NWorkflows(): Promise<N8NWorkflow[]> {
  const res = await fetch(apiUrl('/api/integrations/n8n/workflows'), {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  return handleResponse(res);
}

export async function getN8NWorkflow(workflowId: string): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl(`/api/integrations/n8n/workflows/${workflowId}`), {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse(res);
}

export async function runN8NWorkflow(
  workflowId: string,
  webhookPath: string,
  payload: Record<string, unknown> = {}
): Promise<N8NRunResult> {
  const res = await fetch(apiUrl(`/api/integrations/n8n/workflows/${workflowId}/run`), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ webhook_path: webhookPath, payload }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON: ${text.slice(0, 200)}`); }
  if (!res.ok) {
    const err = json as { message?: string; error?: string; correlation_id?: string };
    const e = new Error(err.message || err.error || `HTTP ${res.status}`) as Error & { correlationId?: string };
    e.correlationId = err.correlation_id;
    throw e;
  }
  return json as N8NRunResult;
}

export async function activateN8NWorkflow(workflowId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/integrations/n8n/workflows/${workflowId}/activate`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message || `HTTP ${res.status}`);
  }
}

export async function deactivateN8NWorkflow(workflowId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/integrations/n8n/workflows/${workflowId}/deactivate`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message || `HTTP ${res.status}`);
  }
}

// ----- Executions -----

export async function listN8NExecutions(
  workflowId?: string,
  limit = 20
): Promise<{ local_records: N8NLocalRecord[]; n8n_executions: N8NExecution[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (workflowId) params.set('workflow_id', workflowId);

  const res = await fetch(apiUrl(`/api/integrations/n8n/executions?${params}`), {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  return handleResponse(res);
}

export async function getN8NExecution(executionId: string): Promise<Record<string, unknown>> {
  const res = await fetch(apiUrl(`/api/integrations/n8n/executions/${executionId}`), {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse(res);
}

// ----- Settings -----

export async function getN8NSettings(): Promise<{
  config: Record<string, unknown>;
  settings: Array<{ key: string; value: string; description: string }>;
}> {
  const res = await fetch(apiUrl('/api/integrations/n8n/settings'), {
    headers: getAuthHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  return handleResponse(res);
}

export async function updateN8NSettings(data: { api_key?: string; webhook_secret?: string }): Promise<void> {
  const res = await fetch(apiUrl('/api/integrations/n8n/settings'), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { message?: string }).message || `HTTP ${res.status}`);
  }
}
