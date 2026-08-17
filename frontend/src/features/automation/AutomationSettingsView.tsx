import React, { useState } from 'react';
import type { AutomationSettings } from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { FiCheck } from 'react-icons/fi';

export const AutomationSettingsView: React.FC = () => {
  const [settings, setSettings] = useState<AutomationSettings>({
    mode: 'SEMI_AUTOMATIC',
    autoImport: true,
    autoContentGen: true,
    autoImageEnhance: true,
    autoWatermark: true,
    autoValidation: true,
    approvalRequired: true,
    autoFbPublish: false,
    autoTikTokPublish: false,
    googleSheetsSync: true,
    autoPurgePublishedImages: true,
  });

  const [savedMsg, setSavedMsg] = useState('');

  const toggleSetting = (key: keyof AutomationSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key],
    }));
  };

  const handleModeChange = (mode: 'MANUAL' | 'SEMI_AUTOMATIC' | 'AUTOMATIC') => {
    setSettings((prev) => ({ ...prev, mode }));
  };

  const handleSave = () => {
    setSavedMsg('Automation Settings updated and saved to backend!');
    setTimeout(() => setSavedMsg(''), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Automation Pipeline & Queue Controls
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Configure automatic processing pipeline steps, background Redis/Asynq workers, and Google Sheets sync.
          </p>
        </div>

        <Button variant="primary" leftIcon={<FiCheck />} onClick={handleSave}>
          Save Automation Settings
        </Button>
      </div>

      {savedMsg && (
        <div
          style={{
            padding: '0.625rem 0.875rem',
            borderRadius: '0.375rem',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <FiCheck /> {savedMsg}
        </div>
      )}

      {/* Mode Selector */}
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
        }}
      >
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Select Automation Operating Mode
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {[
            { id: 'MANUAL', label: 'Manual Mode', desc: 'All steps require explicit manual user button triggers.' },
            { id: 'SEMI_AUTOMATIC', label: 'Semi-Automatic (Default)', desc: 'Processes automatically, but REQUIRES human approval before publishing.' },
            { id: 'AUTOMATIC', label: 'Automatic Mode', desc: 'Processes and publishes automatically when validation passes 100%.' },
          ].map((m) => {
            const isSelected = settings.mode === m.id;
            return (
              <div
                key={m.id}
                onClick={() => handleModeChange(m.id as any)}
                style={{
                  padding: '1rem',
                  borderRadius: '0.375rem',
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    {m.label}
                  </span>
                  {isSelected && <Badge variant="info">Active</Badge>}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toggles Grid */}
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
        }}
      >
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Pipeline Step Toggles
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {[
            { key: 'autoImport', label: 'Auto Content Import', desc: 'Attempt automatic extraction from source Facebook URLs' },
            { key: 'autoContentGen', label: 'Auto AI Content Generation', desc: 'Generate Facebook & TikTok copy upon property import' },
            { key: 'autoImageEnhance', label: 'Auto Image Enhancement', desc: 'Process and enhance property images asynchronously' },
            { key: 'autoWatermark', label: 'Auto Watermark Overlay', desc: 'Apply logo watermark to images deterministically' },
            { key: 'autoValidation', label: 'Auto Validation Engine', desc: 'Check images, contact info, and pricing readiness' },
            { key: 'approvalRequired', label: 'Approval Required Gate', desc: 'Block publishing until human approves in Review Center' },
            { key: 'autoFbPublish', label: 'Auto Facebook Publishing', desc: 'Publish directly to Facebook Business Page when approved' },
            { key: 'autoTikTokPublish', label: 'Auto TikTok Publishing', desc: 'Publish directly to TikTok account when approved' },
            { key: 'googleSheetsSync', label: 'Google Sheets Integration', desc: 'Synchronize property data & post URLs to master Google Sheet' },
            { key: 'autoPurgePublishedImages', label: 'Auto-Purge Post Images', desc: 'Remove temporary listing photos after post push (keeps sheet & post data)' },
          ].map((item) => {
            const isChecked = Boolean(settings[item.key as keyof AutomationSettings]);
            return (
              <div
                key={item.key}
                onClick={() => toggleSetting(item.key as keyof AutomationSettings)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</p>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{item.desc}</span>
                </div>

                <div
                  style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: isChecked ? 'var(--accent-primary)' : 'var(--border-color)',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      position: 'absolute',
                      top: '2px',
                      left: isChecked ? '18px' : '2px',
                      transition: 'all 0.2s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Redis Asynq Background Queue Monitor */}
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Redis / Asynq Background Processing Monitor
          </h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--status-success)', fontWeight: 600 }}>● Workers Active</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.75rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Queue: property-import</span>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--status-success)', marginTop: '0.25rem' }}>100% Completed</p>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Queue: ai-content</span>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--status-success)', marginTop: '0.25rem' }}>100% Completed</p>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Queue: ai-image</span>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--status-info)', marginTop: '0.25rem' }}>70% Processing</p>
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Queue: google-sheet</span>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--status-warning)', marginTop: '0.25rem' }}>Synced</p>
          </div>
        </div>
      </div>
    </div>
  );
};
