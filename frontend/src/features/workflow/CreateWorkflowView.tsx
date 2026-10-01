import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import {
  FacebookWorkflowCanvas,
  DEFAULT_FB_WORKFLOW_CONFIG,
  type FacebookWorkflowConfig,
} from '../facebook-import/FacebookWorkflowCanvas';
import {
  getSavedWorkflowFormats,
  saveWorkflowFormatsList,
  getActiveWorkflowFormatId,
  setActiveWorkflowFormatId,
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
  FiLayers,
  FiCheckCircle,
  FiFileText,
  FiImage,
  FiCpu,
  FiMaximize2,
  FiSliders,
} from 'react-icons/fi';

export const CreateWorkflowView: React.FC = () => {
  const navigate = useNavigate();
  const [formats, setFormats] = useState<WorkflowFormat[]>(() => getSavedWorkflowFormats());
  const [activeFormatId, setActiveId] = useState<string>(() => getActiveWorkflowFormatId());

  // Editing state for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFormat, setEditingFormat] = useState<WorkflowFormat>(() => {
    const list = getSavedWorkflowFormats();
    const id = getActiveWorkflowFormatId();
    return list.find((f) => f.id === id) || list[0];
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
            id: `ai-box-${Date.now()}`,
            title: 'Dynamic Real Estate Copywriter',
            processType: 'rental',
            provider: 'google_ai',
            model: 'gemini-flash-latest',
            templateId: '1',
            templateText:
              'Generate an attractive Facebook real estate listing post from the extracted caption.',
            customPrompt: '',
            enabled: true,
            x: 680,
            y: 120,
          },
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
    if (formats.length <= 1) {
      alert('You must keep at least one workflow format.');
      return;
    }
    if (!window.confirm(`Delete workflow format "${formatName}"?`)) {
      return;
    }

    const updatedList = formats.filter((f) => f.id !== formatId);
    setFormats(updatedList);
    saveWorkflowFormatsList(updatedList);

    if (activeFormatId === formatId) {
      const nextId = updatedList[0].id;
      setActiveId(nextId);
      setActiveWorkflowFormatId(nextId);
    }

    if (editingFormat.id === formatId && isModalOpen) {
      setIsModalOpen(false);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* Top Header Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.625rem',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: '#A78BFA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              flexShrink: 0,
            }}
          >
            <FiGitBranch />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Create & Setup Workflow
              </h2>
              <Badge variant="info">Format Builder</Badge>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
              Design reusable workflow formats with customizable extraction branches and dynamic AI prompt generation. Click any format to open the canvas in a modal box.
            </p>
          </div>
        </div>

        {/* Primary Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Button
            variant="primary"
            size="md"
            onClick={handleCreateNewFormat}
            leftIcon={<FiPlus style={{ fontSize: '15px' }} />}
            style={{
              height: '38px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              backgroundColor: '#10B981',
              borderColor: '#10B981',
              borderRadius: '0.375rem',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
            }}
          >
            + Create New Workflow
          </Button>
        </div>
      </div>

      {/* WORKFLOW FORMAT CARDS GRID (NOT IN A TABLE) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {formats.map((format) => {
          const isActive = format.id === activeFormatId;
          const aiCount = format.config.aiBoxes.length;
          const hasContent = format.config.getContent.enabled;
          const hasImages = format.config.getImages.enabled;

          return (
            <div
              key={format.id}
              onClick={() => handleOpenCanvasModal(format)}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: `1.5px solid ${isActive ? '#3B82F6' : 'var(--border-color)'}`,
                borderRadius: '0.75rem',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                boxShadow: isActive ? '0 0 15px rgba(59, 130, 246, 0.15)' : 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = isActive ? '#3B82F6' : 'rgba(139, 92, 246, 0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isActive ? '#3B82F6' : 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
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
                      backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: isActive ? '#60A5FA' : 'var(--text-secondary)',
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
                  lineHeight: '1.35',
                  height: '38px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {format.description || 'Configured Facebook import extraction and multi-box dynamic AI prompts.'}
              </p>

              {/* Branch Feature Indicators */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.6875rem',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: hasContent ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    color: hasContent ? '#60A5FA' : 'var(--text-muted)',
                    border: `1px solid ${hasContent ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    fontWeight: 500,
                  }}
                >
                  <FiFileText style={{ fontSize: '10px' }} />
                  <span>Content: {hasContent ? 'ON' : 'OFF'}</span>
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.6875rem',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: hasImages ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    color: hasImages ? '#4ADE80' : 'var(--text-muted)',
                    border: `1px solid ${hasImages ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    fontWeight: 500,
                  }}
                >
                  <FiImage style={{ fontSize: '10px' }} />
                  <span>Images: {hasImages ? 'ON' : 'OFF'}</span>
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.6875rem',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(139, 92, 246, 0.12)',
                    color: '#C4B5FD',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    fontWeight: 500,
                  }}
                >
                  <FiCpu style={{ fontSize: '10px' }} />
                  <span>{aiCount} AI Box{aiCount > 1 ? 'es' : ''}</span>
                </span>
              </div>

              {/* Dynamic AI Boxes Preview Tags */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.375rem',
                  flexWrap: 'wrap',
                  backgroundColor: 'var(--bg-main)',
                  padding: '0.5rem 0.625rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--border-color)',
                  minHeight: '28px',
                }}
              >
                {format.config.aiBoxes.length > 0 ? (
                  format.config.aiBoxes.map((box, bIdx) => (
                    <span
                      key={box.id || bIdx}
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-secondary)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '3px',
                        padding: '1px 5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: box.provider === 'openai' ? '#10B981' : '#3B82F6',
                        }}
                      />
                      <span>{box.title}</span>
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No dynamic AI boxes configured yet
                  </span>
                )}
              </div>

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

      {/* MODAL BOX: WORKFLOW CANVAS */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="1480px"
        height="90vh"
        bodyPadding="0"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#A78BFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
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
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontWeight: 600,
                padding: '4px 8px',
                outline: 'none',
                minWidth: '240px',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Badge variant={editingFormat.config.getContent.enabled ? 'info' : 'default'} size="sm">
                Content: {editingFormat.config.getContent.enabled ? 'ON' : 'OFF'}
              </Badge>
              <Badge variant={editingFormat.config.getImages.enabled ? 'success' : 'default'} size="sm">
                Images: {editingFormat.config.getImages.enabled ? 'ON' : 'OFF'}
              </Badge>
              <Badge variant="warning" size="sm">
                {editingFormat.config.aiBoxes.length} AI Boxes
              </Badge>
            </div>
          </div>
        }
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                background: 'linear-gradient(135deg, #1877F2 0%, #3B82F6 100%)',
              }}
            >
              Use in Facebook Import
            </Button>
          </div>
        }
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <FacebookWorkflowCanvas
            initialConfig={editingFormat.config}
            onConfigChange={handleCanvasConfigChange}
          />
        </div>
      </Modal>
    </div>
  );
};
