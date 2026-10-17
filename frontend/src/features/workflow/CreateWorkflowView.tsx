import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  FacebookWorkflowCanvas,
  DEFAULT_FB_WORKFLOW_CONFIG,
  type FacebookWorkflowConfig,
  type FacebookWorkflowCanvasRef,
} from '../facebook-import/FacebookWorkflowCanvas';
import {
  getSavedWorkflowFormats,
  saveWorkflowFormatsList,
  getActiveWorkflowFormatId,
  setActiveWorkflowFormatId,
  restoreDefaultWorkflowFormats,
  type WorkflowFormat,
} from './workflowFormats';
import {
  FiGitBranch,
  FiPlus,
  FiSave,
  FiCopy,
  FiTrash2,
  FiCheck,
  FiArrowRight,
  FiCheckCircle,
  FiMaximize2,
  FiCrosshair,
  FiRotateCcw,
  FiLayers,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { useTheme } from '../../context/ThemeContext';

export const CreateWorkflowView: React.FC = () => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const navigate = useNavigate();
  const canvasRef = useRef<FacebookWorkflowCanvasRef>(null);
  const [formats, setFormats] = useState<WorkflowFormat[]>(() => getSavedWorkflowFormats());
  const [activeFormatId, setActiveId] = useState<string>(() => getActiveWorkflowFormatId());
  const [headerActionEl, setHeaderActionEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHeaderActionEl(document.getElementById('header-action-portal'));
  }, []);

  // Editing state for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletedCount, setDeletedCount] = useState<number>(0);
  const [editingFormat, setEditingFormat] = useState<WorkflowFormat | null>(() => {
    const list = getSavedWorkflowFormats();
    const id = getActiveWorkflowFormatId();
    return list.find((f) => f.id === id) || list[0] || null;
  });
  const [modalFormatName, setModalFormatName] = useState<string>('');
  const [modalFormatDesc, setModalFormatDesc] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Open Canvas Modal for an existing format
  const handleOpenCanvasModal = (format: WorkflowFormat) => {
    setEditingFormat(format);
    setModalFormatName(format.name);
    setModalFormatDesc(format.description || '');
    setIsModalOpen(true);
  };

  // Create New Format and open in modal immediately
  const handleCreateNewFormat = () => {
    const newId = `format-${Date.now()}`;
    const newBoxId = `ai-box-${Date.now()}`;
    const newFormat: WorkflowFormat = {
      id: newId,
      name: `Custom Workflow #${formats.length + 1}`,
      description: 'Custom Facebook import extraction with dynamic AI prompt generator',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: {
        ...DEFAULT_FB_WORKFLOW_CONFIG,
        aiBoxes: [
          {
            id: newBoxId,
            title: 'Dynamic Real Estate Copywriter',
            processType: 'rental',
            provider: 'google_ai',
            model: 'gemini-flash-latest',
            templateId: '1',
            templateText:
              'Generate an attractive Facebook real estate listing post from the extracted caption.',
            customPrompt: '',
            enabled: true,
            x: 640,
            y: 110,
          },
        ],
        connections: [
          { id: `conn-content-${newBoxId}`, fromNodeId: 'get-content', toNodeId: newBoxId },
          { id: `conn-${newBoxId}-dest`, fromNodeId: newBoxId, toNodeId: 'destination' },
        ],
      },
    };

    const updatedList = [...formats, newFormat];
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);
    handleOpenCanvasModal(newFormat);
  };

  // Duplicate Format
  const handleDuplicateFormat = (format: WorkflowFormat, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newId = `format-${Date.now()}`;
    const duplicated: WorkflowFormat = {
      ...format,
      id: newId,
      name: `${format.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: JSON.parse(JSON.stringify(format.config)),
    };

    const updatedList = [...formats, duplicated];
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);
  };

  // Delete Format
  const handleDeleteFormat = (formatId: string, formatName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete workflow format "${formatName}"?`)) {
      return;
    }

    const updatedList = formats.filter((f) => f.id !== formatId);
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);

    if (activeFormatId === formatId) {
      const nextId = updatedList[0]?.id || '';
      setActiveId(nextId);
      setActiveWorkflowFormatId(nextId);
    }

    if (editingFormat?.id === formatId && isModalOpen) {
      setIsModalOpen(false);
      setEditingFormat(updatedList[0] || null);
    }
  };

  // Delete All Formats
  const handleDeleteAllFormats = () => {
    if (formats.length === 0) return;
    if (!window.confirm(`Are you sure you want to remove all ${formats.length} workflow format(s)? This will delete all sample and custom workflows.`)) {
      return;
    }

    setFormats([]);
    saveWorkflowFormatsList([]);
    setActiveId('');
    setActiveWorkflowFormatId('');
    setEditingFormat(null);
    try {
      localStorage.removeItem('ea_workflow_deleted_boxes');
    } catch {}
    if (isModalOpen) {
      setIsModalOpen(false);
    }
  };

  // Restore Default Sample Formats
  const handleRestoreDefaults = () => {
    const defaults = restoreDefaultWorkflowFormats();
    setFormats(defaults);
    setActiveId(defaults[0]?.id || '');
    if (editingFormat && !defaults.some((d) => d.id === editingFormat.id)) {
      setEditingFormat(defaults[0] || null);
    }
  };

  // Set as Active Format for Facebook Import
  const handleSetActiveFormat = (formatId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveId(formatId);
    setActiveWorkflowFormatId(formatId);
  };

  // Switch to Facebook Import using this format
  const handleUseInFacebookImport = (formatId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveId(formatId);
    setActiveWorkflowFormatId(formatId);
    navigate('/facebook-import');
  };

  // Update canvas config inside modal
  const handleCanvasConfigChange = (newConfig: FacebookWorkflowConfig) => {
    if (!editingFormat) return;
    const updated: WorkflowFormat = {
      ...editingFormat,
      config: newConfig,
      updatedAt: Date.now(),
    };
    setEditingFormat(updated);
    const updatedList = formats.map((f) => (f.id === editingFormat.id ? updated : f));
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);
  };

  // Save Format inside Modal
  const handleSaveModalFormat = () => {
    if (!editingFormat) return;
    const updated: WorkflowFormat = {
      ...editingFormat,
      name: modalFormatName.trim() || 'Untitled Workflow Format',
      description: modalFormatDesc.trim(),
      updatedAt: Date.now(),
    };

    const updatedList = formats.map((f) => (f.id === editingFormat.id ? updated : f));
    setFormats(updatedList);
    setEditingFormat(updated);
    saveWorkflowFormatsList(updatedList);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: formats.length === 0 ? 'calc(100vh - 6rem)' : 'auto',
        minHeight: formats.length === 0 ? '620px' : 'auto',
        width: '100%',
        boxSizing: 'border-box',
        gap: formats.length > 0 ? '1.25rem' : 0,
        paddingBottom: formats.length > 0 ? '3rem' : 0,
      }}
    >
      {/* Portal action buttons into Top Navbar when workflows exist */}
      {headerActionEl &&
        formats.length > 0 &&
        createPortal(
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteAllFormats}
              leftIcon={<FiTrash2 style={{ fontSize: '13px' }} />}
              style={{
                height: '32px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderColor: 'rgba(239, 68, 68, 0.35)',
                color: '#EF4444',
                borderRadius: '0.375rem',
              }}
              title="Remove all workflow formats and samples"
            >
              Remove All
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateNewFormat}
              leftIcon={<FiPlus style={{ fontSize: '14px' }} />}
              style={{
                height: '32px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '0.375rem',
                boxShadow: 'none',
              }}
            >
              Create Workflow
            </Button>
          </div>,
          headerActionEl
        )}

      {/* Page Header: Shown when workflows exist */}
      {formats.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            paddingBottom: '0.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.625rem',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#818CF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                flexShrink: 0,
              }}
            >
              <FiGitBranch />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Workflow Formats
                </h2>
                <Badge variant="default">
                  {formats.length} {formats.length === 1 ? 'Format' : 'Formats'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-HEIGHT EMPTY STATE CANVAS: SQUARE BUTTON IN CENTER & SPREAD REDUCED DOTS */}
      {formats.length === 0 ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            flex: 1,
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Spread Dot Canvas Pattern with Reduced Dot Size */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              maskImage: 'radial-gradient(ellipse 65% 65% at 50% 50%, black 25%, transparent 95%)',
              WebkitMaskImage: 'radial-gradient(ellipse 65% 65% at 50% 50%, black 25%, transparent 95%)',
            }}
          >
            <svg width="100%" height="100%">
              <defs>
                <pattern id="spread-canvas-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle
                    cx="12"
                    cy="12"
                    r="0.9"
                    fill={isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.22)'}
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#spread-canvas-dots)" />
            </svg>
          </div>

          {/* Square Button in Center with Plus and Small Text Underneath */}
          <button
            type="button"
            onClick={handleCreateNewFormat}
            style={{
              position: 'relative',
              zIndex: 2,
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.625rem',
              outline: 'none',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => {
              const box = e.currentTarget.querySelector('.square-step-box') as HTMLElement | null;
              if (box) {
                box.style.borderColor = 'var(--accent-primary)';
                box.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
                box.style.color = 'var(--accent-primary)';
              }
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              const box = e.currentTarget.querySelector('.square-step-box') as HTMLElement | null;
              if (box) {
                box.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)';
                box.style.backgroundColor = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
                box.style.color = 'var(--text-secondary)';
              }
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              className="square-step-box"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '0.75rem',
                border: isDark ? '2px dashed rgba(255, 255, 255, 0.4)' : '2px dashed rgba(0, 0, 0, 0.3)',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
              }}
            >
              <FiPlus style={{ fontSize: '26px', strokeWidth: 2 }} />
            </div>
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              Add first step...
            </span>
          </button>
        </div>
      ) : (
        /* WORKFLOW FORMAT CARDS GRID */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {formats.map((format) => {
            const isActive = format.id === activeFormatId;

            return (
              <div
                key={format.id}
                onClick={() => handleOpenCanvasModal(format)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                  position: 'relative',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                  e.currentTarget.style.boxShadow = isDark
                    ? '0 10px 25px -3px rgba(0, 0, 0, 0.6)'
                    : '0 10px 25px -3px rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                {/* Card Top: Title & Active Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '0.5rem',
                        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'),
                        color: isActive ? (isDark ? '#60A5FA' : '#2563EB') : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        flexShrink: 0,
                      }}
                    >
                      <FiGitBranch />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {format.name}
                      </h3>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Updated {new Date(format.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {isActive && (
                    <Badge variant="info" size="sm">
                      <FiCheckCircle style={{ marginRight: '3px' }} /> Active in FB Import
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: '1.4',
                    height: '38px',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {format.description || 'Configured Facebook import extraction and multi-box dynamic AI prompts.'}
                </p>

                {/* Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    marginTop: 'auto',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  {/* Main Modal Trigger Button */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenCanvasModal(format)}
                    leftIcon={<FiMaximize2 style={{ fontSize: '13px' }} />}
                    style={{
                      height: '34px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      borderRadius: '0.375rem',
                      flex: 1,
                    }}
                  >
                    Open Canvas (Modal)
                  </Button>

                  {!isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleSetActiveFormat(format.id, e)}
                      style={{
                        height: '34px',
                        fontSize: '0.75rem',
                        borderRadius: '0.375rem',
                        whiteSpace: 'nowrap',
                      }}
                      title="Set as active format for Facebook Import"
                    >
                      Set Active
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleDuplicateFormat(format, e)}
                    title="Duplicate format"
                    style={{
                      height: '34px',
                      width: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '0.375rem',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <FiCopy style={{ fontSize: '13px' }} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteFormat(format.id, format.name, e)}
                    title="Delete format"
                    style={{
                      height: '34px',
                      width: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '0.375rem',
                      backgroundColor: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#EF4444',
                      cursor: 'pointer',
                    }}
                  >
                    <FiTrash2 style={{ fontSize: '13px' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL BOX: WORKFLOW CANVAS */}
      {editingFormat && (
        <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="1480px"
        height="90vh"
        bodyPadding="0"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                color: isDark ? '#A78BFA' : '#7C3AED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                flexShrink: 0,
              }}
            >
              <FiGitBranch />
            </div>
            <input
              type="text"
              value={modalFormatName}
              onChange={(e) => setModalFormatName(e.target.value)}
              placeholder="Format Name"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                padding: '4px 6px',
                outline: 'none',
                minWidth: '240px',
              }}
            />
          </div>
        }
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => canvasRef.current?.addAIBox()}
              leftIcon={<FiPlus style={{ fontSize: '13px' }} />}
              style={{
                height: '32px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#10B981',
                borderColor: '#10B981',
                color: '#FFFFFF',
                boxShadow: 'none',
              }}
            >
              Add Dynamic AI Node
            </Button>
            {deletedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => canvasRef.current?.openRecoverModal()}
                leftIcon={<FiRotateCcw style={{ fontSize: '13px', color: '#0284C7' }} />}
                style={{
                  height: '32px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.08)',
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.5)',
                  color: isDark ? '#38BDF8' : '#0284C7',
                  boxShadow: 'none',
                }}
                title="Recover deleted AI nodes"
              >
                Recover ({deletedCount})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => canvasRef.current?.resetLayout()}
              leftIcon={<FiCrosshair style={{ fontSize: '13px' }} />}
              style={{
                height: '32px',
                fontSize: '0.75rem',
                fontWeight: 500,
                boxShadow: 'none',
              }}
            >
              Reset Layout
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveModalFormat}
              leftIcon={saveSuccess ? <FiCheck style={{ color: '#10B981' }} /> : <FiSave />}
              style={{
                height: '32px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderColor: saveSuccess ? '#10B981' : undefined,
                color: saveSuccess ? '#10B981' : undefined,
                boxShadow: 'none',
              }}
            >
              {saveSuccess ? 'Saved!' : 'Save Format'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleUseInFacebookImport(editingFormat.id)}
              leftIcon={<FiArrowRight />}
              style={{
                height: '32px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#1877F2',
                borderColor: '#1877F2',
                color: '#FFFFFF',
                boxShadow: 'none',
              }}
            >
              Use in Facebook Import
            </Button>
          </div>
        }
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <FacebookWorkflowCanvas
            ref={canvasRef}
            initialConfig={editingFormat.config}
            onConfigChange={handleCanvasConfigChange}
            onDeletedCountChange={setDeletedCount}
            allowEditPrompt={true}
          />
        </div>
      </Modal>
      )}
    </div>
  );
};
