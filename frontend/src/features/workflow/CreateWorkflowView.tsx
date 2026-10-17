import React, { useState, useRef } from 'react';
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
  FiMessageSquare,
  FiZap,
  FiFileText,
  FiActivity,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';
import { FaFacebook } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

export const CreateWorkflowView: React.FC = () => {
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const navigate = useNavigate();
  const canvasRef = useRef<FacebookWorkflowCanvasRef>(null);
  const [formats, setFormats] = useState<WorkflowFormat[]>(() => getSavedWorkflowFormats());
  const [activeFormatId, setActiveId] = useState<string>(() => getActiveWorkflowFormatId());

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
      {/* Sleek Minimal Header: Only shown when workflows exist */}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Button
              variant="outline"
              size="md"
              onClick={handleDeleteAllFormats}
              leftIcon={<FiTrash2 style={{ fontSize: '14px' }} />}
              style={{
                height: '38px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderColor: 'rgba(239, 68, 68, 0.35)',
                color: '#EF4444',
                borderRadius: '0.5rem',
              }}
              title="Remove all workflow formats and samples"
            >
              Remove All
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={handleCreateNewFormat}
              leftIcon={<HiSparkles style={{ fontSize: '15px' }} />}
              style={{
                height: '38px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                borderColor: '#4F46E5',
                borderRadius: '0.5rem',
                boxShadow: '0 2px 10px rgba(79, 70, 229, 0.3)',
              }}
            >
              Create New Workflow
            </Button>
          </div>
        </div>
      )}

      {/* FULL-HEIGHT EMPTY STATE STUDIO CANVAS */}
      {formats.length === 0 ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            flex: 1,
            borderRadius: '1rem',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '2.5rem 2rem 2rem 2rem',
            overflow: 'hidden',
            boxSizing: 'border-box',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Subtle Ambient Background Lighting */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: isDark
                ? 'radial-gradient(ellipse 60% 40% at 50% 15%, rgba(99, 102, 241, 0.12), transparent 70%), radial-gradient(ellipse 50% 30% at 85% 85%, rgba(139, 92, 246, 0.08), transparent 70%)'
                : 'radial-gradient(ellipse 60% 40% at 50% 15%, rgba(99, 102, 241, 0.06), transparent 70%), radial-gradient(ellipse 50% 30% at 85% 85%, rgba(139, 92, 246, 0.04), transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top Hero Section: Title, Subtitle, and REDESIGNED CENTER BUTTON */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              textAlign: 'center',
              maxWidth: '680px',
              margin: '0 auto',
              padding: '0.5rem 1rem 0 1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            {/* Ambient Pill Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                background: isDark
                  ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.18), rgba(139, 92, 246, 0.18))'
                  : 'linear-gradient(90deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
                border: isDark ? '1px solid rgba(129, 140, 248, 0.35)' : '1px solid rgba(99, 102, 241, 0.25)',
                color: isDark ? '#C7D2FE' : '#4338CA',
                boxShadow: '0 2px 10px rgba(99, 102, 241, 0.12)',
              }}
            >
              <HiSparkles style={{ fontSize: '14px', color: isDark ? '#A5B4FC' : '#6366F1' }} />
              <span>Visual AI Real Estate Pipeline</span>
            </div>

            {/* Main Title */}
            <h1
              style={{
                fontSize: '2.1rem',
                fontWeight: 800,
                margin: 0,
                lineHeight: 1.25,
                letterSpacing: '-0.03em',
                background: isDark
                  ? 'linear-gradient(180deg, #FFFFFF 20%, #94A3B8 100%)'
                  : 'linear-gradient(180deg, #0F172A 20%, #334155 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Create Your Automated AI Workflow
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontSize: '0.9375rem',
                color: 'var(--text-muted)',
                margin: 0,
                lineHeight: 1.55,
                maxWidth: '560px',
              }}
            >
              Connect live property listings to dual-language AI copywriting, high-res photo preservation, and instant multi-platform broadcasting.
            </p>

            {/* REDESIGNED CENTER CREATE BUTTON */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem', marginTop: '0.35rem' }}>
              <button
                type="button"
                onClick={handleCreateNewFormat}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '13px 32px',
                  borderRadius: '0.75rem',
                  fontSize: '0.9375rem',
                  fontWeight: 650,
                  letterSpacing: '0.01em',
                  color: '#FFFFFF',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #7C3AED 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  boxShadow: isDark
                    ? '0 12px 28px -4px rgba(79, 70, 229, 0.55), 0 4px 12px rgba(99, 102, 241, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                    : '0 12px 24px -4px rgba(79, 70, 229, 0.45), 0 4px 10px rgba(99, 102, 241, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                  e.currentTarget.style.boxShadow = isDark
                    ? '0 18px 36px -4px rgba(99, 102, 241, 0.7), 0 6px 16px rgba(124, 58, 237, 0.45)'
                    : '0 18px 32px -4px rgba(79, 70, 229, 0.55), 0 6px 14px rgba(99, 102, 241, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = isDark
                    ? '0 12px 28px -4px rgba(79, 70, 229, 0.55), 0 4px 12px rgba(99, 102, 241, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                    : '0 12px 24px -4px rgba(79, 70, 229, 0.45), 0 4px 10px rgba(99, 102, 241, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.35)';
                }}
              >
                <HiSparkles style={{ fontSize: '18px', color: '#E0E7FF' }} />
                <span>Create Workflow</span>
                <FiArrowRight style={{ fontSize: '15px', opacity: 0.85, marginLeft: '2px' }} />
              </button>

              {/* Subtle Restore Samples Link */}
              <button
                type="button"
                onClick={handleRestoreDefaults}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <FiRotateCcw style={{ fontSize: '11px' }} />
                <span>Or restore sample workflow templates</span>
              </button>
            </div>
          </div>

          {/* SPREAD FLOW COOL DESIGN WITH SOFT GRADIENT & GLOW CHAT CARDS */}
          <div
            onClick={handleCreateNewFormat}
            style={{
              position: 'relative',
              zIndex: 2,
              width: '100%',
              borderRadius: '1rem',
              overflow: 'hidden',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
              background: isDark
                ? 'radial-gradient(circle at 15% 30%, rgba(59, 130, 246, 0.12), transparent 45%), radial-gradient(circle at 50% 15%, rgba(139, 92, 246, 0.14), transparent 50%), radial-gradient(circle at 85% 65%, rgba(16, 185, 129, 0.12), transparent 45%), rgba(10, 15, 29, 0.65)'
                : 'radial-gradient(circle at 15% 30%, rgba(59, 130, 246, 0.06), transparent 45%), radial-gradient(circle at 50% 15%, rgba(139, 92, 246, 0.08), transparent 50%), radial-gradient(circle at 85% 65%, rgba(16, 185, 129, 0.06), transparent 45%), rgba(255, 255, 255, 0.75)',
              padding: '2rem 1.75rem 2.25rem 1.75rem',
              boxShadow: isDark
                ? '0 15px 35px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                : '0 10px 25px -8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              marginTop: '1.25rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.35)';
              e.currentTarget.style.boxShadow = isDark
                ? '0 20px 45px -10px rgba(99, 102, 241, 0.2), 0 0 0 1px rgba(99, 102, 241, 0.25)'
                : '0 16px 35px -8px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(99, 102, 241, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
              e.currentTarget.style.boxShadow = isDark
                ? '0 15px 35px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                : '0 10px 25px -8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8)';
            }}
            title="Click to launch Workflow Format Studio"
          >
            {/* Subtle Dotted Background Pattern */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `radial-gradient(circle, ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'} 1px, transparent 1px)`,
                backgroundSize: '24px 24px',
                pointerEvents: 'none',
              }}
            />

            {/* Live Pipeline Active Pill */}
            <div
              style={{
                position: 'absolute',
                top: '0.875rem',
                right: '1.25rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.6875rem',
                fontWeight: 600,
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                color: isDark ? '#A5B4FC' : '#4F46E5',
                border: isDark ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid rgba(99, 102, 241, 0.25)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#6366F1',
                  boxShadow: '0 0 8px #6366F1',
                }}
              />
              <span>Interactive Pipeline Preview • Click to Open</span>
            </div>

            {/* SPREAD FLOW: 4 Connected Columns */}
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                display: 'grid',
                gridTemplateColumns: 'minmax(190px, 1fr) 36px minmax(210px, 1.1fr) 36px minmax(300px, 1.5fr) 36px minmax(190px, 1fr)',
                alignItems: 'center',
                gap: '0',
                width: '100%',
                paddingTop: '0.5rem',
              }}
            >
              {/* NODE 1: Trigger (Facebook) */}
              <div
                style={{
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                  border: isDark ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '0.875rem',
                  padding: '1.15rem',
                  backdropFilter: 'blur(12px)',
                  boxShadow: isDark
                    ? '0 10px 25px -4px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.2)'
                    : '0 10px 25px -4px rgba(59, 130, 246, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#1877F2',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      boxShadow: '0 4px 12px rgba(24, 119, 242, 0.45)',
                      flexShrink: 0,
                    }}
                  >
                    <FaFacebook />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Facebook Post
                    </h4>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Auto-Trigger Source
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                    borderRadius: '0.5rem',
                    padding: '7px 9px',
                    fontSize: '0.6875rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4',
                  }}
                >
                  Monitors Facebook page feeds and detects property listings in real time.
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#3B82F6',
                    }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#60A5FA', fontWeight: 600 }}>
                    Live Stream • 0.2s latency
                  </span>
                </div>
              </div>

              {/* CONNECTOR 1 -> 2 */}
              <div style={{ width: '100%', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
                  <path
                    d="M 0 12 L 32 12"
                    stroke={isDark ? '#60A5FA' : '#3B82F6'}
                    strokeWidth="2.2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                  <polygon points="28,8 36,12 28,16" fill={isDark ? '#60A5FA' : '#3B82F6'} />
                </svg>
              </div>

              {/* NODE 2: Extract & Route */}
              <div
                style={{
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                  border: isDark ? '1px solid rgba(139, 92, 246, 0.35)' : '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: '0.875rem',
                  padding: '1.15rem',
                  backdropFilter: 'blur(12px)',
                  boxShadow: isDark
                    ? '0 10px 25px -4px rgba(139, 92, 246, 0.25), 0 0 0 1px rgba(139, 92, 246, 0.2)'
                    : '0 10px 25px -4px rgba(139, 92, 246, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(139, 92, 246, 0.18)',
                      color: '#A78BFA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                      flexShrink: 0,
                    }}
                  >
                    <FiLayers />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Extract & Route
                    </h4>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Specs & Photos
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                      borderRadius: '0.375rem',
                      padding: '5px 8px',
                      fontSize: '0.6875rem',
                      color: isDark ? '#93C5FD' : '#1D4ED8',
                      fontWeight: 600,
                    }}
                  >
                    <FiFileText style={{ fontSize: '11px' }} />
                    <span>Price ฿35,000 • 2 Bed (45 sqm)</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                      borderRadius: '0.375rem',
                      padding: '5px 8px',
                      fontSize: '0.6875rem',
                      color: isDark ? '#6EE7B7' : '#047857',
                      fontWeight: 600,
                    }}
                  >
                    <FiCheck style={{ fontSize: '11px' }} />
                    <span>8 HD Listing Photos</span>
                  </div>
                </div>
              </div>

              {/* CONNECTOR 2 -> 3 (Branching) */}
              <div style={{ width: '100%', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="36" height="90" viewBox="0 0 36 90" fill="none">
                  {/* Top branch */}
                  <path
                    d="M 0 45 C 18 45, 18 22, 36 22"
                    stroke={isDark ? '#A78BFA' : '#8B5CF6'}
                    strokeWidth="2.2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                  <polygon points="30,18 36,22 30,26" fill={isDark ? '#A78BFA' : '#8B5CF6'} />
                  {/* Bottom branch */}
                  <path
                    d="M 0 45 C 18 45, 18 68, 36 68"
                    stroke={isDark ? '#10B981' : '#059669'}
                    strokeWidth="2.2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                  <polygon points="30,64 36,68 30,72" fill={isDark ? '#10B981' : '#059669'} />
                </svg>
              </div>

              {/* NODE 3: Branching AI Dynamic Generators */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {/* AI Chat Card 1: Gemini Flash Bilingual */}
                <div
                  style={{
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                    border: isDark ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(168, 85, 247, 0.25)',
                    borderRadius: '0.875rem',
                    padding: '0.85rem 1rem',
                    backdropFilter: 'blur(12px)',
                    boxShadow: isDark
                      ? '0 8px 24px -4px rgba(168, 85, 247, 0.28), 0 0 0 1px rgba(168, 85, 247, 0.2)'
                      : '0 8px 20px -4px rgba(168, 85, 247, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <HiSparkles style={{ fontSize: '13px', color: '#A78BFA' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Gemini Flash • Bilingual Copywriter
                      </span>
                    </div>
                    <span style={{ fontSize: '0.625rem', color: '#A78BFA', fontWeight: 600 }}>Active Node</span>
                  </div>

                  {/* Chat speech bubble */}
                  <div
                    style={{
                      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.06)',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      borderRadius: '0.5rem',
                      padding: '7px 9px',
                      fontSize: '0.6875rem',
                      color: 'var(--text-primary)',
                      lineHeight: '1.4',
                    }}
                  >
                    🏢 <strong>Regent Home Bangna</strong>: Modern 2-Bedroom Condo with Sky Pool. BTS Bangna 5 mins. Line ID: @bolthaven
                  </div>
                </div>

                {/* AI Chat Card 2: GPT-4o Viral Hook Script */}
                <div
                  style={{
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                    border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '0.875rem',
                    padding: '0.85rem 1rem',
                    backdropFilter: 'blur(12px)',
                    boxShadow: isDark
                      ? '0 8px 24px -4px rgba(16, 185, 129, 0.28), 0 0 0 1px rgba(16, 185, 129, 0.2)'
                      : '0 8px 20px -4px rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiZap style={{ fontSize: '13px', color: '#10B981' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        GPT-4o • TikTok Viral Video Script
                      </span>
                    </div>
                    <span style={{ fontSize: '0.625rem', color: '#10B981', fontWeight: 600 }}>Active Node</span>
                  </div>

                  {/* Chat speech bubble */}
                  <div
                    style={{
                      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.06)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: '0.5rem',
                      padding: '7px 9px',
                      fontSize: '0.6875rem',
                      color: 'var(--text-primary)',
                      lineHeight: '1.4',
                    }}
                  >
                    🎬 <em>"Stop scrolling! This Bangna condo has an infinity pool overlooking the city skyline for under ฿15k..."</em>
                  </div>
                </div>
              </div>

              {/* CONNECTOR 3 -> 4 (Merging) */}
              <div style={{ width: '100%', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="36" height="90" viewBox="0 0 36 90" fill="none">
                  {/* Top branch merging */}
                  <path
                    d="M 0 22 C 18 22, 18 45, 36 45"
                    stroke={isDark ? '#A78BFA' : '#8B5CF6'}
                    strokeWidth="2.2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                  {/* Bottom branch merging */}
                  <path
                    d="M 0 68 C 18 68, 18 45, 36 45"
                    stroke={isDark ? '#10B981' : '#059669'}
                    strokeWidth="2.2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                  <polygon points="30,41 36,45 30,49" fill={isDark ? '#10B981' : '#059669'} />
                </svg>
              </div>

              {/* NODE 4: Destination (Property Inbox) */}
              <div
                style={{
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                  border: isDark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '0.875rem',
                  padding: '1.15rem',
                  backdropFilter: 'blur(12px)',
                  boxShadow: isDark
                    ? '0 10px 25px -4px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.2)'
                    : '0 10px 25px -4px rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(16, 185, 129, 0.18)',
                      color: '#10B981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.15rem',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      flexShrink: 0,
                    }}
                  >
                    <FiCheckCircle />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Property Inbox
                    </h4>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Ready Destination
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                    borderRadius: '0.5rem',
                    padding: '7px 9px',
                    fontSize: '0.6875rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4',
                  }}
                >
                  Auto-formatted listings appear directly in Property Inbox for 1-click publishing.
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Badge variant="success" size="sm">
                    ✓ Auto-Sync Ready
                  </Badge>
                </div>
              </div>
            </div>
          </div>
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
