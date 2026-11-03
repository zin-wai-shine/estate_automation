import React, { useState, useRef } from 'react';
import {
  FiX,
  FiUploadCloud,
  FiTrash2,
  FiCheck,
  FiCopy,
  FiExternalLink,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiInfo,
  FiTag,
} from 'react-icons/fi';
import { SiGooglesheets } from 'react-icons/si';
import { Select } from '../../components/ui/Select';
import { type DynamicAIBoxConfig } from './FacebookWorkflowCanvas';

const DEFAULT_SERVICE_ACCOUNT_EMAIL = 'bolthaven-sheets@super-realestate-488219.iam.gserviceaccount.com';

interface GoogleSheetSettingsSideboxProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  boxConfig: DynamicAIBoxConfig;
  onUpdateBoxConfig: (updated: Partial<DynamicAIBoxConfig>) => void;
  onLoadHeaders?: () => Promise<void>;
  loadingHeaders?: boolean;
  onUrlChange?: (newUrl: string, delay?: number) => void;
}

export const GoogleSheetSettingsSidebox: React.FC<GoogleSheetSettingsSideboxProps> = ({
  isOpen,
  onClose,
  isDark,
  boxConfig,
  onUpdateBoxConfig,
  onLoadHeaders,
  loadingHeaders = false,
  onUrlChange,
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const currentEmail = boxConfig.googleServiceAccountEmail || DEFAULT_SERVICE_ACCOUNT_EMAIL;
  const isCustomKey = Boolean(boxConfig.googleServiceAccountJson && boxConfig.googleServiceAccountEmail);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(currentEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setUploadError('Please select a valid .json Google Cloud Service Account key file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const parsed = JSON.parse(text);
        if (!parsed.client_email || !parsed.private_key) {
          throw new Error('Missing "client_email" or "private_key" fields in JSON credentials.');
        }

        onUpdateBoxConfig({
          googleServiceAccountJson: text,
          googleServiceAccountEmail: parsed.client_email,
          googleServiceAccountFilename: file.name,
        });

        setUploadSuccess(`Loaded service account: ${parsed.client_email}`);
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse JSON file');
      }
    };
    reader.onerror = () => setUploadError('Failed to read file');
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearCustomKey = () => {
    onUpdateBoxConfig({
      googleServiceAccountJson: undefined,
      googleServiceAccountEmail: undefined,
      googleServiceAccountFilename: undefined,
    });
    setUploadSuccess(null);
    setUploadError(null);
  };


  return (
    <div
      className="workflow-sidebar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: '380px', // sits right alongside the 380px main sidebar inspector
        width: '440px',
        maxWidth: 'calc(100vw - 420px)',
        backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
        borderLeft: '1px solid var(--border-color)',
        borderRight: 'none',
        boxShadow: isDark
          ? '-16px 0 20px -6px rgba(0, 0, 0, 0.75)'
          : '-8px 0 16px -4px rgba(0, 0, 0, 0.08)',
        zIndex: 165,
        display: 'flex',
        flexDirection: 'column',
        animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── Top Header (Exact Equal Match to Main Sidebar Header) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.875rem 1rem',
          height: '62px',
          boxSizing: 'border-box',
          borderBottom: 'none',
          backgroundColor: isDark ? 'var(--bg-main)' : '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(15, 157, 88, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <SiGooglesheets size={18} color="#0F9D58" />
          </div>

          <div style={{ minWidth: 0, flex: 1, paddingRight: '0.5rem' }}>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                padding: '1px 0',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Google Sheet Connection & Credentials
            </div>
            <div style={{ fontSize: '0.6875rem', color: isDark ? '#8B949E' : '#64748B', marginTop: '2px', fontWeight: 500 }}>
              Spreadsheet destination and Google Cloud service account key
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={onClose}
            title="Close Settings (Esc)"
            aria-label="Close"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <FiX size={15} />
          </button>
        </div>
      </div>

      {/* ── Main Scrollable Body (Clean Direct Form, No Nested Cards, No Footer) ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.875rem 1rem 2.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* ── 1. Spreadsheet Destination ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Google Spreadsheet URL / ID
            </label>
            {boxConfig.googleSpreadsheetUrl && (
              <a
                href={boxConfig.googleSpreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '0.625rem',
                  color: '#0F9D58',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Open Sheet <FiExternalLink size={10} />
              </a>
            )}
          </div>
          <input
            type="text"
            value={boxConfig.googleSpreadsheetUrl || ''}
            onChange={(e) => {
              if (onUrlChange) {
                onUrlChange(e.target.value);
              } else {
                onUpdateBoxConfig({ googleSpreadsheetUrl: e.target.value });
              }
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (pasted && onUrlChange) {
                onUrlChange(pasted.trim(), 150);
              }
            }}
            placeholder="https://docs.google.com/spreadsheets/d/1lzY57D5ers2Xs6cvbV-skeqGSAK_jijbQJZt8Hn8udY/..."
            style={{
              width: '100%',
              height: '34px',
              padding: '0 0.625rem',
              borderRadius: '6px',
              border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
              backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
              color: 'var(--text-primary)',
              fontSize: '0.75rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ── Sheet / Tab Name & Load Headers ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Sheet / Tab Name (Optional)
            </label>
            <input
              type="text"
              value={boxConfig.googleSheetName || ''}
              onChange={(e) => onUpdateBoxConfig({ googleSheetName: e.target.value })}
              placeholder="e.g. Post Properties or Sheet1"
              style={{
                width: '100%',
                height: '34px',
                padding: '0 0.625rem',
                borderRadius: '6px',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {onLoadHeaders && (
            <button
              type="button"
              disabled={loadingHeaders}
              onClick={onLoadHeaders}
              style={{
                height: '34px',
                padding: '0 0.85rem',
                borderRadius: '6px',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: loadingHeaders ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: loadingHeaders ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {loadingHeaders ? (
                <>
                  <FiRefreshCw size={12} className="spin" /> Reading...
                </>
              ) : (
                <>
                  <SiGooglesheets size={12} color="#0F9D58" /> Load Headers
                </>
              )}
            </button>
          )}
        </div>

        {/* Detected Columns Chips */}
        {boxConfig.googleSheetHeaders && boxConfig.googleSheetHeaders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Detected Columns ({boxConfig.googleSheetHeaders.length}):
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
                border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                maxHeight: '90px',
                overflowY: 'auto',
              }}
            >
              {boxConfig.googleSheetHeaders.map((hdr, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#1C2128' : '#FFFFFF',
                    border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                    color: 'var(--text-primary)',
                  }}
                >
                  {hdr}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── 2. Google Cloud Service Account Credentials ────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Google Cloud Service Account
            </label>
            <span
              style={{
                fontSize: '0.5625rem',
                fontWeight: 600,
                color: isCustomKey ? '#10B981' : 'var(--text-muted)',
              }}
            >
              {isCustomKey ? `Custom (${boxConfig.googleServiceAccountFilename || 'key.json'})` : 'Default Account'}
            </span>
          </div>

          <div
            style={{
              padding: '0.55rem 0.65rem',
              borderRadius: '6px',
              backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
              border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
            }}
          >
            <div
              style={{
                fontSize: '0.6875rem',
                fontFamily: 'monospace',
                color: isCustomKey ? '#10B981' : 'var(--text-primary)',
                fontWeight: 500,
                wordBreak: 'break-all',
                flex: 1,
              }}
            >
              {currentEmail}
            </div>

            <button
              type="button"
              onClick={handleCopyEmail}
              title="Copy Service Account Email"
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                color: copiedEmail ? '#10B981' : 'var(--text-primary)',
                fontSize: '0.625rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              {copiedEmail ? <FiCheck size={11} /> : <FiCopy size={11} />}
              {copiedEmail ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Share Tip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              padding: '0.45rem 0.6rem',
              borderRadius: '6px',
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: isDark ? '#FDE68A' : '#92400E',
              fontSize: '0.625rem',
              lineHeight: 1.35,
            }}
          >
            <FiInfo size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              Share your Google Sheet with this email and give <strong>Editor</strong> permission.
            </div>
          </div>

          {/* Upload & Reset Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                height: '32px',
                padding: '0 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <FiUploadCloud size={13} color="#3B82F6" />
              <span>{isCustomKey ? 'Change .json Key' : 'Upload Service Account (.json)'}</span>
            </button>

            {isCustomKey && (
              <button
                type="button"
                onClick={handleClearCustomKey}
                title="Reset to default Bolthaven service account"
                style={{
                  height: '32px',
                  padding: '0 0.75rem',
                  borderRadius: '6px',
                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                  backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                  color: isDark ? '#FCA5A5' : '#DC2626',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FiTrash2 size={12} /> Reset
              </button>
            )}
          </div>

          {uploadError && (
            <div
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: '5px',
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                border: '1px solid #EF4444',
                color: isDark ? '#FCA5A5' : '#B91C1C',
                fontSize: '0.625rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <FiAlertCircle size={12} /> {uploadError}
            </div>
          )}

          {uploadSuccess && (
            <div
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: '5px',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                border: '1px solid #10B981',
                color: isDark ? '#6EE7B7' : '#047857',
                fontSize: '0.625rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <FiCheckCircle size={12} /> {uploadSuccess}
            </div>
          )}
        </div>

        {/* Listing Code Generator Section */}
        <div
          style={{
            padding: '0.875rem',
            borderRadius: '8px',
            border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiTag size={14} style={{ color: 'var(--accent-primary, #3B82F6)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Listing Code Generator
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={boxConfig.useGeneratedCode ?? true}
                  onChange={(e) => onUpdateBoxConfig({ useGeneratedCode: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Use in Prompts</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={boxConfig.autoGenerateCode ?? true}
                  onChange={(e) => onUpdateBoxConfig({ autoGenerateCode: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Auto-generate</span>
              </label>
            </div>
          </div>

          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Auto-generate dynamic unique listing codes for the <strong>Code</strong> column during sheet sync.
          </div>

          {/* Format Preset Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Code Format Type
            </label>
            <Select
              options={[
                { value: 'AAA-######-AA', label: 'Dynamic (3 Letters - 6 Digits - 2 Letters) · e.g. AEA-123456-GE' },
                { value: 'AAA-######', label: 'Compact (3 Letters - 6 Digits) · e.g. BKK-849201' },
                { value: '######-AA', label: 'Numeric Prefix (6 Digits - 2 Letters) · e.g. 123456-GE' },
                { value: 'AEA-[6D]-GE', label: 'Fixed Prefix (AEA - 6 Digits - GE) · e.g. AEA-850017-GE' },
                { value: 'custom', label: 'Custom Pattern (User Defined)' },
              ]}
              value={
                ['AAA-######-AA', 'AAA-######', '######-AA', 'AEA-[6D]-GE'].includes(boxConfig.codeFormat ?? 'AAA-######-AA')
                  ? (boxConfig.codeFormat ?? 'AAA-######-AA')
                  : 'custom'
              }
              onChange={(val) => {
                const newFormat = val === 'custom' ? (boxConfig.codeFormat || 'AAA-######-AA') : val;
                onUpdateBoxConfig({ codeFormat: newFormat });
              }}
              height="34px"
            />
          </div>

          {/* Pattern Input & Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Pattern Mask / Syntax
              </label>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                <code>A</code>=Letter &nbsp;•&nbsp; <code>#</code>=Digit
              </span>
            </div>
            <input
              type="text"
              value={boxConfig.codeFormat ?? 'AAA-######-AA'}
              onChange={(e) => onUpdateBoxConfig({ codeFormat: e.target.value })}
              placeholder="e.g. AAA-######-AA"
              style={{
                width: '100%',
                height: '34px',
                padding: '0 10px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ height: '2.5rem' }} />
      </div>
    </div>
  );
};
