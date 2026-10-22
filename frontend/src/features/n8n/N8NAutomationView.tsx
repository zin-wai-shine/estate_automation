import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiZap, FiRefreshCw, FiExternalLink, FiPlay, FiList,
  FiCheckCircle, FiXCircle, FiClock, FiAlertCircle,
  FiActivity, FiSettings, FiEye, FiToggleLeft, FiToggleRight,
  FiCopy, FiX, FiInfo, FiChevronDown, FiChevronUp,
} from 'react-icons/fi';
import {
  checkN8NStatus,
  listN8NWorkflows,
  listN8NExecutions,
  runN8NWorkflow,
  activateN8NWorkflow,
  deactivateN8NWorkflow,
  updateN8NSettings,
  type N8NStatus,
  type N8NWorkflow,
  type N8NLocalRecord,
  type N8NExecution,
} from '../../services/n8nService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string }> = {
    connected:    { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80', icon: <FiCheckCircle />, label: 'Connected' },
    disconnected: { bg: 'rgba(100,116,139,0.14)', color: '#94a3b8', icon: <FiXCircle />,   label: 'Disconnected' },
    error:        { bg: 'rgba(239,68,68,0.12)',  color: '#f87171', icon: <FiAlertCircle />, label: 'Error' },
    checking:     { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', icon: <FiRefreshCw style={{ animation: 'spin 1s linear infinite' }} />, label: 'Checking…' },
    success:      { bg: 'rgba(34,197,94,0.12)',  color: '#4ade80', icon: <FiCheckCircle />, label: 'Success' },
    failed:       { bg: 'rgba(239,68,68,0.12)',  color: '#f87171', icon: <FiXCircle />,     label: 'Failed' },
    running:      { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', icon: <FiActivity />,    label: 'Running' },
    pending:      { bg: 'rgba(234,179,8,0.12)',  color: '#facc15', icon: <FiClock />,       label: 'Pending' },
    unknown:      { bg: 'rgba(100,116,139,0.14)', color: '#94a3b8', icon: <FiInfo />,       label: 'Unknown' },
  };
  const s = map[status] ?? map.unknown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.55rem', borderRadius: '999px',
      backgroundColor: s.bg, color: s.color,
      fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {s.icon} {s.label}
    </span>
  );
};

const MetricCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; accent?: string }> = ({
  label, value, icon, accent = '#60a5fa',
}) => (
  <div style={{
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
    display: 'flex', alignItems: 'center', gap: '0.875rem',
    minWidth: 0,
  }}>
    <div style={{
      width: '36px', height: '36px', borderRadius: '0.5rem', flexShrink: 0,
      backgroundColor: accent + '1a',
      color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.0625rem',
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', whiteSpace: 'nowrap' }}>
        {label}
      </div>
    </div>
  </div>
);

interface WorkflowRunModalProps {
  workflow: N8NWorkflow;
  onClose: () => void;
  onSuccess: (correlationId: string) => void;
}

const WorkflowRunModal: React.FC<WorkflowRunModalProps> = ({ workflow, onClose, onSuccess }) => {
  const [webhookPath, setWebhookPath] = useState('property-processing');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const handleRun = async () => {
    if (!webhookPath.trim()) { setError('Webhook path is required'); return; }
    setRunning(true);
    setError('');
    try {
      const result = await runN8NWorkflow(workflow.id, webhookPath.trim(), {
        event: 'property.process',
        workflow_name: workflow.name,
      });
      onSuccess(result.correlation_id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: '0.875rem', width: '100%', maxWidth: '460px', padding: '1.5rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Run Workflow
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              {workflow.name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.125rem', padding: '0.25rem' }}>
            <FiX />
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
            Webhook Path (configured in n8n Webhook Trigger node)
          </label>
          <input
            value={webhookPath}
            onChange={(e) => setWebhookPath(e.target.value)}
            placeholder="e.g. property-processing"
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)',
              borderRadius: '0.5rem', padding: '0.55rem 0.75rem',
              color: 'var(--text-primary)', fontSize: '0.8125rem',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
            The webhook will be called at: <code style={{ color: '#60a5fa' }}>n8n/webhook/{webhookPath}</code>
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', padding: '0.625rem 0.75rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8125rem', color: '#f87171', margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)',
            backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem',
          }}>
            Cancel
          </button>
          <button onClick={handleRun} disabled={running} style={{
            padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none',
            backgroundColor: '#3b82f6', color: '#fff', cursor: running ? 'not-allowed' : 'pointer',
            fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem',
            opacity: running ? 0.7 : 1,
          }}>
            <FiPlay /> {running ? 'Triggering…' : 'Run Workflow'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ExecutionDetailModalProps {
  record: N8NLocalRecord | N8NExecution;
  onClose: () => void;
}

const ExecutionDetailModal: React.FC<ExecutionDetailModalProps> = ({ record, onClose }) => {
  const isLocal = 'correlation_id' in record;
  const local = isLocal ? (record as N8NLocalRecord) : null;
  const n8n = !isLocal ? (record as N8NExecution) : null;

  const id = local?.correlation_id ?? n8n?.id ?? '';
  const status = local?.status ?? (n8n?.finished ? (n8n.status ?? 'success') : 'running');
  const startedAt = local?.started_at ?? n8n?.startedAt;
  const completedAt = local?.completed_at ?? n8n?.stoppedAt;
  const workflowName = local?.workflow_name ?? n8n?.workflowName ?? '—';
  const errorMsg = local?.error_message ?? '';
  const durationMs = local?.duration_ms ?? 0;

  const [copied, setCopied] = useState(false);
  const copyId = () => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: '0.875rem', width: '100%', maxWidth: '580px',
        maxHeight: '85vh', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Execution Detail
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>{workflowName}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.125rem' }}>
            <FiX />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</span>
            <StatusBadge status={status} />
          </div>

          {/* Correlation ID */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Correlation ID</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <code style={{ fontSize: '0.6875rem', color: '#60a5fa', backgroundColor: 'rgba(59,130,246,0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.35rem' }}>
                {id.length > 20 ? `…${id.slice(-16)}` : id}
              </code>
              <button onClick={copyId} title="Copy ID" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4ade80' : 'var(--text-muted)', fontSize: '0.875rem', padding: '0.2rem' }}>
                <FiCopy />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Started</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>{formatDate(startedAt)}</div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Duration</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>{formatDuration(durationMs)}</div>
            </div>
          </div>

          {completedAt && (
            <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Completed</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>{formatDate(completedAt)}</div>
            </div>
          )}

          {errorMsg && (
            <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', padding: '0.875rem' }}>
              <div style={{ fontSize: '0.6875rem', color: '#f87171', fontWeight: 600, marginBottom: '0.375rem' }}>Error</div>
              <p style={{ fontSize: '0.8125rem', color: '#fca5a5', margin: 0, wordBreak: 'break-word' }}>{errorMsg}</p>
            </div>
          )}

          {local?.trigger_source && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trigger Source</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{local.trigger_source}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Settings Section ──────────────────────────────────────────────────────────

const SettingsPanel: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateN8NSettings({ api_key: apiKey || undefined, webhook_secret: webhookSecret || undefined });
      setSaved(true);
      setApiKey('');
      setWebhookSecret('');
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
          n8n API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API key (leave blank to keep existing)"
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            borderRadius: '0.5rem', padding: '0.55rem 0.75rem',
            color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none',
          }}
        />
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Generate an API key in your n8n instance: Settings → API → Create API Key
        </p>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
          Webhook Secret
        </label>
        <input
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="Leave blank to keep existing"
          style={{
            width: '100%', boxSizing: 'border-box',
            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            borderRadius: '0.5rem', padding: '0.55rem 0.75rem',
            color: 'var(--text-primary)', fontSize: '0.8125rem', outline: 'none',
          }}
        />
      </div>
      {error && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', padding: '0.625rem 0.75rem' }}>
          <p style={{ fontSize: '0.8125rem', color: '#f87171', margin: 0 }}>{error}</p>
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving || (!apiKey && !webhookSecret)}
        style={{
          alignSelf: 'flex-start', padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
          border: 'none', backgroundColor: saved ? '#166534' : '#3b82f6',
          color: '#fff', cursor: (saving || (!apiKey && !webhookSecret)) ? 'not-allowed' : 'pointer',
          fontSize: '0.8125rem', fontWeight: 600, opacity: (saving || (!apiKey && !webhookSecret)) ? 0.6 : 1,
          transition: 'background-color 0.2s',
        }}
      >
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
};

// ── Main View ────────────────────────────────────────────────────────────────

export const N8NAutomationView: React.FC = () => {
  const [status, setStatus] = useState<N8NStatus>({ status: 'checking', message: 'Connecting…' });
  const [workflows, setWorkflows] = useState<N8NWorkflow[]>([]);
  const [localExecs, setLocalExecs] = useState<N8NLocalRecord[]>([]);
  const [n8nExecs, setN8nExecs] = useState<N8NExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'workflows' | 'history' | 'settings'>('workflows');
  const [runModal, setRunModal] = useState<N8NWorkflow | null>(null);
  const [detailRecord, setDetailRecord] = useState<N8NLocalRecord | N8NExecution | null>(null);
  const [toast, setToast] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const hasFetched = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [statusData, workflowData, execData] = await Promise.allSettled([
        checkN8NStatus(),
        listN8NWorkflows(),
        listN8NExecutions(undefined, 25),
      ]);

      if (statusData.status === 'fulfilled') {
        setStatus(statusData.value.connection);
      } else {
        setStatus({ status: 'disconnected', message: 'Could not reach n8n' });
      }

      if (workflowData.status === 'fulfilled') {
        setWorkflows(Array.isArray(workflowData.value) ? workflowData.value : []);
      }

      if (execData.status === 'fulfilled') {
        setLocalExecs(execData.value.local_records ?? []);
        setN8nExecs(execData.value.n8n_executions ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      loadAll();
    }
  }, [loadAll]);

  const handleToggleWorkflow = async (workflow: N8NWorkflow) => {
    setTogglingId(workflow.id);
    try {
      if (workflow.active) {
        await deactivateN8NWorkflow(workflow.id);
        showToast(`"${workflow.name}" deactivated`);
      } else {
        await activateN8NWorkflow(workflow.id);
        showToast(`"${workflow.name}" activated`);
      }
      await loadAll(true);
    } catch (e) {
      showToast(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = workflows.filter(w => w.active).length;
  const allExecs = [...localExecs, ...n8nExecs];
  const successExecs = localExecs.filter(r => r.status === 'success').length;
  const failedExecs = localExecs.filter(r => r.status === 'failed').length;
  const runningExecs = localExecs.filter(r => r.status === 'running' || r.status === 'pending').length;

  const sectionStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '0.75rem',
    overflow: 'hidden',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    padding: '0.875rem 1.25rem',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.45rem 1rem', borderRadius: '0.5rem', border: 'none',
    fontSize: '0.8125rem', fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    backgroundColor: active ? 'rgba(59,130,246,0.14)' : 'transparent',
    color: active ? '#60a5fa' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.625rem',
          padding: '0.625rem 1.125rem', zIndex: 9999, color: '#f1f5f9',
          fontSize: '0.8125rem', fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          pointerEvents: 'none', maxWidth: '400px', textAlign: 'center',
        }}>
          {toast}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.875rem' }}>
        <div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiZap style={{ color: '#818cf8' }} /> n8n Automation
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
            Connect, execute, and monitor automation workflows.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <StatusBadge status={status.status} />
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing}
            title="Refresh"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.45rem 0.875rem', borderRadius: '0.5rem',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)', cursor: refreshing ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem', fontWeight: 500,
            }}
          >
            <FiRefreshCw style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
          <a
            href="http://localhost:5678"
            target="_blank"
            rel="noopener noreferrer"
            title="Open n8n Editor (local admin only)"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.45rem 0.875rem', borderRadius: '0.5rem',
              border: '1px solid rgba(129,140,248,0.3)', backgroundColor: 'rgba(129,140,248,0.08)',
              color: '#818cf8', fontSize: '0.8125rem', fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <FiExternalLink /> Open n8n Editor
          </a>
        </div>
      </div>

      {/* Connection Info */}
      {status.message && (
        <div style={{
          backgroundColor: status.status === 'error' ? 'rgba(239,68,68,0.08)' : status.status === 'connected' ? 'rgba(34,197,94,0.07)' : 'rgba(100,116,139,0.08)',
          border: `1px solid ${status.status === 'error' ? 'rgba(239,68,68,0.2)' : status.status === 'connected' ? 'rgba(34,197,94,0.18)' : 'var(--border-color)'}`,
          borderRadius: '0.625rem', padding: '0.625rem 1rem',
        }}>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: status.status === 'error' ? '#f87171' : 'var(--text-secondary)' }}>
            {status.message}
          </p>
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
        <MetricCard label="Workflows" value={loading ? '…' : workflows.length} icon={<FiList />} accent="#818cf8" />
        <MetricCard label="Active" value={loading ? '…' : activeCount} icon={<FiZap />} accent="#60a5fa" />
        <MetricCard label="Running" value={loading ? '…' : runningExecs} icon={<FiActivity />} accent="#facc15" />
        <MetricCard label="Successful" value={loading ? '…' : successExecs} icon={<FiCheckCircle />} accent="#4ade80" />
        <MetricCard label="Failed" value={loading ? '…' : failedExecs} icon={<FiXCircle />} accent="#f87171" />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
        {(['workflows', 'history', 'settings'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabBtnStyle(activeTab === tab)}>
            {tab === 'workflows' && <><FiZap style={{ marginRight: '0.375rem' }} />Workflows</>}
            {tab === 'history' && <><FiClock style={{ marginRight: '0.375rem' }} />History</>}
            {tab === 'settings' && <><FiSettings style={{ marginRight: '0.375rem' }} />Settings</>}
          </button>
        ))}
      </div>

      {/* ── Workflows Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'workflows' && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Available Workflows
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Loading workflows…
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: '#f87171', fontSize: '0.875rem', margin: 0 }}>{error}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                Make sure n8n is running and the API key is configured in Settings.
              </p>
            </div>
          ) : workflows.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No workflows found. Create your first workflow in n8n, then refresh.
            </div>
          ) : (
            <div>
              {workflows.map((wf, idx) => (
                <div key={wf.id} style={{
                  padding: '0.875rem 1.25rem',
                  borderBottom: idx < workflows.length - 1 ? '1px solid var(--border-color)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  transition: 'background-color 0.15s',
                }}>
                  {/* Status indicator */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: wf.active ? '#4ade80' : '#475569',
                    boxShadow: wf.active ? '0 0 6px rgba(74,222,128,0.4)' : 'none',
                  }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {wf.name}
                      </span>
                      <StatusBadge status={wf.active ? 'connected' : 'disconnected'} />
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      ID: {wf.id} · Updated {relativeTime(wf.updatedAt)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => setRunModal(wf)}
                      title="Run Workflow"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.375rem 0.75rem', borderRadius: '0.4rem',
                        border: '1px solid rgba(59,130,246,0.3)', backgroundColor: 'rgba(59,130,246,0.1)',
                        color: '#60a5fa', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                      }}
                    >
                      <FiPlay /> Run
                    </button>

                    <button
                      onClick={() => handleToggleWorkflow(wf)}
                      disabled={togglingId === wf.id}
                      title={wf.active ? 'Deactivate' : 'Activate'}
                      style={{
                        display: 'flex', alignItems: 'center',
                        padding: '0.375rem', borderRadius: '0.4rem',
                        border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)',
                        color: wf.active ? '#4ade80' : 'var(--text-muted)',
                        cursor: togglingId === wf.id ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                      }}
                    >
                      {wf.active ? <FiToggleRight /> : <FiToggleLeft />}
                    </button>

                    <a
                      href={`http://localhost:5678/workflow/${wf.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in n8n"
                      style={{
                        display: 'flex', alignItems: 'center',
                        padding: '0.375rem', borderRadius: '0.4rem',
                        border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.875rem',
                      }}
                    >
                      <FiExternalLink />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── History Tab ───────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Execution History
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {localExecs.length} local records · {n8nExecs.length} n8n records
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
          ) : localExecs.length === 0 && n8nExecs.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No executions yet. Run a workflow to see its history here.
            </div>
          ) : (
            <div>
              {/* Local Records */}
              {localExecs.map((rec, idx) => (
                <div key={rec.correlation_id} style={{
                  padding: '0.875rem 1.25rem',
                  borderBottom: idx < localExecs.length - 1 || n8nExecs.length > 0 ? '1px solid var(--border-color)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}>
                  <StatusBadge status={rec.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rec.workflow_name || rec.n8n_workflow_id}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {relativeTime(rec.created_at)} · {rec.trigger_source} · {formatDuration(rec.duration_ms)}
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailRecord(rec)}
                    title="View Details"
                    style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '0.4rem', padding: '0.375rem 0.625rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <FiEye /> Details
                  </button>
                </div>
              ))}

              {/* n8n Native Executions */}
              {n8nExecs.map((exec, idx) => (
                <div key={exec.id} style={{
                  padding: '0.875rem 1.25rem',
                  borderBottom: idx < n8nExecs.length - 1 ? '1px solid var(--border-color)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  backgroundColor: 'rgba(129,140,248,0.03)',
                }}>
                  <StatusBadge status={exec.finished ? (exec.status ?? 'success') : 'running'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {exec.workflowName || exec.workflowId}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      n8n ID: {exec.id} · {relativeTime(exec.startedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailRecord(exec)}
                    title="View Details"
                    style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '0.4rem', padding: '0.375rem 0.625rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <FiEye /> Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Settings Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Connection Info Card */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Connection Status
              </h2>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>n8n Instance</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  http://n8n:5678 (internal)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Status</span>
                <StatusBadge status={status.status} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Local Admin URL</span>
                <a href="http://localhost:5678" target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: '#60a5fa', textDecoration: 'none' }}>
                  localhost:5678 <FiExternalLink style={{ fontSize: '0.75rem' }} />
                </a>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Message</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{status.message || '—'}</span>
              </div>
            </div>
          </div>

          {/* API Credentials Card */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                API Credentials
              </h2>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}
              >
                {showSettings ? <FiChevronUp /> : <FiChevronDown />}
                {showSettings ? 'Hide' : 'Configure'}
              </button>
            </div>
            {showSettings && (
              <div style={{ padding: '1.25rem' }}>
                <SettingsPanel onSaved={() => loadAll(true)} />
              </div>
            )}
            {!showSettings && (
              <div style={{ padding: '1rem 1.25rem' }}>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Click Configure to update the n8n API key and webhook secret. Keys are stored server-side and never sent to the browser after saving.
                </p>
              </div>
            )}
          </div>

          {/* Setup Guide */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Setup Guide
              </h2>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                { n: '1', title: 'Start n8n', desc: 'Run `docker compose up -d n8n` from the project root.' },
                { n: '2', title: 'Open n8n Editor', desc: 'Visit http://localhost:5678 in your browser. Log in with the credentials set in .env.' },
                { n: '3', title: 'Create API Key', desc: 'In n8n: Settings → API → Create API Key. Copy the key.' },
                { n: '4', title: 'Configure Here', desc: 'Paste the API key in the "API Credentials" section above and save.' },
                { n: '5', title: 'Create a Workflow', desc: 'In n8n, create a workflow with a Webhook Trigger node. Note the webhook path.' },
                { n: '6', title: 'Run from Dashboard', desc: 'Click Run on a workflow here and enter the webhook path to trigger it.' },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(129,140,248,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0 }}>
                    {step.n}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{step.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {runModal && (
        <WorkflowRunModal
          workflow={runModal}
          onClose={() => setRunModal(null)}
          onSuccess={(cid) => {
            showToast(`Workflow triggered! Correlation ID: ${cid.slice(0, 8)}…`);
            loadAll(true);
          }}
        />
      )}
      {detailRecord && (
        <ExecutionDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
      )}
    </div>
  );
};

export default N8NAutomationView;
