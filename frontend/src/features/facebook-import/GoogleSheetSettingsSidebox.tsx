import React, { useState, useRef, useEffect } from 'react';
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
  FiSliders,
  FiDatabase,
  FiCpu,
  FiZap,
  FiPlay,
  FiEye,
} from 'react-icons/fi';
import { SiGooglesheets } from 'react-icons/si';
import { Select } from '../../components/ui/Select';
import { GOOGLE_SHEET_AI_MODEL_OPTIONS } from './aiModelUtils';
import type { DynamicAIBoxConfig, GoogleSheetColumnMapping } from './FacebookWorkflowCanvas';

const DEFAULT_SERVICE_ACCOUNT_EMAIL = 'bolthaven-sheets@super-realestate-488219.iam.gserviceaccount.com';

const PRESET_INSTRUCTION_SNIPPETS = [
  { label: '+ Clean Condo Name', text: 'Extract clean condo project name without marketing words or emojis.' },
  { label: '+ Format Price THB', text: 'Format price as numeric integer with THB currency symbol (e.g. 25,000 THB).' },
  { label: '+ BTS/MRT Distance', text: 'Extract nearest BTS or MRT station and walk distance or minutes.' },
  { label: '+ Phone & Line ID', text: 'Extract agent phone number and Line ID into contact columns.' },
  { label: '+ Area in SQM', text: 'Format unit size in square meters (SQM) as clean numeric value.' },
];

const SUGGESTED_SOURCE_FIELDS = [
  { value: 'property.code', label: 'property.code (Listing Code / Ref)' },
  { value: 'property.project_name', label: 'property.project_name (Condo / Project Name)' },
  { value: 'property.room_type', label: 'property.room_type (Bedrooms / Unit Type)' },
  { value: 'property.price', label: 'property.price (Rental / Sale Price)' },
  { value: 'property.size', label: 'property.size (Floor Area in SQM)' },
  { value: 'property.floor', label: 'property.floor (Floor Level)' },
  { value: 'property.station', label: 'property.station (BTS / MRT Station)' },
  { value: 'property.agent_name', label: 'property.agent_name (Owner / Agent Name)' },
  { value: 'property.contact_info', label: 'property.contact_info (Phone / Line ID)' },
  { value: 'property.source_url', label: 'property.source_url (Original Post Link)' },
  { value: 'caption', label: 'caption (Full Raw Post Text)' },
];

interface GoogleSheetSettingsSideboxProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  boxConfig: DynamicAIBoxConfig;
  onUpdateBoxConfig: (updated: Partial<DynamicAIBoxConfig>) => void;
  availablePrompts?: Array<{ id: string | number; name: string; category?: string; instructions?: string; templateText?: string }>;
  onLoadHeaders?: () => Promise<void>;
  loadingHeaders?: boolean;
  onUrlChange?: (newUrl: string, delay?: number) => void;
  onTestGoogleSheetSync?: () => void;
  testingSheetSync?: boolean;
  sheetTestResult?: any;
}

