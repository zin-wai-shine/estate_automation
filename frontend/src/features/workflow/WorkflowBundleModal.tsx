import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiCheck, FiDownload, FiFileText, FiLayers, FiScissors, FiUpload, FiX } from 'react-icons/fi';
import type { FacebookWorkflowConfig } from '../facebook-import/FacebookWorkflowCanvas';
import {
  applyWorkflowBundleImport,
  buildWorkflowBundle,
  downloadBundleFile,
  fetchCropFormatsForBundle,
  fetchPromptTemplatesForBundle,
  parseWorkflowBundle,
  type WorkflowBundleFile,
} from './workflowBundleService';

interface WorkflowBundleModalProps {
  isOpen: boolean;
  initialTab?: 'export' | 'import';
  isDark: boolean;
  workflowName: string;
  workflowDescription?: string;
  workflowConfig?: FacebookWorkflowConfig;
  onClose: () => void;
  onApplyWorkflow: (
    name: string,
    config: FacebookWorkflowConfig,
    mode: 'new' | 'replace',
    description?: string
  ) => void;
}

export const WorkflowBundleModal: React.FC<WorkflowBundleModalProps> = ({
  isOpen,
  initialTab = 'export',
  isDark,
  workflowName,
  workflowDescription,
  workflowConfig,
  onClose,
  onApplyWorkflow,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialTab);

  // Export state
  const [includeWorkflow, setIncludeWorkflow] = useState(true);
  const [includePromptTemplates, setIncludePromptTemplates] = useState(true);
  const [includeCropFormats, setIncludeCropFormats] = useState(true);
  const [customFileName, setCustomFileName] = useState('');
  const [hasEditedFileName, setHasEditedFileName] = useState(false);
  const [exportCounts, setExportCounts] = useState({ prompts: 0, crops: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Import state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedBundle, setParsedBundle] = useState<WorkflowBundleFile | null>(null);
  const [importedFileName, setImportedFileName] = useState('');
  const [importWorkflow, setImportWorkflow] = useState(true);
  const [importPromptTemplates, setImportPromptTemplates] = useState(true);
  const [importCropFormats, setImportCropFormats] = useState(true);
  const [workflowImportMode, setWorkflowImportMode] = useState<'new' | 'replace'>('new');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Floating window position & drag state (clamped strictly inside viewport)
  const windowRef = useRef<HTMLDivElement | null>(null);
  const [winPos, setWinPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(12, Math.round((window.innerWidth - 380) / 2)) : 120,
    y: typeof window !== 'undefined' ? Math.max(12, Math.round((window.innerHeight - 360) / 2)) : 80,
  }));
  const [isDraggingWin, setIsDraggingWin] = useState(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const clampWinPos = (x: number, y: number) => {
    const w = windowRef.current?.offsetWidth || 380;
    const h = windowRef.current?.offsetHeight || 320;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return {
      x: Math.max(8, Math.min(maxX, x)),
      y: Math.max(8, Math.min(maxY, y)),
    };
  };

  useEffect(() => {
    if (!isDraggingWin) return;
    const onMove = (e: MouseEvent) => {
      setWinPos(clampWinPos(e.clientX - dragOffsetRef.current.dx, e.clientY - dragOffsetRef.current.dy));
    };
    const onUp = () => setIsDraggingWin(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDraggingWin]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => setWinPos((prev) => clampWinPos(prev.x, prev.y));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, activeTab, parsedBundle]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setExportStatus(null);
    setImportError(null);
    setImportSuccess(null);
    setHasEditedFileName(false);

    Promise.all([fetchPromptTemplatesForBundle(), fetchCropFormatsForBundle()]).then(
      ([prompts, crops]) => {
        setExportCounts({ prompts: prompts.length, crops: crops.length });
      }
    );
  }, [isOpen, initialTab]);

  const suggestedFileName = useMemo(() => {
    const slug = (workflowName || 'workflow')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'workflow';

    if (includeWorkflow && includePromptTemplates && includeCropFormats) return `${slug}-full-bundle`;
    if (includeWorkflow && !includePromptTemplates && !includeCropFormats) return `${slug}-canvas`;
    if (!includeWorkflow && includePromptTemplates && !includeCropFormats) return 'prompt-templates';
    if (!includeWorkflow && !includePromptTemplates && includeCropFormats) return 'crop-cut-formats';
    return `${slug}-custom-bundle`;
  }, [workflowName, includeWorkflow, includePromptTemplates, includeCropFormats]);

  useEffect(() => {
    if (!hasEditedFileName) {
      setCustomFileName(suggestedFileName);
    }
  }, [suggestedFileName, hasEditedFileName]);

  if (!isOpen) return null;

  const nodeCount =
    (workflowConfig?.aiBoxes?.length || 0) +
    (workflowConfig?.combineBoxes?.length || 0) +
    (workflowConfig?.destinations?.length || (workflowConfig?.destination ? 1 : 0)) +
    3;
  const wireCount = workflowConfig?.connections?.length || 0;

  const handleExport = async () => {
    if (!includeWorkflow && !includePromptTemplates && !includeCropFormats) return;
    setIsExporting(true);
    setExportStatus(null);
    try {
      const bundle = await buildWorkflowBundle({
        fileName: customFileName || suggestedFileName,
        workflowName,
        workflowDescription,
        workflowConfig,
        includeWorkflow,
        includePromptTemplates,
        includeCropFormats,
      });
      downloadBundleFile(bundle, customFileName || suggestedFileName);
      setExportStatus('Saved .bolthaven.json file.');
    } catch (err: any) {
      setExportStatus(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);
    try {
      const text = await file.text();
      const bundle = parseWorkflowBundle(text);
      setParsedBundle(bundle);
      setImportedFileName(file.name);
      setImportWorkflow(Boolean(bundle.workflow?.config));
      setImportPromptTemplates(Boolean(bundle.promptTemplates && bundle.promptTemplates.length > 0));
      setImportCropFormats(Boolean(bundle.cropFormats && bundle.cropFormats.length > 0));
    } catch (err: any) {
      setParsedBundle(null);
      setImportError(err?.message || 'Could not read bundle file.');
    }
  };

  const handleImport = async () => {
    if (!parsedBundle) return;
    if (!importWorkflow && !importPromptTemplates && !importCropFormats) return;
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const res = await applyWorkflowBundleImport(
        parsedBundle,
        {
          importWorkflow,
          importPromptTemplates,
          importCropFormats,
          workflowImportMode,
        },
        onApplyWorkflow
      );
      const parts: string[] = [];
      if (res.workflowApplied) parts.push('Canvas');
      if (res.promptTemplatesCount > 0) parts.push(`${res.promptTemplatesCount} Prompts`);
      if (res.cropFormatsCount > 0) parts.push(`${res.cropFormatsCount} Crop Formats`);
      setImportSuccess(`Imported: ${parts.join(', ') || 'Done'}.`);
      setTimeout(() => {
        onClose();
      }, 850);
    } catch (err: any) {
      setImportError(err?.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const borderCol = isDark ? '#30363D' : '#E2E8F0';
  const rowBg = isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC';
  const rowActiveBg = isDark ? 'rgba(255, 255, 255, 0.075)' : '#EFF6FF';
  const rowActiveBorder = isDark ? 'rgba(255, 255, 255, 0.24)' : '#94A3B8';

  const rowStyle = (_active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '6px 4px',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.12s ease',
  });

  const renderCheckPill = (checked: boolean) => (
    <span
      style={{
        width: '14px',
        height: '14px',
        borderRadius: '4px',
        border: `1px solid ${checked ? (isDark ? 'rgba(255,255,255,0.5)' : '#0F172A') : (isDark ? 'rgba(255,255,255,0.22)' : '#CBD5E1')}`,
        backgroundColor: checked ? (isDark ? 'rgba(255,255,255,0.16)' : '#0F172A') : 'transparent',
        color: '#FFFFFF',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.12s ease',
      }}
    >
      {checked && <FiCheck size={10} strokeWidth={3} />}
    </span>
  );

  return (
    <div
      ref={windowRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: `${winPos.x}px`,
        top: `${winPos.y}px`,
        zIndex: 9999,
        width: '380px',
        maxWidth: 'calc(100vw - 24px)',
        borderRadius: '10px',
        backgroundColor: isDark ? '#1C2128' : '#FFFFFF',
        border: `1px solid ${isDark ? '#30363D' : '#CBD5E1'}`,
        boxShadow: isDark
          ? '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)'
          : '0 14px 36px rgba(15, 23, 42, 0.16)',
        overflow: 'hidden',
        color: 'var(--text-primary)',
        userSelect: isDraggingWin ? 'none' : 'auto',
      }}
    >
      {/* Compact Draggable macOS-style Titlebar */}
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          dragOffsetRef.current = { dx: e.clientX - winPos.x, dy: e.clientY - winPos.y };
          setIsDraggingWin(true);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '36px',
          padding: '0 12px',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
          borderBottom: `1px solid ${borderCol}`,
          cursor: isDraggingWin ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              border: 'none',
              padding: 0,
              backgroundColor: '#EF4444',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
            Workflow Bundle
          </span>
        </div>

        {/* Compact Segmented Switcher */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px',
            borderRadius: '6px',
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#E2E8F0',
            border: `1px solid ${borderCol}`,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            style={{
              height: '22px',
              padding: '0 9px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: activeTab === 'export' ? (isDark ? '#30363D' : '#FFFFFF') : 'transparent',
              color: activeTab === 'export' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            style={{
              height: '22px',
              padding: '0 9px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: activeTab === 'import' ? (isDark ? '#30363D' : '#FFFFFF') : 'transparent',
              color: activeTab === 'import' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Import
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '5px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FiX size={13} />
        </button>
      </div>

      {/* Body — fixed minHeight so Export and Import tabs stay the exact same size */}
      <div
        style={{
          padding: '14px',
          minHeight: '236px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '14px',
        }}
      >
        {activeTab === 'export' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  style={rowStyle(includeWorkflow)}
                  onClick={() => setIncludeWorkflow((v) => !v)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {renderCheckPill(includeWorkflow)}
                    <FiLayers size={13} style={{ color: includeWorkflow ? 'var(--text-primary)' : 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Workflow Canvas</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {nodeCount} nodes · {wireCount} wires
                  </span>
                </label>

                <label
                  style={rowStyle(includePromptTemplates)}
                  onClick={() => setIncludePromptTemplates((v) => !v)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {renderCheckPill(includePromptTemplates)}
                    <FiFileText size={13} style={{ color: includePromptTemplates ? 'var(--text-primary)' : 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Prompt Templates</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {exportCounts.prompts} items
                  </span>
                </label>

                <label
                  style={rowStyle(includeCropFormats)}
                  onClick={() => setIncludeCropFormats((v) => !v)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {renderCheckPill(includeCropFormats)}
                    <FiScissors size={13} style={{ color: includeCropFormats ? 'var(--text-primary)' : 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Crop &amp; Cut Formats</span>
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {exportCounts.crops} items
                  </span>
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '32px',
                  borderRadius: '7px',
                  border: `1px solid ${borderCol}`,
                  backgroundColor: rowBg,
                  padding: '0 10px',
                  gap: '4px',
                }}
              >
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => {
                    setHasEditedFileName(true);
                    setCustomFileName(e.target.value);
                  }}
                  placeholder="workflow-bundle"
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    outline: 'none',
                    minWidth: 0,
                  }}
                />
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                  .bolthaven.json
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                paddingTop: '10px',
                borderTop: `1px solid ${borderCol}`,
              }}
            >
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: exportStatus?.startsWith('Export failed') ? '#F87171' : '#34D399',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {exportStatus && (
                  <>
                    <FiCheck size={12} /> {exportStatus}
                  </>
                )}
              </span>
              <button
                type="button"
                disabled={isExporting || (!includeWorkflow && !includePromptTemplates && !includeCropFormats)}
                onClick={handleExport}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: `1px solid ${isDark ? '#30363D' : '#0F172A'}`,
                  backgroundColor: isDark ? '#2D333B' : '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: isExporting || (!includeWorkflow && !includePromptTemplates && !includeCropFormats) ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FiDownload size={12} />
                {isExporting ? 'Exporting...' : 'Export File'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.bolthaven.json,application/json"
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileSelected(e.dataTransfer.files?.[0]);
                }}
                style={{
                  border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1'}`,
                  borderRadius: '7px',
                  padding: parsedBundle ? '10px' : '28px 12px',
                  textAlign: 'center',
                  backgroundColor: rowBg,
                  cursor: 'pointer',
                  flex: parsedBundle ? '0 0 auto' : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                  <FiUpload size={13} style={{ color: 'var(--text-secondary)' }} />
                  {importedFileName || 'Choose or drop .bolthaven.json'}
                </div>
                {!parsedBundle && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                    Canvas, prompt templates, and crop formats
                  </div>
                )}
              </div>

              {parsedBundle && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {parsedBundle.workflow?.config && (
                    <div style={{ ...rowStyle(importWorkflow), flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
                      <div
                        onClick={() => setImportWorkflow((v) => !v)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {renderCheckPill(importWorkflow)}
                          <FiLayers size={13} style={{ color: importWorkflow ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                            {parsedBundle.workflow.name || parsedBundle.name}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                          {(parsedBundle.workflow.config.aiBoxes?.length || 0) + 3} nodes
                        </span>
                      </div>
                      {importWorkflow && (
                        <div style={{ display: 'flex', gap: '12px', paddingLeft: '22px', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="wf-import-mode"
                              checked={workflowImportMode === 'new'}
                              onChange={() => setWorkflowImportMode('new')}
                            />
                            New Workflow
                          </label>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="wf-import-mode"
                              checked={workflowImportMode === 'replace'}
                              onChange={() => setWorkflowImportMode('replace')}
                            />
                            Replace Current
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {Array.isArray(parsedBundle.promptTemplates) && parsedBundle.promptTemplates.length > 0 && (
                    <div
                      style={rowStyle(importPromptTemplates)}
                      onClick={() => setImportPromptTemplates((v) => !v)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {renderCheckPill(importPromptTemplates)}
                        <FiFileText size={13} style={{ color: importPromptTemplates ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Prompt Templates</span>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                        {parsedBundle.promptTemplates.length} items
                      </span>
                    </div>
                  )}

                  {Array.isArray(parsedBundle.cropFormats) && parsedBundle.cropFormats.length > 0 && (
                    <div
                      style={rowStyle(importCropFormats)}
                      onClick={() => setImportCropFormats((v) => !v)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {renderCheckPill(importCropFormats)}
                        <FiScissors size={13} style={{ color: importCropFormats ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Crop &amp; Cut Formats</span>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                        {parsedBundle.cropFormats.length} items
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                paddingTop: '10px',
                borderTop: `1px solid ${borderCol}`,
              }}
            >
              <span style={{ fontSize: '0.6875rem', color: importError ? '#F87171' : '#34D399' }}>
                {importError || importSuccess || ''}
              </span>
              <button
                type="button"
                disabled={
                  !parsedBundle ||
                  isImporting ||
                  (!importWorkflow && !importPromptTemplates && !importCropFormats)
                }
                onClick={handleImport}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: `1px solid ${isDark ? '#30363D' : '#0F172A'}`,
                  backgroundColor: isDark ? '#2D333B' : '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity:
                    !parsedBundle ||
                    isImporting ||
                    (!importWorkflow && !importPromptTemplates && !importCropFormats)
                      ? 0.5
                      : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FiUpload size={12} />
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
