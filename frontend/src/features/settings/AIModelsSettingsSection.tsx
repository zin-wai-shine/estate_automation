import React, { useState, useEffect } from 'react';
import {
  FiCpu,
  FiEye,
  FiEyeOff,
  FiKey,
  FiClock,
  FiSliders,
  FiTrash2,
  FiZap,
  FiShield,
  FiCheckCircle,
  FiCheck,
} from 'react-icons/fi';
import { SiGooglegemini } from 'react-icons/si';
import { TbBrandOpenai } from 'react-icons/tb';
import {
  getAIProviders,
  saveAIProvider,
  getAIHistory,
  clearAIHistory,
  type AIProviderConfig,
  type AIHistoryEntry,
} from '../ai-models/aiModelStorage';

export const AIModelsSettingsSection: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'credentials' | 'routing' | 'history'>('credentials');
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [history, setHistory] = useState<AIHistoryEntry[]>([]);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [tempKeyValues, setTempKeyValues] = useState<Record<string, string>>({});
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // Model Routing Preferences
  const [copywriterModel, setCopywriterModel] = useState<string>('gemini-flash-latest');
  const [imageEnhanceModel, setImageEnhanceModel] = useState<string>('runware:100@1');
  const [heroModel, setHeroModel] = useState<string>('chatgpt_browser');

  useEffect(() => {
    setProviders(getAIProviders());
    setHistory(getAIHistory());
  }, []);

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartEdit = (prov: AIProviderConfig) => {
    setEditingKeyId(prov.id);
    setTempKeyValues((prev) => ({ ...prev, [prov.id]: prov.apiKey || '' }));
  };

  const handleSaveKey = (prov: AIProviderConfig) => {
    const val = tempKeyValues[prov.id] !== undefined ? tempKeyValues[prov.id].trim() : prov.apiKey;
    const updated: AIProviderConfig = {
      ...prov,
      apiKey: val,
      status: (val ? 'active' : 'warning') as 'active' | 'warning',
      statusMessage: val ? 'Configured & Active' : 'API Key Required',
    };
    saveAIProvider(updated);
    setProviders(getAIProviders());
    setEditingKeyId(null);
    setSavedFeedback(`Saved ${prov.name} API Key`);
    setTimeout(() => setSavedFeedback(null), 2500);
  };

  const handleClearLogs = () => {
    if (window.confirm('Clear all AI execution logs?')) {
      clearAIHistory();
      setHistory([]);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '0.875rem',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Clean Card Header */}
      <div
        style={{
          padding: '1.125rem 1.375rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '0.5rem',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #3B82F6)',
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            <FiCpu />
          </div>
          <div>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              AI Models & Provider Setup
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Configure provider credentials, workflow node routing, and execution telemetry
            </span>
          </div>
        </div>

        {/* Segment Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            padding: '3px',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSubTab('credentials')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: activeSubTab === 'credentials' ? 'var(--accent-primary, #3B82F6)' : 'transparent',
              color: activeSubTab === 'credentials' ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            <FiKey size={13} />
            <span>API Keys</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('routing')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: activeSubTab === 'routing' ? 'var(--accent-primary, #3B82F6)' : 'transparent',
              color: activeSubTab === 'routing' ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            <FiSliders size={13} />
            <span>Model Routing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.375rem',
              border: 'none',
              backgroundColor: activeSubTab === 'history' ? 'var(--accent-primary, #3B82F6)' : 'transparent',
              color: activeSubTab === 'history' ? '#FFFFFF' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            <FiClock size={13} />
            <span>Execution Logs</span>
          </button>
        </div>
      </div>

      {savedFeedback && (
        <div
          style={{
            padding: '0.5rem 1.375rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#10B981',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <FiCheckCircle size={14} />
          <span>{savedFeedback}</span>
        </div>
      )}

      {/* Sub-Tab 1: API Keys & Credentials */}
      {activeSubTab === 'credentials' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Row 1: Google Gemini AI */}
          {(() => {
            const gemini = providers.find((p) => p.provider === 'google_ai') || {
              id: 'prov-google',
              name: 'Google AI (Gemini)',
              provider: 'google_ai',
              apiKey: '',
              status: 'active',
            };
            const isEditing = editingKeyId === gemini.id;
            const isVisible = showKeys[gemini.id];
            const currentVal = isEditing ? (tempKeyValues[gemini.id] ?? gemini.apiKey) : gemini.apiKey;
            const hasKey = Boolean(gemini.apiKey && gemini.apiKey.trim().length > 0);

            return (
              <div
                style={{
                  padding: '1.25rem 1.375rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 300px', minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <SiGooglegemini style={{ color: '#8B5CF6', fontSize: '1.1rem' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Google Gemini AI
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '1px 8px',
                        borderRadius: '999px',
                        backgroundColor: hasKey ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                        color: hasKey ? '#10B981' : '#EAB308',
                      }}
                    >
                      ● {hasKey ? 'Active' : 'Key Configured in .env'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    Powers automated dual-language listing copywriting, condo name extraction, and SEO formatting.
                  </p>
                </div>

                <div style={{ flex: '1 1 340px', maxWidth: '440px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={isVisible ? 'text' : 'password'}
                        disabled={!isEditing}
                        value={currentVal || (isEditing ? '' : '••••••••••••••••••••••••••••••••')}
                        onChange={(e) => setTempKeyValues((prev) => ({ ...prev, [gemini.id]: e.target.value }))}
                        placeholder="AIzaSy... (Gemini API Key)"
                        style={{
                          width: '100%',
                          padding: '0.45rem 2.25rem 0.45rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: isEditing ? '1px solid var(--accent-primary, #3B82F6)' : '1px solid var(--border-color)',
                          backgroundColor: isEditing ? 'var(--bg-surface)' : 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8125rem',
                          fontFamily: 'monospace',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(gemini.id)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                        }}
                      >
                        {isVisible ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                      </button>
                    </div>

                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => handleSaveKey(gemini as AIProviderConfig)}
                        style={{
                          padding: '0.45rem 0.875rem',
                          borderRadius: '0.375rem',
                          backgroundColor: 'var(--accent-primary, #3B82F6)',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <FiCheck size={13} />
                        <span>Save</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(gemini as AIProviderConfig)}
                        style={{
                          padding: '0.45rem 0.875rem',
                          borderRadius: '0.375rem',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Row 2: Runware AI */}
          {(() => {
            const runware = providers.find((p) => p.provider === 'runware_ai') || {
              id: 'prov-runware',
              name: 'Runware AI',
              provider: 'runware_ai',
              apiKey: '',
              status: 'active',
            };
            const isEditing = editingKeyId === runware.id;
            const isVisible = showKeys[runware.id];
            const currentVal = isEditing ? (tempKeyValues[runware.id] ?? runware.apiKey) : runware.apiKey;

            return (
              <div
                style={{
                  padding: '1.25rem 1.375rem',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 300px', minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <FiZap style={{ color: '#10B981', fontSize: '1.1rem' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Runware AI GPU
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        padding: '1px 8px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10B981',
                      }}
                    >
                      ● Active ($19.81 Balance)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    Accelerated GPU infrastructure for SDXL Realism, FLUX.1 staging, and 4x photo upscaling.
                  </p>
                </div>

                <div style={{ flex: '1 1 340px', maxWidth: '440px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={isVisible ? 'text' : 'password'}
                        disabled={!isEditing}
                        value={currentVal || (isEditing ? '' : '••••••••••••••••••••••••••••••••')}
                        onChange={(e) => setTempKeyValues((prev) => ({ ...prev, [runware.id]: e.target.value }))}
                        placeholder="Runware API Key"
                        style={{
                          width: '100%',
                          padding: '0.45rem 2.25rem 0.45rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: isEditing ? '1px solid var(--accent-primary, #3B82F6)' : '1px solid var(--border-color)',
                          backgroundColor: isEditing ? 'var(--bg-surface)' : 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.8125rem',
                          fontFamily: 'monospace',
                          boxSizing: 'border-box',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(runware.id)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                        }}
                      >
                        {isVisible ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                      </button>
                    </div>

                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => handleSaveKey(runware as AIProviderConfig)}
                        style={{
                          padding: '0.45rem 0.875rem',
                          borderRadius: '0.375rem',
                          backgroundColor: 'var(--accent-primary, #3B82F6)',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <FiCheck size={13} />
                        <span>Save</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(runware as AIProviderConfig)}
                        style={{
                          padding: '0.45rem 0.875rem',
                          borderRadius: '0.375rem',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Row 3: OpenAI ChatGPT */}
          <div
            style={{
              padding: '1.25rem 1.375rem',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1.25rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 300px', minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <TbBrandOpenai style={{ color: '#10A37F', fontSize: '1.15rem' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  OpenAI ChatGPT (Browser Agent)
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '1px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    color: '#10B981',
                  }}
                >
                  ● Active Session
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                Directly connected via BoltHaven Chrome Profile Companion. Runs ChatGPT Plus/Pro worker tabs with zero API billing costs.
              </p>
            </div>

            <div style={{ flex: '1 1 340px', maxWidth: '440px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  padding: '0.45rem 0.875rem',
                  borderRadius: '0.375rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <FiShield style={{ color: '#10B981' }} />
                <span>Managed by Mac Companion (Port 9224)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Model Routing Preferences */}
      {activeSubTab === 'routing' && (
        <div style={{ padding: '1.25rem 1.375rem', display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          {/* Setting 1: Copywriting */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '1rem',
              borderBottom: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <strong style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: 'block' }}>
                Facebook Listing Copywriter & Translation
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Assigned to General AI Processor node for Facebook post description generation
              </span>
            </div>
            <select
              value={copywriterModel}
              onChange={(e) => setCopywriterModel(e.target.value)}
              style={{
                padding: '0.45rem 0.875rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            >
              <option value="gemini-flash-latest">Gemini Flash (Recommended - Ultra Fast)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
            </select>
          </div>

          {/* Setting 2: Image Staging & Retouching */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '1rem',
              borderBottom: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <strong style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: 'block' }}>
                Image Staging & Enhancement Model
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Default model assigned to automated photo enhancement steps
              </span>
            </div>
            <select
              value={imageEnhanceModel}
              onChange={(e) => setImageEnhanceModel(e.target.value)}
              style={{
                padding: '0.45rem 0.875rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            >
              <option value="runware:100@1">SDXL Realism (Runware - ~1.4s)</option>
              <option value="runware:101@1">FLUX.1 Schnell (Runware - ~0.8s)</option>
              <option value="runware:102@1">FLUX.1 Dev (Runware - ~2.2s)</option>
            </select>
          </div>

          {/* Setting 3: Hero Image Generator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <strong style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', display: 'block' }}>
                Facebook Hero Image Generator
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Default generator used for composite condo hero cards
              </span>
            </div>
            <select
              value={heroModel}
              onChange={(e) => setHeroModel(e.target.value)}
              style={{
                padding: '0.45rem 0.875rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                outline: 'none',
              }}
            >
              <option value="chatgpt_browser">ChatGPT Pro (Chrome Browser Agent)</option>
              <option value="runware:101@1">FLUX.1 Schnell (Runware)</option>
              <option value="runware:100@1">SDXL Realism (Runware)</option>
            </select>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Execution History & Logs */}
      {activeSubTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '0.75rem 1.375rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Recent AI Generation Logs ({history.length} entries)
            </span>
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                <FiTrash2 size={12} />
                <span>Clear Logs</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              No recent AI generations logged yet.
            </div>
          ) : (
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '0.75rem 1.375rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: item.status === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: item.status === 'success' ? '#10B981' : '#EF4444',
                        }}
                      >
                        {item.status === 'success' ? '✓ OK' : '✕ Error'}
                      </span>
                      <strong style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                        {item.model}
                      </strong>
                      {item.durationMs && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          • {item.durationMs}ms
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '650px',
                      }}
                    >
                      {item.outputPreview || item.prompt}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