export const GoogleSheetSettingsSidebox: React.FC<GoogleSheetSettingsSideboxProps> = ({
  isOpen,
  onClose,
  isDark,
  boxConfig,
  onUpdateBoxConfig,
  availablePrompts = [],
  onLoadHeaders,
  loadingHeaders = false,
  onUrlChange,
  onTestGoogleSheetSync,
  testingSheetSync = false,
  sheetTestResult,
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'mode' | 'mappings' | 'write' | 'testing'>('connection');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [localTestResult, setLocalTestResult] = useState<any>(null);
  const [runningLocalTest, setRunningLocalTest] = useState(false);
  const [testMode, setTestMode] = useState<'preview' | 'write'>('preview');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveTestResult = localTestResult || sheetTestResult;
  const isExecutingTest = runningLocalTest || testingSheetSync;

  if (!isOpen) return null;

  const currentEmail = boxConfig.googleServiceAccountEmail || DEFAULT_SERVICE_ACCOUNT_EMAIL;
  const isCustomKey = Boolean(boxConfig.googleServiceAccountJson && boxConfig.googleServiceAccountEmail);
  const selectedModel = boxConfig.model || (boxConfig.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');
  const selectedTemplateId = boxConfig.templateId || '';
  const currentAiPrompt = boxConfig.googleSheetAiPrompt ?? boxConfig.customPrompt ?? '';
  const processingMode = boxConfig.googleSheetProcessingMode || 'smart_auto';
  const writeOperation = boxConfig.googleSheetWriteOperation || 'append';
  const matchColumns = boxConfig.googleSheetMatchColumns || (boxConfig.googleSheetHeaders && boxConfig.googleSheetHeaders.length > 0 ? [boxConfig.googleSheetHeaders[0]] : ['Code']);
  const preserveNonEmpty = boxConfig.googleSheetPreserveNonEmpty !== false;
  const detectedHeaders = boxConfig.googleSheetHeaders || [];
  const columnMappings = boxConfig.googleSheetColumnMappings || [];
  const headerRow = boxConfig.googleSheetHeaderRow || 1;
  const availableTabs = boxConfig.googleSheetAvailableTabs || (boxConfig.googleSheetName ? [boxConfig.googleSheetName] : ['Sheet1']);

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

  const handleModelChange = (newModel: string) => {
    const isGoogle = newModel.startsWith('gemini');
    onUpdateBoxConfig({
      model: newModel,
      provider: isGoogle ? 'google_ai' : 'openai',
    });
  };

  const handleTemplateChange = (templateId: string) => {
    const match = availablePrompts.find((p) => String(p.id) === templateId);
    onUpdateBoxConfig({
      templateId,
      templateText: match?.templateText || match?.instructions || '',
    });
  };

  const handleAppendInstruction = (snippet: string) => {
    const updated = currentAiPrompt ? `${currentAiPrompt.trim()}\n- ${snippet}` : `- ${snippet}`;
    onUpdateBoxConfig({
      googleSheetAiPrompt: updated,
      customPrompt: updated,
    });
  };

  // Heuristic Auto-Map Columns based on detected header names
  const handleAutoMapColumns = () => {
    if (detectedHeaders.length === 0) return;

    const newMappings: GoogleSheetColumnMapping[] = detectedHeaders.map((header, idx) => {
      const lower = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      let sourceField = '';
      let dataType: GoogleSheetColumnMapping['dataType'] = 'string';
      let mode: GoogleSheetColumnMapping['mappingMode'] = 'auto';

      if (lower.includes('code') || lower.includes('id') || lower.includes('ref')) {
        sourceField = 'property.code';
        dataType = 'string';
      } else if (lower.includes('project') || lower.includes('condo') || lower.includes('building') || lower.includes('name')) {
        sourceField = 'property.project_name';
        dataType = 'string';
      } else if (lower.includes('room') || lower.includes('bed') || lower.includes('type')) {
        sourceField = 'property.room_type';
        dataType = 'string';
      } else if (lower.includes('size') || lower.includes('sqm') || lower.includes('area')) {
        sourceField = 'property.size';
        dataType = 'number';
      } else if (lower.includes('floor')) {
        sourceField = 'property.floor';
        dataType = 'string';
      } else if (lower.includes('price') || lower.includes('rent')) {
        sourceField = 'property.price';
        dataType = 'currency';
      } else if (lower.includes('bts') || lower.includes('mrt') || lower.includes('station')) {
        sourceField = 'property.station';
        dataType = 'string';
      } else if (lower.includes('owner') || lower.includes('agent')) {
        sourceField = 'property.agent_name';
        dataType = 'string';
      } else if (lower.includes('contact') || lower.includes('phone') || lower.includes('tel') || lower.includes('line')) {
        sourceField = 'property.contact_info';
        dataType = 'string';
      } else if (lower.includes('link') || lower.includes('url') || lower.includes('source')) {
        sourceField = 'property.source_url';
        dataType = 'url';
      } else {
        sourceField = '';
        dataType = 'string';
      }

      return {
        sheetColumn: header,
        columnIndex: idx,
        mappingMode: mode,
        sourceField,
        dataType,
        required: idx === 0,
        defaultValue: '',
      };
    });

    onUpdateBoxConfig({ googleSheetColumnMappings: newMappings });
  };

  const handleUpdateColumnMapping = (index: number, partial: Partial<GoogleSheetColumnMapping>) => {
    const existing = [...columnMappings];
    if (!existing[index]) {
      existing[index] = {
        sheetColumn: detectedHeaders[index] || `Col ${index + 1}`,
        columnIndex: index,
        mappingMode: 'auto',
      };
    }
    existing[index] = { ...existing[index], ...partial };
    onUpdateBoxConfig({ googleSheetColumnMappings: existing });
  };

  const toggleMatchColumn = (colName: string) => {
    const current = [...matchColumns];
    const idx = current.indexOf(colName);
    if (idx >= 0) {
      if (current.length > 1) {
        current.splice(idx, 1);
      }
    } else {
      current.push(colName);
    }
    onUpdateBoxConfig({ googleSheetMatchColumns: current });
  };

  // Run Real Process Test (Preview or Write)
  const handleExecuteProcessTest = async (op: 'preview' | 'write') => {
    setRunningLocalTest(true);
    setTestMode(op);
    setLocalTestResult(null);
    try {
      const samplePayload = {
        spreadsheet_url: boxConfig.googleSpreadsheetUrl || 'https://docs.google.com/spreadsheets/d/1lzY57D5ers2Xs6cvbV-skeqGSAK_jijbQJZt8Hn8udY/edit?gid=0#gid=0',
        sheet_name: boxConfig.googleSheetName || '',
        header_row: headerRow,
        mode: processingMode,
        operation: op === 'write' ? writeOperation : 'preview',
        match_columns: matchColumns,
        preserve_non_empty: preserveNonEmpty,
        column_mappings: columnMappings,
        incoming_data: {
          property: {
            code: 'BHR-100001',
            project_name: 'The Metropolis Samrong',
            room_type: '1 Bedroom',
            price: 12000,
            size: 35,
            floor: '21',
            station: 'BTS Samrong',
            agent_name: 'Super Agent',
            contact_info: '081-234-5678 / Line: @supercondo',
            source_url: 'https://facebook.com/marketplace/item/100001',
          },
        },
        raw_content: 'The Metropolis Samrong, 1 Bedroom, 35 Sq.m., Floor 21, 12,000 THB/month, near BTS Samrong. Fully furnished, ready to move in. Contact 081-234-5678.',
        condo_name: 'The Metropolis Samrong',
        images: ['https://example.com/condo1.jpg'],
        custom_instructions: currentAiPrompt,
        model: selectedModel,
        provider: selectedModel.startsWith('gemini') ? 'google_ai' : 'openai',
        prompt_template: boxConfig.templateText || '',
        credentials_json: boxConfig.googleServiceAccountJson || '',
      };

      const res = await fetch('/api/google-sheets/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload),
      });

      const data = await res.json();
      setLocalTestResult(data);
    } catch (err: any) {
      setLocalTestResult({ success: false, error: err.message || 'Network error during test execution' });
    } finally {
      setRunningLocalTest(false);
    }
  };

  const promptOptions = [
    { value: '', label: 'None (Automatic Schema Extraction)' },
    ...availablePrompts.map((p) => ({
      value: String(p.id),
      label: p.name,
    })),
  ];

  return (
    <div
      className="workflow-sidebar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: '380px',
        width: '560px',
        maxWidth: 'calc(100vw - 420px)',
        backgroundColor: isDark ? '#161B22' : '#FFFFFF',
        borderLeft: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
        boxShadow: isDark
          ? '-16px 0 24px -6px rgba(0, 0, 0, 0.75)'
          : '-8px 0 16px -4px rgba(0, 0, 0, 0.08)',
        zIndex: 170,
        display: 'flex',
        flexDirection: 'column',
        animation: 'sidebarSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.875rem 1.15rem',
          borderBottom: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
          backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(15, 157, 88, 0.15)',
              border: '1px solid rgba(15, 157, 88, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <SiGooglesheets size={18} color="#0F9D58" />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Google Sheet & AI Agent Settings
            </div>
            <div style={{ fontSize: '0.6875rem', color: isDark ? '#8B949E' : '#64748B', marginTop: '2px', fontWeight: 500 }}>
              Universal Smart Data Mapping · Dynamic Schema Discovery
            </div>
          </div>
        </div>

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
          }}
        >
          <FiX size={15} />
        </button>
      </div>

      {/* ── Sub Navigation Tabs ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          borderBottom: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
          backgroundColor: isDark ? '#0D1117' : '#F1F5F9',
          padding: '0 0.5rem',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'connection', label: '1. Connection', icon: <FiDatabase size={12} /> },
          { key: 'mode', label: '2. Processing Mode', icon: <FiCpu size={12} /> },
          { key: 'mappings', label: `3. Columns (${detectedHeaders.length})`, icon: <FiSliders size={12} /> },
          { key: 'write', label: '4. Write Rules', icon: <FiZap size={12} /> },
          { key: 'testing', label: '5. Preview & Test', icon: <FiPlay size={12} /> },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0.65rem 0.85rem',
                border: 'none',
                background: 'none',
                borderBottom: isActive ? '2px solid #0F9D58' : '2px solid transparent',
                color: isActive ? '#0F9D58' : 'var(--text-secondary)',
                fontSize: '0.71875rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Scrollable Tab Content ─────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
        }}
      >
        {/* ── TAB 1: CONNECTION & DISCOVERY ─────────────────────────────────── */}
        {activeTab === 'connection' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Spreadsheet URL Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Google Spreadsheet URL or Sheet ID
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

            {/* Workbook Title if discovered */}
            {boxConfig.googleSheetTitle && (
              <div
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  backgroundColor: isDark ? 'rgba(15, 157, 88, 0.1)' : '#ECFDF5',
                  border: '1px solid rgba(15, 157, 88, 0.25)',
                  color: '#0F9D58',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <SiGooglesheets size={12} />
                <span>Workbook: {boxConfig.googleSheetTitle}</span>
              </div>
            )}

            {/* Tab Selection & Header Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr auto', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Worksheet Tab
                </label>
                {availableTabs.length > 1 ? (
                  <Select
                    value={boxConfig.googleSheetName || availableTabs[0]}
                    onChange={(val) => onUpdateBoxConfig({ googleSheetName: val })}
                    options={availableTabs.map((t) => ({ value: t, label: t }))}
                    height="34px"
                  />
                ) : (
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
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Header Row
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={headerRow}
                  onChange={(e) => onUpdateBoxConfig({ googleSheetHeaderRow: parseInt(e.target.value) || 1 })}
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
                      <SiGooglesheets size={12} color="#0F9D58" /> Refresh Schema
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Service Account Credentials Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem' }}>
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
                    title="Reset to default service account"
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
                <div style={{ padding: '0.45rem', borderRadius: '5px', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: '0.625rem' }}>
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div style={{ padding: '0.45rem', borderRadius: '5px', backgroundColor: '#ECFDF5', color: '#047857', fontSize: '0.625rem' }}>
                  {uploadSuccess}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: PROCESSING MODE & AI SETTINGS ──────────────────────────── */}
        {activeTab === 'mode' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Data Processing Mode
            </label>

            {/* 3-Way Mode Pill Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {[
                {
                  id: 'smart_auto',
                  title: 'Smart Auto',
                  badge: 'DEFAULT',
                  desc: 'Directly maps known values; uses AI only for missing fields.',
                },
                {
                  id: 'direct',
                  title: 'Direct Mapping',
                  badge: 'ZERO AI',
                  desc: '1:1 JSON mapping only. Bypasses AI completely.',
                },
                {
                  id: 'ai_extract',
                  title: 'AI Extraction',
                  badge: 'FULL AI',
                  desc: 'Extracts all columns from raw unstructured text via AI schema.',
                },
              ].map((m) => {
                const isSelected = processingMode === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => onUpdateBoxConfig({ googleSheetProcessingMode: m.id as any })}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #0F9D58' : isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                      backgroundColor: isSelected
                        ? isDark ? 'rgba(15, 157, 88, 0.15)' : 'rgba(15, 157, 88, 0.08)'
                        : isDark ? '#0D1117' : '#FFFFFF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isSelected ? '#0F9D58' : 'var(--text-primary)' }}>
                        {m.title}
                      </span>
                      <span
                        style={{
                          fontSize: '0.5rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: isSelected ? '#0F9D58' : isDark ? '#21262D' : '#E2E8F0',
                          color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
                        }}
                      >
                        {m.badge}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                      {m.desc}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI Configuration (Shown when mode uses AI: Smart Auto or AI Extract) */}
            {processingMode !== 'direct' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                  border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    AI Engine & Model
                  </label>
                  <Select
                    value={selectedModel}
                    onChange={(val) => handleModelChange(val)}
                    options={GOOGLE_SHEET_AI_MODEL_OPTIONS}
                    height="36px"
                    placeholder="Select AI Model..."
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Select Prompt Template (Optional Advanced Mapping)
                  </label>
                  <Select
                    value={selectedTemplateId}
                    onChange={(val) => handleTemplateChange(val)}
                    options={promptOptions}
                    height="36px"
                    placeholder="Select Prompt Template..."
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Custom AI Extraction Instructions / Hints
                  </label>

                  {/* Preset quick chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {PRESET_INSTRUCTION_SNIPPETS.map((snippet, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAppendInstruction(snippet.text)}
                        style={{
                          fontSize: '0.5625rem',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: isDark ? '#21262D' : '#FFFFFF',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        {snippet.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    value={currentAiPrompt}
                    onChange={(e) => {
                      onUpdateBoxConfig({
                        googleSheetAiPrompt: e.target.value,
                        customPrompt: e.target.value,
                      });
                    }}
                    placeholder="e.g. Map price with THB currency symbol, clean condo project name, format bedrooms as integer, extract BTS station name..."
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      borderRadius: '6px',
                      border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                      backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                      color: 'var(--text-primary)',
                      fontSize: '0.75rem',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: UNIVERSAL COLUMN MAPPING TABLE ──────────────────────────── */}
        {activeTab === 'mappings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Detected Columns ({detectedHeaders.length})
                </span>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  Map each column to incoming property attributes or extraction modes
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoMapColumns}
                disabled={detectedHeaders.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#0F9D58',
                  color: '#FFFFFF',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: detectedHeaders.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <FiZap size={12} /> Auto Map Columns
              </button>
            </div>

            {detectedHeaders.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: isDark ? '1px dashed #30363D' : '1px dashed #CBD5E1',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                }}
              >
                No column headers detected yet. Click "Refresh Schema" in Tab 1 to read spreadsheet headers.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxHeight: '380px',
                  overflowY: 'auto',
                }}
              >
                {detectedHeaders.map((colName, idx) => {
                  const m = columnMappings.find((c) => c.sheetColumn === colName || c.columnIndex === idx) || {
                    sheetColumn: colName,
                    columnIndex: idx,
                    mappingMode: 'auto',
                    sourceField: '',
                    dataType: 'string',
                  };

                  return (
                    <div
                      key={colName + idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 100px 1fr 90px',
                        gap: '0.5rem',
                        alignItems: 'center',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '6px',
                        backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                      }}
                    >
                      {/* Column Title */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.71875rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={colName}>
                          {colName}
                        </div>
                        <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                          Col {String.fromCharCode(65 + (idx % 26))}
                        </div>
                      </div>

                      {/* Mode Dropdown */}
                      <select
                        value={m.mappingMode || 'auto'}
                        onChange={(e) => handleUpdateColumnMapping(idx, { mappingMode: e.target.value as any })}
                        style={{
                          height: '30px',
                          borderRadius: '4px',
                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                          color: 'var(--text-primary)',
                          fontSize: '0.6875rem',
                          padding: '0 4px',
                        }}
                      >
                        <option value="auto">Auto</option>
                        <option value="direct">Direct</option>
                        <option value="ai_extract">AI Extract</option>
                        <option value="static">Static</option>
                        <option value="ignore">Ignore</option>
                      </select>

                      {/* Source Path Input / Suggestions */}
                      {m.mappingMode === 'static' ? (
                        <input
                          type="text"
                          value={m.staticValue || ''}
                          placeholder="Fixed static value..."
                          onChange={(e) => handleUpdateColumnMapping(idx, { staticValue: e.target.value })}
                          style={{
                            height: '30px',
                            borderRadius: '4px',
                            border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                            backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                            color: 'var(--text-primary)',
                            fontSize: '0.6875rem',
                            padding: '0 6px',
                          }}
                        />
                      ) : m.mappingMode === 'ignore' ? (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Skipped (no write)
                        </div>
                      ) : (
                        <input
                          type="text"
                          list="source-field-suggestions"
                          value={m.sourceField || ''}
                          placeholder="e.g. property.code"
                          onChange={(e) => handleUpdateColumnMapping(idx, { sourceField: e.target.value })}
                          style={{
                            height: '30px',
                            borderRadius: '4px',
                            border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                            backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                            color: 'var(--text-primary)',
                            fontSize: '0.6875rem',
                            padding: '0 6px',
                          }}
                        />
                      )}

                      {/* Data Type */}
                      <select
                        value={m.dataType || 'string'}
                        onChange={(e) => handleUpdateColumnMapping(idx, { dataType: e.target.value as any })}
                        style={{
                          height: '30px',
                          borderRadius: '4px',
                          border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                          backgroundColor: isDark ? '#161B22' : '#FFFFFF',
                          color: 'var(--text-primary)',
                          fontSize: '0.6875rem',
                          padding: '0 4px',
                        }}
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="currency">Currency</option>
                        <option value="url">URL</option>
                        <option value="date">Date</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            <datalist id="source-field-suggestions">
              {SUGGESTED_SOURCE_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </datalist>
          </div>
        )}

        {/* ── TAB 4: WRITE RULES & ROW MATCHING ─────────────────────────────── */}
        {activeTab === 'write' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Write Operation
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {[
                  { id: 'append', label: 'Append Row', desc: 'Always adds a new row at the end of the sheet.' },
                  { id: 'upsert', label: 'Upsert Row', desc: 'Updates matching row if found; appends new row otherwise.' },
                  { id: 'update', label: 'Update Row Only', desc: 'Updates existing matching row. Fails if no row matches.' },
                  { id: 'preview', label: 'Preview Only', desc: 'Validates & structures output without writing to sheet.' },
                ].map((op) => {
                  const isSel = writeOperation === op.id;
                  return (
                    <div
                      key={op.id}
                      onClick={() => onUpdateBoxConfig({ googleSheetWriteOperation: op.id as any })}
                      style={{
                        padding: '0.65rem 0.75rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: isSel ? '1.5px solid #0F9D58' : isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                        backgroundColor: isSel
                          ? isDark ? 'rgba(15, 157, 88, 0.15)' : 'rgba(15, 157, 88, 0.08)'
                          : isDark ? '#0D1117' : '#FFFFFF',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isSel ? '#0F9D58' : 'var(--text-primary)' }}>
                        {op.label}
                      </div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.25 }}>
                        {op.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Key Columns for Matching (Visible for Update / Upsert) */}
            {(writeOperation === 'update' || writeOperation === 'upsert') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Row Matching Key Columns (Click to Toggle)
                </label>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  Rows matching ALL selected columns will be targeted for update.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {detectedHeaders.map((col) => {
                    const isMatched = matchColumns.includes(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => toggleMatchColumn(col)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: isMatched ? '1px solid #0F9D58' : '1px solid var(--border-color)',
                          backgroundColor: isMatched ? 'rgba(15, 157, 88, 0.15)' : isDark ? '#21262D' : '#F1F5F9',
                          color: isMatched ? '#0F9D58' : 'var(--text-secondary)',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isMatched ? '✓ ' : ''}{col}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preserve Non-Empty Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.75rem',
                borderRadius: '6px',
                backgroundColor: isDark ? '#0D1117' : '#F8FAFC',
                border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
              }}
            >
              <div>
                <div style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Preserve Existing Cell Data
                </div>
                <div style={{ fontSize: '0.5625rem', color: 'var(--text-muted)' }}>
                  Do not overwrite nonempty sheet cells with null or empty incoming values.
                </div>
              </div>
              <input
                type="checkbox"
                checked={preserveNonEmpty}
                onChange={(e) => onUpdateBoxConfig({ googleSheetPreserveNonEmpty: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#0F9D58', cursor: 'pointer' }}
              />
            </div>
          </div>
        )}

        {/* ── TAB 5: LIVE PREVIEW & TEST CONTROLS ───────────────────────────── */}
        {activeTab === 'testing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={isExecutingTest}
                onClick={() => handleExecuteProcessTest('preview')}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '6px',
                  backgroundColor: isDark ? '#21262D' : '#F1F5F9',
                  border: isDark ? '1px solid #30363D' : '1px solid #CBD5E1',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: isExecutingTest ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <FiEye size={13} color="#3B82F6" />
                {isExecutingTest && testMode === 'preview' ? 'Validating...' : 'Test Extraction (Preview)'}
              </button>

              <button
                type="button"
                disabled={isExecutingTest}
                onClick={() => {
                  if (onTestGoogleSheetSync) {
                    onTestGoogleSheetSync();
                  } else {
                    handleExecuteProcessTest('write');
                  }
                }}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '6px',
                  backgroundColor: '#0F9D58',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: isExecutingTest ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <SiGooglesheets size={13} />
                {isExecutingTest && testMode === 'write' ? 'Executing Write...' : 'Test Write to Sheet'}
              </button>
            </div>

            {/* Test Results Banner */}
            {effectiveTestResult && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '6px',
                  backgroundColor: effectiveTestResult.success
                    ? isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5'
                    : isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                  border: effectiveTestResult.success ? '1px solid #10B981' : '1px solid #EF4444',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {effectiveTestResult.success ? (
                    <FiCheckCircle size={14} color="#10B981" />
                  ) : (
                    <FiAlertCircle size={14} color="#EF4444" />
                  )}
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: effectiveTestResult.success ? '#10B981' : '#EF4444' }}>
                    {effectiveTestResult.success ? 'Execution Succeeded' : 'Execution Failed'}
                  </span>
                </div>

                {effectiveTestResult.execution_summary && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {effectiveTestResult.execution_summary}
                  </div>
                )}
                {effectiveTestResult.error && (
                  <div style={{ fontSize: '0.6875rem', color: '#EF4444' }}>
                    {effectiveTestResult.error}
                  </div>
                )}

                {/* Structured Values Preview */}
                {(effectiveTestResult.mapped_data || effectiveTestResult) && (
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px' }}>
                      Mapped Data:
                    </div>
                    <pre
                      style={{
                        padding: '0.5rem',
                        borderRadius: '4px',
                        backgroundColor: isDark ? '#0D1117' : '#FFFFFF',
                        border: isDark ? '1px solid #30363D' : '1px solid #E2E8F0',
                        fontSize: '0.625rem',
                        color: 'var(--text-primary)',
                        maxHeight: '160px',
                        overflow: 'auto',
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(effectiveTestResult.mapped_data || effectiveTestResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
